"""Phase 4 viewport acceptance against real engine-generated HTML fixtures."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess,shutil,time,json,re
root=Path(__file__).resolve().parents[1]
subprocess.run(['node','scripts/ui-phase8-fixtures.js'],cwd=root,check=True,stdout=subprocess.DEVNULL)
css='\n'.join((root/'public'/path).read_text() for path in ['styles.css','shell.css','tabletop/tokens.css','tabletop/layout.css','tabletop/solo.css','tabletop/expansions.css','tabletop/coop.css','tabletop/interactions.css','tabletop/dialogs.css','game-shell.css','theme.css','tabletop/responsive.css'])
fit_js=(root/'public/tabletop/fit.js').read_text().replace('export function','function')+'\nwindow.fitTabletop = fitTabletop;' 
checks=[];shots=root/'docs/ui-phase4-refinement';shots.mkdir(parents=True,exist_ok=True)
viewports=[(320,568),(390,844),(568,320),(844,390),(768,1024),(1024,768),(1440,900),(1920,1080)]
fixtures=['solo-base-seat0','solo-all-seat0','coop-base-seat0','coop-all-seat0','coop-all-seat1','coop-incubus-seat0','coop-all-draft-seat0','coop-all-draft-seat1','solo-all-longlab-seat0','coop-all-longlab-seat0']
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
  for fixture in fixtures:
   for w,h in viewports:
    page.set_viewport_size({'width':w,'height':h})
    page.set_content(re.sub(r'<link[^>]*>', '', (root/f'docs/ui-phase8-baselines/{fixture}.html').read_text()).replace('</head>',f'<style>{css}</style></head>'))
    page.add_script_tag(content=fit_js)
    result=page.evaluate('''async ([w,h])=>{
      let page=document.querySelector('main.page'); page.classList.add('game-viewport');
      page.style.cssText='position:relative;display:block;overflow:hidden;height:'+h+'px;width:'+w+'px;padding:0;max-width:none';
      const table=page.querySelector('.tt2-root');
      const fitTabletop=window.fitTabletop;
      const m=table.matches('.tt6-root')?'coop':'solo';
      const fit=fitTabletop(page,table,{mode:m});
      let rect=table.getBoundingClientRect(),p=page.getBoundingClientRect();
      let rects=[...table.querySelectorAll('.tt5-zone,.tt2-zone,.tt6-player,.tt6-hand-block,.tt6-piles,.tt6-draft')].map(e=>({name:e.getAttribute('aria-label')||e.className,rect:e.getBoundingClientRect(),scroll:e.scrollWidth-e.clientWidth}));
      let invisible=rects.filter(o=>o.rect.right>p.right+1||o.rect.bottom>p.bottom+1||o.rect.left<p.left-1);
      let truncated=[...table.querySelectorAll('.tt5-zone')].filter(e=>e.scrollHeight>e.clientHeight+3||e.scrollWidth>e.clientWidth+3).length;
      let lab=[...table.querySelectorAll('[data-tabletop-scroll]')].map(el=>el.scrollWidth-el.clientWidth);
      return {zoneHeights: [...table.querySelectorAll('.tt6-opponent,.tt6-center,.tt6-self,.tt5-expansions,.tt5-zone,.tt2-doors,.tt2-labyrinth,.tt2-hand,.tt2-piles')].map(e=>[e.className,Math.round(e.getBoundingClientRect().height/fit.zoom)]),width:w,height:h,shape:fit.shape,pressure:fit.pressure,zoom:fit.zoom,tableHeight:fit.tableHeight,offscreen:invisible.map(x=>x.name),expClipped:truncated,labOverflow:lab,zoneCount:rects.length,bodyScroll:document.documentElement.scrollHeight-h};
    }''',[w,h])
    result['fixture']=fixture
    checks.append(result)
    if fixture in ('solo-all-seat0','coop-all-seat0','coop-all-longlab-seat0','coop-all-draft-seat0') and (w,h) in [(390,844),(844,390),(1440,900),(568,320)]:page.screenshot(path=str(shots/f'{fixture}-{w}x{h}.png'))
  browser.close()
finally:
 pass
(shots/'metrics.json').write_text(json.dumps(checks,indent=2))
for result in checks:
 if result['offscreen'] or result['expClipped'] or result['zoom']<.75:print('CHECK',result['fixture'],result['width'],result['height'],'zoom',round(result['zoom'],2),'pressure',result['pressure'],'off',len(result['offscreen']),'clipped',result['expClipped'],'lab',result['labOverflow'])
print('Tests',len(checks),'offscreen',sum(bool(c['offscreen']) for c in checks),'expClipped',sum(c['expClipped'] for c in checks),'lab-overflow',sum(any(x>2 for x in c['labOverflow']) for c in checks),'zoom <.75',sum(c['zoom']<.75 for c in checks))
assert all(not c['offscreen'] and not c['expClipped'] and all(x<=2 for x in c['labOverflow']) for c in checks), 'Phase 4 layout overflow detected'

"""Phase 6 reserved-action-area layout checks on actual engine-generated boards."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess,shutil,json,re
root=Path(__file__).resolve().parents[1]
subprocess.run(['node','scripts/ui-phase8-fixtures.js'],cwd=root,check=True,stdout=subprocess.DEVNULL)
css='\n'.join((root/'public'/path).read_text() for path in ['styles.css','shell.css','tabletop/tokens.css','tabletop/layout.css','tabletop/solo.css','tabletop/expansions.css','tabletop/coop.css','tabletop/interactions.css','tabletop/dialogs.css','game-shell.css','theme.css','tabletop/responsive.css','tabletop/action-dock.css'])
fit=(root/'public/tabletop/fit.js').read_text().replace('export function','function')+'\nwindow.fitTabletop=fitTabletop;'
viewports=[(320,568),(390,844),(568,320),(844,390),(768,1024),(1024,768),(1440,900),(1920,1080)]
fixtures=['solo-base-seat0','solo-all-seat0','coop-base-seat0','coop-all-seat0','coop-all-seat1','coop-all-draft-seat0','solo-all-longlab-seat0','coop-all-longlab-seat0']
shots=root/'docs/ui-phase6-refinement';shots.mkdir(parents=True,exist_ok=True)
checks=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844})
 for fixture in fixtures:
  filename=root/f'docs/ui-phase8-baselines/{fixture}.html'
  if not filename.exists():continue
  html=filename.read_text()
  for w,h in viewports:
   page.set_viewport_size({'width':w,'height':h})
   html2=re.sub(r'<link[^>]*>','',html)
   html2=html2.replace('<body>','<body><div id="app">').replace('</body>','</div></body>')
   html2=html2.replace('<main class="page">','<main class="page game-viewport"><div class="tt6-table-slot">').replace('</main>', '''</div><section class="tt6-workspace" data-action-dock><div class="tt6-dock-status"><strong>Choose one card to discard</strong><span class="tt6-dock-subtitle">Leftmost card will be drawn first.</span></div><div class="tt6-dock-scroll"><div class="tt6-dock-decision"><section class="decision"><div class="cards tt3-order-list">'''+''.join('<div class="tt3-order-item"><div class="tt3-order-handle"><span class="card">Card</span></div><button>Discard</button></div>' for _ in range(5))+'''</div><button>Confirm Prophecy</button></section></div></div></section></main>''')
   page.set_content(html2.replace('</head>',f'<style>{css}</style></head>'))
   page.add_script_tag(content=fit)
   result=page.evaluate('''()=>{const table=document.querySelector('.tt2-root'),slot=document.querySelector('.tt6-table-slot'),dock=document.querySelector('[data-action-dock]');
    const fit=window.fitTabletop(slot,table,{mode:table.matches('.tt6-root')?'coop':'solo'});const bounds=slot.getBoundingClientRect();
    const zones=[...table.querySelectorAll('.tt2-zone,.tt6-player,.tt6-hand-block,.tt6-piles,.tt6-draft,.tt5-zone')];
    return {slot:{width:Math.round(bounds.width),height:Math.round(bounds.height)},dock:{width:Math.round(dock.getBoundingClientRect().width),height:Math.round(dock.getBoundingClientRect().height),scrollHeight:dock.querySelector('.tt6-dock-scroll').scrollHeight},zoom:fit.zoom,zoneOffscreen:zones.filter(z=>{let r=z.getBoundingClientRect();return r.bottom>bounds.bottom+2||r.right>bounds.right+2||r.left<bounds.left-2}).length,viewportHeight:innerHeight,appHeight:document.querySelector('#app').getBoundingClientRect().height,pageTop:document.querySelector('.game-viewport').getBoundingClientRect().top,pageHeight:document.querySelector('.game-viewport').getBoundingClientRect().height,slotTop:bounds.top,dockTop:dock.getBoundingClientRect().top,documentScroll:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,slotOutsideViewport:bounds.bottom>innerHeight+1,dockOutsideViewport:dock.getBoundingClientRect().bottom>innerHeight+1,slotScroll:slot.scrollHeight>slot.clientHeight+3};}''')
   result.update({'fixture':fixture,'viewport':f'{w}x{h}'})
   checks.append(result)
   if fixture in ('coop-all-seat0','solo-all-seat0','coop-all-draft-seat0') and (w,h) in [(390,844),(844,390),(568,320),(1440,900)]:page.screenshot(path=str(shots/f'{fixture}-{w}x{h}.png'))
 browser.close()
(shots/'measurements.json').write_text(json.dumps(checks,indent=2))
print('Checks:',len(checks),'offscreen:',sum(c['zoneOffscreen']>0 for c in checks),'document scroll:',sum(c['documentScroll'] for c in checks),'min zoom:',round(min(c['zoom'] for c in checks),2),'bad slot:',sum(c['slotOutsideViewport'] for c in checks),'bad dock:',sum(c['dockOutsideViewport'] for c in checks))
for c in checks:
 if c['zoneOffscreen'] or c['documentScroll']:print('ISSUE',c['fixture'],c['viewport'],c['slot'],c['zoom'],c['zoneOffscreen'],c['documentScroll'])
assert all(not c['documentScroll'] and c['zoneOffscreen']==0 and not c['slotOutsideViewport'] and not c['dockOutsideViewport'] for c in checks)

from pathlib import Path
from playwright.sync_api import sync_playwright
import shutil,json,re
root=Path(__file__).resolve().parents[1]
import tempfile,subprocess
out=Path(tempfile.mkdtemp(prefix='onirama-phase3-visual-'))
subprocess.run(['node','scripts/ui-phase7-fixtures.js'],cwd=root,check=True,stdout=subprocess.DEVNULL)
subprocess.run(['node','scripts/ui-phase8-fixtures.js'],cwd=root,check=True,stdout=subprocess.DEVNULL)
fixtures={
 'home':root/'docs/ui-phase7-baselines/home.html',
 'setup':root/'docs/ui-phase7-baselines/setup.html',
 'settings':root/'docs/ui-phase7-baselines/settings.html',
 'multiplayer':root/'docs/ui-phase7-baselines/multiplayer.html',
 'game-solo':root/'docs/ui-phase8-baselines/solo-all-seat0.html',
 'game-coop':root/'docs/ui-phase8-baselines/coop-all-seat0.html'
}
css="\n".join((root/"public"/name).read_text() for name in ["styles.css","shell.css","tabletop/tokens.css","tabletop/layout.css","tabletop/solo.css","tabletop/expansions.css","tabletop/coop.css","tabletop/interactions.css","tabletop/dialogs.css","game-shell.css","theme.css"])
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 for name,path in fixtures.items():
  page=browser.new_page(viewport={'width':1440,'height':900})
  for theme in ['forest','moonlit','copper','lagoon','heather','sandstone']:
   for w,h in [(390,844),(844,390),(1440,900)]:
    page.set_viewport_size({'width':w,'height':h})
    page.set_content(re.sub(r'<link[^>]*>', '', path.read_text()).replace('</head>',f'<style>{css}</style></head>'),wait_until='load')
    page.evaluate('(theme) => document.documentElement.dataset.theme = theme',theme)
    if name.startswith('game'):
     page.evaluate('''() => { let m=document.querySelector('main.page');if(!m)return;let app=document.createElement('div');app.id='app';m.parentNode.insertBefore(app,m);app.appendChild(m);m.classList.add('game-viewport');let t=m.querySelector('.tt2-root');if(t){t.style.zoom='1';let available=m.clientHeight;if(t.getBoundingClientRect().height>available){let low=.2,high=1,best=.2;for(let i=0;i<9;i++){let z=(low+high)/2;t.style.zoom=z;if(t.getBoundingClientRect().height<=available-2){best=z;low=z;}else high=z;}t.style.zoom=best;}} }''')
    values=page.evaluate('''() => {const cs=getComputedStyle(document.documentElement),b=document.querySelector('.tt2-root'),a=document.querySelector('.shell-card'),svg=document.querySelector('.ui-icon'),root=document.documentElement;return {theme:root.dataset.theme,panel:cs.getPropertyValue('--ui-panel').trim(),felt:cs.getPropertyValue('--table-felt-light').trim(),svgCount:document.querySelectorAll('svg.ui-icon').length,game:!!b,outerOverflow:root.scrollHeight>innerHeight+1||root.scrollWidth>innerWidth+1,bodyColor:getComputedStyle(a||b||document.body).backgroundColor};}''')
    values.update(name=name,viewport=f'{w}x{h}');results.append(values)
    if (name,theme,w,h) in {('home','forest',1440,900),('home','moonlit',1440,900),('home','forest',390,844),('settings','forest',390,844),('game-solo','forest',390,844),('game-coop','moonlit',1440,900),('game-coop','forest',390,844),('setup','copper',844,390)}:
     page.screenshot(path=str(out/f'{name}-{theme}-{w}x{h}.png'))
  page.close()
 browser.close()
(out/'measurements.json').write_text(json.dumps(results,indent=2))
print('checked',len(results),'theme x screen x viewport renders')
for item in results[:8]:print(item)
print('svg-failures',len([x for x in results if not x['svgCount']]))
print('overflow',len([x for x in results if x['outerOverflow']]))


assert len(results)==108
assert all(r['svgCount']>0 and not r['outerOverflow'] for r in results), 'Theme/layout smoke failure'
assert len({r['felt'] for r in results if r['name']=='game-solo' and r['viewport']=='1440x900'})==6
print('Theme screenshots and measurements:',out)

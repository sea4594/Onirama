"""Offline Phase 2 viewport smoke: actual route/card renderers, no Firebase simulation.
Requires optional Python Playwright and system Chromium. Outputs screenshots to /tmp.
"""
import json, re, shutil, subprocess, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(tempfile.mkdtemp(prefix='onirama-phase2-'))
CSS_FILES=['styles.css','shell.css','tabletop/tokens.css','tabletop/layout.css','tabletop/solo.css','tabletop/expansions.css','tabletop/coop.css','tabletop/interactions.css','tabletop/dialogs.css','game-shell.css']
CSS='\n'.join((ROOT/'public'/file).read_text() for file in CSS_FILES)
VIEWPORTS=[(320,568),(568,320),(390,844),(844,390),(768,1024),(1024,768),(1440,900),(1920,1080)]
subprocess.run(['node','scripts/ui-phase7-fixtures.js'],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
subprocess.run(['node','scripts/ui-phase8-fixtures.js'],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
files=[('route:'+p.stem,p) for p in sorted((ROOT/'docs/ui-phase7-baselines').glob('*.html'))]
files += [('game:'+p.stem,p) for p in sorted((ROOT/'docs/ui-phase8-baselines').glob('*.html'))]
overlays=json.loads(subprocess.check_output(['node','--input-type=module','-e',
  "import {renderOverlay} from './public/game-overlay.js'; console.log(JSON.stringify({pause:renderOverlay('pause',[],false,{motion:'reduced'}),rules:renderOverlay('rules',['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'],true)}))"],cwd=ROOT,text=True))
fit='''() => {const viewport=document.querySelector('.game-viewport'),table=viewport?.querySelector('.tt2-root');if(!table)return 1;table.style.zoom='1';const available=viewport.clientHeight;if(table.getBoundingClientRect().height<=available)return 1;let low=.2,high=1,best=.2;for(let i=0;i<8;i++){const candidate=(low+high)/2;table.style.zoom=String(candidate);if(table.getBoundingClientRect().height<=available-2){best=candidate;low=candidate;}else high=candidate;}table.style.zoom=String(best);return best;}'''
measure='''() => {const root=document.documentElement,board=document.querySelector('.tt2-root'),window=document.querySelector('.shell-viewport-window'),menu=document.querySelector('.game-menu-dialog');const bounds=el=>el?.getBoundingClientRect();const b=bounds(board),m=bounds(menu);return {documentOverflowY:root.scrollHeight>innerHeight+1,documentOverflowX:root.scrollWidth>innerWidth+1,tabletopBottom:b?.bottom||null,menuWithinViewport:!m||(m.top>=0&&m.bottom<=innerHeight+1&&m.left>=0&&m.right<=innerWidth+1),scrollWindow:!!window,screenHeight:innerHeight};}'''
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium') or shutil.which('chromium-browser'),args=['--no-sandbox','--disable-dev-shm-usage'])
 for name,path in files:
  src=re.sub(r'<link[^>]*>','',path.read_text()).replace('</head>',f'<style>{CSS}</style></head>')
  if name.startswith('game:'):
   src=src.replace('<main class="page">','<div id="app"><main class="page game-viewport">').replace('</main>','</main></div>')
  page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
  page.set_content(src,wait_until='domcontentloaded')
  for w,h in VIEWPORTS:
   page.set_viewport_size({'width':w,'height':h})
   if name.startswith('game:'):page.evaluate(fit)
   measurement=page.evaluate(measure);results.append({'fixture':name,'viewport':f'{w}x{h}',**measurement})
   if (name,w,h) in {('route:setup',568,320),('route:home',1440,900),('game:coop-all-seat0',390,844),('game:coop-all-seat0',844,390),('game:solo-all-seat0',390,844),('game:dialog-nightmare',568,320)}:
    page.screenshot(path=str(OUT/f'{name.replace(":","-")}-{w}x{h}.png'))
  page.close()
 # Explicit overlay fixtures: body chrome remains on the live tabletop in actual app.
 board=(ROOT/'docs/ui-phase8-baselines/solo-all-seat0.html').read_text()
 board=re.search(r'<main class="page">(.*)</main>',board,re.S).group(1)
 for kind in ['pause','rules']:
  src=f'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{CSS}</style></head><body><div id="app"><main class="page game-viewport">{board}</main>{overlays[kind]}</div></body></html>'
  page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
  page.set_content(src)
  for w,h in [(320,568),(568,320),(390,844),(844,390),(768,1024),(1440,900)]:
   page.set_viewport_size({'width':w,'height':h});page.evaluate(fit)
   result=page.evaluate(measure);results.append({'fixture':'overlay:'+kind,'viewport':f'{w}x{h}',**result})
   if (kind,w,h) in [('pause',390,844),('rules',844,390),('rules',390,844)]:
    page.screenshot(path=str(OUT/f'overlay-{kind}-{w}x{h}.png'))
  page.close()
 browser.close()
(OUT/'measurements.json').write_text(json.dumps(results,indent=2)+'\n')
fail=[r for r in results if r['documentOverflowY'] or r['documentOverflowX'] or not r['menuWithinViewport'] or (r['tabletopBottom'] is not None and r['tabletopBottom']>r['screenHeight']+1)]
print(f'Checked {len(results)} rendered viewports; {len(fail)} outer-scroll, cutoff, or popup-bound failures. Screenshots: {OUT}')
for row in fail[:8]:print('FAIL',row)
if fail:raise SystemExit(1)

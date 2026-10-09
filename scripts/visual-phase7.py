from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
shots=root/'docs/ui-phase7-baselines'
styles='\n'.join((root/'public'/p).read_text() for p in ['styles.css','shell.css','tabletop/tokens.css','tabletop/layout.css','tabletop/solo.css','tabletop/expansions.css','tabletop/coop.css','tabletop/interactions.css','tabletop/dialogs.css'])
sizes=[(320,568),(390,844),(568,320),(844,390),(768,1024),(1024,768),(1440,900),(1920,1080)]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 errors=[]
 for route in ['home','multiplayer','setup','settings','history','tutorial','join','lobby','rules']:
  raw=(shots/f'{route}.html').read_text()
  content=re.sub(r'<link[^>]*>', '',raw).replace('</head>','<style>'+styles+'</style></head>')
  for w,h in sizes:
   page=b.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
   page.set_content(content,wait_until='domcontentloaded')
   v=page.evaluate('''() => ({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth, controls:[...document.querySelectorAll('button,input,select')].filter(x => x.getBoundingClientRect().width<=0).length, title:document.querySelector('h1')?.textContent})''')
   if v['overflow']>1 or v['controls']>0:errors.append((route,w,h,v))
   if (w,h) in [(320,568),(390,844),(844,390),(1440,900)]:page.screenshot(path=str(shots/f'{route}-{w}x{h}.png'),full_page=True)
   print(route,f'{w}x{h}',v['overflow'],v['controls'])
   page.close()
 b.close()
 print('ISSUES',errors)
 if errors:raise SystemExit(1)

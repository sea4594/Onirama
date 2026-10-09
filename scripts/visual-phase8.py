"""Local Chromium QA of generated, real-renderer board/dialog fixtures.
No Firebase credentials or cloud service required. Screenshots are saved selectively.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys,re
root=Path(__file__).resolve().parents[1]
fixtures=root/'docs/ui-phase8-baselines'
sizes=[(320,568),(390,844),(568,320),(844,390),(768,1024),(1024,768),(1440,900),(1920,1080)]
filenames=sorted(fixtures.glob('*.html'))
styles=['styles.css','shell.css','tabletop/tokens.css','tabletop/layout.css','tabletop/solo.css','tabletop/expansions.css','tabletop/coop.css','tabletop/interactions.css','tabletop/dialogs.css']
css='\n'.join((root/'public'/s).read_text() for s in styles)
issues=[];results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for path in filenames:
  for w,h in sizes:
   page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
   page.set_content(re.sub(r'<link[^>]*>', '',path.read_text()).replace('</head>','<style>'+css+'</style></head>'),wait_until='domcontentloaded')
   actual=page.evaluate('''() => {
     const b=document.querySelector('.tt2-root'),dlg=document.querySelector('.tt4-dialog');
     const r=b?.getBoundingClientRect(), d=dlg?.getBoundingClientRect();
     const regions=[...document.querySelectorAll('.tt2-doors,.tt2-labyrinth,.tt2-piles,.tt2-hand,.tt6-opponent,.tt6-self,.tt6-center,.tt5-zone')];
     const tooSmall=[...document.querySelectorAll('button:not([disabled])')].filter(el=>{let r=el.getBoundingClientRect();return r.width<14||r.height<14}).map(e=>e.getAttribute('aria-label')||e.title||e.textContent.trim());
     const nestedOverflow=[...document.querySelectorAll('.tt2-door-group,.tt2-door-stack > *,.tt2-pile,.tt6-door-color,.tt6-door-cards > *')].filter(el=>{const zone=el.closest('.tt2-zone,.tt6-player,.tt6-piles'),child=el.getBoundingClientRect(),z=zone?.getBoundingClientRect();return z && (child.right>z.right+1 || child.left<z.left-1)}).map(el=>el.className);
     const clipped=regions.filter(e=>{const z=e.getBoundingClientRect();return z.width<15||z.height<15}).map(e=>e.className);
     return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),boardWidth:r?.width,regions:regions.length,clipped,nestedOverflow,tooSmall,dialog:!!d,dialogOffscreen:d?d.left<-1||d.top<-1||d.right>innerWidth+1||d.bottom>innerHeight+1:false,dialogScroll:d?document.querySelector('.tt4-content').scrollHeight-document.querySelector('.tt4-content').clientHeight:0,boardScrollHeight:document.body.scrollHeight};
   }''')
   results.append({'fixture':path.stem,'size':f'{w}x{h}',**actual})
   if actual['overflow']>1 or actual['clipped'] or actual['nestedOverflow'] or actual['tooSmall'] or actual['dialogOffscreen'] or not actual['regions']:issues.append(results[-1])
   if (w,h) in [(320,568),(390,844),(568,320),(1440,900)] and path.stem in ('solo-all-seat0','coop-all-seat0','solo-hard-seat0','dialog-prophecy','dialog-nightmare'):
    page.screenshot(path=str(fixtures/f'{path.stem}-{w}x{h}.png'),full_page=not path.stem.startswith('dialog'))
   page.close()
 browser.close()
(fixtures/'qa-results.json').write_text(json.dumps({'cases':len(results),'issues':issues},indent=2))
print('CASES',len(results),'ISSUES',len(issues))
for issue in issues[:35]:print(json.dumps(issue))
if issues:sys.exit(1)

"""Browser interaction smoke checks for physical card inspection and gap reordering."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import shutil, json, re
ROOT=Path(__file__).resolve().parents[1]
css='\n'.join((ROOT/'public'/p).read_text() for p in ['styles.css','shell.css','tabletop/tokens.css','tabletop/layout.css','tabletop/solo.css','tabletop/expansions.css','tabletop/coop.css','tabletop/interactions.css','tabletop/dialogs.css','game-shell.css','theme.css','tabletop/responsive.css'])
source='\n'.join(re.sub(r'(?m)^export ', '', (ROOT/'public'/p).read_text().replace("import {cardSymbol} from '../icons.js';", '').replace("import {htmlEscape,cardDescription} from './cards.js';", '')) for p in ['tabletop/cards.js','tabletop/card-inspection.js','tabletop/interactions.js'])+"\nwindow.createCardInspector=createCardInspector;window.createDecisionReorder=createDecisionReorder;"

results=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
  for viewport in [(390,844),(844,390),(1440,900)]:
   context=browser.new_context(viewport={'width':viewport[0],'height':viewport[1]},has_touch=True,device_scale_factor=1)
   page=context.new_page()
   page.set_default_timeout(4000)
   fixture=(ROOT/'docs/ui-phase8-baselines/solo-all-seat0.html').read_text()
   fixture=re.sub(r'<link[^>]*>', '', fixture).replace('</head>',f'<style>{css}</style></head>')
   page.set_content(fixture)
   page.add_script_tag(content=source)
   page.evaluate('''async()=>{
     window.inspector=createCardInspector({root:document.body});
     const cards=[...document.querySelectorAll('[data-tt-card-info]')].slice(0,4).map(el=>el.outerHTML);
     const demo=document.createElement('section'); demo.id='test-order';demo.style.cssText='position:fixed;z-index:400;top:12px;left:10px;right:10px;max-height:160px;overflow:hidden;background:#213d31;padding:8px;border-radius:10px;';
     demo.innerHTML='<div class="cards tt3-order-list" data-tt-order-group="effect">'+cards.map((html,i)=>'<div class="stack tt3-order-item" data-tt-order-id="r'+i+'"><div class="tt3-order-handle" role="button" tabindex="0" data-tt-order-handle="r'+i+'">'+html+'</div></div>').join('')+'<button class="tt5-order-end" data-tt-order-end="effect" aria-label="Move to end"></button></div>';
     document.body.appendChild(demo);window.actions=[];
     window.reorder=createDecisionReorder({root:document.body,canReorder:()=>true,onReorder:(kind,from,gap)=>window.actions.push({kind,from,gap})});
    }''')
   a=page.locator('#test-order [data-tt-order-handle]').nth(0);b=page.locator('#test-order [data-tt-order-handle]').nth(2)
   ra=a.bounding_box();rb=b.bounding_box()
   page.mouse.move(ra['x']+ra['width']/2,ra['y']+ra['height']/2);page.mouse.down();page.mouse.move(rb['x']+5,rb['y']+rb['height']/2,steps=10)
   assert page.locator('#test-order .tt5-insert-before').count()==1, f'insertion line absent {viewport}'
   page.mouse.up();events=page.evaluate('window.actions');assert events and events[-1]['from']=='r0' and events[-1]['gap']==2,events
   a.click();b.click();events=page.evaluate('window.actions');assert events[-1]['from']=='r0' and events[-1]['gap']==2,events
   a.click();page.locator('#test-order [data-tt-order-end]').click(force=True)
   events=page.evaluate('window.actions');assert events[-1]['gap']==4,events
   # Right-click should explain the visible card, even inside a decision surface.
   a.click(button='right');assert page.locator('.tt5-inspection').count()==1
   assert page.locator('.tt5-inspection p').inner_text()
   rect=page.locator('.tt5-inspection').bounding_box();assert 0<=rect['x'] and rect['x']+rect['width']<=viewport[0]+1,rect
   page.keyboard.press('Escape');assert page.locator('.tt5-inspection').count()==0
   # Touch long press should show info, not invoke a reordering command.
   count=len(page.evaluate('window.actions'))
   ra=a.bounding_box()
   page.dispatch_event('#test-order [data-tt-order-handle]', 'pointerdown', {'pointerId':77,'pointerType':'touch','button':0,'clientX':ra['x']+15,'clientY':ra['y']+15})
   page.wait_for_timeout(560)
   assert page.locator('.tt5-inspection').count()==1,'Long hold inspection missing'
   page.dispatch_event('#test-order [data-tt-order-handle]', 'pointerup', {'pointerId':77,'pointerType':'touch','button':0,'clientX':ra['x']+15,'clientY':ra['y']+15})
   page.dispatch_event('#test-order [data-tt-order-handle]', 'click', {})
   assert len(page.evaluate('window.actions'))==count,'Inspection invoked reorder'
   assert page.locator('#test-order .tt5-order-selected').count()==0,'Hold selected a reorder card'
   page.screenshot(path=str(ROOT/f'docs/ui-phase5-interactions-{viewport[0]}x{viewport[1]}.png'))
   results.append({'viewport':f'{viewport[0]}x{viewport[1]}','drag':True,'tap':True,'endGap':True,'rightClick':True,'longPress':True})
   context.close()
  browser.close()
finally:pass
print(json.dumps(results,indent=2))

"""Browser exercises the shipped pointer/tap/keyboard controller on rendered views."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re,json,sys
root=Path(__file__).resolve().parents[1];fixtures=root/'docs/ui-phase8-baselines'
styles=['styles.css','shell.css','tabletop/tokens.css','tabletop/layout.css','tabletop/solo.css','tabletop/expansions.css','tabletop/coop.css','tabletop/interactions.css','tabletop/dialogs.css']
css='\n'.join((root/'public'/s).read_text() for s in styles)
source=(root/'public/tabletop/interactions.js').read_text().replace('export ', '')
fail=[];steps=0
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for name in ['solo-base-seat0','solo-all-seat0','coop-base-seat0','coop-base-seat1','coop-hard-seat0']:
  for w,h in [(320,568),(390,844),(844,390),(1440,900)]:
   page=browser.new_page(viewport={'width':w,'height':h})
   page.set_content(re.sub(r'<link[^>]*>','',(fixtures/f'{name}.html').read_text()).replace('</head>','<style>'+css+'</style></head>'))
   page.evaluate('''(src)=>{
      const source=JSON.parse(document.getElementById('qa-state').textContent);
      window.game=source.state;window.seat=source.seat;
      // Evaluate the unmodified controller bodies (only remove ESM export tokens).
      const factory=new Function(src+';return {createTabletopInteractions,tabletopLegalTargets}');
      const code=factory();window.legal=code.tabletopLegalTargets;
      window.commands=[];window.choices=[];
      const root=document.body,board=document.querySelector('.tt2-root,.tt6-root');
      const controller=code.createTabletopInteractions({root,getGame:()=>window.game,getSeat:()=>window.seat,onSelect:id=>{board.dataset.selectedCard=board.dataset.selectedCard===id?'':id;window.choices.push(id);controller.syncTargets();},onCommand:(type,id)=>window.commands.push({type,id})});
      root.addEventListener('click',e=>{const card=e.target.closest('[data-tt-card]');if(card){board.dataset.selectedCard=board.dataset.selectedCard===card.dataset.ttCard?'':card.dataset.ttCard;window.choices.push(card.dataset.ttCard);controller.syncTargets();}});
      window.controller=controller;
      controller.syncTargets();
    }''',source)
   eligible=page.evaluate('''()=>[...document.querySelectorAll('[data-tt-card]')].map(el=>({id:el.dataset.ttCard,legal:window.legal(window.game,el.dataset.ttCard,window.seat)})).filter(a=>a.legal.includes('discard'))''')
   if not eligible:
    if name=='coop-base-seat1':
     # Opposing seat cannot act out of turn; this is expected, not a failure.
     if page.locator('[data-tt-card]').count():fail.append((name,w,h,'inactive seat exposed selectable cards'))
     steps+=1
    else:fail.append((name,w,h,'no legal hand card'))
    page.close();continue
   card=eligible[0];selector=f'[data-tt-card="{card["id"]}"]'
   try:
    page.locator(selector).first.click(force=True)
    ready=page.locator('[data-tt-drop="discard"].tt3-target-ready').count()>0
    if not ready:fail.append((name,w,h,'selection did not highlight discard'))
    page.locator('[data-tt-drop="discard"]').first.click(force=True)
    cmd=page.evaluate('window.commands')
    if not cmd or cmd[-1]!={'type':'discard','id':card['id']}:fail.append((name,w,h,'tap discard failed',cmd))
    steps+=1
    page.evaluate('''()=>{window.commands=[];window.controller.syncTargets();}''')
    # Test drag from a legal personal/shared card to discard, with real pointer positions.
    bb=page.locator(selector).first.bounding_box();target=page.locator('[data-tt-drop="discard"]').first.bounding_box()
    sx=bb['x']+bb['width']/2;sy=bb['y']+bb['height']/2;tx=target['x']+target['width']/2;ty=target['y']+target['height']/2
    page.mouse.move(sx,sy);page.mouse.down();page.mouse.move((sx+tx)/2,(sy+ty)/2,steps=5);page.mouse.move(tx,ty,steps=5);page.mouse.up()
    cmd=page.evaluate('window.commands')
    if not cmd or cmd[-1]!={'type':'discard','id':card['id']}:fail.append((name,w,h,'drag discard failed',cmd))
    steps+=1
    # Busy/pending blocks a normally legal gesture.
    page.evaluate('''()=>{window.commands=[];window.game.phase='decision';window.controller.syncTargets();}''')
    page.locator('[data-tt-drop="discard"]').first.click(force=True)
    if page.evaluate('window.commands'):fail.append((name,w,h,'pending decision allowed command'))
    steps+=1
   except Exception as e:fail.append((name,w,h,'exception',str(e)[:200]))
   page.close()
 browser.close()
print('INTERACTION CASES',steps,'FAILURES',len(fail))
for f in fail:print(f)
if fail:sys.exit(1)

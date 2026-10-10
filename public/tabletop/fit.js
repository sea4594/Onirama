/* Responsive allocation for the live tabletop, independent of game rules.
   First choose an arrangement, then reduce panel pressure only if required.
   Zoom is an extreme-viewport fallback, never the primary layout mechanism. */
const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
export function tabletopShape(width,height){
  if(width>=1150&&height>=540)return 'wide';
  if(width>height&&height<540)return 'short';
  if(width>=680)return 'medium';
  return 'portrait';
}
export function tabletopDimensions(width,height,mode='solo',zoneCount=0){
  const shape=tabletopShape(width,height),coop=mode==='coop';
  const card=shape==='wide'?clamp(width*.057,68,91):shape==='medium'?clamp(width*.07,55,79):shape==='short'?clamp(Math.min(width*.069,height*.145),34,64):clamp(width*(coop?.125:.172),40,75);
  const mini=shape==='wide'?clamp(width*.036,41,57):shape==='medium'?clamp(width*.047,34,49):shape==='short'?clamp(Math.min(width*.044,height*.092),25,39):clamp(width*(coop?.078:.089),25,43);
  const columns=Math.max(1,Math.min(zoneCount,shape==='portrait'?2:shape==='wide'?4:3));
  return {shape,card:Math.round(card),mini:Math.round(mini),columns};
}
function reflowLabyrinths(table){
  for(const row of table.querySelectorAll('[data-tabletop-scroll]')){
    const cards=[...row.children].filter(c=>c.matches('.card.tiny'));
    if(!cards.length)continue;
    const available=Math.max(0,row.clientWidth-8),cardWidth=cards[0].offsetWidth||cards[0].getBoundingClientRect().width;
    const step=cards.length<2?cardWidth:clamp((available-cardWidth)/(cards.length-1),.15,cardWidth*.7);
    const margin=Math.min(0,step-cardWidth);
    cards.forEach((card,i)=>card.style.marginRight=i===cards.length-1?'0px':`${margin}px`);
    row.scrollLeft=0;
  }
}
function fitExpansionContents(table){
 for(const zone of table.querySelectorAll('.tt5-zone')){
  // Towers occupy a dedicated Door-sized shelf; never miniaturize it as an expansion tile.
  if(zone.closest('.tt8-towers-slot'))continue;
  const inner=zone.querySelector('.tt5-contents'),head=zone.querySelector('header');if(!inner||!head)continue;
  inner.style.transform='';inner.style.left='0px';inner.style.top='0px';
  const w=Math.max(inner.scrollWidth,inner.offsetWidth),h=Math.max(inner.scrollHeight,inner.offsetHeight),
    headBottom=head.offsetTop+head.offsetHeight,
    availW=Math.max(1,zone.clientWidth-8),availH=Math.max(1,zone.clientHeight-headBottom-5),
    scale=Math.max(.1,Math.min(1,availW/Math.max(1,w),availH/Math.max(1,h)));
  inner.style.transform=`scale(${scale})`;
  inner.style.left=`${Math.max(2,(zone.clientWidth-w*scale)/2)}px`;
  inner.style.top=`${headBottom+Math.max(1,(availH-h*scale)/2)}px`;
 }
}
export function fitTabletop(viewport,table,{mode='solo',expansions=[]}={}){
  if(!viewport||!table)return null;
  const width=viewport.clientWidth,height=viewport.clientHeight;
  if(!width||!height)return null;
  const zones=table.querySelectorAll('.tt5-zone').length;
  const plan=tabletopDimensions(width,height,mode,zones);
  table.style.transform='';table.style.minHeight='0';table.style.zoom='1';table.style.left='0';table.style.width=`${width}px`;table.style.transformOrigin='top left';
  table.dataset.tt4Shape=plan.shape;
  table.dataset.tt4ExpansionCount=String(zones);
  table.style.setProperty('--tt4-exp-columns',plan.columns);
  let used='normal';
  for(const [pressure,factor] of [['normal',1],['tight',.88],['minimum',.76]]){
    used=pressure;table.dataset.tt4Pressure=pressure;
    table.style.setProperty('--tt4-card',`${Math.round(plan.card*factor)}px`);
    table.style.setProperty('--tt4-mini',`${Math.round(plan.mini*factor)}px`);
    table.style.setProperty('--tt4-exp-height',`${Math.round((plan.shape==='short'?55:plan.shape==='portrait'?66:77)*factor)}px`);
    table.style.setProperty('--tt4-gap',`${pressure==='normal'?7:pressure==='tight'?4:3}px`);
    table.style.setProperty('--tt4-panel-pad',`${pressure==='normal'?6:pressure==='tight'?4:3}px`);
    table.style.setProperty('--tt4-pad',`${pressure==='normal'?7:pressure==='tight'?4:3}px`);
    reflowLabyrinths(table);
    if(table.getBoundingClientRect().height<=height-1)break;
  }
  // Lay out at an expanded logical width when height is scarce, then
  // paint-scale *once*. Unlike CSS zoom, the columns cannot reflow after
  // fitting, so compact phones do not suddenly become microscopic.
  let scale=1;
  for(let i=0;i<14;i++){
    table.style.width=`${width/scale}px`;
    reflowLabyrinths(table);
    const natural=table.offsetHeight;
    const next=Math.min(1,Math.max(.25,(height-1)/natural));
    if(Math.abs(next-scale)<.003){scale=next;break;}
    scale=(scale+next)/2;
  }
  // The final fit is determined using the *same* width used for measurement.
  table.style.width=`${width/scale}px`;
  reflowLabyrinths(table);
  scale=Math.min(scale,(height-1)/table.offsetHeight,1);
  // Final corrected scale may require one more layout-width update.
  for(let i=0;i<3;i++){
    table.style.width=`${width/scale}px`;
    reflowLabyrinths(table);
    const corrected=Math.min(1,(height-1)/table.offsetHeight);
    if(Math.abs(corrected-scale)<.003)break;
    scale=Math.min(scale,corrected);
  }
  table.style.minHeight=`${Math.floor(height/scale)}px`;
  table.style.transform=scale<1?`scale(${scale})`:'';
  const zoom=scale;
  reflowLabyrinths(table);
  fitExpansionContents(table);
  table.dataset.tt4Fit=used;
  table.style.setProperty('--game-fit-scale',String(zoom));
  return {...plan,pressure:used,zoom,tableHeight:table.getBoundingClientRect().height,viewportHeight:height};
}

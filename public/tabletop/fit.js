/* One responsive allocation pipeline for solo and co-op. Geometry belongs to
   adaptive.css; this module chooses its layout, sizes and density using the
   actual board viewport, active zones and measured card content. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function tabletopShape(width,height){
 if(width>=1100&&height>=500)return 'wide';
 if(width>height&&height<560)return 'short';
 if(width>=675)return 'medium';
 return 'portrait';
}
export function tabletopDimensions(width,height,mode='solo',zoneCount=0){
 const shape=tabletopShape(width,height),coop=mode==='coop';
 const card=shape==='wide'?clamp(width*.065,70,105):shape==='medium'?clamp(width*.095,65,94):shape==='short'?clamp(width*.105,46,80):clamp(width/(coop?6.0:5.5),49,75);
 const mini=shape==='wide'?clamp(width*.036,43,60):shape==='medium'?clamp(width*.054,38,57):shape==='short'?clamp(width*.060,29,46):clamp(width/(coop?10.5:10.2),29,41);
 const columns=zoneCount>=7?4:zoneCount>=4?3:2;
 return {shape,card:Math.round(card),mini:Math.round(mini),columns};
}
function landscapeFitMinimum(width,height){return width>height?.2:.5;}
function overlapRows(table){
 for(const row of table.querySelectorAll('[data-tabletop-scroll]')){
  const cards=[...row.children].filter(c=>c.matches('.card.tiny'));
  if(!cards.length)continue;
  if(row.matches('.tt2-labyrinth-row,.tt6-labyrinth-cards')){
   // Fitting is presentation-only: never move the player's viewport. The
   // Labyrinth scroll controller restores its end anchor after the fit.
   cards.forEach(c=>c.style.marginRight='0px');
   continue;
  }
  const avail=Math.max(0,row.clientWidth-6),w=cards[0].offsetWidth||cards[0].getBoundingClientRect().width;
  // Keep the last card fully visible; crop less important earlier faces first.
  const step=cards.length<2?w:clamp((avail-w)/(cards.length-1),0,w*.76);
  cards.forEach((c,i)=>c.style.marginRight=i===cards.length-1?'0px':`${Math.min(0,step-w)}px`);
  row.scrollLeft=0;
 }
}
function fitTiles(table){
 for(const zone of table.querySelectorAll('.tt5-zone')){
  if(zone.closest('.tt8-towers-slot')||zone.matches('.tt5-catchers,.tt5-premonitions,.tt5-denizens'))continue;
  const inner=zone.querySelector(':scope > .tt5-contents');if(!inner)continue;
  inner.style.transform='';inner.style.left='0px';inner.style.top='18px';
  const width=Math.max(inner.scrollWidth,inner.offsetWidth),height=Math.max(inner.scrollHeight,inner.offsetHeight);
  const availableWidth=Math.max(1,zone.clientWidth-9),availableHeight=Math.max(1,zone.clientHeight-21);
  const scale=clamp(Math.min(availableWidth/Math.max(1,width),availableHeight/Math.max(1,height)),.28,1);
  inner.style.transform=scale<.995?`scale(${scale})`:'';
  inner.style.left=`${Math.max(4,(zone.clientWidth-width*scale)/2)}px`;
  inner.style.top=`${17+Math.max(1,(availableHeight-height*scale)/2)}px`;
 }
}
function assign(table,plan,{mode,width,height,zoneCount,tier,cardFactor=1}={}){
 const landscape=width>height,short=landscape&&height<560,tablet=plan.shape==='medium',layout=landscape?(short?'short':'wide'):'portrait';
 const crowded=zoneCount>=5,veryCrowded=zoneCount>=8;
 const multipliers={comfortable:1,compact:.89,dense:.79,ultra:.71};
 const pressure=multipliers[tier]||1;
 const pad=tier==='comfortable'?6:tier==='compact'?4:3;
 const gap=tier==='comfortable'?7:tier==='compact'?5:3;
 const baseCard=Math.round(plan.card*cardFactor*pressure),baseMini=Math.round(plan.mini*(.94+(cardFactor-1)*.45)*pressure);
 const card=Math.max(33,baseCard),mini=Math.max(20,baseMini);
 const catcher=Math.round((short?91:veryCrowded?100:112)*pressure+(tier==='dense'||tier==='ultra'?8:0));
 const prem=Math.round((short?84:veryCrowded?93:101)*pressure+(tier==='dense'||tier==='ultra'?6:0));
 const zone=Math.round((landscape?61:veryCrowded?67:73)*pressure+4);
 const columns=short?Math.min(4,Math.max(2,zoneCount)):plan.shape==='wide'?Math.min(5,Math.max(2,zoneCount)):tablet?Math.min(4,Math.max(2,zoneCount)):zoneCount>=6?3:2;
 table.dataset.tt15Layout=layout;table.dataset.tt15Tier=tier;table.dataset.tt4Shape=plan.shape;table.dataset.tt4Pressure=tier==='comfortable'?'normal':tier==='compact'?'tight':'minimum';
 table.style.setProperty('--tt15-card',`${card}px`);table.style.setProperty('--tt15-mini',`${mini}px`);
 table.style.setProperty('--tt15-tower',`${clamp(Math.round(mini*1.25),35,73)}px`);
 table.style.setProperty('--tt15-pad',`${pad}px`);table.style.setProperty('--tt15-gap',`${gap}px`);
 table.style.setProperty('--tt15-zone-h',`${Math.max(37,zone)}px`);
 table.style.setProperty('--tt15-catcher-h',`${Math.max(62,catcher)}px`);
 table.style.setProperty('--tt15-prem-h',`${Math.max(61,prem)}px`);
 table.style.setProperty('--tt15-landscape-shelf',`${clamp(Math.round(88*pressure),56,92)}px`);
 table.style.setProperty('--tt15-exp-cols',columns);
 table.style.setProperty('--tt4-exp-columns',columns);
 table.style.setProperty('--tt4-exp-height',`${zone}px`);
 table.style.setProperty('--tt4-card',`${card}px`);table.style.setProperty('--tt4-mini',`${mini}px`);
 return {layout,card,mini,columns};
}
// Build only occupied rows in portrait solo. Grid templates that name absent
// expansions otherwise reserve empty tracks and spread the board apart.
export function fitPortraitSoloRows(table,portrait){
 const grid=table?.querySelector?.(':scope > .tt2-grid');if(!grid)return [];
 if(!portrait){for(const key of ['grid-template-areas','grid-template-rows','align-content'])grid.style.removeProperty(key);return [];}
 const has=selector=>Boolean(grid.querySelector(selector));
 const rows=[['doors','doors']];
 if(has('.tt5-premonitions'))rows.push(['premonitions','premonitions']);
 if(has('.tt8-towers-slot'))rows.push(['towers','towers']);
 if(has('.tt5-catchers'))rows.push(['catchers','catchers']);
 if(has('.tt9-exp-secondary'))rows.push(['secondary','secondary']);
 rows.push(has('.tt9-exp-denizens')?['piles','denizens']:['piles','piles']);
 rows.push(['labyrinth','labyrinth'],['hand','hand']);
 grid.style.setProperty('grid-template-areas',rows.map(row=>`'${row.join(' ')}'`).join(' '),'important');
 grid.style.setProperty('grid-template-rows',`repeat(${rows.length},auto)`,'important');
 grid.style.setProperty('align-content','stretch','important');
 return rows;
}
export function fitTabletop(viewport,table,{mode='solo',expansions=[]}={}){
 if(!viewport||!table)return null;
 const width=viewport.clientWidth,height=viewport.clientHeight;
 if(!width||!height)return null;
 const zones=table.querySelectorAll('.tt5-expansions>.tt5-zone').length;
 const plan=tabletopDimensions(width,height,mode,zones);
 const portraitSolo=mode==='solo'&&width<=height;
 fitPortraitSoloRows(table,portraitSolo);
 table.style.width=`${width}px`;table.style.height='auto';table.style.minHeight='0';table.style.transform='';table.style.zoom='1';table.style.left='0';table.style.transformOrigin='top left';
 let choice,selected;
 // Preserve usable card widths by changing composition and per-zone pressure
 // first. Full-table downscaling is reserved for exceptionally small screens.
 for(const tier of ['comfortable','compact','dense','ultra']){
  const metrics=assign(table,plan,{mode,width,height,zoneCount:zones,tier});
  overlapRows(table);fitTiles(table);
  const actual=table.scrollHeight;
  choice={...metrics,tier,actual};
  if(actual<=height-2)break;
 }
 // If the compact arrangement fits comfortably, reinvest free room in cards
 // rather than enormous empty panels. Never grow beyond legible practical sizes.
 if(choice.actual<height-(portraitSolo?24:85)){
  let acceptedFactor=1;
  for(const factor of portraitSolo?[1.08,1.16,1.24,1.32,1.40,1.48,1.56]:[1.08,1.16,1.24]){
   const metrics=assign(table,plan,{mode,width,height,zoneCount:zones,tier:choice.tier,cardFactor:factor});
   overlapRows(table);fitTiles(table);
   const actual=table.scrollHeight;
   if(actual>height-(portraitSolo?6:20)){
    assign(table,plan,{mode,width,height,zoneCount:zones,tier:choice.tier,cardFactor:acceptedFactor});
    overlapRows(table);fitTiles(table);break;
   }
   acceptedFactor=factor;
   choice={...metrics,tier:choice.tier,actual};
  }
 }
 let zoom=1;
 if(table.scrollHeight>height){
  zoom=clamp((height-1)/table.scrollHeight,landscapeFitMinimum(width,height),1);
  if(width>height){
   // Each scale change requires a matching *layout* width. Otherwise a phone
   // landscape board visually ends before the right safe-area boundary.
   // Re-measure as the expanded width may reflow the expansion shelves.
   for(let attempt=0;attempt<8;attempt++){
    table.style.width=`${width/zoom}px`;
    overlapRows(table);fitTiles(table);
    const required=clamp((height-1)/Math.max(1,table.scrollHeight),.2,1);
    if(required>=zoom-.001)break;
    zoom=required;
   }
   table.style.width=`${width/zoom}px`;
  }else{
   table.style.width=`${width/zoom}px`;
   overlapRows(table);fitTiles(table);
   zoom=Math.min(zoom,(height-1)/table.scrollHeight);
  }
  table.style.transform=`scale(${zoom})`;
 }else{table.style.height=`${height}px`;}
 // A resized solo or co-op board must still reach the action panel.
 // Scaling can otherwise leave an intermittent gap beneath the hand.
 if(zoom<1&&table.scrollHeight<height/zoom){
  table.style.height=`${height/zoom}px`;
 }
 overlapRows(table);fitTiles(table);
 table.dataset.tt4Fit=choice.tier;table.style.setProperty('--game-fit-scale',String(zoom));
 return {...plan,...choice,zoom,tableHeight:table.getBoundingClientRect().height,viewportHeight:height};
}

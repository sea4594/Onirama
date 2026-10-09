import {zonesFor} from './zones.js';
// A pure, resize-driven blueprint. All zones remain registered, even if condensed to stacks.
const bound=(v,min,max)=>Math.max(min,Math.min(max,v));
const num=v=>Number.isFinite(v)?v:0;
export const REFERENCE_VIEWPORTS=Object.freeze([
  [320,568],[568,320],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[1920,1080]
]);
export function planTabletop({width,height,mode='solo',expansions=[]}={}){
  width=Math.max(240,num(width));height=Math.max(260,num(height));
  const zones=zonesFor({mode,expansions}),coop=mode==='coop';
  const aspect=width/height,landscape=aspect>=1.12;
  const size=width<620||height<435?'compact':width<1050?'medium':'spacious';
  const density=expansions.length+(coop?3:0);
  const layout=landscape?(density>=7?'landscape-dense':'landscape'):(density>=7?'portrait-dense':'portrait');
  const longColumn=landscape&&size==='spacious';
  const columns=longColumn?3:landscape?2:1;
  const gap=size==='compact'?6:size==='medium'?10:14;
  const areaWidth=width-(gap*(columns+1));
  const effectiveWidth=areaWidth/columns;
  // Width for a standard five-card hand. Dense layouts use overlap rather than unreadable cards.
  const widthBudget=coop?Math.min(width*0.74,effectiveWidth):Math.max(effectiveWidth,width*0.55);
  const cardWidth=Math.round(bound(widthBudget/5.5,42,size==='compact'?84:110));
  const compactWidth=Math.round(bound(cardWidth*0.61,30,60));
  const overlap=widthBudget < 5*cardWidth+4*gap;
  const regionMap={core:[],players:[],expansions:[]};
  for(const zone of zones){if(zone.startsWith('p')&&/^p[01]-/.test(zone)||zone==='shared-hand'||zone==='draft')regionMap.players.push(zone);else if(['draw','discard','limbo','game-status'].includes(zone))regionMap.core.push(zone);else regionMap.expansions.push(zone);}
  return {width,height,orientation:landscape?'landscape':'portrait',size,layout,columns,gap,cardWidth,compactWidth,overlap,density,
    zones,regions:regionMap,inspection:size==='compact'||density>=6?'tap-zoom':'optional',
    // The mobile contract: never hide a zone; collapse contents into inspectable stacks.
    stackLimit:size==='compact'?(density>=6?1:3):(density>=6?3:6)};
}
export function applyTabletopMetrics(element,options){
  if(!element)return null;
  const rect=element.getBoundingClientRect?.()||{};
  const windowWidth=typeof window==='undefined'?0:window.innerWidth;
  const windowHeight=typeof window==='undefined'?0:window.innerHeight;
  const plan=planTabletop({width:rect.width||windowWidth||390,height:windowHeight||rect.height||844,...options});
  element.dataset.tabletopLayout=plan.layout;
  element.dataset.tabletopDensity=plan.density>=7?'dense':plan.density>=3?'moderate':'light';
  element.style?.setProperty('--tabletop-gap',`${plan.gap}px`);
  element.style?.setProperty('--tabletop-card-width',`${plan.cardWidth}px`);
  element.style?.setProperty('--tabletop-compact-width',`${plan.compactWidth}px`);
  return plan;
}

// Original art-free card definitions. All physical cards receive unique instance ids.
export const COLORS = ['red','blue','green','brown'];
export const SYMBOLS = ['sun','moon','key'];
export const LOCATION_COUNTS = {
  red: { sun: 9, moon: 4, key: 3 },
  blue: { sun: 8, moon: 4, key: 3 },
  green: { sun: 7, moon: 4, key: 3 },
  brown: { sun: 6, moon: 4, key: 3 }
};
export const EXPANSIONS = [
  {id:'book', name:'The Book of Steps Lost and Found', phase:4},
  {id:'glyphs', name:'The Glyphs', phase:4},
  {id:'dreamcatchers', name:'The Dreamcatchers', phase:4},
  {id:'towers', name:'The Towers', phase:4},
  {id:'premonitions', name:'Happy Dreams and Dark Premonitions', phase:5},
  {id:'crossroads', name:'Crossroads and Dead Ends', phase:5},
  {id:'oniverse', name:'The Door to the Oniverse', phase:5},
  {id:'mirrors', name:'The Mirrors (promo)', phase:6},
  {id:'sphinx', name:'Sphinx, Diver and Confusion (promo)', phase:6},
  {id:'incubus', name:'Little Incubus', phase:6}
];
export function createDeck() {
  const cards = []; let index=0;
  const add=(kind,color=null,symbol=null)=>cards.push({id:`c${++index}`,kind,color,symbol});
  for (const color of COLORS) {
    for (const symbol of SYMBOLS) for (let n=0;n<LOCATION_COUNTS[color][symbol];n++) add('location',color,symbol);
    for(let n=0;n<2;n++) add('door',color);
  }
  for (let n=0;n<10;n++) add('nightmare');
  if (cards.length!==76) throw Error('Base deck must contain 76 cards');
  return cards;
}

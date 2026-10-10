// Seeded xorshift32 allows deterministic replays. Seed is kept on authoritative server only.
export function nextRandom(state) {
  let n=state.rng|0; n^=n<<13; n^=n>>>17; n^=n<<5;
  state.rng=n>>>0;
  return state.rng/4294967296;
}
export function shuffle(state,arr) {
  if (arr===state.deck) state.shuffleSerial=(state.shuffleSerial||0)+1;
  for(let i=arr.length-1;i>0;i--) { const j=Math.floor(nextRandom(state)*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
}

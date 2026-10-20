// Firestore accepts arrays containing maps, but rejects arrays containing arrays.
// The engine legitimately uses nested lists (for example expansion stacks and
// replay snapshots). Store ONLY nested list values in a tagged map, leaving
// normal lists and the in-memory game model untouched.
const TAG='__oniramaNestedArrayV1';
export function toFirestore(value){
 function encode(value,inArray){
  if(Array.isArray(value)){
   const items=value.map(item=>encode(item,true));
   return inArray?{[TAG]:items}:items;
  }
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encode(item,false)]));
  return value;
 }
 return encode(value,false);
}
export function fromFirestore(value){
 if(Array.isArray(value))return value.map(fromFirestore);
 if(value&&typeof value==='object'){
  const keys=Object.keys(value);
  if(keys.length===1&&keys[0]===TAG&&Array.isArray(value[TAG]))return value[TAG].map(fromFirestore);
  return Object.fromEntries(keys.map(key=>[key,fromFirestore(value[key])]));
 }
 return value;
}

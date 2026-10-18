import test from 'node:test';
import assert from 'node:assert/strict';
import {fitTabletop} from '../public/tabletop/fit.js';
function board(){
 const style={width:'',height:'',transform:'',setProperty(){}};
 const table={style,dataset:{},querySelectorAll(){return []},get scrollHeight(){return Math.max(style.height==='auto'?0:parseFloat(style.height)||0,parseFloat(style.width)>500?430:800)},getBoundingClientRect(){return {height:(parseFloat(style.height)||this.scrollHeight)*(parseFloat(style.transform.match(/scale\(([^)]+)/)?.[1])||1)}}};
 return table;
}
test('cooperative board fills the full slot after scaling and reflow, with no blank panel gap',()=>{
 const table=board(),out=fitTabletop({clientWidth:390,clientHeight:500},table,{mode:'coop'});
 assert.ok(out.zoom<1);assert.ok(Math.abs(out.tableHeight-500)<3,`Expected 500px, got ${out.tableHeight}`);
 assert.ok(parseFloat(table.style.height)>500,'Scaled-up board height must fill the entire available slot');
});
test('solo board also fills its slot after scaling instead of leaving a hand-to-panel gap',()=>{
 const table=board(),out=fitTabletop({clientWidth:390,clientHeight:500},table,{mode:'solo'});
 assert.ok(out.zoom<1);assert.ok(Math.abs(out.tableHeight-500)<3,`Expected 500px, got ${out.tableHeight}`);
});

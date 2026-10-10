import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUIDE_CHAPTERS,getGuideChapters,guideLesson,guideCardStrip,renderRulesReference,renderGuideTutorial,filterGuide} from '../public/rules-guide.js';
import {renderOverlay} from '../public/game-overlay.js';
const modules=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx','incubus'];
test('all base, cooperative, expansions and promotional chapters use a single reference',()=>{
 assert.deepEqual(GUIDE_CHAPTERS.map(c=>c.id),['base','coop','book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx','combinations','incubus']);
 assert.ok(GUIDE_CHAPTERS.reduce((n,c)=>n+c.entries.length,0)>=50);
 for(const c of GUIDE_CHAPTERS){assert.ok(c.entries.length>=2,c.id);for(const e of c.entries){assert.ok(e.title&&e.paragraphs.length&&e.paragraphs.every(p=>p.length>25),`${c.id}: ${e.title}`);assert.ok(e.cards.length>0,`${c.id}: ${e.title} missing illustration`);}}
});
test('illustrations render real existing tabletop cards without adding new artwork or sensitive state',()=>{
 const result=guideCardStrip([{kind:'door',color:'red'},{kind:'nightmare'},{kind:'location',color:'blue',symbol:'key'}],'Example');
 assert.match(result,/class="card red tiny"/);assert.match(result,/class="card nightmare tiny"/);assert.match(result,/class="card blue tiny"/);assert.match(result,/Example/);assert.doesNotMatch(result,/data-tt-motion-id/);
});
test('full reference includes all expansions, rule summaries, search, visual examples and official links',()=>{
 const html=renderRulesReference();for(const id of ['base','coop','book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx','combinations','incubus'])assert.ok(html.includes(`data-guide-chapter="${id}"`),id);
 for(const term of ['four penalties','Prophecy','Incantation','False Destruction','Dead Ends','Overload','Denizen','Rainbow','Sphinx','True Dreamwalker'])assert.ok(html.toLowerCase().includes(term.toLowerCase()),term);
 assert.match(html,/data-guide-search/);assert.match(html,/guide-figure/g);assert.match(html,/href="https:\/\//);assert.match(html,/RULES_DECISIONS_AND_AMBIGUITIES/);
});
test('in-game rules include base and enabled chapters only and exclude co-op in solo',()=>{
 const solo=getGuideChapters(['glyphs','mirrors'],false);assert.deepEqual(solo.map(x=>x.id),['base','glyphs','mirrors','combinations']);
 const coop=getGuideChapters(['book'],true);assert.deepEqual(coop.map(x=>x.id),['base','coop','book','combinations']);
 const html=renderOverlay('rules',['book','towers'],false);for(const id of ['base','book','towers','combinations'])assert.match(html,new RegExp(`data-guide-chapter="${id}"`));for(const id of ['coop','glyphs','dreamcatchers','incubus'])assert.doesNotMatch(html,new RegExp(`data-guide-chapter="${id}"`));
});
test('tutorial teaches the same content in a navigable, illustrated chapter sequence',()=>{
 for(let i=0;i<GUIDE_CHAPTERS.length;i++){
  const chapter=GUIDE_CHAPTERS[i];for(let j=0;j<chapter.entries.length;j++){
   const {step}=guideLesson(i,j);assert.equal(step,chapter.entries[j]);const html=renderGuideTutorial(i,j);
   assert.ok(html.includes('guide-figure'),`${chapter.id} ${j}`);assert.ok(html.includes(step.title.replaceAll('&','&amp;')),`${chapter.id} ${j}`);
   assert.ok(html.includes(`value="${i}" selected`));assert.ok(html.includes(`aria-valuenow="${j+1}"`));
  }
 }
 assert.match(renderGuideTutorial(0,0),/disabled/);assert.match(renderGuideTutorial(GUIDE_CHAPTERS.length-1,GUIDE_CHAPTERS.at(-1).entries.length-1),/data-action="tutorialStart"/);
});
test('text search filters only matching entries and shows an empty state for no matches',()=>{
 function element(hay){return {hidden:false,open:false,getAttribute:()=>hay};}
 const a=element('key prophecy nightmare'),b=element('door and wild crossroads'),c=element('book key spells');
 const groups=[{hidden:false,querySelectorAll:()=>[a,b]},{hidden:false,querySelectorAll:()=>[c]}];const empty={hidden:true};const root={querySelectorAll:()=>groups,querySelector:()=>empty};
 filterGuide(root,'key');assert.equal(a.hidden,false);assert.equal(b.hidden,true);assert.equal(c.hidden,false);assert.equal(empty.hidden,true);
 filterGuide(root,'no-matching-topic');assert.ok(groups.every(x=>x.hidden));assert.equal(empty.hidden,false);
 filterGuide(root,'');assert.ok(groups.every(x=>!x.hidden));assert.equal(empty.hidden,true);
});
test('reference and tutorial assets ship with Pages and app handles search and chapter navigation',()=>{
 const html=readFileSync('public/index.html','utf8'),app=readFileSync('public/app.js','utf8'),css=readFileSync('public/rules-guide.css','utf8');
 assert.match(html,/rules-guide\.css/);assert.match(app,/data-guide-search/);assert.match(app,/data-guide-jump/);assert.match(app,/data-tutorial-chapter/);assert.match(css,/guide-in-game/);assert.match(css,/@media\(max-width:600px\)/);
});

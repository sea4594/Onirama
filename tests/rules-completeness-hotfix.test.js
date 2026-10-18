import test from 'node:test';
import assert from 'node:assert/strict';
import {GUIDE_CHAPTERS,renderRulesReference,getGuideChapters,renderGuideTutorial} from '../public/rules-guide.js';
const chapters=Object.fromEntries(GUIDE_CHAPTERS.map(c=>[c.id,c]));
const body=id=>chapters[id].entries.flatMap(e=>[e.title,...e.paragraphs,...e.bullets]).join(' ').toLowerCase();
const has=(id,...terms)=>terms.forEach(s=>assert.ok(body(id).includes(s.toLowerCase()),`${id} missing ${s}`));
test('related Denizen, Mirror, Premonition, Spell and Dream effect rules are no longer fragmented',()=>{
 assert.deepEqual(chapters.oniverse.entries.map(e=>e.title),['Oniverse Door setup & rallying Denizens','All eight Denizen abilities']);
 assert.deepEqual(chapters.mirrors.entries.map(e=>e.title),['Mirror setup, pairs & victory','All nine Mirrors & their effects']);
 assert.deepEqual(chapters.premonitions.entries.map(e=>e.title),['All eight Dark Premonitions','Happy Dreams: choose one benefit']);
 assert.equal(chapters.book.entries.length,2);assert.equal(chapters.towers.entries.length,2);assert.equal(chapters.sphinx.entries.length,2);
});
test('base and cooperative rules include the necessary choices and timing',()=>{
 has('base','76 cards','58 Locations','four penalties','five cards','fourth','Limbo','nightmare','prophecy');
 has('coop','eight Locations','shared resources','personal','three','swap','each player','one Door');
});
test('all expansion-specific numbers and important caveats remain visible',()=>{
 has('book','5 cards','7','10','6','9','12','bottom five','any two Goal');
 has('glyphs','eight Glyph','four additional Doors','Incantation','top five');
 has('dreamcatchers','four Lost Dreams','Failsafe','overload','rightmost','failed deck search','without shuffling');
 has('towers','twelve Towers','3, 4 and 5','False Destruction','hard','four different colors');
 has('premonitions','four Happy Dreams','eight Dark Premonitions','seven','red','blue','green','brown','five Doors','three Doors');
 has('crossroads','six Crossroads','ten Dead Ends','Escape','second','Key');
 has('oniverse','sixteen Denizens','eight unseen','architect','cyclobot','squirrel','harpoon','hammer','chromatic','mirror','keeper');
});
test('all promo rule sets and Incubus modes remain complete',()=>{
 has('mirrors','RED:','BLUE:','GREEN:','BROWN:','KEY:','GLYPH','SUN','MOON','RAINBOW','two matching');
 has('sphinx','four Sphinx','four Diver','four Confusion','two extra Nightmare','Moon','Key','bottom','last revealed');
 has('incubus','New Dreamwalker','Apprentice Dreamwalker','True Dreamwalker','TWO Locations');
});
test('in-game rule filtering and tutorial reuse the same newly consolidated guide',()=>{
 const only=getGuideChapters(['oniverse','dreamcatchers'],false);
 assert.deepEqual(only.map(c=>c.id),['base','dreamcatchers','oniverse','combinations']);
 const ingame=renderRulesReference(['oniverse','dreamcatchers'],false,{inGame:true});
 assert.match(ingame,/All eight Denizen abilities/);assert.match(ingame,/Freeing, Failsafes &amp; overload/);
 assert.doesNotMatch(ingame,/data-guide-chapter="glyphs"/);
 const i=GUIDE_CHAPTERS.findIndex(c=>c.id==='oniverse');
 assert.match(renderGuideTutorial(i,1),/All eight Denizen abilities/);
});

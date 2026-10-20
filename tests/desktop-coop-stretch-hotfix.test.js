import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync('public/tabletop/phase34.css','utf8');
const desktop=css.slice(css.indexOf('/* Desktop co-op equipment atlas.'));

test('Piles span both Premonitions and Dreamcatchers rows only on desktop landscape',()=>{
 assert.match(desktop,/@media \(orientation:landscape\) and \(min-width:1000px\) and \(min-height:600px\)/);
 assert.match(desktop,/grid-template-areas:'doors towers' 'premonitions piles' 'catchers piles'!important/);
 assert.match(desktop,/grid-area:piles!important/);
 assert.match(desktop,/grid-area:catchers!important/);
 assert.match(desktop,/align-content:stretch!important/);
 assert.match(desktop,/align-items:stretch!important/);
});

test('Desktop growth reaches tower contents, premonitions, catchers, doors and piles without fixed heights',()=>{
 assert.match(desktop,/\.tt8-towers-slot>\.tt5-alignment\{[^}]*height:100%!important/);
 assert.match(desktop,/\.tt5-alignment>\.tt5-contents\{[^}]*height:calc\(100% - 19px\)!important/);
 assert.match(desktop,/\.tt17-coop-doors>\.tt17-player-doors\{[^}]*height:100%/);
 assert.match(desktop,/\.tt5-expansions>\.tt5-premonitions\{[^}]*height:100%!important/);
 assert.match(desktop,/\.tt5-expansions>\.tt5-catchers\{[^}]*height:100%!important/);
 assert.match(desktop,/\.tt17-coop-equipment>\.tt6-piles\{[^}]*height:100%/);
});

test('Desktop fallbacks do not reserve unoccupied expansion rows',()=>{
 for(const template of [
  "'doors towers' 'premonitions piles'",
  "'doors towers' 'catchers piles'",
  "'doors towers' 'piles piles'",
  "'doors doors' 'premonitions piles' 'catchers piles'",
  "'doors doors' 'premonitions piles'",
  "'doors doors' 'catchers piles'",
  "'doors doors' 'piles piles'",
 ]) assert.ok(desktop.includes(`grid-template-areas:${template}!important`),`missing layout ${template}`);
 assert.ok(css.indexOf('/* Desktop co-op equipment atlas.')>0,'desktop style must follow earlier layout rules');
});

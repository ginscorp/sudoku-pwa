import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../dist/js/catalog.js';
import {parseGrid,candidateMask,digits,conflicts,PEERS} from '../dist/js/engine.js';
import {newGame,mistakeCells,place,fillAllNotes,undo,redo,normalizeStore,DEFAULT_SETTINGS} from '../dist/js/state.js';
import {hintBoardModel} from '../dist/js/hint-board.js';

function fixture(){
 const p=CATALOG.levels.extreme[0],g=newGame(parseGrid(p.puzzle),parseGrid(p.solution),'extreme',p.id);
 for(let i=0;i<81;i++)if(!g.values[i])for(const n of digits(candidateMask(g.values,i)))if(n!==g.solution[i])return {g,i,n};
 throw Error('Missing non-conflicting wrong move fixture');
}

test('wrong solution digit is detected immediately even without a duplicate, and the game can continue',()=>{
 const {g,i,n}=fixture();assert.equal(conflicts(g.values).size,0);
 place(g,i,n);assert.equal(conflicts(g.values).size,0);assert.deepEqual([...mistakeCells(g)],[i]);
 assert.equal(g.completed,false);assert.equal(g.hints,0);
 const j=g.values.findIndex(v=>!v);assert.ok(place(g,j,g.solution[j]));
 assert.deepEqual([...mistakeCells(g)],[i]);
 const diagram=hintBoardModel(g.values,g.proven,null,{mistakes:[i]});
 assert.equal(diagram.filter(c=>c.conflict).length,1);assert.equal(diagram[i].value,n);
});

test('bad input preserves peer notes; undo, redo and direct correction preserve the round',()=>{
 const {g,i,n}=fixture();fillAllNotes(g);g.pencil=false;g.selected=i;
 const before=structuredClone(g);
 assert.ok(place(g,i,n));
 for(const peer of PEERS[i])assert.equal(g.notes[peer],before.notes[peer]);
 assert.ok(undo(g));assert.deepEqual(g.values,before.values);assert.deepEqual(g.notes,before.notes);assert.equal(mistakeCells(g).size,0);
 assert.ok(redo(g));assert.deepEqual([...mistakeCells(g)],[i]);
 assert.ok(place(g,i,g.solution[i]));assert.equal(mistakeCells(g).size,0);assert.equal(g.values[i],g.solution[i]);
 assert.ok(undo(g));assert.equal(g.values[i],n);assert.deepEqual([...mistakeCells(g)],[i]);
 assert.ok(undo(g));assert.deepEqual(g.values,before.values);assert.deepEqual(g.notes,before.notes);
});

test('existing saves enable error checking without changing values/history; explicit choice survives reload',()=>{
 const {g,i,n}=fixture();place(g,i,n);const original=structuredClone(g);
 const raw={schema:1,game:g,stats:[],settings:{theme:'graphite',cleanNotes:true,showConflicts:false,highlightPeers:true}};
 const loaded=normalizeStore(JSON.parse(JSON.stringify(raw)));
 assert.equal(loaded.settings.showMistakes,true);assert.deepEqual(loaded.game,original);assert.deepEqual([...mistakeCells(loaded.game)],[i]);
 loaded.settings.showMistakes=false;
 assert.equal(normalizeStore(JSON.parse(JSON.stringify(loaded))).settings.showMistakes,false);
 assert.equal(DEFAULT_SETTINGS.showMistakes,true);
});

test('pencil candidates and correct/given digits are never marked as wrong entries',()=>{
 const {g,i,n}=fixture();g.pencil=true;place(g,i,n);assert.equal(mistakeCells(g).size,0);
 g.pencil=false;place(g,i,g.solution[i]);assert.equal(mistakeCells(g).size,0);
 const given=g.givens.findIndex(Boolean);assert.equal(place(g,given,n),false);assert.equal(mistakeCells(g).size,0);
});

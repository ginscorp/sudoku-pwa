import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../dist/js/catalog.js';
import {parseGrid,digits,candidateMask} from '../dist/js/engine.js';
import {coachStep} from '../dist/js/coach.js';
import {hintBoardModel} from '../dist/js/hint-board.js';
import {newGame,fillAllNotes,place,erase,undo,redo,applyHint,normalizeStore,DEFAULT_SETTINGS} from '../dist/js/state.js';

function fixture(){
 const p=CATALOG.levels.extreme.find(p=>p.id==='extreme-v2-7');
 const g=newGame(parseGrid(p.puzzle),parseGrid(p.solution),'extreme',p.id);
 fillAllNotes(g);return g;
}
const hint=g=>coachStep(g.values,g.proven,g.notes);
const signature=s=>JSON.stringify(s?.kind==='place'?['place',s.index,s.value]:s?.changes);
const removeByHand=(g,changes)=>{g.pencil=true;for(const c of changes)for(const n of digits(c.remove))assert.equal(place(g,c.index,n),true);};

test('manual removals are skipped, diagram matches live notes, reading does not mutate',()=>{
 const g=fixture(),first=hint(g);assert.equal(first.kind,'eliminate');
 removeByHand(g,first.changes);
 const before=structuredClone(g),next=hint(g);
 assert.ok(next);assert.notEqual(signature(next),signature(first));assert.ok(next.skipped>0);
 assert.deepEqual(g,before);
 const diagram=hintBoardModel(g.values,g.proven,next,{explain:true,notes:g.notes});
 assert.deepEqual(diagram.map(c=>c.mask),g.notes);
 for(const c of first.changes)assert.equal(diagram[c.index].mask&c.remove,0);
 const restored=normalizeStore({schema:1,game:structuredClone(g),stats:[],settings:DEFAULT_SETTINGS}).game;
 assert.equal(signature(hint(restored)),signature(next));
});

test('partially completed elimination suggests and changes only remaining marks',()=>{
 const g=fixture(),first=hint(g),removed=first.changes.slice(0,2);
 removeByHand(g,removed);
 const next=hint(g);assert.equal(next.kind,'eliminate');
 assert.deepEqual(next.changes,first.changes.slice(2));
 const before=structuredClone(g);
 assert.equal(applyHint(g,next,DEFAULT_SETTINGS),true);
 for(let i=0;i<81;i++)assert.equal(g.notes[i],before.notes[i]&~(next.changes.find(c=>c.index===i)?.remove||0));
 assert.equal(g.hints,1);undo(g);assert.deepEqual(g.notes,before.notes);redo(g);
 assert.ok(next.changes.every(c=>!(g.notes[c.index]&c.remove)));
});

test('repeat apply is a true no-op: no count, undo entry, proof or notes changes',()=>{
 const g=fixture(),step=hint(g);assert.equal(applyHint(g,step,DEFAULT_SETTINGS),true);
 const after=structuredClone(g);
 assert.equal(applyHint(g,step,DEFAULT_SETTINGS),false);assert.deepEqual(g,after);
 // Also protect callers without a captured context.
 const {context,...legacy}=step;
 assert.equal(applyHint(g,legacy,DEFAULT_SETTINGS),false);assert.deepEqual(g,after);
 assert.notEqual(signature(hint(g)),signature(step));
});

test('apply never restores an unrelated manually removed mark in a target cell',()=>{
 const g=fixture(),first=hint(g),c=first.changes[0];
 const other=digits(g.notes[c.index]&~c.remove).find(n=>n!==g.solution[c.index]);
 assert.ok(other);removeByHand(g,[{index:c.index,remove:1<<other}]);
 const step=hint(g);assert.equal(step.kind,'eliminate');
 assert.equal(applyHint(g,step,DEFAULT_SETTINGS),true);
 assert.equal(g.notes[c.index]&(1<<other),0);
});

test('proven exclusions survive a new digit and fill variants; erase invalidates, undo restores',()=>{
 const g=fixture(),step=hint(g);applyHint(g,step,DEFAULT_SETTINGS);
 const at=g.values.findIndex((v,i)=>!v&&!step.changes.some(c=>c.index===i));
 g.pencil=false;assert.equal(place(g,at,g.solution[at]),true);
 for(const c of step.changes)assert.equal(g.proven[c.index]&c.remove,c.remove);
 fillAllNotes(g);for(const c of step.changes)assert.equal(g.notes[c.index]&c.remove,0);
 const after=structuredClone(g);assert.equal(erase(g,at),true);assert.ok(g.proven.every(v=>!v));
 undo(g);assert.deepEqual(g.proven,after.proven);assert.deepEqual(g.notes,after.notes);
 redo(g);assert.ok(g.proven.every(v=>!v));
});

test('stale hint is rejected after a pencil edit or digit without changing current state',()=>{
 for(const edit of ['pencil','digit']){
  const g=fixture(),step=hint(g),at=g.values.findIndex(v=>!v);
  if(edit==='pencil')place(g,at,digits(g.notes[at])[0]);
  else{g.pencil=false;place(g,at,g.solution[at]);}
  const before=structuredClone(g);assert.equal(applyHint(g,step,DEFAULT_SETTINGS),false);assert.deepEqual(g,before);
 }
});

test('incorrect/incomplete notes cannot become proof of a wrong placement or exclusion',()=>{
 for(const p of CATALOG.levels.extreme.slice(0,30)){
  const g=newGame(parseGrid(p.puzzle),parseGrid(p.solution),'extreme',p.id);
  // Deliberately omit the real solution from every empty cell and keep sparse wrong notes.
  g.notes=g.values.map((v,i)=>v?0:candidateMask(g.values,i)&~(1<<g.solution[i]));
  const before=structuredClone(g),step=hint(g);assert.deepEqual(g,before);
  if(step?.kind==='place')assert.equal(step.value,g.solution[step.index]);
  if(step?.kind==='eliminate')for(const c of step.changes){assert.equal(c.remove&(1<<g.solution[c.index]),0);assert.ok(c.remove&g.notes[c.index]);}
 }
});

test('empty notes lead to a proved placement or explicit fallback, never invisible elimination',()=>{
 const g=fixture();g.notes.fill(0);const before=structuredClone(g),step=hint(g);
 assert.deepEqual(g,before);assert.ok(!step||step.kind==='place');
 if(step){assert.equal(step.value,g.solution[step.index]);assert.equal(applyHint(g,step,DEFAULT_SETTINGS),true);}
});

test('a hint after undo may legitimately repeat, but redo must not apply it twice',()=>{
 const g=fixture(),step=hint(g);applyHint(g,step,DEFAULT_SETTINGS);undo(g);
 assert.equal(signature(hint(g)),signature(step));redo(g);
 const before=structuredClone(g);assert.equal(applyHint(g,step,DEFAULT_SETTINGS),false);assert.deepEqual(g,before);
});

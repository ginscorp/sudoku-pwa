import test from 'node:test';
import assert from 'node:assert/strict';
import {hintBoardModel} from '../dist/js/hint-board.js';
import {coachStep} from '../dist/js/coach.js';
import {CATALOG} from '../dist/js/catalog.js';
import {parseGrid,candidateMask} from '../dist/js/engine.js';
import {newGame,applyHint,undo,DEFAULT_SETTINGS} from '../dist/js/state.js';

test('hint diagram follows the current round and preserves player state',()=>{
  const p=CATALOG.levels.easy[0],values=parseGrid(p.puzzle),solution=parseGrid(p.solution);
  const at=values.findIndex(v=>!v);values[at]=solution[at];
  const proven=Array(81).fill(0),empty=values.findIndex(v=>!v);
  const removable=Array.from({length:9},(_,i)=>i+1).find(n=>n!==solution[empty]&&(candidateMask(values,empty)&(1<<n)));
  if(removable)proven[empty]=1<<removable;
  const before=structuredClone({values,proven});
  const model=hintBoardModel(values,proven,coachStep(values,proven),{explain:true});
  assert.deepEqual({values,proven},before);
  assert.deepEqual(model.map(c=>c.value),values);
  assert.equal(model[at].value,solution[at]);
  for(const cell of model){
    assert.equal(cell.mask,values[cell.index]?0:candidateMask(values,cell.index)&~proven[cell.index]);
    for(const note of cell.notes)if(!note.present)assert.ok(!note.proposed&&!note.remove);
  }
});

test('placement preview highlights a candidate without inserting it; apply is undoable',()=>{
  const p=CATALOG.levels.easy[0],game=newGame(parseGrid(p.puzzle),parseGrid(p.solution),'easy',p.id);
  const step=coachStep(game.values,game.proven);assert.equal(step.kind,'place');
  const before=structuredClone(game),model=hintBoardModel(game.values,game.proven,step,{explain:true});
  assert.equal(model[step.index].value,0);
  assert.equal(model[step.index].notes.filter(n=>n.proposed).length,1);
  assert.equal(model[step.index].notes.find(n=>n.proposed).digit,step.value);
  assert.deepEqual(game,before);
  assert.ok(hintBoardModel(game.values,game.proven,step).every(c=>!c.target&&c.notes.every(n=>!n.proposed&&!n.remove)));
  applyHint(game,step,DEFAULT_SETTINGS);assert.equal(game.values[step.index],step.value);
  undo(game);assert.deepEqual(game.values,before.values);
});

test('elimination preview marks exactly the removable candidates in this position',()=>{
  let values,step;
  for(const p of CATALOG.levels.extreme.slice(0,20)){
    values=parseGrid(p.puzzle);step=coachStep(values);if(step?.kind==='eliminate')break;
  }
  assert.equal(step.kind,'eliminate');
  const model=hintBoardModel(values,Array(81).fill(0),step,{explain:true});
  for(const c of model)for(const n of c.notes){
    const change=step.changes.find(x=>x.index===c.index);
    assert.equal(n.remove,!!(n.present&&change&&(change.remove&(1<<n.digit))));
  }
});

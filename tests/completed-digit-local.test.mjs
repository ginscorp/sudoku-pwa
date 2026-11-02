import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../dist/js/catalog.js';
import {parseGrid} from '../dist/js/engine.js';
import {newGame,place,DEFAULT_SETTINGS} from '../dist/js/state.js';
test('a completed digit cannot mutate an empty cell in normal or pencil mode',()=>{
 const solution=parseGrid(CATALOG.levels.easy[0].solution),clues=[...solution];const at=clues.findIndex(v=>v!==6);clues[at]=0;
 for(const pencil of [false,true]){const game=newGame(clues,solution,'easy','synthetic-completed-digit');game.pencil=pencil;const before=structuredClone(game);assert.equal(place(game,at,6,DEFAULT_SETTINGS),false);assert.deepEqual(game,before);}
});

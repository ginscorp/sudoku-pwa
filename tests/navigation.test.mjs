import test from 'node:test';
import assert from 'node:assert/strict';
import {nearestPlacedDigit} from '../dist/js/navigation.js';

test('keypad navigation chooses the nearest correct placement without changing the game',()=>{
  const game={values:Array(81).fill(0),solution:Array(81).fill(0),selected:40};
  game.values[40]=game.solution[40]=7;
  for(const i of [1,38,61])game.values[i]=game.solution[i]=1;
  game.values[39]=1;game.solution[39]=8; // A mistaken entry must not attract navigation.
  const before=structuredClone(game);
  assert.equal(nearestPlacedDigit(game,1),38);
  assert.equal(nearestPlacedDigit(game,7),40);
  assert.equal(nearestPlacedDigit(game,9),-1);
  assert.deepEqual(game,before);
  game.values[42]=game.solution[42]=1;
  assert.equal(nearestPlacedDigit(game,1),38); // Stable equal-distance choice.
  assert.equal(nearestPlacedDigit(game,1,80),61);
});

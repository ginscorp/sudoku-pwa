import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeStatistics} from '../dist/js/statistics.js';
import {LESSON_EXAMPLES} from '../dist/js/lesson-examples.js';
import {hintBoard} from '../dist/js/hint-board.js';

test('all wins and their time count, while clean wins remain a separate record',()=>{
 const stats=[
  {level:'extreme',elapsedMs:120000,hints:0,mistakes:3},
  {level:'extreme',elapsedMs:240000,hints:1,mistakes:0},
  {level:'extreme',elapsedMs:360000,hints:0,mistakes:0},
  {level:'easy',elapsedMs:60000,hints:0,mistakes:null}
 ];
 const before=JSON.stringify(stats),s=summarizeStatistics(stats),max=s.levels.find(l=>l.id==='extreme');
 assert.equal(s.solved,4);assert.equal(s.totalMs,780000);assert.equal(s.withErrors,1);
 assert.equal(s.noHints,3);assert.equal(s.noErrors,2);assert.equal(s.perfect,1);
 assert.equal(max.solved,3);assert.equal(max.bestMs,120000);assert.equal(max.bestCleanMs,360000);assert.equal(max.averageMs,240000);
 assert.equal(s.levels.find(l=>l.id==='easy').perfect,0);
 assert.equal(s.levels.find(l=>l.id==='hard').bestMs,null);
 assert.equal(JSON.stringify(stats),before);
});

test('a grouped strong link joins the group once, never two false individual links',()=>{
 const e=LESSON_EXAMPLES.grouped,h=hintBoard(e.values,null,null,{notes:e.notes,teaching:true,links:e.links});
 assert.equal((h.match(/<line /g)||[]).length,1);assert.equal((h.match(/class="link-group"/g)||[]).length,1);
 assert.ok(!h.includes('NaN'));assert.match(h,/x1="19" y1="5" x2="45" y2="5"/);
 assert.match(h,/варианты не показаны/);
});

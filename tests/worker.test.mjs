import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,solve} from '../dist/js/engine.js';
let response;
globalThis.self={postMessage:value=>{response=value;}};
await import('../dist/js/puzzle-worker.js');
test('actual offline worker returns the requested tier with a unique solution, including max',()=>{
  for(const level of ['easy','normal','hard','expert','extreme'])for(let i=0;i<8;i++){
    response=null;self.onmessage({data:{level,seed:92817+i*7293}});
    assert.ok(response&&!response.error,`${level}: ${response?.error}`);assert.equal(analyze(response.puzzle).level,level,`${level} seed ${i}`);assert.equal(solve(response.puzzle).count,1);
  }
});

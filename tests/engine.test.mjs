import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../dist/js/catalog.js';
import {parseGrid,solve,isComplete,analyze,logicalStep,allCandidates,applyLogicalStep,transformPuzzle,generatePuzzle,PEERS} from '../dist/js/engine.js';

// An independent, set-based solver: no masks, engine units, or engine solver.
function independentCount(input,limit=2){
  const a=[...input];let count=0;
  function options(i){const r=Math.floor(i/9),c=i%9,s=new Set();for(let n=0;n<9;n++){s.add(a[r*9+n]);s.add(a[n*9+c]);s.add(a[(Math.floor(r/3)*3+Math.floor(n/3))*9+Math.floor(c/3)*3+n%3]);}return [1,2,3,4,5,6,7,8,9].filter(n=>!s.has(n));}
  function walk(){let at=-1,ns=[];for(let i=0;i<81;i++)if(!a[i]){const v=options(i);if(!v.length)return;if(at<0||v.length<ns.length){at=i;ns=v;if(v.length===1)break;}}if(at<0){count++;return;}for(const n of ns){a[at]=n;walk();a[at]=0;if(count>=limit)return;}}
  walk();return count;
}
test('all 2200 original puzzles have exactly one solution, checked independently',()=>{
  let count=0;
  for(const list of Object.values(CATALOG.levels))for(const entry of list){
    const p=parseGrid(entry.puzzle),s=parseGrid(entry.solution);
    assert.equal(independentCount(p),1,entry.id);assert.ok(isComplete(s),entry.id);assert.ok(p.every((n,i)=>!n||n===s[i]));assert.deepEqual(solve(p).solution,s);count++;
  }
  assert.equal(count,2200);
});
test('every original puzzle meets its actual tier criteria',()=>{
  for(const [level,list] of Object.entries(CATALOG.levels))for(const e of list){const a=analyze(parseGrid(e.puzzle));assert.equal(a.level,level,e.id);if(level==='extreme'){assert.equal(a.solvedLogically,false);assert.ok(a.search.depth>=4&&a.search.branches>=12);}}
});
test('every logical elimination and placement is sound against the unique solution',()=>{
  let steps=0;
  for(const list of Object.values(CATALOG.levels))for(const e of list){
    const g=parseGrid(e.puzzle),s=parseGrid(e.solution),m=allCandidates(g);
    for(let t=0;t<400;t++){
      const step=logicalStep(g,m);if(!step)break;
      if(step.kind==='place')assert.equal(step.value,s[step.index],e.id+' '+step.type);
      else for(const ch of step.changes)assert.equal(ch.remove&(1<<s[ch.index]),0,e.id+' '+step.type);
      applyLogicalStep(g,m,step);steps++;
    }
  }
  assert.ok(steps>2000);
});
test('Sudoku transformations preserve clues, validity and unique solutions',()=>{
  for(const e of CATALOG.levels.extreme)for(const seed of [17,84613,4294967295]){
    const p=transformPuzzle(parseGrid(e.puzzle),parseGrid(e.solution),seed);assert.ok(isComplete(p.solution));assert.ok(p.puzzle.every((n,i)=>!n||p.solution[i]===n));assert.equal(solve(p.puzzle).count,1);
  }
});
test('fresh generators produce valid unique puzzles for ten independent seeds',()=>{for(let seed=1;seed<=10;seed++){const p=generatePuzzle(seed*9239,26);assert.equal(independentCount(p.puzzle),1);assert.ok(isComplete(p.solution));}});
test('solver detects invalid and ambiguous puzzles',()=>{const a=Array(81).fill(0);a[0]=a[1]=1;assert.equal(solve(a).count,0);assert.equal(solve(Array(81).fill(0)).count,2);assert.equal(PEERS[40].length,20);});

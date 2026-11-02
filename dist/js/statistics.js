import {LEVELS} from './engine.js';
import {effectiveMistakes} from './mistake-corrections.js';

// Every finished game contributes, regardless of errors or help. Clean records
// are a separate subset; a missing historical mistake count is not zero.
export function summarizeStatistics(stats){
 stats=stats.map(g=>({...g,mistakes:effectiveMistakes(g)}));
 const clean=g=>g.hints===0&&g.mistakes===0;
 const best=games=>games.length?Math.min(...games.map(g=>g.elapsedMs)):null;
 return {
  solved:stats.length,totalMs:stats.reduce((sum,g)=>sum+g.elapsedMs,0),
  noHints:stats.filter(g=>g.hints===0).length,noErrors:stats.filter(g=>g.mistakes===0).length,
  perfect:stats.filter(clean).length,withErrors:stats.filter(g=>g.mistakes>0).length,
  levels:LEVELS.map(level=>{
   const all=stats.filter(g=>g.level===level.id),perfect=all.filter(clean);
   return {...level,solved:all.length,perfect:perfect.length,bestMs:best(all),bestCleanMs:best(perfect),averageMs:all.length?all.reduce((sum,g)=>sum+g.elapsedMs,0)/all.length:null};
  })
 };
}

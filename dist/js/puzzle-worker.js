import {CATALOG} from './catalog.js';
import {parseGrid,transformPuzzle,solve,analyze,generatePuzzle} from './engine.js';
self.onmessage=({data})=>{
  try {
    const {level,seed,exclude,seen=[]}=data, list=CATALOG.levels[level];
    if(!list?.length)throw new Error('Неизвестный уровень');
    // Try fresh puzzles first for the lower four tiers. The validated local catalog
    // provides a bounded, completely offline fallback for every tier.
    if(['beginner','easy','normal','hard'].includes(level)) {
      const target={beginner:46,easy:40,normal:32,hard:27}[level];
      for(let attempt=0;attempt<5;attempt++){
        const p=generatePuzzle((seed+attempt)>>>0,target),rating=analyze(p.puzzle);
        if(rating.level===level){self.postMessage({...p,sourceId:`generated-${seed}-${attempt}`,rating});return;}
      }
    }
    const unseen=list.filter(p=>!seen.includes(p.id)&&p.id!==exclude),choices=unseen.length?unseen:list.filter(p=>p.id!==exclude), pool=choices.length?choices:list;
    for(let attempt=0;attempt<32;attempt++){
      const entry=pool[(seed+attempt)%pool.length];
      const p=transformPuzzle(parseGrid(entry.puzzle),parseGrid(entry.solution),(seed+attempt*7919)>>>0);
      const rating=analyze(p.puzzle);
      if(rating.level!==level)continue;
      const check=solve(p.puzzle);
      if(check.count!==1||check.exhausted)throw new Error('Не удалось проверить единственность решения');
      self.postMessage({...p,sourceId:entry.id,rating});return;
    }
    // A verified original is preferable to silently returning the wrong tier.
    const entry=pool[seed%pool.length];
    self.postMessage({puzzle:parseGrid(entry.puzzle),solution:parseGrid(entry.solution),sourceId:entry.id,rating:entry.rating});
  }catch(error){self.postMessage({error:error.message});}
};

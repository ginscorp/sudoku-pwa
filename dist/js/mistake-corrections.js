const id=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(s);
export function validMistakeCorrection(c,gameId=c?.gameId){
 return !!c&&c.version===1&&id(c.gameId)&&c.gameId===gameId&&c.reason==='completed-digit-input'&&
  Number.isFinite(Date.parse(c.correctedAt))&&Number.isInteger(c.originalMistakes)&&
  Array.isArray(c.exclusions)&&c.exclusions.length>0&&c.exclusions.length<=81&&c.originalMistakes>=c.exclusions.length&&
  c.exclusions.every(e=>id(e.id)&&Number.isInteger(e.seq)&&e.seq>0)&&new Set(c.exclusions.map(e=>e.id)).size===c.exclusions.length;
}
export function recordedMistakes(g){return g.recordedMistakes??g.mistakes??null;}
export function effectiveMistakes(g,through=Infinity){
 const raw=recordedMistakes(g),c=g.mistakeCorrection;
 if(!Number.isInteger(raw))return null;
 return Math.max(0,raw-(validMistakeCorrection(c,g.id)?c.exclusions.filter(e=>e.seq<=through).length:0));
}
// Preserve the original counter and event payloads; the explicit correction is
// applied to the displayed/stored result and survives older queued checkpoints.
export function applyMistakeCorrection(g,c){
 if(!g||!validMistakeCorrection(c,g.id))return false;
 const raw=recordedMistakes(g)??c.originalMistakes,mistakes=Math.max(0,raw-c.exclusions.length);
 const changed=g.recordedMistakes!==raw||g.mistakes!==mistakes||JSON.stringify(g.mistakeCorrection)!==JSON.stringify(c);
 if(changed){g.recordedMistakes=raw;g.mistakes=mistakes;g.mistakeCorrection=structuredClone(c);}
 return changed;
}

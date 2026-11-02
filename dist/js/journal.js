import {sameTheme} from './themes.js';
import {applyMistakeCorrection,effectiveMistakes} from './mistake-corrections.js';
// Durable local journal; all writes are serialized and each game update is atomic.
const DB_NAME='sudoku-public-journal-v2';
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const done=t=>new Promise((resolve,reject)=>{t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Storage transaction aborted'));});
let dbPromise,queue=Promise.resolve();
export const device=(()=>{let s=localStorage.getItem('sudoku.public.device');if(!s){s=crypto.randomUUID();localStorage.setItem('sudoku.public.device',s);}return s;})();
function db(){return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore('games',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function games(){await queue;const d=await db();return req(d.transaction('games').objectStore('games').getAll());}
export async function getGame(id){await queue;const d=await db();return req(d.transaction('games').objectStore('games').get(id));}
function update(id,fn){const task=queue.then(async()=>{const d=await db(),t=d.transaction('games','readwrite'),complete=done(t),s=t.objectStore('games'),old=await req(s.get(id));const value=fn(old);if(value)s.put(value);await complete;return value;});queue=task.catch(()=>{});return task;}
const WAL='sudoku.public.pending-journal';
function commit(entry){
 const {checkpoint,kind,detail,walId}=entry;
 return update(checkpoint.id,old=>{
  if(old?.walIds?.includes(walId))return old;
  if(old?.checkpoint?.mistakeCorrection)applyMistakeCorrection(checkpoint,old.checkpoint.mistakeCorrection);
  checkpoint.elapsedMs=Math.max(Math.round(checkpoint.elapsedMs),old?.checkpoint?.elapsedMs||0,old?.events?.at(-1)?.activeMs||0);
  if(!old)old={id:checkpoint.id,device,parentId:checkpoint.parentId||null,initial:structuredClone(checkpoint),events:[],revision:0};
  const prev=old.checkpoint,changes=[];
  if(prev)for(let i=0;i<81;i++)if(['values','notes','proven'].some(k=>prev[k][i]!==checkpoint[k][i]))changes.push({i,from:prev.values[i],to:checkpoint.values[i],noteFrom:prev.notes[i],noteTo:checkpoint.notes[i],proofFrom:prev.proven[i],proofTo:checkpoint.proven[i]});
  const themeChanged=!!prev&&!sameTheme(prev.theme,checkpoint.theme);
  if(!prev||kind!=='checkpoint'||changes.length||themeChanged||prev.completed!==checkpoint.completed){
   const previous=old.events.at(-1),activeMs=Math.round(checkpoint.elapsedMs);
   old.events.push({seq:old.events.length+1,id:crypto.randomUUID(),kind:!prev?'start':kind==='checkpoint'?(themeChanged&&!changes.length?'theme':'edit'):kind,at:new Date().toISOString(),activeMs,thinkMs:Math.max(0,activeMs-(previous?.activeMs||0)),selected:checkpoint.selected,changes,detail,hints:checkpoint.hints,mistakes:checkpoint.mistakes??null,completed:checkpoint.completed,...(checkpoint.recordedMistakes!=null?{recordedMistakes:checkpoint.recordedMistakes}:{}),...(checkpoint.theme?{theme:{...checkpoint.theme}}:{})});
  }
  old.checkpoint=checkpoint;old.revision++;old.walIds=[...(old.walIds||[]),walId].slice(-128);old.updatedAt=new Date().toISOString();return old;
 }).then(value=>{const pending=JSON.parse(localStorage.getItem(WAL)||'[]');localStorage.setItem(WAL,JSON.stringify(pending.filter(e=>e.walId!==walId)));return value;});
}
export function capture(game,kind='checkpoint',detail={}){
 const checkpoint=structuredClone(game);delete checkpoint.history;delete checkpoint.future;
 const entry={walId:crypto.randomUUID(),checkpoint,kind,detail},pending=JSON.parse(localStorage.getItem(WAL)||'[]');
 pending.push(entry);localStorage.setItem(WAL,JSON.stringify(pending));
 return commit(entry);
}
export function replay(record,step=record.events.length){
 const g=structuredClone(record.initial);g.history=[];g.future=[];
 for(const e of record.events.slice(0,step)){
  for(const c of e.changes){g.values[c.i]=c.to;g.notes[c.i]=c.noteTo;g.proven[c.i]=c.proofTo;}
  g.elapsedMs=e.activeMs;g.selected=e.selected;g.hints=e.hints;g.mistakes=e.mistakes??null;g.completed=e.completed;
  if(e.recordedMistakes!=null)g.recordedMistakes=e.recordedMistakes;else delete g.recordedMistakes;
  if(e.theme)g.theme={...e.theme};
 }
 if(record.checkpoint?.mistakeCorrection){g.mistakeCorrection=record.checkpoint.mistakeCorrection;g.mistakes=effectiveMistakes(g,record.events[Math.min(step,record.events.length)-1]?.seq||0);delete g.mistakeCorrection;delete g.recordedMistakes;}
 return g;
}
// Recover any last action whose synchronous write survived a closed tab.
try{for(const entry of JSON.parse(localStorage.getItem(WAL)||'[]'))commit(entry).catch(()=>{});}catch{}

import {validGrid, conflicts, candidateMask, PEERS, isComplete, LEVELS} from './engine.js';
import {validTheme,themeStats} from './themes.js';
import {digitIsComplete} from './navigation.js';
import {validMistakeCorrection} from './mistake-corrections.js';
export const STORE_KEY = 'sudoku.public.v1';
export const DEFAULT_SETTINGS = {theme:'focus-dark', cleanNotes:true, showConflicts:true, showMistakes:true, highlightPeers:true};
// Derive mistakes from saved values, so old unfinished games get the same
// immediate feedback without changing their moves, notes or undo history.
export function mistakeCells(g) {
  return new Set(g.values.flatMap((v,i)=>v&&!g.givens[i]&&v!==g.solution[i]?[i]:[]));
}
export function newGame(puzzle, solution, level, sourceId, theme=null) {
  if(theme&&!validTheme(theme))throw Error('Неизвестное оформление.');
  return {id: crypto.randomUUID(), sourceId, level, givens:[...puzzle], solution:[...solution], values:[...puzzle], notes:Array(81).fill(0), proven:Array(81).fill(0), history:[], future:[], elapsedMs:0, hints:0, mistakes:0, selected:puzzle.findIndex(n => !n), pencil:false, completed:false, startedAt:new Date().toISOString(),...(theme?{theme:{...theme},themeAtStart:{...theme}}:{})};
}
function snapshot(g) { return {values:[...g.values],notes:[...g.notes],proven:[...g.proven],selected:g.selected}; }
function record(g) { g.future=[];g.history.push(snapshot(g)); if (g.history.length > 500) g.history.shift(); }
export function place(g, i, n, settings = DEFAULT_SETTINGS) {
  if (g.completed || i < 0 || i > 80 || g.givens[i] || n < 0 || n > 9) return false;
  if(n&&digitIsComplete(g,n))return false;
  if (g.pencil && n) {
    if (g.values[i]) return false;
    record(g); g.notes[i] ^= 1 << n; return true;
  }
  if (g.values[i] === n && !g.notes[i]) return false;
  record(g); if(n&&n!==g.solution[i]&&Number.isInteger(g.mistakes))g.mistakes++;
  // Adding a digit only narrows the position; its existing deductions remain true.
  // Replacing/removing a digit can invalidate their premises, so discard them then.
  if(g.values[i])g.proven=Array(81).fill(0);
  g.values[i] = n; g.notes[i] = 0;
  if (n && settings.cleanNotes && (!settings.showMistakes || n===g.solution[i])) for (const j of PEERS[i]) g.notes[j] &= ~(1 << n);
  return true;
}
export function fillCellNotes(g, i) {
  if (g.completed || i < 0 || i > 80 || g.values[i]) return false;
  const mask = candidateMask(g.values, i)&~g.proven[i];
  if (g.notes[i] === mask) { g.pencil = true; return false; }
  record(g); g.notes[i] = mask; g.pencil = true; return true;
}
export function fillAllNotes(g) {
  if(g.completed)return false;
  const notes=g.values.map((_,i)=>candidateMask(g.values,i)&~g.proven[i]);
  g.pencil=true;if(notes.every((v,i)=>v===g.notes[i]))return false;
  record(g);g.notes=notes;return true;
}
export function erase(g, i) {
  if (g.completed || i < 0 || g.givens[i] || (!g.values[i] && !g.notes[i])) return false;
  record(g); if(g.values[i])g.proven=Array(81).fill(0); g.values[i] = 0; g.notes[i] = 0; return true;
}
export function undo(g) {
  if (g.completed || !g.history.length) return false;
  (g.future??=[]).push(snapshot(g));
  Object.assign(g,g.history.pop()); return true;
}
export function redo(g) {
  if(g.completed||!g.future?.length)return false;
  g.history.push(snapshot(g));if(g.history.length>500)g.history.shift();
  Object.assign(g,g.future.pop());return true;
}
export function applyHint(g, step, settings) {
  if(g.completed||!step)return false;
  if(step.context&&['values','proven','notes'].some(key=>step.context[key]&&step.context[key].some((v,i)=>v!==g[key][i])))return false;
  if (step.kind === 'place') {
    if(g.values[step.index])return false;
    const pencil = g.pencil; g.pencil = false; const changed = place(g,step.index,step.value,settings); g.pencil=pencil;
    if (changed) {g.selected=step.index;g.hints++;} return changed;
  }
  const changes=(step.changes||[]).map(({index,remove})=>({index,remove:remove&candidateMask(g.values,index)&~g.proven[index]&(step.context?.notes?g.notes[index]:1022)})).filter(c=>c.remove);
  if(!changes.length)return false;
  record(g);
  for (const {index,remove} of changes) {
    g.proven[index] |= remove;
    // Never reconstruct a cell's notes over the player's manual exclusions.
    g.notes[index] &= ~remove;
  }
  g.selected=changes[0].index;g.hints++;return true;
}
export function complete(g, stats) {
  if (g.completed || !isComplete(g.values)) return false;
  g.completed=true;
  if (!stats.some(r=>r.id===g.id)) stats.push({id:g.id,level:g.level,elapsedMs:Math.round(g.elapsedMs),hints:g.hints,mistakes:g.mistakes??null,at:new Date().toISOString(),...themeStats(g)});
  return true;
}
export function validGame(g) {
  if (!g || typeof g.id!=='string' || g.id.length>100 || !LEVELS.some(l=>l.id===g.level)) return false;
  if([g.theme,g.themeAtStart].some(t=>t!=null&&!validTheme(t)))return false;
  if(g.mistakeCorrection!=null&&!validMistakeCorrection(g.mistakeCorrection,g.id))return false;
  if(g.recordedMistakes!=null&&(!g.mistakeCorrection||!Number.isInteger(g.recordedMistakes)||g.recordedMistakes<0))return false;
  if (![g.givens,g.values,g.solution].every(validGrid) || !isComplete(g.solution) || conflicts(g.givens).size) return false;
  if (g.givens.some((v,i)=>v && (g.solution[i]!==v || g.values[i]!==v))) return false;
  const masks = a=>Array.isArray(a)&&a.length===81&&a.every(n=>Number.isInteger(n)&&n>=0&&n<=1022&&(n&1)===0);
  if (!masks(g.notes) || !masks(g.proven) || !Number.isFinite(g.elapsedMs) || g.elapsedMs<0 || !Number.isInteger(g.hints)||g.hints<0) return false;
  if (!Number.isInteger(g.selected)||g.selected<0||g.selected>80||typeof g.pencil!=='boolean'||typeof g.completed!=='boolean') return false;
  if (g.mistakes!=null&&(!Number.isInteger(g.mistakes)||g.mistakes<0))return false;
  if (g.completed && !isComplete(g.values)) return false;
  if (!Array.isArray(g.history)||g.history.length>500||!g.history.every(s=>validGrid(s.values)&&masks(s.notes)&&masks(s.proven)&&Number.isInteger(s.selected)&&s.selected>=0&&s.selected<81&&!g.givens.some((v,i)=>v&&s.values[i]!==v))) return false;
  return true;
}
export function normalizeStore(raw) {
  if (!raw || raw.schema!==1 || (raw.game!==null&&!validGame(raw.game))) throw new Error('Файл не похож на сохранение Судоку.');
  if (!Array.isArray(raw.stats)||raw.stats.length>100000||!raw.stats.every(s=>s&&typeof s.id==='string'&&LEVELS.some(l=>l.id===s.level)&&Number.isFinite(s.elapsedMs)&&s.elapsedMs>=0&&Number.isInteger(s.hints)&&s.hints>=0&&typeof s.at==='string'&&(s.mistakes==null||Number.isInteger(s.mistakes)&&s.mistakes>=0))) throw new Error('Повреждена статистика сохранения.');
  if(raw.stats.some(s=>[s.theme,s.themeAtStart].some(t=>t!=null&&!validTheme(t))))throw Error('Повреждено оформление в статистике.');
  const settings={...DEFAULT_SETTINGS};
  if (['graphite','paper','forest','focus-light','focus-dark','midnight','atelier','system'].includes(raw.settings?.theme)) settings.theme=raw.settings.theme;
  for(const key of ['cleanNotes','showConflicts','showMistakes','highlightPeers']) if(typeof raw.settings?.[key]==='boolean')settings[key]=raw.settings[key];
  if(raw.game){raw.game.future??=[];if(!Array.isArray(raw.game.future)||raw.game.future.length>500||!raw.game.future.every(s=>validGrid(s.values)&&Array.isArray(s.notes)&&s.notes.length===81&&s.notes.every(n=>Number.isInteger(n)&&n>=0&&n<=1022)&&Array.isArray(s.proven)&&s.proven.length===81&&s.proven.every(n=>Number.isInteger(n)&&n>=0&&n<=1022)&&!raw.game.givens.some((v,i)=>v&&s.values[i]!==v)))throw Error('Повреждена история возврата.');}
  return {schema:1,game:raw.game,stats:raw.stats,settings};
}
export function formatTime(ms) {
  const seconds=Math.floor(ms/1000), s=String(seconds%60).padStart(2,'0'), m=Math.floor(seconds/60)%60, h=Math.floor(seconds/3600);
  return h ? `${h}:${String(m).padStart(2,'0')}:${s}` : `${String(m).padStart(2,'0')}:${s}`;
}

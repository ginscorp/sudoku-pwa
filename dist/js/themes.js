export const THEME_IDS=['graphite','paper','forest','focus-light','focus-dark','midnight','atelier'];

// Keep both the preference and the appearance actually shown on the device.
export function validTheme(theme){
 return !!theme&&typeof theme==='object'&&!Array.isArray(theme)&&Object.keys(theme).length===2&&
  [...THEME_IDS,'system'].includes(theme.selected)&&THEME_IDS.includes(theme.resolved)&&
  (theme.selected==='system'?['graphite','paper'].includes(theme.resolved):theme.selected===theme.resolved);
}
export function sameTheme(a,b){return (a?.selected??null)===(b?.selected??null)&&(a?.resolved??null)===(b?.resolved??null);}
export function resolveTheme(selected,prefersDark=false){
 const theme={selected,resolved:selected==='system'?(prefersDark?'graphite':'paper'):selected};
 if(!validTheme(theme))throw Error('Неизвестное оформление.');
 return theme;
}
export function observeTheme(game,theme){
 if(!game||game.completed||sameTheme(game.theme,theme))return false;
 if(!validTheme(theme))throw Error('Неизвестное оформление.');
 // Observing an existing game does not tell us which theme it started with.
 game.theme={...theme};return true;
}
export function themeStats(game){
 return {theme:game.theme?{...game.theme}:null,themeAtStart:game.themeAtStart?{...game.themeAtStart}:null};
}

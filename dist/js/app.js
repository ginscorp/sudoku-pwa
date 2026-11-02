import {LEVELS,PEERS,digits,conflicts,candidateMask,logicalStep,solve,row,col} from './engine.js';
import {STORE_KEY,DEFAULT_SETTINGS,newGame,place,fillAllNotes,erase,undo,redo,applyHint,complete,normalizeStore,formatTime,mistakeCells} from './state.js';
import {capture,games as journalGames} from './journal.js';
import {featureUI} from './features.js';
import {coachStep,direction} from './coach.js';
import {nearestPlacedDigit,digitIsComplete} from './navigation.js';
import {hintBoard} from './hint-board.js';
import {summarizeStatistics} from './statistics.js';
import {resolveTheme,observeTheme,themeStats} from './themes.js';
import {effectiveMistakes} from './mistake-corrections.js';

// One writer per browser profile prevents two tabs overwriting one local game.
if(navigator.locks){
 const writer=await new Promise(resolve=>navigator.locks.request('sudoku-public-writer',{ifAvailable:true},lock=>{resolve(!!lock);return lock?new Promise(()=>{}):undefined;}));
 if(!writer){document.getElementById('app').innerHTML='<h1>Судоку уже открыто</h1><p class="lesson-body">Продолжите в другой вкладке или закройте ее и обновите эту. Так история ходов останется последовательной.</p><button class="primary" id="retry-tab">Открыть здесь</button>';document.getElementById('retry-tab').onclick=()=>location.reload();await new Promise(()=>{});}
}

const $=id=>document.getElementById(id);
const ICONS={
 book:'<path d="M12 5v16M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/>',
 redo:'<path d="m15 3 5 5-5 5M20 8H10a6 6 0 0 0 0 12"/>',
 chart:'<path d="M4 20V12m6 8V4m6 16V8m4 12H2"/>',
 settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="var(--bg)"/><circle cx="16" cy="12" r="2" fill="var(--bg)"/><circle cx="10" cy="18" r="2" fill="var(--bg)"/>',
 chevron:'<path d="m8 5 7 7-7 7"/>',pause:'<path d="M9 5v14M15 5v14"/>',play:'<path d="m8 5 11 7-11 7Z"/>',
 pencil:'<path d="m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14Z"/>',undo:'<path d="m9 5-5 5 5 5M4 10h10a6 6 0 0 1 0 12" transform="translate(0 -2)"/>',
 erase:'<path d="m14 3 7 7-10 10H6l-4-4Zm-8 9 7 7M11 20h10"/>',hint:'<path d="M9 18h6M10 21h4M8 15c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7Z"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',check:'<path d="m5 12 5 5L20 7"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.chevron}</svg>`;
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
icons();
document.querySelector('.top-actions').append($('account-button'));
let store={schema:1,game:null,stats:[],settings:{...DEFAULT_SETTINGS}},loadWarning='';
try{
  const raw=localStorage.getItem(STORE_KEY);
  if(raw)try{store=normalizeStore(JSON.parse(raw));}catch{
    const backup=localStorage.getItem(STORE_KEY+'.backup');
    if(backup){store=normalizeStore(JSON.parse(backup));loadWarning='Восстановлена резервная копия последнего сохранения.';}
    else loadWarning='Сохранение повреждено. Начата новая партия.';
  }
}catch{loadWarning='Хранилище недоступно. Автосохранение не работает.';}
let game=store.game,paused=true,clockStart=null,loading=false,locked=0,highlight=0,resumeAfterSheet=false,toastTimer,saveOk=true,puzzleWorker=null,swRegistration=null,offlineReady=false;
const media=matchMedia('(prefers-color-scheme: dark)');
function currentTheme(){return resolveTheme(store.settings.theme,media.matches);}
function resolvedTheme(){return store.settings.theme==='system'?(media.matches?'graphite':'paper'):store.settings.theme;}
function compactLayout(){return ['focus-dark','focus-light','midnight','atelier'].includes(resolvedTheme());}
function setTheme(theme,reason='selection'){
  store.settings.theme=theme;document.documentElement.dataset.theme=resolvedTheme();
  document.querySelector('meta[name="theme-color"]').content={graphite:'#181b1f',paper:'#f4f2eb',forest:'#10201d','focus-dark':'#141d26','focus-light':'#f4f5f1',midnight:'#070a10',atelier:'#f3ede3'}[resolvedTheme()];
  document.documentElement.classList.toggle('compact-layout',compactLayout());
  applyLayout(compactLayout());
  if(observeTheme(game,currentTheme())){save();audit('theme',{reason});}
}
function applyLayout(focus){
  const group=$('focus-tools');
  const ids=['undo-button','redo-button','erase-button','pencil-button','candidates-button','hint-button'];
  if(focus)ids.forEach(id=>group.append($(id)));
  else {['pencil-button','candidates-button'].forEach(id=>document.querySelector('.note-controls').append($(id)));['undo-button','redo-button','erase-button','hint-button'].forEach(id=>document.querySelector('.tools').append($(id)));}
  updateControls();
}
function updateControls(){
  const finished=!!game?.completed,compact=compactLayout();
  $('completion-controls').hidden=!finished;
  $('focus-tools').hidden=finished||!compact;
  document.querySelector('.note-controls').hidden=finished||compact;
  document.querySelector('.controls').hidden=finished;
  document.querySelector('.tools').hidden=finished||compact;
}
setTheme(store.settings.theme,'open');media.addEventListener('change',()=>setTheme(store.settings.theme,'system-change'));
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
function flushClock(){if(clockStart!==null&&game){const now=performance.now();game.elapsedMs+=Math.max(0,now-clockStart);clockStart=now;}}
function stopClock(){flushClock();clockStart=null;}
function startClock(){if(game&&!paused&&!loading&&!game.completed&&!document.hidden&&!$('sheet').open&&clockStart===null)clockStart=performance.now();}
function save(){
  flushClock();observeTheme(game,currentTheme());store.game=game;
  try{
    const previous=localStorage.getItem(STORE_KEY);
    if(previous)localStorage.setItem(STORE_KEY+'.backup',previous);
    localStorage.setItem(STORE_KEY,JSON.stringify(store));saveOk=true;$('save-label').textContent='Сохранено на устройстве';$('save-label').classList.remove('warning-copy');
  }catch{saveOk=false;$('save-label').textContent='Не удалось сохранить';$('save-label').classList.add('warning-copy');}
  return saveOk;
}
function audit(kind='checkpoint',detail={}){if(!game)return;flushClock();observeTheme(game,currentTheme());try{capture(game,kind,detail).catch(()=>toast('Не удалось записать историю. Сохраните резервную копию.'));}catch{toast('Хранилище заполнено. Сохраните резервную копию.');}}
function pausedView(){
  const cover=paused&&game&&!game.completed&&!loading;
  $('pause-layer').hidden=!cover;$('board').inert=!!cover;$('board').setAttribute('aria-hidden',String(!!cover));
  document.querySelector('.board-wrap').classList.toggle('covered',!!cover);
  $('pause-button').setAttribute('aria-label',game?.completed?'Время решения':paused?'Продолжить игру':'Приостановить игру');
  $('pause-button').lastElementChild.innerHTML=icon(paused?'play':'pause');
  $('pause-button').disabled=!!game?.completed;
  $('pause-button').lastElementChild.hidden=!!game?.completed;
  for(const id of ['pencil-button','candidates-button','undo-button','redo-button','erase-button','hint-button'])$(id).disabled=!!(paused||loading||!game||game.completed||(id==='undo-button'&&!game.history.length)||(id==='redo-button'&&!game.future?.length));
  document.querySelectorAll('.number-button').forEach(el=>el.disabled=!!(paused||loading||!game||game.completed));
  updateControls();
}
function pause(reason='manual'){
  if(!game||game.completed||loading)return;
  stopClock();paused=true;
  $('pause-title').textContent=reason==='return'?'С возвращением':'Пауза';
  $('pause-copy').textContent=reason==='return'?'Партия и заметки на месте. Время остановлено.':'Время остановлено. Продолжим?';
  save();audit('pause',{reason});pausedView();
}
function resume(){if(!game||loading||game.completed)return;paused=false;startClock();audit('resume');render();}

for(let i=0;i<81;i++){
  const b=document.createElement('button');b.className='cell';b.type='button';b.dataset.index=i;
  b.addEventListener('click',()=>selectCell(i));$('board').append(b);
}
for(let n=1;n<=9;n++){
  const b=document.createElement('button');b.type='button';b.className='number-button';b.dataset.number=n;b.setAttribute('aria-label',`Цифра ${n}`);b.innerHTML=`${n}<small></small>`;
  let hold=null,long=false;
  b.addEventListener('pointerdown',e=>{if(e.button!==0||b.disabled)return;long=false;if(game&&digitIsComplete(game,n))return;hold=setTimeout(()=>{long=true;if(digitIsComplete(game,n)){input(n);return;}locked=locked===n?0:n;render();toast(locked?`Цифра ${n} закреплена. Нажимайте клетки.`:'Закрепление снято.');},480);});
  for(const event of ['pointerup','pointercancel','pointerleave'])b.addEventListener(event,()=>clearTimeout(hold));
  b.addEventListener('contextmenu',e=>e.preventDefault());
  b.addEventListener('click',()=>{if(long){long=false;return;}if(locked===n){locked=0;render();return;}input(n);});
  $('numpad').append(b);
}
function selectCell(i){
  if(!game||(paused&&!game.completed)||loading)return;
  game.selected=i;highlight=0;
  if(locked&&!game.values[i]&&!game.completed){input(locked);return;}
  render();save();
}
function input(n){
  if(!game||paused||loading||game.completed)return;
  const at=game.selected;
  const correcting=store.settings.showMistakes&&!game.pencil&&!game.givens[at]&&game.values[at]&&game.values[at]!==game.solution[at];
  if(digitIsComplete(game,n)||(game.values[at]&&!correcting)){
    const target=nearestPlacedDigit(game,n);
    locked=0;highlight=n;
    if(target>=0)game.selected=target;
    else toast(`Цифры ${n} на поле пока нет. Подсвечены ее варианты.`);
    render();save();return;
  }
  highlight=0;
  const digitMode=!game.pencil;
  flushClock();if(place(game,at,n,store.settings)){
    if(digitIsComplete(game,n))locked=0;
    const mistake=!!(digitMode&&n&&n!==game.solution[at]);
    changed(digitMode?'digit':'note',{digit:n,cell:at,mistake});
    if(mistake&&store.settings.showMistakes)toast('Неверная цифра. Можно отменить ход или ввести другую.');
  }
}
function changed(kind='edit',detail={}){
  highlight=0;
  flushClock();
  if(complete(game,store.stats)){stopClock();save();render();showWin();}
  else{save();render();}
  audit(kind,detail);
}
function render(){
  if(!game){for(const b of $('board').children){b.className='cell';b.innerHTML='';}pausedView();return;}
  const selected=game.selected,match=locked||highlight||game.values[selected],wrong=store.settings.showMistakes?mistakeCells(game):new Set();
  const bad=new Set([...(store.settings.showConflicts?conflicts(game.values):[]),...wrong]);
  const peerSet=new Set(PEERS[selected]);
  for(const b of $('board').children){
    const i=Number(b.dataset.index),r=row(i),c=col(i),v=game.values[i];
    b.className=['cell',(Math.floor(r/3)+Math.floor(c/3))%2?'alt':'',c===2||c===5?'major-right':'',r===2||r===5?'major-bottom':'',store.settings.highlightPeers&&peerSet.has(i)?'peer':'',match&&v===match?'match':'',i===selected?'selected':'',v&&!game.givens[i]?'entered':'',bad.has(i)?'conflict':'',wrong.has(i)?'mistake':''].filter(Boolean).join(' ');
    b.setAttribute('aria-pressed',String(i===selected));
    const noteDigits=digits(game.notes[i]);
    b.setAttribute('aria-label',`Строка ${r+1}, столбец ${c+1}: ${v?`${v}${game.givens[i]?', задано':''}`:noteDigits.length?`заметки ${noteDigits.join(', ')}`:'пусто'}${wrong.has(i)?', ошибка':bad.has(i)?', повтор цифры':''}`);
    b.setAttribute('aria-invalid',String(wrong.has(i)));
    b.innerHTML=v?String(v):`<span class="notes" aria-hidden="true">${Array.from({length:9},(_,j)=>{const present=game.notes[i]&(1<<(j+1));return `<span class="${present&&j+1===match?'lit':''}">${present?j+1:''}</span>`;}).join('')}</span>`;
  }
  const idx=LEVELS.findIndex(l=>l.id===game.level);$('level-label').textContent=LEVELS[idx].name;
  document.querySelectorAll('.game-meta .difficulty-dots i').forEach((el,j)=>el.classList.toggle('on',j<=idx));
  $('timer').textContent=formatTime(game.elapsedMs);
  $('pencil-button').setAttribute('aria-pressed',String(game.pencil));
  $('progress').textContent=`${game.values.filter(Boolean).length} / 81`;
  $('cell-caption').textContent=game.completed?'Задача решена':wrong.has(selected)?'Неверная цифра · отмените ход или исправьте':wrong.size?`Ошибок на поле: ${wrong.size} · проверьте красные клетки`:locked?`Закреплена ${locked} · нажмите ее, чтобы снять`:bad.has(selected)?'Конфликт в строке, столбце или блоке':`Строка ${row(selected)+1} · столбец ${col(selected)+1}${game.pencil?' · заметки':''}`;
  $('cell-caption').classList.toggle('warning-copy',wrong.size>0);
  for(const b of $('numpad').children){const n=Number(b.dataset.number),left=9-game.values.filter(v=>v===n).length;b.querySelector('small').textContent=Math.max(0,left);b.classList.toggle('finished',left<=0);b.setAttribute('aria-label',left<=0?`Цифра ${n}: все девять на поле, подсветить`:`Цифра ${n}`);b.classList.toggle('locked',locked===n);b.classList.toggle('tracking',match===n);b.setAttribute('aria-pressed',String(locked===n));}
  pausedView();
}
function closeSheet(){ $('sheet').close(); }
function openSheet(title,html,eyebrow='СУДОКУ'){
  if(!$('sheet').open){resumeAfterSheet=!!(game&&!paused&&!game.completed&&!loading);stopClock();save();}
  $('sheet-title').textContent=title;$('sheet-eyebrow').textContent=eyebrow;$('sheet-content').innerHTML=html;icons($('sheet'));
  if(!$('sheet').open)$('sheet').showModal();
  $('sheet').scrollTop=0;
}
$('close-sheet').addEventListener('click',closeSheet);
$('sheet').addEventListener('close',()=>{if(resumeAfterSheet&&!paused&&!document.hidden)startClock();resumeAfterSheet=false;});
$('sheet').addEventListener('click',e=>{if(e.target===$('sheet')){const r=$('sheet').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSheet();}});
$('pause-button').addEventListener('click',()=>paused?resume():pause());$('resume-button').addEventListener('click',resume);
$('pencil-button').addEventListener('click',()=>{if(!game||paused)return;game.pencil=!game.pencil;save();render();});
$('candidates-button').addEventListener('click',()=>{
  if(!game||paused)return;
  fillAllNotes(game);changed('candidates');toast('Варианты заполнены во всех пустых клетках.');
});
$('undo-button').addEventListener('click',()=>{if(game&&!paused&&undo(game))changed('undo');});
$('redo-button').addEventListener('click',()=>{if(game&&!paused&&redo(game))changed('redo');});
$('erase-button').addEventListener('click',()=>{if(game&&!paused&&erase(game,game.selected))changed('erase');});
$('new-button').addEventListener('click',showLevels);
function showLevels(){
  openSheet('Новая задача',`<p class="sheet-copy">Выберите свой уровень. Все задачи имеют единственное решение.</p><div class="level-list">${LEVELS.map((l,i)=>`<button class="level-option ${game?.level===l.id?'current':''}" data-level="${l.id}"><span><b>${l.name}</b><small>${l.subtitle}</small></span><span class="difficulty-dots">${Array.from({length:7},(_,j)=>`<i class="${j<=i?'on':''}"></i>`).join('')}</span></button>`).join('')}</div><p class="sheet-copy" style="margin:18px 0 0">Сложность оценивается по приемам решения. Максимальный — высший уровень нашей шкалы.</p>`,'ВАШ ТЕМП. ВАШ УРОВЕНЬ.');
  document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{
    const level=b.dataset.level;
    if(game&&!game.completed&&(game.history.length||game.elapsedMs>10000)){
      openSheet('Начать новую?',`<p class="sheet-copy">Текущая партия останется в истории. Вы сможете вернуться к ней позже.</p><div class="button-row"><button class="secondary" id="keep-game">Продолжить текущую</button><button class="primary" id="confirm-new">Новая задача</button></div>`);
      $('keep-game').onclick=closeSheet;$('confirm-new').onclick=()=>startNew(level);
    }else startNew(level);
  });
}
async function startNew(level='extreme'){
  localStorage.removeItem('sudoku.public.fresh-start');
  if(game){stopClock();audit();}
  stopClock();loading=true;paused=false;locked=0;highlight=0;resumeAfterSheet=false;if($('sheet').open)closeSheet();
  $('loading-layer').hidden=false;render();
  puzzleWorker?.terminate();puzzleWorker=new Worker(new URL('./puzzle-worker.js',import.meta.url),{type:'module'});
  const timeout=setTimeout(()=>failed('Подготовка заняла слишком много времени. Попробуйте еще раз.'),20000);
  function failed(message){clearTimeout(timeout);puzzleWorker?.terminate();loading=false;$('loading-layer').hidden=true;if(game){pause();render();}openSheet('Не удалось начать',`<p class="sheet-copy" id="generation-error"></p><button class="primary" id="retry-game">Попробовать снова</button>`);$('generation-error').textContent=message;$('retry-game').onclick=()=>startNew(level);}
  puzzleWorker.onerror=()=>failed('Не удалось загрузить задачи. Для первой загрузки нужен интернет.');
  puzzleWorker.onmessage=({data})=>{
    if(data.error){failed(data.error);return;}
    clearTimeout(timeout);puzzleWorker.terminate();game=newGame(data.puzzle,data.solution,level,data.sourceId,currentTheme());store.game=game;loading=false;paused=document.hidden;$('loading-layer').hidden=true;
    if(document.hidden)pause('return');else if($('sheet').open)resumeAfterSheet=true;
    render();startClock();save();audit('start');
    try{const seen=JSON.parse(localStorage.getItem('sudoku.public.seen')||'{}');seen[level]=[...(seen[level]||[]),data.sourceId].slice(-5000);localStorage.setItem('sudoku.public.seen',JSON.stringify(seen));}catch{}
  };
  let seen=[];try{seen=JSON.parse(localStorage.getItem('sudoku.public.seen')||'{}')[level]||[];}catch{}
  puzzleWorker.postMessage({level,seed:crypto.getRandomValues(new Uint32Array(1))[0],exclude:game?.sourceId,seen});
}

$('settings-button').addEventListener('click',showSettings);
function themeCard(id,label,bg,line,accent){return `<button class="theme-card ${resolvedTheme()===id?'active':''}" data-theme-choice="${id}" aria-label="Оформление ${label}" aria-pressed="${resolvedTheme()===id}"><span class="theme-swatch" style="--swatch-bg:${bg};--swatch-line:${line};--swatch-accent:${accent}">${'<i></i>'.repeat(9)}</span><b>${label}</b></button>`;}
function showSettings(){
  openSheet('Под вас',`<p class="sheet-copy">Спокойное поле, удобные заметки и ничего лишнего.</p><div class="themes">${themeCard('graphite','Графит','#181b1f','#50565e','#ebc887')}${themeCard('paper','Бумага','#f4f2eb','#b9c1c2','#315f8c')}${themeCard('forest','Хвоя','#10201d','#4a7562','#b9dca5')}${themeCard('focus-light','Фокус · день','#f4f5f1','#9caeb8','#376e92')}${themeCard('focus-dark','Фокус · ночь','#141d26','#667e8e','#9ac9e7')}${themeCard('midnight','Полночь','#070a10','#607794','#85b7ff')}${themeCard('atelier','Ателье','#f3ede3','#a78d73','#976044')}</div>
    <label class="setting-row"><span>Как на iPhone<small>Светлая или темная тема автоматически</small></span><input type="checkbox" id="system-theme" ${store.settings.theme==='system'?'checked':''}></label>
    <h3 class="sheet-section">Во время игры</h3>
    <label class="setting-row"><span>Убирать занятые заметки<small>После ввода цифры в связанных клетках</small></span><input type="checkbox" data-setting="cleanNotes" ${store.settings.cleanNotes?'checked':''}></label>
    <label class="setting-row"><span>Сразу показывать ошибки<small>Неверная цифра выделяется красным. Можно исправить или отменить, партия продолжается.</small></span><input type="checkbox" data-setting="showMistakes" ${store.settings.showMistakes?'checked':''}></label>
    <label class="setting-row"><span>Показывать конфликты<small>Только повторы в строке, столбце и блоке</small></span><input type="checkbox" data-setting="showConflicts" ${store.settings.showConflicts?'checked':''}></label>
    <label class="setting-row"><span>Подсвечивать область<small>Строку, столбец и блок выбранной клетки</small></span><input type="checkbox" data-setting="highlightPeers" ${store.settings.highlightPeers?'checked':''}></label>
    <div class="button-row"><button class="secondary" id="settings-school">Школа судоку</button><button class="secondary" id="settings-history">История и разбор</button><button class="secondary" id="settings-account">Локальные данные</button></div><h3 class="sheet-section">Ваши сохранения</h3><p class="sheet-copy">Партия и история сохраняются в этом браузере. В разделе «История» можно восстановить незаконченные партии и выгрузить полный разбор.</p>
    <div class="button-row"><button class="secondary" id="export-button">${icon('download')}Сохранить файл</button><button class="secondary" id="import-button">${icon('upload')}Восстановить</button></div>
    <button class="secondary" id="help-button" style="width:100%;margin-top:12px">Как играть и установить</button>`,'ОФОРМЛЕНИЕ И НАСТРОЙКИ');
  document.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>{setTheme(b.dataset.themeChoice);save();render();showSettings();});
  $('system-theme').onchange=e=>{setTheme(e.target.checked?'system':resolvedTheme());save();showSettings();};
  document.querySelectorAll('[data-setting]').forEach(b=>b.onchange=()=>{store.settings[b.dataset.setting]=b.checked;save();render();});
  $('settings-school').onclick=features.academy;$('settings-history').onclick=features.history;$('settings-account').onclick=features.account;$('help-button').onclick=showHelp;$('export-button').onclick=exportSave;$('import-button').onclick=()=>$('import-file').click();
}
function exportSave(){
  save();const blob=new Blob([JSON.stringify({...store,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`sudoku-public-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Сохраните файл в приложении «Файлы».');
}
$('import-file').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{
    if(file.size>10000000)throw new Error('Слишком большой файл сохранения.');
    const incoming=normalizeStore(JSON.parse(await file.text()));
    if(incoming.game){const checked=solve(incoming.game.givens);if(checked.count!==1||checked.exhausted)throw new Error('Задача в файле не прошла проверку.');}
    openSheet('Восстановить копию?',`<p class="sheet-copy">Файл заменит текущую партию, оформление и статистику на этом устройстве.</p><div class="button-row"><button class="secondary" id="cancel-import">Отмена</button><button class="primary" id="confirm-import">Восстановить</button></div>`);
    $('cancel-import').onclick=showSettings;$('confirm-import').onclick=()=>{stopClock();store=incoming;game=store.game;locked=0;paused=true;resumeAfterSheet=false;setTheme(store.settings.theme,'import');save();closeSheet();render();if(!game)startNew();toast('Сохранение восстановлено.');};
  }catch(error){toast(error.message||'Не удалось прочитать файл.');}
});
function showHelp(){
  openSheet('Все под рукой',`<ol class="help-list"><li><b>Цифра.</b> Выберите пустую клетку и нажмите цифру. На заданной или правильно заполненной клетке клавиатура переключает на ближайшую уже стоящую цифру и подсвечивает ее и заметки. Неверная цифра сразу выделяется красным: ее можно заменить с клавиатуры, стереть или отменить ход. Ошибки не прерывают партию. Удерживайте цифру, чтобы закрепить ее и расставить в нескольких пустых клетках.</li><li><b>Карандаш.</b> Включите его для ручных заметок. Повторное нажатие на цифру убирает заметку.</li><li><b>Все варианты.</b> Одно нажатие заполняет допустимые заметки во всех пустых клетках всего поля по текущим цифрам. Доказанные подсказкой исключения сохраняются при добавлении цифр; при стирании или замене цифры они проверяются заново. Это не проверка по готовому решению.</li><li><b>Отмена.</b> Восстанавливает и цифры, и связанные заметки. Доступно до 500 последних действий, в том числе после перезапуска. «Вернуть» повторяет отмененный ход. Полная история для разбора хранится отдельно и не ограничена этими 500 действиями.</li><li><b>Время.</b> Считается только активная игра. В фоне, на паузе и при открытом меню таймер остановлен.</li><li><b>Офлайн на iPhone.</b> Откройте опубликованную игру в Safari, выберите «Поделиться» → «На экран Домой». Затем откройте с иконки с интернетом и дождитесь «Офлайн готово». После этого проверьте запуск в авиарежиме.</li></ol><p class="sheet-copy">На компьютере работают цифры, стрелки, N — карандаш, A — варианты, Backspace — стереть, ⌘Z — отмена. Для установки на телефон разместите игру на собственном HTTPS-сайте.</p>`,'НЕСКОЛЬКО ПРОСТЫХ ПРИЕМОВ');
}
$('stats-button').addEventListener('click',async()=>{
  openSheet('Ваш ритм','<p class="sheet-copy">Собираем вашу статистику…</p>');
  try{const remote=await cloudGames();for(const g of remote)if(g.completed&&!store.stats.some(s=>s.id===g.id))store.stats.push({id:g.id,level:g.level,elapsedMs:g.elapsedMs,hints:g.hints,mistakes:g.mistakes??null,at:g.updatedAt,...themeStats(g),...(g.mistakeCorrection?{mistakeCorrection:g.mistakeCorrection,recordedMistakes:g.recordedMistakes}:{})});save();}catch{}
  const summary=summarizeStatistics(store.stats);
  openSheet('Ваш ритм',`<p class="sheet-copy stats-credit">Каждая решенная задача засчитывается, даже с ошибками и подсказками. Все затраченное на нее активное время сохранено.</p><div class="stats-overview"><div class="stat-card"><strong>${summary.solved}</strong><span>решено задач</span></div><div class="stat-card"><strong>${summary.perfect}</strong><span>без ошибок и подсказок</span></div><div class="stat-card"><strong>${summary.noHints}</strong><span>без подсказок</span></div><div class="stat-card"><strong>${summary.noErrors}</strong><span>без ошибок</span></div><div class="stat-card"><strong>${summary.withErrors}</strong><span>с ошибками, но решено</span></div><div class="stat-card"><strong>${formatTime(summary.totalMs)}</strong><span>время всех решений</span></div></div><table class="stat-table"><thead><tr><th>Уровень</th><th>Решено</th><th>Чисто</th><th>Лучшее</th></tr></thead><tbody>${summary.levels.map(l=>`<tr><td>${l.name}</td><td>${l.solved}</td><td>${l.perfect}</td><td>${l.bestMs===null?'—':formatTime(l.bestMs)}<small>чисто ${l.bestCleanMs===null?'—':formatTime(l.bestCleanMs)}</small>${l.averageMs===null?'':`<small>ср. ${formatTime(l.averageMs)}</small>`}</td></tr>`).join('')}</tbody></table><p class="sheet-copy">«Решено», общее время, лучшее и среднее время учитывают все завершенные задачи. «Чисто» — только без ошибок и подсказок; его рекорд показан отдельно. Незаконченные партии и их время остаются в истории.</p><details class="stats-rules"><summary>Как считаются ошибки и подсказки</summary><p class="sheet-copy">Ошибкой считается каждый новый неверный ввод цифры, даже после отмены или исправления и при выключенной подсветке. Возврат уже сделанного хода не добавляет ошибку. Заметки ошибками не считаются; карандаш и «Варианты» не считаются подсказками. Подсказки учитываются при применении шага. Старые записи без счетчика ошибок не попадают в чистые рекорды.</p></details><button class="secondary" id="stats-history" style="width:100%">История, ошибки и разбор ходов</button>`,'КАЖДАЯ РЕШЕННАЯ ЗАДАЧА В СЧЕТ');$('stats-history').onclick=features.history;
});
$('hint-button').addEventListener('click',()=>{
  if(!game||paused||loading||game.completed)return;
  const wrong=store.settings.showMistakes?mistakeCells(game):new Set();
  if(wrong.size){
    const at=wrong.has(game.selected)?game.selected:[...wrong][0];
    openSheet('Сначала исправим ошибку',`<p class="hint-text">Красным отмечены цифры, которые не подходят к решению этой задачи. Можно отменить ход, стереть цифру или заменить ее с клавиатуры. Партия продолжается.</p>${hintBoard(game.values,game.proven,null,{mistakes:[...wrong],notes:game.notes})}<button class="primary" id="show-mistake">Вернуться к ошибочной клетке</button>`);
    $('show-mistake').onclick=()=>{game.selected=at;render();save();closeSheet();};return;
  }
  const bad=conflicts(game.values);
  if(bad.size){const at=[...bad].find(i=>!game.givens[i]);openSheet('Сначала конфликт',`<p class="hint-text">Одна цифра повторяется в строке, столбце или блоке. Проверьте отмеченные клетки.</p>${hintBoard(game.values,game.proven,null,{conflicts:[...bad],notes:game.notes})}<button class="primary" id="show-conflict">Показать на игровом поле</button>`);$('show-conflict').onclick=()=>{game.selected=at??[...bad][0];render();closeSheet();};return;}
  const result=solve(game.values,{limit:1});
  if(!result.count||result.exhausted){openSheet('Проверьте последние ходы',`<p class="hint-text">Из текущего положения решение не найдено. Попробуйте отменить последние цифры или очистить клетку, в которой сомневаетесь.</p>${hintBoard(game.values,game.proven,null,{notes:game.notes})}`);return;}
  const step=coachStep(game.values,game.proven,game.notes);audit('hint-view',{technique:step?.type||'reveal-option'});
  if(step){
    function explain(stage=0){
      openSheet(stage===0?'Куда посмотреть':stage===1?'Основание приема':'Применить шаг',`<span class="hint-type">${step.type}</span><p class="hint-text">${stage===0?direction(step):step.text}</p>${step.skipped?'<p class="sheet-copy">Уже убранные вами варианты учтены. Ниже — следующий полезный шаг.</p>':''}${hintBoard(game.values,game.proven,step,{explain:stage>0,notes:game.notes})}${stage>0&&step.trace?.length?`<details><summary>Вся цепочка доказательства · ${step.trace.length} шагов</summary><ol class="proof-chain">${step.trace.map(t=>`<li>${t}</li>`).join('')}</ol></details>`:''}<div class="button-row hint-actions">${stage<2?'<button class="primary" id="hint-next">'+(stage===0?'Показать объяснение':'Следующий шаг')+'</button>':'<button class="primary" id="apply-hint">'+(step.kind==='place'?'Поставить цифру':'Применить к заметкам')+'</button>'}<button class="secondary" id="hint-school">Изучить приемы</button></div>`,'ПО ВАШЕЙ ТЕКУЩЕЙ ПОЗИЦИИ');
      if($('hint-next'))$('hint-next').onclick=()=>explain(stage+1);
      if($('apply-hint'))$('apply-hint').onclick=()=>{const applied=applyHint(game,step,store.settings);closeSheet();if(applied)changed('hint',{technique:step.type,text:step.text,trace:step.trace||[]});else toast('Этот шаг уже выполнен или позиция изменилась. Откройте подсказку еще раз.');};
      $('hint-school').onclick=features.academy;
    }
    explain();
  }else{
    const at=!game.values[game.selected]?game.selected:game.values.findIndex(n=>!n);
    openSheet('Нужен более глубокий шаг',`<p class="hint-text">Сейчас не найден короткий прием, который можно объяснить одной подсказкой. Продолжайте анализ цепочек или откройте одну клетку.</p>${hintBoard(game.values,game.proven,{kind:'place',index:at,cells:[at]},{notes:game.notes})}<p class="hint-location">Будет показан ответ для клетки: строка ${row(at)+1}, столбец ${col(at)+1}. Это открытие цифры из решения, без логического объяснения.</p><button class="primary" id="reveal-cell">Открыть одну клетку</button>`,'МАКСИМАЛЬНАЯ СЛОЖНОСТЬ');
    const reveal={kind:'place',index:at,value:game.solution[at],context:{values:[...game.values],proven:[...game.proven],notes:[...game.notes]}};
    $('reveal-cell').onclick=()=>{const applied=applyHint(game,reveal,store.settings);closeSheet();if(applied)changed('hint',{technique:'Открытие из решения'});else toast('Позиция изменилась. Откройте подсказку еще раз.');};
  }
});
function showWin(){
  const mistakes=effectiveMistakes(game);
  openSheet('Красиво решено.',`<div class="success-symbol">${icon('check')}</div><div class="result-time">${formatTime(game.elapsedMs)}</div><p class="result-sub">${LEVELS.find(l=>l.id===game.level).name} · ${game.hints?`подсказок: ${game.hints}`:'без подсказок'}<br>${mistakes===0?'без ошибок':mistakes==null?'ошибки не учитывались':`ошибок: ${mistakes}`}<br>Только ваше активное время</p><button class="primary" id="next-game" style="width:100%">Следующая задача</button><button class="quiet" id="review-game" style="margin:12px auto 0">Посмотреть решение</button>`,'ЕЩЕ ОДНА ЗАДАЧА ПОКОРИЛАСЬ');
  $('next-game').onclick=()=>startNew(game.level);$('review-game').onclick=closeSheet;
}
$('close-solution').onclick=showWin;
$('completed-next').onclick=()=>startNew(game.level);
document.addEventListener('keydown',e=>{
  if($('sheet').open||!game||loading||e.target.matches('input,textarea'))return;
  if(e.code==='Space'){e.preventDefault();paused?resume():pause();return;}if(paused||game.completed)return;
  if(/^[1-9]$/.test(e.key)){e.preventDefault();input(Number(e.key));}
  else if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();if(erase(game,game.selected))changed('erase');}
  else if(e.key.toLowerCase()==='z'&&(e.metaKey||e.ctrlKey)){e.preventDefault();if(e.shiftKey?redo(game):undo(game))changed(e.shiftKey?'redo':'undo');}
  else if(e.key.toLowerCase()==='n')$('pencil-button').click();
  else if(e.key.toLowerCase()==='a'&&!e.metaKey&&!e.ctrlKey)$('candidates-button').click();
  else if(e.key.startsWith('Arrow')){e.preventDefault();const i=game.selected;const at={ArrowRight:i%9===8?i:i+1,ArrowLeft:i%9===0?i:i-1,ArrowUp:Math.max(0,i-9),ArrowDown:Math.min(80,i+9)}[e.key];if(at!==undefined){game.selected=at;render();save();}}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){resumeAfterSheet=false;pause('return');}});
window.addEventListener('pagehide',()=>{stopClock();paused=true;save();audit('pause',{reason:'pagehide'});});
window.addEventListener('pageshow',e=>{if(e.persisted){paused=true;clockStart=null;render();}});
setInterval(()=>{flushClock();if(game)$('timer').textContent=formatTime(game.elapsedMs);},250);
setInterval(()=>{if(clockStart!==null){save();audit();}},5000);

$('offline-button').addEventListener('click',()=>{
  openSheet(offlineReady?'Готово без интернета':'Офлайн еще не готов',`<p class="sheet-copy">${offlineReady?'Игра, задачи и оформление сохранены на этом устройстве. Новые партии, заметки и статистика доступны без подключения.':'Для первой загрузки откройте игру с интернетом. Дождитесь сообщения «Офлайн готово» перед отключением сети.'}</p><p class="sheet-copy">После добавления на экран Домой один раз откройте игру с новой иконки с интернетом. Очистка данных сайта или удаление приложения может удалить сохранения. Резервная копия доступна в настройках.</p><button class="secondary" id="install-help" style="width:100%">Как установить на iPhone</button>`);$('install-help').onclick=showHelp;
});
async function initOffline(){
  if(!('serviceWorker' in navigator)||!isSecureContext){$('offline-label').textContent='Офлайн требует HTTPS';return;}
  try{
    swRegistration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
    const ready=await navigator.serviceWorker.ready;
    let repairing=false;
    function display(data){offlineReady=data.ready===true;$('offline-label').textContent=offlineReady?'Офлайн готово':'Офлайн пока недоступен';$('offline-dot').classList.toggle('ready',offlineReady);}
    function check(){
      const worker=navigator.serviceWorker.controller||ready.active;if(!worker)return;
      const channel=new MessageChannel();channel.port1.onmessage=({data})=>{
        channel.port1.close();display(data);
        if(!data.ready&&data.protocol>=2&&navigator.onLine&&!repairing){
          repairing=true;$('offline-label').textContent='Офлайн загружается';
          const repair=new MessageChannel(),timer=setTimeout(()=>{repair.port1.close();repairing=false;display({ready:false});},40000);
          repair.port1.onmessage=({data})=>{clearTimeout(timer);repair.port1.close();repairing=false;display(data);};
          worker.postMessage({type:'PREPARE'},[repair.port2]);
        }
      };worker.postMessage({type:'STATUS'},[channel.port2]);
    }
    check();navigator.serviceWorker.addEventListener('controllerchange',check);
    window.addEventListener('online',check);
    function pending(){if(swRegistration.waiting)$('update-button').hidden=false;}
    pending();swRegistration.addEventListener('updatefound',()=>{const installing=swRegistration.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed')pending();});});
    $('update-button').onclick=()=>{pause();save();navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});swRegistration.waiting?.postMessage({type:'ACTIVATE'});};
  }catch{$('offline-label').textContent='Офлайн недоступен';$('offline-dot').classList.add('error');}
}
const features=featureUI({open:openSheet,toast,audit,download:(data,name)=>{const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);},restore:(g,{newBranch=false}={})=>{stopClock();audit();if(newBranch)g.themeAtStart=currentTheme();game=g;store.game=g;paused=true;resumeAfterSheet=false;locked=0;highlight=0;save();closeSheet();render();audit('resume',{fromHistory:true});}});
$('learn-button').onclick=features.academy;$('account-button').onclick=features.account;
initOffline();
if(game){$('loading-layer').hidden=true;loading=false;pause('return');render();}else if(localStorage.getItem('sudoku.public.fresh-start')){$('loading-layer').hidden=true;showLevels();}else startNew();
if(loadWarning)setTimeout(()=>toast(loadWarning),1000);

import {LESSONS,SOURCES} from './academy.js';
import {LESSON_EXAMPLES,practiceFor} from './lesson-examples.js';
import {hintBoard} from './hint-board.js';
import {games,getGame,replay,device} from './journal.js';
import {effectiveMistakes} from './mistake-corrections.js';
import {recordStorageLabel} from './history-status.js';
import {LEVELS,digits,row,col} from './engine.js';
import {formatTime,newGame} from './state.js';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={theme:'Смена оформления',start:'Начало партии',edit:'Изменение',digit:'Ввод цифры',note:'Карандаш',candidates:'Все варианты',erase:'Удаление',undo:'Отмена',redo:'Возврат',hint:'Подсказка применена','hint-view':'Просмотр подсказки',lesson:'Обучение',resume:'Продолжение',pause:'Пауза'};
export function featureUI(api){
 let schoolGroup='Основа';
 const quizOrders=new Map();
 function quizOptions(lesson){
  if(!quizOrders.has(lesson.id)){
   const choices=lesson.options.map((text,index)=>({text,index}));
   for(let i=choices.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[choices[i],choices[j]]=[choices[j],choices[i]];}
   quizOrders.set(lesson.id,choices);
  }
  return quizOrders.get(lesson.id);
 }
 const groupDescriptions={'Основа':'Правила, сканирование и работа с заметками','Одиночки':'Находим единственное место для цифры','Пересечения':'Связываем строки, столбцы и блоки','Группы':'Пары, тройки и скрытые наборы','Рыбы':'Узоры кандидатов в нескольких линиях','Цепочки':'Проверяем связи и делаем выводы','Крылья':'Ищем опорные клетки и общий кандидат','Единственность':'Используем условие одного решения','Продвинутое':'Сложные конструкции и исключения','Практика':'Стратегия, внимательность и разбор ошибок'};
 const LEARNED='sudoku.public.learned',CURRICULUM='sudoku.public.curriculum';
 if(localStorage.getItem(CURRICULUM)!=='2'){localStorage.setItem(LEARNED,'[]');localStorage.setItem(CURRICULUM,'2');}
 let learned;try{learned=JSON.parse(localStorage.getItem(LEARNED)||'[]');if(!Array.isArray(learned))learned=[];}catch{learned=[];}
 const remember=()=>localStorage.setItem(LEARNED,JSON.stringify(learned));
 function resetSchool(){
  api.open('Пройти школу заново?',`<p class="sheet-copy">Снимем только отметки уроков. Партии, статистика и настройки сохранятся. Уроки и примеры можно повторять сколько угодно.</p><div class="lesson-actions"><button class="primary" id="confirm-school-reset">Начать обучение заново</button><button class="secondary" id="cancel-school-reset">Оставить отметки</button></div>`,'ШКОЛА СУДОКУ');
  $('confirm-school-reset').onclick=()=>{learned=[];remember();quizOrders.clear();schoolGroup='Основа';academy();api.toast('Отметки сняты. Можно пройти школу с начала.');};$('cancel-school-reset').onclick=academy;
 }
 function gridHTML(g,classes=()=>'',click=false){return `<div class="study-grid" role="group" aria-label="Учебное поле">${g.values.map((v,i)=>`<${click?'button type="button"':'span'} class="study-cell ${classes(i)}" data-study-cell="${i}" aria-label="Строка ${row(i)+1}, столбец ${col(i)+1}">${v||`<span class="study-notes">${Array.from({length:9},(_,j)=>`<i>${g.notes[i]&(1<<j+1)?j+1:''}</i>`).join('')}</span>`}</${click?'button':'span'}>`).join('')}</div>`;}
 function academy(){
  api.open('Школа судоку',`<p class="sheet-copy">От базы к сложным цепочкам. Раскройте нужный раздел и выберите прием. Все ${LESSONS.length} уроков и упражнения доступны офлайн.</p><div class="school-progress"><strong>${LESSONS.filter(l=>learned.includes(l.id)).length} / ${LESSONS.length}</strong><span>уроков пройдено</span></div><button class="secondary school-restart" id="restart-school">Начать обучение заново</button>${[...new Set(LESSONS.map(l=>l.group))].map((group,index)=>{const items=LESSONS.filter(l=>l.group===group),done=items.filter(l=>learned.includes(l.id)).length;return `<details class="lesson-group" data-group="${group}" ${group===schoolGroup?'open':''}><summary><span class="lesson-number">${String(index+1).padStart(2,'0')}</span><span class="lesson-heading"><strong>${group}</strong><small>${groupDescriptions[group]}</small><small class="group-progress">Пройдено ${done} из ${items.length}</small></span></summary><div class="lesson-list">${items.map(l=>`<button class="lesson-link" data-lesson="${l.id}"><span>${l.title}</span><span aria-label="${learned.includes(l.id)?'Пройдено':'Открыть'}">${learned.includes(l.id)?'✓':'›'}</span></button>`).join('')}</div></details>`;}).join('')}<p class="sheet-copy">Нет единого конечного списка всех возможных приемов: многие являются частными случаями цепей. Здесь основные семейства. Автоподсказка на поле распознает одиночки, пересечения, пары/тройки, X-Wing, Swordfish, XY-Wing и некоторые цепочки противоречия.</p><details><summary>Материалы для дальнейшего изучения</summary>${SOURCES.map(([t,url])=>`<p><a href="${url}" target="_blank" rel="noopener noreferrer">${t}</a></p>`).join('')}<p class="sheet-copy">Внешние ссылки требуют сети. Тексты уроков и упражнения внутри приложения доступны без нее.</p></details>`,'ОБУЧЕНИЕ');
  $('restart-school').onclick=resetSchool;
  document.querySelectorAll('.lesson-group').forEach(group=>group.ontoggle=()=>{if(group.open)schoolGroup=group.dataset.group;});
  document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>lesson(b.dataset.lesson));
 }
 function lesson(id,stage=0,answered=false){
  const l=LESSONS.find(l=>l.id===id),idx=LESSONS.indexOf(l),ex=LESSON_EXAMPLES[id];schoolGroup=l.group;
  const titles=['Что искать','Почему это работает','Какой вывод'],final=stage===2;
  const step=ex.place?{kind:'place',index:ex.place[0],value:ex.place[1],cells:ex.cells}:{kind:'eliminate',cells:ex.cells,changes:ex.changes};
  api.open(l.title,`<p class="lesson-kicker">${idx+1} / ${LESSONS.length} · ${learned.includes(id)?'Урок пройден · можно повторить':'Разбор на поле'}</p><div class="lesson-tabs" aria-label="Шаг объяснения">${titles.map((title,i)=>`<button data-stage="${i}" class="${stage===i?'active':''}" aria-pressed="${stage===i}">${i+1}<span>${title}</span></button>`).join('')}</div><section class="lesson-example"><h3>${titles[stage]}</h3><p class="lesson-body">${ex.steps[stage]}</p>${hintBoard(ex.values,null,step,{explain:final,notes:ex.notes,teaching:true,links:stage?ex.links:[],colors:stage?ex.colors:{},focus:ex.focus})}<p class="diagram-note">с1к1 — строка 1, столбец 1. Это отдельная схема приема. Показаны только нужные клетки и кандидаты, остальные не заполнены. Для рыб и цепей одной цифры показана только эта цифра. Ваша партия не меняется.</p>${!final?'<button class="primary lesson-wide" id="example-next">'+titles[stage+1]+' →</button>':''}</section><details class="lesson-theory"><summary>Правило целиком</summary><p class="lesson-body">${l.text}</p></details>${final?`<h3 class="sheet-section">Проверьте себя</h3><p class="lesson-body">${l.question}</p><div class="quiz-options">${quizOptions(l).map(o=>`<button class="secondary" data-answer="${o.index}">${o.text}</button>`).join('')}</div><p id="quiz-result" class="lesson-body" role="status">${answered?'Верно. '+l.explanation:''}</p><div class="lesson-actions">${practiceFor(id)?'<button class="secondary" id="practice">Попробовать на настоящем поле</button>':''}<button class="primary" id="lesson-next" ${!answered&&!learned.includes(id)?'disabled':''}>${idx<LESSONS.length-1?'Следующий урок':'Все уроки'}</button></div>`:''}<div class="lesson-actions"><button class="secondary" id="repeat-lesson">Пройти этот урок заново</button><button class="secondary" id="lessons-back">Все уроки</button></div>`,l.group.toUpperCase());
  document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>lesson(id,+b.dataset.stage,answered));
  if($('example-next'))$('example-next').onclick=()=>lesson(id,stage+1,answered);
  if($('practice'))$('practice').onclick=()=>practice(practiceFor(id),id,answered);
  document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{
   const correct=Number(b.dataset.answer)===l.answer;
   $('quiz-result').textContent=(correct?'Верно. ':'Попробуйте еще. ')+(correct?l.explanation:'Вернитесь к схеме: проверьте условия и сравните варианты.');
   if(correct){answered=true;$('lesson-next').disabled=false;if(!learned.includes(id)){learned.push(id);remember();api.audit('lesson',{lesson:id,correct:true});}}
  });
  $('repeat-lesson').onclick=()=>{learned=learned.filter(x=>x!==id);remember();quizOrders.delete(id);lesson(id);};
  $('lessons-back').onclick=academy;if($('lesson-next'))$('lesson-next').onclick=()=>idx<LESSONS.length-1?lesson(LESSONS[idx+1].id):academy();
 }
 function practice(example,id,answered=false){
  const {step}=example,values=example.values;let revealed=false;
  function draw(){
   api.open('Найдите следующий шаг',`<p class="sheet-copy">Это позиция из нашего каталога. ${step.type}. Сначала найдите основание, затем раскройте разбор. Игровая партия остается на месте.</p>${hintBoard(values,null,revealed?step:null,{notes:example.notes,explain:revealed,teaching:'practice',interactive:true})}<p class="lesson-body" id="practice-result" role="status">${revealed?step.text:'Какие клетки удерживают кандидатов? Где можно сделать постановку или исключение?'}</p><div class="lesson-actions"><button class="primary" id="practice-show">${revealed?'Попробовать еще раз':'Показать основание и вывод'}</button><button class="secondary" id="practice-back">Вернуться к уроку</button></div>`,'ПРАКТИКА НА ПОЛЕ');
   document.querySelectorAll('[data-hint-index]').forEach(b=>b.onclick=()=>{const i=+b.dataset.hintIndex,correct=step.kind==='place'?i===step.index:step.changes.some(c=>c.index===i);if(correct){revealed=true;draw();api.audit('lesson',{lesson:id,practice:true,correct:true});}else $('practice-result').textContent='Попробуйте другую клетку: куда ставится цифра или откуда исключается кандидат?';});
   $('practice-show').onclick=()=>{revealed=!revealed;draw();};$('practice-back').onclick=()=>lesson(id,2,answered);
  }draw();
 }
 async function history(){
  api.open('История партий','<p class="sheet-copy">Читаем сохраненные партии…</p>','ВАША ИГРА');
  let list=await games();
  const combined=new Map(list.map(r=>[r.id,{...r.checkpoint,mistakes:effectiveMistakes(r.checkpoint),id:r.id,local:true,events:r.events.length,device:r.device,updatedAt:r.updatedAt,storage:recordStorageLabel(r)}]));
  list=[...combined.values()].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  api.open('История партий',`<p class="sheet-copy">Исходное поле, ходы, заметки, подсказки и время между действиями. Незаконченные партии тоже сохраняются.</p><div class="lesson-list">${list.map(r=>`<button class="lesson-link" data-record="${esc(r.id)}"><span>${esc(LEVELS.find(l=>l.id===r.level)?.name||r.level)} · ${formatTime(r.elapsedMs||0)}<small>${r.completed?'Решена':'Не закончена'} · ошибок: ${r.mistakes??'нет учета'} · подсказок: ${r.hints||0} · ${r.events} событий · ${r.storage}<br>${esc(new Date(r.startedAt).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}))}</small></span><span>›</span></button>`).join('')||'<p class="sheet-copy">История появится после начала игры.</p>'}</div>`,'ПАРТИИ И РАЗБОР');
  document.querySelectorAll('[data-record]').forEach(b=>b.onclick=async()=>{try{const local=await getGame(b.dataset.record);if(!local)throw Error("Missing local game");showReplay(local);}catch{api.toast('Не удалось прочитать локальную партию.');}});
 }
 function showReplay(record){
  const end=replay(record),excluded=new Set(record.checkpoint.mistakeCorrection?.exclusions.map(e=>e.id)||[]),wrong=record.events.filter(e=>!excluded.has(e.id)&&e.kind==='digit'&&e.changes.some(c=>c.to&&c.to!==end.solution[c.i]));
  const longest=[...record.events].filter(e=>e.kind!=='start').sort((a,b)=>b.thinkMs-a.thinkMs).slice(0,3);
  api.open('Разбор партии',`<p class="sheet-copy">${esc(LEVELS.find(l=>l.id===end.level)?.name)} · ${formatTime(end.elapsedMs)} · ${record.events.length} событий</p><p class="replay-storage">${recordStorageLabel(record)}</p><div id="replay-field"></div><label class="replay-label">Шаг <output id="replay-position"></output><input id="replay-slider" type="range" min="0" max="${record.events.length}" value="${record.events.length}"></label><p class="lesson-body" id="replay-event" role="status"></p><h3 class="sheet-section">Что можно разобрать</h3><p class="sheet-copy">Вводов, отличавшихся от решения: ${wrong.length}. Ошибок за партию: ${end.mistakes??wrong.length}. Подсказок применено: ${end.hints}. Это разбор после игры, без ограничения ошибок.</p><div class="replay-jumps">${wrong.slice(0,6).map(e=>`<button class="secondary" data-jump="${e.seq}">Ошибка · шаг ${e.seq}</button>`).join('')}</div><h3 class="sheet-section">Долгие интервалы</h3><div class="replay-jumps">${longest.map(e=>`<button class="secondary" data-jump="${e.seq}">${formatTime(e.thinkMs)} · шаг ${e.seq}</button>`).join('')}</div><p class="sheet-copy">Это активное время между действиями, а не доказательство, куда вы смотрели. Пауза, фон и меню не включаются.</p><div class="replay-actions"><button class="secondary" id="replay-export">Скачать полный разбор</button>${!end.completed?'<button class="primary" id="replay-resume">Продолжить</button>':''}<button class="secondary" id="history-back">Все партии</button></div>`,'ИСТОРИЯ БЕЗ ПОТЕРИ ХОДОВ');
  const draw=()=>{const n=Number($('replay-slider').value),g=replay(record,n),e=record.events[n-1];$('replay-position').textContent=n+' / '+record.events.length;$('replay-field').innerHTML=gridHTML(g,i=>e?.changes.some(c=>c.i===i)?'effect':'');$('replay-event').textContent=e?`${labels[e.kind]||e.kind} · ${formatTime(e.activeMs)} · интервал ${formatTime(e.thinkMs)}${e.changes.length?' · '+e.changes.map(c=>`с${row(c.i)+1}к${col(c.i)+1}: ${c.from||'·'} → ${c.to||'·'}`).join(', '):''}`:'Исходное поле';};
  $('replay-slider').oninput=draw;draw();document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{$('replay-slider').value=b.dataset.jump;draw();});
  $('replay-export').onclick=()=>api.download({schema:2,type:'sudoku-public-full-history',...record},'sudoku-history-'+record.id+'.json');
  if($('replay-resume'))$('replay-resume').onclick=()=>{const g=structuredClone(end);g.history=[];g.future=[];const newBranch=record.device!==device;if(newBranch){g.parentId=g.id;g.id=crypto.randomUUID();g.startedAt=new Date().toISOString();delete g.themeAtStart;}api.restore(g,{newBranch});};
  $('history-back').onclick=history;
 }
 function account(){
  api.open('Локальные данные',`<p class="sheet-copy">Игра и история хранятся только в этом браузере. Вход в аккаунт не нужен. Очистка данных браузера удалит сохранения. Полный разбор партии можно скачать из истории.</p><button class="primary" id="account-history">Партии и разбор</button>`,'НА ЭТОМ УСТРОЙСТВЕ');
  $('account-history').onclick=history;
 }
 return {academy,history,account};
}

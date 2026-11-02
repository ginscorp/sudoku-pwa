import {candidateMask,digits,row,col} from './engine.js';

function linkMarkup([a,b,kind]){
 const point=end=>{
  const cells=Array.isArray(end)?end:[end],xs=cells.map(i=>col(i)*10+5),ys=cells.map(i=>row(i)*10+5);
  const left=Math.min(...xs)-4,right=Math.max(...xs)+4,top=Math.min(...ys)-4,bottom=Math.max(...ys)+4;
  return {x:(left+right)/2,y:(top+bottom)/2,left,right,top,bottom,group:Array.isArray(end)};
 };
 const from=point(a),to=point(b);
 // A grouped strong link starts at a single enclosing group boundary. Two
 // separate strong links would falsely say each individual candidate is forced.
 const boundary=(p,q)=>{
  if(!p.group)return p;
  const dx=q.x-p.x,dy=q.y-p.y,scale=Math.min(dx?(p.right-p.left)/2/Math.abs(dx):Infinity,dy?(p.bottom-p.top)/2/Math.abs(dy):Infinity);
  return {x:p.x+dx*scale,y:p.y+dy*scale};
 };
 const start=boundary(from,to),end=boundary(to,from);
 const box=p=>p.group?`<rect class="link-group" x="${p.left}" y="${p.top}" width="${p.right-p.left}" height="${p.bottom-p.top}" rx="1"><title>Единая группа кандидатов</title></rect>`:'';
 return box(from)+box(to)+`<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" class="${kind}"/>`;
}

// A read-only projection of this position. Never inserts a solution digit or
// changes the player's notes while an explanation is being viewed.
export function hintBoardModel(values,proven=Array(81).fill(0),step=null,{explain=false,conflicts=[],mistakes=[],notes=null}={}){
  const causes=new Set(step?.cells||[]),bad=new Set([...conflicts,...mistakes]);
  const removals=new Map((step?.changes||[]).map(c=>[c.index,c.remove]));
  return values.map((value,index)=>{
    const mask=value?0:notes?notes[index]:candidateMask(values,index)&~proven[index];
    const target=!!(explain&&(step?.kind==='place'?step.index===index:removals.has(index)));
    return {index,value,mask,cause:causes.has(index),target,conflict:bad.has(index),
      notes:Array.from({length:9},(_,j)=>{
        const digit=j+1,present=!!(mask&(1<<digit));
        return {digit,present,remove:!!(present&&target&&(removals.get(index)&(1<<digit))),
          proposed:!!(present&&target&&step?.kind==='place'&&step.value===digit)};
      })};
  });
}

export function hintBoard(values,proven,step=null,options={}){
  const cells=hintBoardModel(values,proven,step,options);
  const numbers=Array.from({length:9},(_,i)=>`<span>${i+1}</span>`).join('');
  const html=cells.map(c=>{
    const classes=['hint-cell',c.cause?'cause':'',c.target?'target':'',c.conflict?'conflict':'',options.colors?.[c.index]?'lesson-color-'+options.colors[c.index]:'',
      col(c.index)===2||col(c.index)===5?'major-right':'',row(c.index)===2||row(c.index)===5?'major-bottom':''].filter(Boolean).join(' ');
    const label=`Строка ${row(c.index)+1}, столбец ${col(c.index)+1}: ${c.value||('варианты '+(digits(c.mask).join(', ')||(options.teaching?'не показаны':'отсутствуют')))}`;
    const content=c.value?`<span class="hint-value">${c.value}</span>`:
      `<span class="hint-notes" aria-hidden="true">${c.notes.map(n=>`<span class="hint-note${n.present&&options.focus===n.digit?' study-focus':''}${n.remove?' remove':n.proposed?' proposed':''}" data-digit="${n.digit}">${n.present?n.digit:''}</span>`).join('')}</span>`;
    return `<${options.interactive?'button type="button"':'div'} class="${classes}" data-hint-index="${c.index}" data-value="${c.value}" aria-label="${label}" role="${options.interactive?'button':'img'}">${content}</${options.interactive?'button':'div'}>`;
  }).join('');
  const legend=options.mistakes?.length?'<span><i class="legend-conflict"></i>Ошибочные цифры</span>':options.conflicts?.length?'<span><i class="legend-conflict"></i>Повторяющиеся цифры</span>':
    step?`<span><i class="legend-cause"></i>${options.explain?'Основание приема':'Область для поиска'}</span>${options.explain?`<span><i class="${step.kind==='place'?'legend-target':'legend-remove'}"></i>${step.kind==='place'?'Место для цифры':'Исключаемые варианты'}</span>`:''}`:'';
  return `<figure class="hint-diagram"><figcaption><strong>${options.teaching==='practice'?'Учебная позиция из каталога':options.teaching?'Учебная схема':'Ваше текущее поле'}</strong><span>${options.teaching==='practice'?'Кандидаты этой позиции':options.teaching?'Пустые клетки: не показаны':options.notes?'Ваши текущие заметки':'Варианты по текущим цифрам'}</span></figcaption><div class="hint-board-layout"><div class="hint-column-labels" aria-hidden="true">${numbers}</div><div class="hint-row-labels" aria-hidden="true">${numbers}</div><div class="hint-board" role="group" aria-label="${options.teaching?'Учебное':'Текущее'} поле, строки и столбцы от 1 до 9">${html}</div>${options.links?.length?`<svg class="lesson-links" viewBox="0 0 90 90" aria-hidden="true">${options.links.map(linkMarkup).join('')}</svg>`:''}</div>${legend?`<div class="hint-legend">${legend}</div>`:''}</figure>`;
}

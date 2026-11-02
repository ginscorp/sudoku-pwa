import {logicalStep,allCandidates,applyLogicalStep,UNITS,digits,countBits,isComplete,row,col} from './engine.js';
// A bounded assumption proof using only the existing human-readable rules.
// The complete chain is retained; no search result is passed off as a named pattern.
export function coachStep(values,proven=Array(81).fill(0),notes=null){
 const masks=allCandidates(values).map((m,i)=>m&~proven[i]),started=performance.now(),trace=[];
 const context={values:[...values],proven:[...proven],notes:notes?[...notes]:null};
 // Missing pencil marks are not proof: derive every exclusion independently.
 // An already completed exclusion advances the analysis, never the player's game.
 for(let k=0;k<729;k++){
  const step=findStep(values,masks,started);if(!step)return null;
  const changes=step.kind==='eliminate'?step.changes.map(c=>({...c,remove:c.remove&(notes?notes[c.index]:masks[c.index])})).filter(c=>c.remove):null;
  if(step.kind==='place'||changes.length)return {...step,...(changes?{changes}:{}),context,skipped:trace.length,trace:[...trace,...(step.trace||[])]};
  trace.push(step.type+': '+step.text,...(step.trace||[]));
  applyLogicalStep(values,masks,step);
  if(performance.now()-started>900)return null;
 }
 return null;
}
function findStep(values,masks,started){
 const basic=logicalStep(values,masks);if(basic)return basic;
 const order=values.map((v,i)=>i).filter(i=>!values[i]&&countBits(masks[i])>1).sort((a,b)=>countBits(masks[a])-countBits(masks[b]));
 for(const at of order)for(const n of digits(masks[at])){
  if(performance.now()-started>900)return null;
  const g=[...values],m=[...masks],trace=[`Предположим: в строке ${row(at)+1}, столбце ${col(at)+1} стоит ${n}.`];
  applyLogicalStep(g,m,{kind:'place',index:at,value:n});
  for(let k=0;k<60;k++){
   let reason='';
   const empty=g.findIndex((v,i)=>!v&&!m[i]);
   if(empty>=0)reason=`В строке ${row(empty)+1}, столбце ${col(empty)+1} не осталось ни одного кандидата.`;
   if(!reason)for(let u=0;u<27&&!reason;u++)for(let d=1;d<=9;d++)if(!UNITS[u].some(i=>g[i]===d)&&!UNITS[u].some(i=>m[i]&(1<<d))){reason=`В ${u<9?'строке '+(u+1):u<18?'столбце '+(u-8):'блоке '+(u-17)} негде поставить ${d}.`;break;}
   if(reason)return {kind:'eliminate',type:'Цепочка противоречия',rank:7,cells:[at],changes:[{index:at,remove:1<<n}],text:`Кандидат ${n} в строке ${row(at)+1}, столбце ${col(at)+1} приводит к противоречию. Его можно исключить.`,trace:[...trace,reason]};
   if(isComplete(g))break;
   const next=logicalStep(g,m);if(!next)break;trace.push(next.type+': '+next.text);applyLogicalStep(g,m,next);
  }
 }
 return null;
}
export function direction(step){
 if(step.kind==='place')return step.rank===1?'Посмотрите, нет ли клетки с одним оставшимся кандидатом.':'Проверьте, сколько мест осталось для одной цифры внутри области.';
 if(step.type==='Пересечение')return 'Проследите, не собрались ли все места одной цифры на пересечении блока и линии.';
 if(/пара|тройка/i.test(step.type))return 'Ищите небольшую группу клеток, которая забирает себе столько же цифр.';
 if(step.type==='X-Wing'||step.type==='Swordfish')return 'Выберите одну цифру и сравните ее позиции в нескольких строках и столбцах.';
 if(step.type==='XY-Wing')return 'Ищите три клетки с двумя кандидатами: центральную и два крыла.';
 return 'Простой рисунок не найден. Проверьте последствия одного из кандидатов шаг за шагом.';
}

const VERSION='public-0.1.0';
const BASE=new URL('./',self.location.href).href;
const PREFIX='sudoku-public:'+new URL(BASE).pathname+':';
const CACHE=PREFIX+VERSION;
const ASSETS=["./","index.html","style.css","manifest.webmanifest","js/academy.js","js/app.js","js/catalog.js","js/coach.js","js/features.js","js/hint-board.js","js/history-status.js","js/journal.js","js/lesson-examples.js","js/mistake-corrections.js","js/navigation.js","js/puzzle-worker.js","js/state.js","js/statistics.js","js/themes.js","js/training.js","js/engine.js","icons/icon.svg","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png"].map(p=>new URL(p,BASE).href);
const PROTOCOL=2;
const isUsable=response=>response instanceof Response&&response.ok;
let preparing=null;
async function status(){
  try{const cache=await caches.open(CACHE),found=await Promise.all(ASSETS.map(url=>cache.match(url)));
    return {ready:found.every(isUsable),version:VERSION,protocol:PROTOCOL,assets:found.filter(isUsable).length};
  }catch{return {ready:false,version:VERSION,protocol:PROTOCOL,assets:0};}
}
function prepare(){
  if(preparing)return preparing;
  preparing=(async()=>{
    try{
      const cache=await caches.open(CACHE),found=await Promise.all(ASSETS.map(url=>cache.match(url)));
      const missing=ASSETS.filter((_,i)=>!isUsable(found[i]));
      if(missing.length)await cache.addAll(missing.map(url=>new Request(url,{cache:'reload'})));
    }catch{/* Online play must still work when CacheStorage or a download fails. */}
    return status();
  })().finally(()=>{preparing=null;});
  return preparing;
}
self.addEventListener('install',event=>event.waitUntil(prepare()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await self.clients.claim();
  // Keep the previous shell for requests already handled by the preceding worker.
  try{const older=(await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE);
    for(const key of older.slice(0,-1))await caches.delete(key);
  }catch{}
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE')event.waitUntil(self.skipWaiting());
  if(['STATUS','PREPARE'].includes(event.data?.type))event.waitUntil((async()=>{
    event.ports[0]?.postMessage(await (event.data.type==='PREPARE'?prepare():status()));
  })());
});
function unavailable(navigation){
  const text=navigation?`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#141d26"><title>Вернуться в судоку</title><body style="background:#141d26;color:#e4edf5;font:17px/1.6 -apple-system,sans-serif;margin:0;padding:48px 24px"><main style="max-width:420px;margin:auto"><h1>Нужна связь для загрузки</h1><p>Офлайн-файлы игры сейчас недоступны. Подключитесь к интернету и откройте игру снова. Ваши сохранения этот экран не изменяет.</p><a href="${BASE}" style="display:block;padding:15px;background:#9ac9e7;color:#142330;text-align:center;border-radius:14px;text-decoration:none">Восстановить загрузку игры</a></main></body></html>`:'Sudoku resource unavailable while offline';
  return new Response(text,{status:503,headers:{'Content-Type':navigation?'text/html; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!url.href.startsWith(BASE))return;
  event.respondWith((async()=>{
    url.search='';url.hash='';
    const navigation=event.request.mode==='navigate',entry=url.href===BASE||url.href===BASE+'index.html';
    let cache;
    try{
      cache=await caches.open(CACHE);
      const response=await cache.match(url.href);
      if(isUsable(response))return response;
      if(navigation&&entry){const fallback=await cache.match(BASE+'index.html');if(isUsable(fallback))return fallback;}
    }catch{/* CacheStorage failure must not prevent a network response. */}
    try{
      const response=await fetch(event.request);
      if(!(response instanceof Response))return unavailable(navigation);
      if(isUsable(response)&&ASSETS.includes(url.href))try{await (cache||await caches.open(CACHE)).put(url.href,response.clone());}catch{}
      return response;
    }catch{return unavailable(navigation);}
  })());
});

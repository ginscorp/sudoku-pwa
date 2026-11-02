import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const base='https://example.test/game/';
const source=readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8');
function worker(offline=false){
 const listeners={},entries=new Map(),calls=[];
 const cache={match:async url=>entries.get(String(url))?.clone(),put:async(url,r)=>entries.set(String(url),r.clone()),addAll:async requests=>{if(offline)throw Error('offline');for(const r of requests)entries.set(r.url,new Response('asset'));}};
 const self={location:new URL(base+'sw.js'),clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(n,f)=>listeners[n]=f};
 vm.runInNewContext(source,{URL,Request,Response,self,caches:{open:async()=>cache,keys:async()=>[],delete:async()=>{}},fetch:async r=>{calls.push(r.url);if(offline)throw Error('offline');return new Response('network');}});
 return {entries,calls,request(url=base){let response;listeners.fetch({request:{url,method:'GET',mode:'navigate'},respondWith:p=>response=p});return response;},async prepare(){let done,result;listeners.message({data:{type:'PREPARE'},ports:[{postMessage:r=>result=r}],waitUntil:p=>done=p});await done;return result;}};
}
test('prepared cache serves a navigation without network',async()=>{const w=worker(true);w.entries.set(base+'index.html',new Response('saved shell'));assert.equal(await(await w.request()).text(),'saved shell');assert.equal(w.calls.length,0);});
test('a missing offline cache returns a usable recovery page',async()=>{const r=await worker(true).request();assert.equal(r.status,503);assert.match(await r.text(),/https:\/\/example.test\/game\//);});
test('preparation requires every static asset and excludes another origin',async()=>{const w=worker();assert.equal((await w.prepare()).ready,true);assert.equal(w.request('https://other.example.test/'),undefined);const list=JSON.parse(source.match(/const ASSETS=(\[[^;]+\])\.map/)[1]);for(const asset of list)assert.ok(existsSync(new URL('../dist/'+(asset==='./'?'index.html':asset),import.meta.url)),asset);});

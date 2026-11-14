'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, element } = require('./harness.cjs');
const BASE='https://example.test/Expirydate_calculator/';
function worker() {
  const handlers={}, stores=new Map(), deleted=[];let claimed=0,skipped=0;
  const cacheName='time-limit:'+BASE+':v0.1.9';
  const cache={ entries:new Map(), async addAll(requests){this.requests=requests;},
    async put(key,res){this.entries.set(key,res);}, async match(key){return this.entries.get(key)?.clone();} };
  stores.set(cacheName,cache);
  const context=vm.createContext({URL,Request,Response,AbortController,setTimeout,clearTimeout,
    self:{registration:{scope:BASE},clients:{async claim(){claimed++;}},skipWaiting(){skipped++;},addEventListener(k,fn){handlers[k]=fn;}},
    caches:{async open(){return cache;},async keys(){return [...stores.keys()];},async delete(key){deleted.push(key);stores.delete(key);}},
    fetch: async()=>new Response('online-new')});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),context);
  return {handlers,context,cache,stores,deleted,cacheName,get claimed(){return claimed;},get skipped(){return skipped;},
    async lifecycle(name){let promise;handlers[name]({waitUntil(p){promise=p;}});await promise;},
    async request(url=BASE,mode='navigate',method='GET'){let response;handlers.fetch({request:{url,mode,method},respondWith(p){response=p;}});return response;} };
}
test('service worker installs all existing assets without test dependencies',async()=>{
  const w=worker();await w.lifecycle('install');assert.equal(w.cache.requests.length,7);
  for(const req of w.cache.requests){assert.equal(req.cache,'reload');assert.ok(fs.existsSync(path.join(ROOT,new URL(req.url).pathname.slice(new URL(BASE).pathname.length))));assert.doesNotMatch(new URL(req.url).pathname,/\/test\/|package/);}
});
test('service worker activate only removes old caches within its scope',async()=>{
  const w=worker();const old='time-limit:'+BASE+':v0.1.6';const unrelated='time-limit:https://example.test/other/:v0.1.6';
  w.stores.set(old,{});w.stores.set(unrelated,{});await w.lifecycle('activate');
  assert.deepEqual(w.deleted,[old]);assert.ok(w.stores.has(w.cacheName));assert.ok(w.stores.has(unrelated));assert.equal(w.claimed,1);
});
test('service worker update requires SKIP_WAITING message',()=>{
  const w=worker();w.handlers.message({data:{type:'OTHER'}});assert.equal(w.skipped,0);
  w.handlers.message({data:{type:'SKIP_WAITING'}});assert.equal(w.skipped,1);
});
test('service worker network first and cached navigation while offline',async()=>{
  const w=worker();assert.equal(await (await w.request()).text(),'online-new');
  w.context.fetch=async()=>{throw Error('offline');};
  for(const url of [BASE,BASE+'index.html',BASE+'?from=homescreen'])assert.equal(await (await w.request(url)).text(),'online-new');
});
test('service worker asset fallback, HTTP failure and absent-cache 503',async()=>{
  const w=worker();await w.request(BASE+'pwa.js','cors');
  w.context.fetch=async()=>new Response('error',{status:500});
  assert.equal(await (await w.request(BASE+'pwa.js','cors')).text(),'online-new');
  const res=await w.request();assert.equal(res.status,503);assert.match(await res.text(),/オフライン|오프라인/);
});
test('service worker ignores non-GET, external and unrelated requests',async()=>{
  const w=worker();assert.equal(await w.request(BASE,'navigate','POST'),undefined);
  assert.equal(await w.request('https://other.test/index.html','cors'),undefined);
  assert.equal(await w.request(BASE+'test/calculator.test.cjs','cors'),undefined);
});
test('manifest identity, relative paths and release version remain consistent',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.id,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');assert.equal(manifest.display,'standalone');
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');assert.match(html,/v0\.1\.9 · PWA/);
  assert.match(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),/VERSION = 'v0\.1\.9'/);
  assert.match(html,/<script src="\.\/pwa.js" defer>/);
});
function pwa(secure=true) {
  const status=element(),button=element({hidden:true}),events={},windowEvents={},messages=[];let reloads=0,updates=0,registered;
  const reg={waiting:{postMessage(m){messages.push(m);}},addEventListener(){},update(){updates++;return Promise.resolve();}};
  const sw={controller:{},ready:Promise.resolve(),addEventListener(k,fn){events[k]=fn;},register(url,options){registered={url,options};return Promise.resolve(reg);}};
  const context=vm.createContext({CustomEvent:class {constructor(type){this.type=type;this.defaultPrevented=false;}preventDefault(){this.defaultPrevented=true;}},document:{getElementById:id=>id==='pwaStatus'?status:button,addEventListener(k,fn){events[k]=fn;},visibilityState:'visible'},
    navigator:{serviceWorker:sw,onLine:true},window:{isSecureContext:secure,dispatchEvent(event){windowEvents[event.type]?.(event);return !event.defaultPrevented;},addEventListener(k,fn){windowEvents[k]=fn;}},location:{protocol:secure?'https:':'file:',reload(){reloads++;}}});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'pwa.js'),'utf8'),context);
  return {status,button,events,windowEvents,messages,context,get registered(){return registered;},get reloads(){return reloads;},get updates(){return updates;}};
}
test('PWA registration, ready/offline status and deliberate update reload',async()=>{
  const p=pwa();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(p.registered.url,'./sw.js');assert.equal(p.registered.options.updateViaCache,'none');
  assert.match(p.status.textContent,/준비 완료/);assert.equal(p.button.hidden,false);
  p.events.controllerchange();assert.equal(p.reloads,0);
  p.context.navigator.onLine=false;p.windowEvents.offline();assert.match(p.status.textContent,/오프라인 · 수동 계산 가능/);
  p.button.fire('click');assert.equal(p.messages[0].type,'SKIP_WAITING');p.events.controllerchange();assert.equal(p.reloads,1);
  p.context.navigator.onLine=true;p.events.visibilitychange();assert.equal(p.updates,1);
});
test('PWA file / insecure environment gives HTTPS guidance',()=>{
  const p=pwa(false);assert.match(p.status.textContent,/HTTPS/);assert.equal(p.registered,undefined);
});
test('PWA preserves input before update and again before reload; failed storage prevents reload',async()=>{
  const p=pwa();await new Promise(resolve=>setImmediate(resolve));let saves=0;
  p.windowEvents['time-limit:before-update']=()=>{saves++;};
  p.button.fire('click');assert.equal(saves,1);p.events.controllerchange();assert.equal(saves,2);assert.equal(p.reloads,1);
  const denied=pwa();await new Promise(resolve=>setImmediate(resolve));
  denied.windowEvents['time-limit:before-update']=event=>event.preventDefault();denied.button.fire('click');
  assert.equal(denied.messages.length,0);assert.equal(denied.reloads,0);assert.match(denied.status.textContent,/입력 보존 실패/);
});
test('PWA can retry reload when the second draft save fails',async()=>{
  const p=pwa();await new Promise(resolve=>setImmediate(resolve));
  p.button.fire('click');p.windowEvents['time-limit:before-update']=event=>event.preventDefault();p.events.controllerchange();
  assert.equal(p.reloads,0);assert.equal(p.button.disabled,false);assert.match(p.button.textContent,/다시 열기/);
  p.windowEvents['time-limit:before-update']=()=>{};p.button.fire('click');assert.equal(p.reloads,1);
});

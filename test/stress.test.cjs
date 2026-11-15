'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadApp}=require('./harness.cjs');
const phrase='오늘 15시부터 2시간';
function speech(options={}){
 const sessions=[];let busy=false;
 class Recognition{
  constructor(){if(options.constructorThrows)throw Error('constructor');sessions.push(this);this.aborts=0;}
  start(){if(options.startThrows||busy)throw Error('busy');busy=true;this.started=true;}
  stop(){if(options.stopThrows)throw Error('stop');if(options.syncStop)this.end();}
  abort(){this.aborts++;if(this.aborts>3)throw Error('recursive abort');if(options.abortError)this.onerror?.({error:'aborted'});if(options.abortThrows)throw Error('abort');if(options.syncAbort)this.end();}
  end(){busy=false;this.onend?.();}
  result(text=phrase){this.onresult?.({results:[[{transcript:text}]]});}
 }
 const app=loadApp('2026-11-15T04:00:00Z',{Recognition});
 return {app,sessions,start(){app.el('mic').fire('click');const r=sessions.at(-1);r?.onstart?.();return r;}};
}
for(const code of ['no-speech','network','not-allowed','service-not-allowed','audio-capture','aborted','unknown'])
 for(const syncAbort of [false,true])test(`speech error ${code}, synchronous end=${syncAbort}`,()=>{
  const s=speech({syncAbort,abortError:true}),r=s.start();r.onerror({error:code});
  assert.equal(r.aborts,1,'abort must not recurse');if(!syncAbort)r.end();
  assert.equal(s.app.timers.size,0);const next=s.start();assert.ok(next.started);next.result();next.end();
  assert.match(s.app.el('details').innerHTML,/15NOV2026 1700/);assert.equal(s.app.timers.size,0);
 });
test('retry waits until the previous native session has ended',()=>{
 const s=speech(),r=s.start();s.app.el('again').fire('click');assert.equal(s.sessions.length,1);
 r.result('이전 결과');r.end();assert.equal(s.sessions.length,2);const next=s.sessions[1];assert.ok(next.started);
 next.onstart();next.result();next.end();assert.equal(s.app.el('input').value,phrase);
});
test('repeated retry clicks create only one replacement session',()=>{
 const s=speech(),r=s.start();for(let i=0;i<10;i++)s.app.el('again').fire('click');
 assert.equal(r.aborts,1);r.end();assert.equal(s.sessions.length,2);
});
test('synchronous stop end leaves no orphan timeout',()=>{
 const s=speech({syncStop:true}),r=s.start();r.result();assert.equal(s.app.timers.size,0);
});
test('duplicate start events cannot leave a timer that stops a later session',()=>{
 const s=speech(),r=s.start();r.onstart();r.end();assert.equal(s.app.timers.size,0);
});
test('backgrounding aborts speech and ignores late results',()=>{
 const s=speech(),r=s.start();s.app.visibility('hidden');assert.equal(r.aborts,1);r.result();r.end();
 assert.equal(s.app.el('input').value,'');assert.equal(s.app.timers.size,0);
});
test('missing end after cancellation releases UI without automatic busy restart',()=>{
 const s=speech(),r=s.start();s.app.el('again').fire('click');s.app.advance(2000);
 assert.equal(s.sessions.length,1);assert.equal(s.app.el('mic').attributes['aria-label'],'음성 입력 시작');
 assert.match(s.app.el('status').textContent,/다시/);assert.equal(s.app.timers.size,0);r.end();
});
for(const method of ['constructorThrows','startThrows','stopThrows','abortThrows'])test(`speech exception ${method}`,()=>{
 const s=speech({[method]:true});const r=s.start();if(r?.started){if(method==='stopThrows')r.result();else s.app.el('clear').fire('click');}
 s.app.advance(30000);assert.equal(s.app.timers.size,0);assert.equal(s.app.el('mic').attributes['aria-label'],'음성 입력 시작');
});
for(const stage of ['starting','listening','stopping'])test(`clear during ${stage} cancels callbacks and timers`,()=>{
 const s=speech();s.app.el('mic').fire('click');const r=s.sessions[0];if(stage!=='starting')r.onstart();if(stage==='stopping')r.result();
 s.app.el('clear').fire('click');r.result();r.end();s.app.advance(30000);
 assert.equal(s.app.el('input').value,'');assert.equal(s.app.el('output').hidden,true);assert.equal(s.app.timers.size,0);
});
test('no start event times out; silent listening also terminates',()=>{
 const s=speech();s.app.el('mic').fire('click');s.app.advance(12000);assert.equal(s.sessions[0].aborts,1);assert.equal(s.app.timers.size,0);
 s.sessions[0].end();s.start();s.app.advance(27000);assert.equal(s.sessions[1].aborts,1);assert.equal(s.app.timers.size,0);
});
test('pending text debounce is cancelled before a new voice session',()=>{
 const s=speech();s.app.el('input').value=phrase;s.app.el('input').fire('input');s.start();s.app.advance(130);
 assert.equal(s.app.el('manualTime').value,'');
});
for(const [date,time,sign] of [['01JAN1900','0000',-1],['31DEC2100','2359',1]])test(`result outside allowed date range ${sign}`,()=>{
 const app=loadApp();assert.match(app.manual(date,time,'1','minutes',sign),/manual-error/);assert.equal(app.el('manualActions').hidden,true);
 assert.throws(()=>app.api.calculate(`${date} ${time} 1분 ${sign===1?'더하기':'빼기'}`));
});
test('seeded 1000 arithmetic cases agree with independent KST arithmetic and step totals',()=>{
 const app=loadApp();let seed=152026;
 const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 const fmt=ms=>{const iso=new Date(ms+32400000).toISOString();return iso.slice(8,10)+['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][+iso.slice(5,7)-1]+iso.slice(0,4)+' '+iso.slice(11,13)+iso.slice(14,16);};
 for(let i=0;i<1000;i++){
  const start=Date.parse('2000-01-01T00:00:00+09:00')+rand(50*365*1440)*60000,minutes=rand(5256000)+1,sign=rand(2)?1:-1;
  const [date,time]=fmt(start).split(' '),expected=fmt(start+sign*minutes*60000);
  assert.ok(app.manual(date,time,String(minutes),'minutes',sign).includes(expected),`seed case ${i}`);
  const steps=app.api.buildCalculationSteps(start,minutes,sign);assert.ok(steps.length<=3);assert.equal(steps.reduce((sum,s)=>sum+s.minutes,0),minutes);assert.equal(steps.at(-1).to,start+sign*minutes*60000);
  assert.ok(app.api.calculate(`${date} ${time} ${minutes}분 ${sign===1?'더하기':'빼기'}`).includes(expected));
 }
});

test('a final transcript survives a subsequent stop error',()=>{
 const s=speech(),r=s.start();r.result();r.onerror({error:'aborted'});r.end();
 assert.equal(s.app.el('input').value,phrase);assert.match(s.app.el('details').innerHTML,/15NOV2026 1700/);assert.equal(s.app.timers.size,0);
});
test('clear cancels a queued retry and pagehide also aborts',()=>{
 const s=speech(),r=s.start();s.app.el('again').fire('click');s.app.el('clear').fire('click');r.end();
 assert.equal(s.sessions.length,1);const next=s.start();s.app.emit('pagehide');assert.equal(next.aborts,1);next.end();assert.equal(s.app.timers.size,0);
});
test('a delayed result after speechend is accepted but not after timeout',()=>{
 const s=speech(),r=s.start();r.onspeechend();s.app.advance(1500);r.result();r.end();assert.equal(s.app.el('input').value,phrase);
 const next=s.start();next.onspeechend();s.app.advance(2000);next.result('late');next.end();assert.equal(s.app.el('input').value,phrase);
});

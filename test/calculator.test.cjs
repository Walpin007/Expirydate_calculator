'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness.cjs');
function setEnd(app,text){const [date='',time='']=text.split(' ');app.el('endDate').value=date;app.el('endTime').value=time;}

const arithmetic = [
  ['minutes add', '27SEP2026', '1530', '45', 'minutes', 1, '27SEP2026 1615'],
  ['minutes subtract', '27SEP2026', '1530', '45', 'minutes', -1, '27SEP2026 1445'],
  ['hours add', '27SEP2026', '1530', '40', 'hours', 1, '29SEP2026 0730'],
  ['hours subtract', '27SEP2026', '1530', '40', 'hours', -1, '25SEP2026 2330'],
  ['days add', '27SEP2026', '1530', '4', 'days', 1, '01OCT2026 1530'],
  ['days subtract', '01OCT2026', '1530', '4', 'days', -1, '27SEP2026 1530'],
  ['midnight forward', '27SEP2026', '2359', '1', 'minutes', 1, '28SEP2026 0000'],
  ['midnight backward', '28SEP2026', '0000', '1', 'minutes', -1, '27SEP2026 2359'],
  ['month forward', '30APR2026', '2330', '1', 'hours', 1, '01MAY2026 0030'],
  ['month backward', '01MAY2026', '0030', '1', 'hours', -1, '30APR2026 2330'],
  ['year forward', '31DEC2026', '2330', '1', 'hours', 1, '01JAN2027 0030'],
  ['year backward', '01JAN2027', '0030', '1', 'hours', -1, '31DEC2026 2330'],
  ['leap day', '28FEB2024', '1200', '1', 'days', 1, '29FEB2024 1200'],
  ['leap day backward', '01MAR2024', '1200', '1', 'days', -1, '29FEB2024 1200'],
  ['non-leap year', '28FEB2026', '1200', '1', 'days', 1, '01MAR2026 1200'],
  ['century 2000 is leap', '28FEB2000', '1200', '1', 'days', 1, '29FEB2000 1200'],
  ['century 2100 is not leap', '28FEB2100', '1200', '1', 'days', 1, '01MAR2100 1200'],
  ['US DST spring must not affect KST', '08MAR2026', '0030', '1', 'days', 1, '09MAR2026 0030'],
  ['US DST autumn must not affect KST', '01NOV2026', '0030', '24', 'hours', 1, '02NOV2026 0030'],
  ['HHMM add', '27SEP2026', '1530', '0130', 'hhmm', 1, '27SEP2026 1700'],
  ['HHMM subtract across midnight', '01JAN2027', '0030', '0130', 'hhmm', -1, '31DEC2026 2300'],
  ['HHMM over 24h', '27SEP2026', '1530', '2645', 'hhmm', 1, '28SEP2026 1815'],
  ['HHMM over 99h', '27SEP2026', '1530', '10000', 'hhmm', 1, '01OCT2026 1930'],
  ['HHMM one minute', '27SEP2026', '2359', '0001', 'hhmm', 1, '28SEP2026 0000']
];
for (const [name, ...args] of arithmetic) test(name, () => {
  const expected = args.pop(); const result = loadApp().manual(...args);
  assert.match(result, new RegExp(`<div class="value">${expected}</div>`));
});
for (const [date,time] of [['29FEB2026','1200'],['29FEB1900','1200'],['29FEB2100','1200'],['31APR2026','1200'],['00JAN2026','1200'],['32JAN2026','1200'],['27XYZ2026','1200'],['27SEP1899','1200'],['27SEP2101','1200'],['2026-09-27','1200'],['27SEP2026','2400'],['27SEP2026','1260'],['27SEP2026','930'],['27SEP2026','12:30'],['','1200'],['27SEP2026','']]) {
  test(`invalid date/time ${date} ${time}`, () => assert.match(loadApp().manual(date,time,'1','minutes'),/manual-error/));
}
for (const unit of ['minutes','hours','days']) for (const value of ['', '0', '-1', '1.5', '1e3', 'Infinity', 'abc', '99999999999999999999']) {
  test(`invalid amount ${unit}: ${value}`, () => assert.match(loadApp().manual('27SEP2026','1530',value,unit),/manual-error/));
}
for (const value of ['0000','0060','0161','1260','130','-0130','01:30','1.30','1e03','abcd','8760001']) {
  test(`invalid HHMM ${value}`, () => assert.match(loadApp().manual('27SEP2026','1530',value,'hhmm'),/manual-error/));
}
for (const [unit, value, over] of [['minutes','5256000','5256001'],['hours','87600','87601'],['days','3650','3651'],['hhmm','8760000','8760001']]) {
  test(`10-year fixed-duration boundary ${unit}`, () => {
    const app=loadApp(); assert.equal(app.api.parseManualDuration(value,unit),5256000);
    assert.match(app.manual('01JAN2026','0000',value,unit),/30DEC2035 0000/);
    assert.match(app.manual('01JAN2026','0000',over,unit),/최대 10년/);
  });
}
for (const [end, expected] of [['28SEP2026 1815','2645'],['27SEP2026 1530','0000'],['27SEP2026 1531','0001'],['27SEP2026 1629','0059'],['27SEP2026 1630','0100'],['28SEP2026 1530','2400'],['01OCT2026 1935','10005']]) {
  test(`elapsed HHMM ${expected}`, () => {
    const app=loadApp();setEnd(app,end);
    assert.match(app.manual('27SEP2026','1530','','difference'), new RegExp(`<div class="value">${expected}</div>`));
  });
}
test('difference before start, missing/invalid end and >10-year comparison policy', () => {
  const app=loadApp(); app.manual('27SEP2026','1530','','difference');
  assert.match(app.el('manualResult').innerHTML,/종료 일시를 입력/);
  for(const end of ['27SEP2026 1529','29FEB2026 1200','28SEP2026 2460','bad 1200']) {
    setEnd(app,end); app.el('endTime').fire('input');
    assert.match(app.el('manualResult').innerHTML,/manual-error/);
  }
  // Existing difference mode has no 10-year limit; only date input bounds apply.
  setEnd(app,'27SEP2037 1530'); app.el('endTime').fire('input');
  assert.match(app.el('manualResult').innerHTML,/9643200/);
});
test('HHMM controls, live input and sign preservation around difference mode', () => {
  const app=loadApp(); app.manual('27SEP2026','1530','0130','hhmm',-1);
  assert.equal(app.el('manualAmount').type,'text');assert.equal(app.el('hhmmHelp').hidden,false);
  assert.equal(app.el('manualAmount').value,'0130');
  app.el('manualAmount').value='0200';app.el('manualAmount').fire('input');
  assert.match(app.el('manualResult').innerHTML, /27SEP2026 1330/);
  app.unit('difference'); assert.ok(app.signs.every(b=>b.disabled));
  assert.equal(app.el('amountField').hidden,true);assert.equal(app.el('endField').hidden,false);
  app.unit('hhmm');assert.match(app.el('manualResult').innerHTML,/27SEP2026 1330/);
  app.unit('minutes');assert.equal(app.el('manualAmount').type,'number');assert.equal(app.el('hhmmHelp').hidden,true);
});
test('KST epoch, formatting, default date and omitted year use KST near UTC midnight', () => {
  const app=loadApp('2026-12-31T15:30:00Z');const a=app.api;
  assert.equal(a.kst(2026,9,27,15,30),Date.parse('2026-09-27T06:30:00Z'));
  assert.equal(a.display(Date.parse('2026-12-31T15:00:00Z')),'01JAN2027 0000');
  assert.equal(app.el('manualDate').value,'01JAN2027');
  assert.equal(a.display(a.parseDates('1일 1시부터 1시간')[0].ms),'01JAN2027 0100');
});
test('오늘 resolves to the current KST date across midnight and fills manual controls', () => {
  for (const [instant,day,result] of [
    ['2026-11-12T14:59:59Z','12NOV2026','14NOV2026 0730'],
    ['2026-11-12T15:00:00Z','13NOV2026','15NOV2026 0730']
  ]) {
    const app=loadApp(instant),a=app.api;
    const raw='오늘 15시 30분부터 40시간';
    assert.equal(a.display(a.parseDates(raw)[0].ms),day+' 1530');
    assert.match(a.calculate(raw),new RegExp(result));
    a.syncManualFromVoice(raw);
    assert.equal(app.el('manualDate').value,day);
    assert.equal(app.el('manualTime').value,'1530');
    assert.match(app.el('manualResult').innerHTML,new RegExp(result));
  }
});
test('오늘 can identify both dates or a single date without a clock', () => {
  const app=loadApp('2026-11-12T15:00:00Z'),a=app.api;
  const raw='오늘 13시부터 오늘 18시 45분까지';
  assert.equal(a.parseDates(raw).length,2);
  assert.match(a.calculate(raw),/5시간 45분/);
  a.syncManualFromVoice(raw);
  assert.match(app.el('manualResult').innerHTML,/>0545</);
  assert.throws(()=>a.calculate('오늘부터 40시간'),/시각/);
  app.el('manualDate').value='01JAN2026';
  app.el('manualTime').value='1230';
  app.el('input').value='오늘';
  a.render();
  assert.equal(app.el('manualDate').value,'13NOV2026');
  assert.equal(app.el('manualTime').value,'');
  assert.match(app.el('details').innerHTML,/시각과 계산할 기간/);
});
test('kst rejects non-integer and non-finite components', () => {
  const a=loadApp().api;
  for(let i=0;i<5;i++) for(const value of [NaN,Infinity,1.5,undefined]) {
    const args=[2026,9,27,15,30];args[i]=value;assert.throws(()=>a.kst(...args));
  }
});
const voice = [
  ['2026년 9월 27일 15시 30분부터 40시간','27SEP2026 1530',2400,'29SEP2026 0730'],
  ['9월 27일 오후 3시 30분부터 4일 12시간 30분','27SEP2026 1530',6510,'02OCT2026 0400'],
  ['9월27일1530부터4일12시간30분','27SEP2026 1530',6510,'02OCT2026 0400'],
  ['27SEP2026 1530부터 1분','27SEP2026 1530',1,'27SEP2026 1531'],
  ['27sep2026 15:30 2 days 3 hours 4 minutes','27SEP2026 1530',3064,'29SEP2026 1834'],
  ['9월 27일 오전 12시부터 60분','27SEP2026 0000',60,'27SEP2026 0100'],
  ['9월 27일 오후 12시부터 1시간','27SEP2026 1200',60,'27SEP2026 1300'],
  ['2024년 2월 29일 23시 59분부터 1분','29FEB2024 2359',1,'01MAR2024 0000']
];
for(const [raw,start,minutes,end] of voice) test(`voice: ${raw}`,()=>{
  const app=loadApp();const a=app.api;const dates=a.parseDates(raw);
  assert.equal(a.display(dates[0].ms),start);assert.equal(a.parseDuration(raw,dates),minutes);
  assert.match(a.calculate(raw),new RegExp(end));a.syncManualFromVoice(raw);
  assert.match(app.el('manualResult').innerHTML,new RegExp(end));
});
test('voice dates with omitted month/year and year rollover',()=>{
  const a=loadApp().api;
  for(const [raw,end] of [['9월 27일 15시 30분부터 28일 18시 15분까지','28SEP2026 1815'],['12월 31일 23시부터 1월 1일 1시까지','01JAN2027 0100']]) {
    const dates=a.parseDates(raw);assert.equal(a.display(dates[1].ms),end);assert.equal(a.parseDuration(raw,dates),null);
  }
});
test('voice comparison and remaining / exact / exceeded results',()=>{
  const app=loadApp();const raw='2026년 9월 27일 15시 30분부터 28일 18시 15분까지';
  assert.match(app.api.calculate(raw),/26시간 45분/);app.api.syncManualFromVoice(raw);
  assert.match(app.el('manualResult').innerHTML,/>2645</);
  for(const [limit,label] of [['27시간','REMAINING'],['26시간 45분','AT LIMIT'],['26시간','EXCEEDED']])assert.match(app.api.calculate(raw+' '+limit),new RegExp(label));
});
for(const suffix of ['0분','-1시간','- 1시간','+1시간','1.5시간','.5시간','1,000분','1e3분','1시간 2시간','5256001분','999999999999999999일'])test(`invalid voice period ${suffix}`,()=>{
  assert.throws(()=>loadApp().api.calculate('27SEP2026 1530부터 '+suffix));
});
test('voice max period, combined limit and missing duration',()=>{
  const a=loadApp().api;
  assert.match(a.calculate('01JAN2026 0000부터 3650일'),/30DEC2035 0000/);
  assert.throws(()=>a.calculate('01JAN2026 0000부터 3650일 1분'));
  assert.throws(()=>a.calculate('01JAN2026 0000'));
  assert.match(a.calculate('이천이십육년 구월 이십칠일 오후 세시부터 두시간'),/27SEP2026 1700/);
});
for(const raw of ['', '날짜 없음 40시간', '2026년 2월 29일 1시부터 1시간','9월 27일 24시부터 1시간','9월 27일 15시 60분부터 1시간','9월 27일 오전 0시부터 1시간','9월 27일 오후 13시부터 1시간','9월 27일 30분부터 1시간','9월 27일 15시부터 26일 15시까지','9월 27일 1시 28일 1시 29일 1시'])test(`invalid voice date: ${raw}`,()=>assert.throws(()=>loadApp().api.calculate(raw)));

for(const raw of ['9월 27일 15시 100분부터 1시간','9월 27일 오후 3시 100분부터 1시간']) test(`reject truncated clock: ${raw}`,()=>assert.throws(()=>loadApp().api.calculate(raw)));
test('missing SpeechRecognition falls back to typed input without a microphone',()=>{
  const app=loadApp();app.el('mic').fire('click');
  assert.equal(app.el('output').hidden,false);assert.equal(app.el('intro').hidden,true);
  assert.match(app.el('details').innerHTML,/음성 인식이 제공되지 않습니다/);
  app.el('clear').fire('click');assert.equal(app.el('output').hidden,true);
});

const naturalVoice=[
  ['오늘 15시에서 2시간 빼기','14NOV2026 1300',-1],
  ['오늘 15시부터 2시간 전','14NOV2026 1300',-1],
  ['오늘 오후 세 시 반부터 두 시간','14NOV2026 1730',1],
  ['오늘 오후 세시 반에서 두시간 빼 주세요','14NOV2026 1330',-1],
  ['오늘 오후 세 시부터 두 시간 반','14NOV2026 1730',1],
  ['오늘 15시부터 반 시간','14NOV2026 1530',1],
  ['내일 오전 열한 시부터 스물두 시간','16NOV2026 0900',1],
  ['어제 23시부터 두 시간','14NOV2026 0100',1],
  ['모레 0시에서 삼십 분 전','15NOV2026 2330',-1],
  ['지금부터 두 시간','14NOV2026 1500',1],
  ['오늘 지금에서 삼십 분 빼기','14NOV2026 1230',-1],
  ['이천이십육년 십일월 십사일 오후 세시부터 두시간','14NOV2026 1700',1]
];
for(const [raw,expected,sign] of naturalVoice)test(`natural speech: ${raw}`,()=>{
  const app=loadApp('2026-11-14T04:00:59Z');app.el('input').value=raw;app.api.render();
  assert.match(app.el('details').innerHTML,new RegExp(expected));
  assert.match(app.el('manualResult').innerHTML,new RegExp(expected));
  assert.equal(app.signs.find(b=>b.dataset.sign===String(sign)).attributes['aria-pressed'],'true');
});
for(const raw of ['오늘 15시부터 한 달','오늘 15시에서 2시간 전후','오늘 15시부터 2시간 더하기 30분 빼기','오늘 오후 3시 반쯤부터 2시간','오늘 15시부터 2시간 반나절','오늘 15시부터 2시간 말고 3시간','오늘 15시부터 2시간 20초'])test(`reject unparsed or ambiguous speech: ${raw}`,()=>{
  const app=loadApp();assert.throws(()=>app.api.calculate(raw));
});
test('partial voice inputs fill the form and remove old results without inventing a clock',()=>{
  const app=loadApp('2026-11-14T04:00:00Z');app.manual('01JAN2026','1200','2','hours');
  for(const [raw,date,time] of [['오늘 15시','14NOV2026','1500'],['내일','15NOV2026',''],['모레 날짜','16NOV2026',''],['지금','14NOV2026','1300']]){
    app.el('input').value=raw;app.api.render();
    assert.equal(app.el('manualDate').value,date);assert.equal(app.el('manualTime').value,time);
    assert.equal(app.el('manualAmount').value,'');assert.equal(app.el('manualActions').hidden,true);assert.equal(app.el('voiceActions').hidden,true);
  }
});
test('relative dates cross leap days and new year in KST and remain fixed after parsing',()=>{
  for(const [now,raw,date] of [['2026-12-31T14:59:59Z','내일 0시부터 1분','01JAN2027 0001'],['2024-02-28T15:00:00Z','어제 23시부터 두 시간','29FEB2024 0100']])assert.match(loadApp(now).api.calculate(raw),new RegExp(date));
  const app=loadApp('2026-12-31T14:59:59Z'),parsed=app.api.analyzeVoice('지금부터 두 시간');
  app.setNow('2026-12-31T15:01:00Z');app.api.syncManualFromVoice('',parsed);
  assert.equal(app.el('manualDate').value,'31DEC2026');assert.equal(app.el('manualTime').value,'2359');
  assert.match(app.api.calculate('',parsed),/01JAN2027 0159/);
});
test('calendar and today controls preserve DDMMMYYYY and the typed clock',()=>{
  const app=loadApp('2026-11-14T04:00:00Z');app.manual('14NOV2026','1530','2','hours');
  app.el('startCalendar').value='2024-02-29';app.el('startCalendar').fire('change');
  assert.equal(app.el('manualDate').value,'29FEB2024');assert.match(app.el('manualResult').innerHTML,/29FEB2024 1730/);
  app.setNow('2026-11-14T15:01:00Z');app.el('startToday').fire('click');
  assert.equal(app.el('manualDate').value,'15NOV2026');assert.equal(app.el('manualTime').value,'1530');
  app.unit('difference');app.el('endCalendar').value='2026-11-16';app.el('endCalendar').fire('change');app.el('endTime').value='1800';app.el('endTime').fire('input');
  assert.equal(app.el('endDate').value,'16NOV2026');assert.match(app.el('manualResult').innerHTML,/>2630</);
  app.el('endToday').fire('click');assert.match(app.el('manualResult').innerHTML,/>0230</);
});
test('copy results, select fallback, chain arithmetic and hide stale actions',async()=>{
  const app=loadApp();app.manual('27SEP2026','1530','0130','hhmm');
  await app.el('copyManual').fire('click');assert.deepEqual(app.copied,['27SEP2026 1700']);
  app.el('useManual').fire('click');assert.equal(app.el('manualTime').value,'1700');assert.equal(app.el('manualAmount').value,'');assert.equal(app.el('manualActions').hidden,true);
  app.el('manualAmount').value='0100';app.el('manualAmount').fire('input');assert.match(app.el('manualResult').innerHTML,/27SEP2026 1800/);
  const fallback=loadApp(undefined,{clipboardBlocked:true});fallback.manual('27SEP2026','1530','1','hours');await fallback.el('copyManual').fire('click');
  assert.equal(fallback.el('manualCopyValue').hidden,false);assert.equal(fallback.el('manualCopyValue').value,'27SEP2026 1630');
  app.el('input').value='오늘 15시에서 두 시간 빼기';app.api.render();await app.el('copyVoice').fire('click');assert.equal(app.copied.at(-1),'28SEP2026 1300');
  app.el('useVoice').fire('click');assert.equal(app.el('manualTime').value,'1300');assert.equal(app.el('manualAmount').value,'');
  app.el('input').value='오늘 13시부터 오늘 18시 45분까지';app.api.render();await app.el('copyVoice').fire('click');
  assert.equal(app.copied.at(-1),'0545');assert.equal(app.el('useVoice').hidden,true);assert.equal(app.el('useManual').hidden,true);
});
test('update draft restores fields once, preserving 지금 instead of recalculating at reload',()=>{
  const app=loadApp('2026-11-14T04:00:00Z');app.el('input').value='지금부터 두시간';app.api.render();app.el('output').hidden=false;
  assert.equal(app.emit('time-limit:before-update').defaultPrevented,false);assert.equal(app.storage.size,1);
  const restored=loadApp('2026-11-14T04:05:00Z',{storage:app.storage});
  assert.equal(restored.el('manualTime').value,'1300');assert.equal(restored.el('manualAmount').value,'2');assert.match(restored.el('manualResult').innerHTML,/14NOV2026 1500/);
  assert.equal(restored.el('input').value,'지금부터 두시간');assert.match(restored.el('manualFeedback').textContent,/복원/);assert.equal(restored.storage.size,0);
  const fresh=loadApp('2026-11-14T04:06:00Z',{storage:restored.storage});assert.equal(fresh.el('manualTime').value,'');
});
test('update draft handles difference mode, corrupt/expired storage and save failure',()=>{
  const app=loadApp('2026-11-14T04:00:00Z');setEnd(app,'15NOV2026 1630');app.manual('14NOV2026','1530','','difference');app.emit('time-limit:before-update');
  const key=[...app.storage.keys()][0],saved=app.storage.get(key);
  const restored=loadApp('2026-11-14T04:00:01Z',{storage:app.storage});assert.equal(restored.el('endDate').value,'15NOV2026');assert.equal(restored.el('endTime').value,'1630');assert.match(restored.el('manualResult').innerHTML,/>2500</);
  for(const value of ['invalid',saved]){
    const storage=new Map([[key,value]]),fresh=loadApp('2026-11-14T05:00:00Z',{storage});assert.equal(fresh.el('manualTime').value,'');
  }
  assert.equal(loadApp(undefined,{storageBlocked:true}).emit('time-limit:before-update').defaultPrevented,true);
});

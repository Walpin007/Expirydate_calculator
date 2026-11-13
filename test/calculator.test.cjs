'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness.cjs');

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
    const app=loadApp();app.el('manualEnd').value=end;
    assert.match(app.manual('27SEP2026','1530','','difference'), new RegExp(`<div class="value">${expected}</div>`));
  });
}
test('difference before start, missing/invalid end and >10-year comparison policy', () => {
  const app=loadApp(); app.manual('27SEP2026','1530','','difference');
  assert.match(app.el('manualResult').innerHTML,/종료 일시를 입력/);
  for(const end of ['27SEP2026 1529','29FEB2026 1200','28SEP2026 2460','bad']) {
    app.el('manualEnd').value=end; app.el('manualEnd').fire('input');
    assert.match(app.el('manualResult').innerHTML,/manual-error/);
  }
  // Existing difference mode has no 10-year limit; only date input bounds apply.
  app.el('manualEnd').value='27SEP2037 1530'; app.el('manualEnd').fire('input');
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
  // Written-out Korean numbers are not normalized by the current parser.
  assert.throws(()=>a.calculate('이천이십육년 구월 이십칠일 오후 세시부터 두시간'));
});
for(const raw of ['', '날짜 없음 40시간', '2026년 2월 29일 1시부터 1시간','9월 27일 24시부터 1시간','9월 27일 15시 60분부터 1시간','9월 27일 오전 0시부터 1시간','9월 27일 오후 13시부터 1시간','9월 27일 30분부터 1시간','9월 27일 15시부터 26일 15시까지','9월 27일 1시 28일 1시 29일 1시'])test(`invalid voice date: ${raw}`,()=>assert.throws(()=>loadApp().api.calculate(raw)));

for(const raw of ['9월 27일 15시 100분부터 1시간','9월 27일 오후 3시 100분부터 1시간']) test(`reject truncated clock: ${raw}`,()=>assert.throws(()=>loadApp().api.calculate(raw)));
test('missing SpeechRecognition falls back to typed input without a microphone',()=>{
  const app=loadApp();app.el('mic').fire('click');
  assert.equal(app.el('output').hidden,false);assert.equal(app.el('intro').hidden,true);
  assert.match(app.el('details').innerHTML,/음성 인식이 제공되지 않습니다/);
  app.el('clear').fire('click');assert.equal(app.el('output').hidden,true);
});

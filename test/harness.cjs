'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
function element(attrs = {}) {
  const handlers = {};
  return { value: '', hidden: false, disabled: false, innerHTML: '', textContent: '',
    dataset: {}, attributes: {}, type: 'text', ...attrs,
    setAttribute(k, v) { this.attributes[k] = v; },
    addEventListener(k, fn) { (handlers[k] ||= []).push(fn); },
    fire(k) { if (k === 'click' && this.disabled) return; return Promise.all((handlers[k] || []).map(fn=>fn())); },
    classList: { add() {}, remove() {} }, focus() {}, select() {},
    insertAdjacentHTML(_, html) { this.innerHTML = html + this.innerHTML; }
  };
}
function loadApp(now = '2026-09-27T15:30:00Z', options = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const elements = new Map([...html.matchAll(/<[a-z][^>]*\bid="([^"]+)"[^>]*>/gi)].map(m => [m[1], element({hidden:/\shidden(?:\s|>)/.test(m[0])})]));
  const buttons = name => [...html.matchAll(new RegExp('data-' + name + '="([^"]+)"', 'g'))]
    .map(m => element({ dataset: { [name]: m[1] } }));
  const signs = buttons('sign'), units = buttons('unit');
  class Clock extends Date { static now() { return Date.parse(now); } }
  const events={}, storage=options.storage||new Map(), copied=[];
  const emit=(type)=>{const event={type,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};for(const fn of events[type]||[])fn(event);return event;};
  const context = vm.createContext({ Date: Clock, console,
    location:{pathname:'/Expirydate_calculator/'},
    sessionStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(options.storageBlocked)throw Error('blocked');storage.set(k,v);},removeItem:k=>storage.delete(k)},
    navigator:{clipboard:{async writeText(text){if(options.clipboardBlocked)throw Error('denied');copied.push(text);}}},
    document: { getElementById(id) { if (!elements.has(id)) throw Error('Missing DOM id: ' + id); return elements.get(id); },
      querySelectorAll(q) { return q === '[data-sign]' ? signs : q === '[data-unit]' ? units : []; } },
    window: { scrollTo() {}, addEventListener(k,fn){(events[k]||=[]).push(fn);} }, setTimeout() { return 1; }, clearTimeout() {} });
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
  if (scripts.length !== 1) throw Error('Expected one inline application script; update the harness if structure changes.');
  const suffix = '  })();';
  if (!scripts[0].includes(suffix)) throw Error('Application test seam not found');
  // Instrument only the in-memory copy. No exports/hooks/dependencies ship to the browser.
  const script = scripts[0].replace(suffix, `globalThis.api = { kst, display, durationText, readClock, currentKst, parseDates, parseDuration, calculate, syncManualFromVoice, renderManual, render, analyzeVoice, ${scripts[0].includes('function parseManualDuration(') ? 'parseManualDuration,' : ''} };\n${suffix}`);
  vm.runInContext(script, context, { filename: 'index.html:inline' });
  return { api: context.api, storage, copied, emit, setNow(value){now=value;}, el: id => elements.get(id), signs, units,
    unit(name) { const b = units.find(b => b.dataset.unit === name); if (!b) throw Error('Missing unit ' + name); b.fire('click'); },
    sign(n) { signs.find(b => b.dataset.sign === String(n)).fire('click'); },
    manual(date, time, amount, unit, sign = 1) {
      elements.get('manualDate').value = date; elements.get('manualTime').value = time;
      elements.get('manualAmount').value = amount; this.unit(unit); this.sign(sign);
      return elements.get('manualResult').innerHTML;
    } };
}
module.exports = { loadApp, ROOT, element };

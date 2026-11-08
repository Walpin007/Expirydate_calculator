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
    fire(k) { if (k === 'click' && this.disabled) return; for (const fn of handlers[k] || []) fn(); },
    classList: { add() {}, remove() {} }, focus() {},
    insertAdjacentHTML(_, html) { this.innerHTML = html + this.innerHTML; }
  };
}
function loadApp(now = '2026-09-27T15:30:00Z') {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], element()]));
  const buttons = name => [...html.matchAll(new RegExp('data-' + name + '="([^"]+)"', 'g'))]
    .map(m => element({ dataset: { [name]: m[1] } }));
  const signs = buttons('sign'), units = buttons('unit');
  class Clock extends Date { static now() { return Date.parse(now); } }
  const context = vm.createContext({ Date: Clock, console,
    document: { getElementById(id) { if (!elements.has(id)) throw Error('Missing DOM id: ' + id); return elements.get(id); },
      querySelectorAll(q) { return q === '[data-sign]' ? signs : q === '[data-unit]' ? units : []; } },
    window: { scrollTo() {} }, setTimeout() { return 1; }, clearTimeout() {} });
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
  if (scripts.length !== 1) throw Error('Expected one inline application script; update the harness if structure changes.');
  const suffix = '  })();';
  if (!scripts[0].includes(suffix)) throw Error('Application test seam not found');
  // Instrument only the in-memory copy. No exports/hooks/dependencies ship to the browser.
  const script = scripts[0].replace(suffix, `globalThis.api = { kst, display, durationText, readClock, currentKst, parseDates, parseDuration, calculate, syncManualFromVoice, renderManual, ${scripts[0].includes('function parseManualDuration(') ? 'parseManualDuration,' : ''} };\n${suffix}`);
  vm.runInContext(script, context, { filename: 'index.html:inline' });
  return { api: context.api, el: id => elements.get(id), signs, units,
    unit(name) { const b = units.find(b => b.dataset.unit === name); if (!b) throw Error('Missing unit ' + name); b.fire('click'); },
    sign(n) { signs.find(b => b.dataset.sign === String(n)).fire('click'); },
    manual(date, time, amount, unit, sign = 1) {
      elements.get('manualDate').value = date; elements.get('manualTime').value = time;
      elements.get('manualAmount').value = amount; this.unit(unit); this.sign(sign);
      return elements.get('manualResult').innerHTML;
    } };
}
module.exports = { loadApp, ROOT, element };

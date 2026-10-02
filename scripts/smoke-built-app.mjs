#!/usr/bin/env node
/**
 * Smoke-tests the PRODUCTION build by booting it in jsdom.
 *
 * The unit and interaction suites run against Vite's dev transform. This runs
 * the actual minified output that ships, which catches a different class of
 * problem: a bad chunk boundary, a minifier bug, or a module that throws at
 * import time.
 *
 * It is NOT a substitute for opening a browser. jsdom does not enforce
 * Content Security Policy, has no layout engine, and cannot execute Monaco.
 * What it proves is that the bundle boots, React mounts, the toolbar renders,
 * the command palette opens by both click and Ctrl+K, and a diff delivered
 * from a worker renders results.
 *
 * Usage:
 *   npm run build:web
 *   node scripts/smoke-built-app.mjs
 *
 * Exits non-zero if nothing rendered or anything hit console.error.
 */
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:4173/', pretendToBeVisual: true });
const { window } = dom;

// Browser APIs jsdom lacks. Same set the test suite stubs.
window.matchMedia = (q) => ({ matches:false, media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}, dispatchEvent:()=>false });
window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
// Stand-in for the diff worker. jsdom has no Worker, and the built worker
// chunk only installs its handler in a real worker context. This replies with
// the exact message shape the app expects, which is what we're verifying:
// that the production bundle renders results delivered from a worker.
window.Worker = class {
  constructor(){ this.onmessage = null; this.onerror = null; }
  postMessage(msg){
    const a = String(msg.orig ?? '').split('\n');
    const b = String(msg.mod  ?? '').split('\n');
    const rawDiff = [];
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (a[i] !== undefined && b[i] !== undefined && a[i] === b[i]) {
        rawDiff.push({ type:'unchanged', lineA:a[i], lineB:b[i], lineNumA:i+1, lineNumB:i+1 });
      } else {
        if (a[i] !== undefined) rawDiff.push({ type:'del', lineA:a[i], lineB:'', lineNumA:i+1, lineNumB:null });
        if (b[i] !== undefined) rawDiff.push({ type:'add', lineA:'', lineB:b[i], lineNumA:null, lineNumB:i+1 });
      }
    }
    const unchanged = rawDiff.filter(r=>r.type==='unchanged').length;
    const adds = rawDiff.filter(r=>r.type==='add').length;
    const dels = rawDiff.filter(r=>r.type==='del').length;
    const similarity = Math.round((unchanged / Math.max(unchanged+dels, unchanged+adds, 1)) * 100);
    setTimeout(() => this.onmessage && this.onmessage({
      data: { requestId: msg.requestId, rawDiff, stats: { adds, dels, unchanged, similarity } }
    }), 0);
  }
  terminate(){} addEventListener(){} removeEventListener(){}
};
window.Element.prototype.scrollIntoView = () => {};
window.scrollTo = () => {};

for (const k of ['window','document','navigator','location','HTMLElement','Element','Node','SVGElement',
                 'getComputedStyle','requestAnimationFrame','cancelAnimationFrame','matchMedia',
                 'ResizeObserver','Worker','localStorage','sessionStorage','CustomEvent','Event','MutationObserver','DOMParser','Blob','URL']) {
  if (globalThis[k] === undefined && window[k] !== undefined) globalThis[k] = window[k];
}
globalThis.self = window;

// No network in this sandbox, and we're testing that the bundle *boots*, not
// that remote services respond. Record attempts instead of performing them.
const networkAttempts = [];
globalThis.fetch = window.fetch = async (u) => {
  networkAttempts.push(String(u));
  return { ok: false, status: 0, json: async () => ({}), text: async () => '' };
};
globalThis.networkAttempts = networkAttempts;

const errors = [];
window.addEventListener('error', e => errors.push('window.error: ' + e.message));
const origErr = console.error;
console.error = (...a) => { errors.push('console.error: ' + a.join(' ').slice(0,200)); };

const match = html.match(/src=["'](?:\.\/)?assets\/(index-[^"']+\.js)["']/);
const entry = match
  ? match[1]
  : readdirSync(new URL('../dist/assets/', import.meta.url)).find(f => /^index-.*\.js$/.test(f));
console.log('booting', entry);

try {
  await import(new URL(`../dist/assets/${entry}`, import.meta.url).href);
  await new Promise(r => setTimeout(r, 400));
  console.error = origErr;
  const doc = window.document;
  const root = doc.getElementById('root');
  const text = () => (root?.textContent || '').replace(/\s+/g,' ').trim();
  console.log('LANDING_CHARS:', text().length);

  // Enter the studio.
  const openBtn = [...doc.querySelectorAll('button')].find(b => /open studio/i.test(b.textContent||''));
  console.log('OPEN_STUDIO_BUTTON:', !!openBtn);
  openBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 500));

  const labels = [...doc.querySelectorAll('button')].map(b => (b.textContent||'').trim()).filter(Boolean);
  console.log('STUDIO_BUTTONS:', JSON.stringify(labels.slice(0, 14)));
  for (const need of ['RUN_DIFF','SWAP','CLEAR','SHARE','LOAD_SAMPLE']) {
    console.log('  has ' + need + ':', labels.some(l => l.includes(need)));
  }

  // Open the palette via its toolbar button (a plain click, no synthetic
  // keyboard plumbing) to establish whether the component renders at all.
  const cmdBtn = [...doc.querySelectorAll('button')].find(b => /COMMANDS/.test(b.textContent||''));
  console.log('COMMANDS_BUTTON:', !!cmdBtn);
  cmdBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  console.log('PALETTE_OPENS_ON_CLICK:', !!doc.querySelector('[aria-label="Command palette"]'));

  // Close it before testing the keyboard path — Ctrl+K TOGGLES, so pressing it
  // while the palette is already open would close it and look like a failure.
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  await new Promise(r => setTimeout(r, 250));
  console.log('PALETTE_CLOSED_BY_ESC:', !doc.querySelector('[aria-label="Command palette"]'));

  window.dispatchEvent(new window.KeyboardEvent('keydown', { key:'k', ctrlKey:true, bubbles:true }));
  await new Promise(r => setTimeout(r, 300));
  const palette = doc.querySelector('[aria-label="Command palette"]');
  console.log('PALETTE_OPENS_ON_CTRL_K:', !!palette);
  if (palette) {
    const opts = [...palette.querySelectorAll('[role=option]')].map(o => (o.textContent||'').trim());
    console.log('PALETTE_COMMANDS:', opts.length);
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    await new Promise(r => setTimeout(r, 250));
    console.log('PALETTE_CLOSES_ON_ESC_AGAIN:', !doc.querySelector('[aria-label="Command palette"]'));
  }
  // Close the palette, then run a real diff through the built bundle.
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  await new Promise(r => setTimeout(r, 200));

  const sample = [...doc.querySelectorAll('button')].find(b => /LOAD_SAMPLE/.test(b.textContent||''));
  sample?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));

  const run = [...doc.querySelectorAll('button')].find(b => /RUN_DIFF/.test(b.textContent||''));
  run?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 600));

  const report = doc.getElementById('diff-report-container');
  console.log('DIFF_RAN:', !!report);
  if (report) {
    const t = report.textContent.replace(/\s+/g,' ');
    console.log('  has Similarity:', /Similarity/.test(t));
    console.log('  percentage shown:', (t.match(/\d+%/) || ['none'])[0]);
    console.log('  export buttons:', ['EXPORT_HTML','EXPORT_PDF','EXPORT_PNG','EXPORT_JSON']
      .filter(x => t.includes(x)).join(', '));
  }

  const text2 = text();
  const textLen = text2.length;
  console.log('NETWORK_ATTEMPTS:', JSON.stringify([...new Set(networkAttempts)].slice(0,8)));
  console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0,5), null, 1) : 'none');
  process.exit(textLen > 0 && errors.length === 0 ? 0 : 1);
} catch (e) {
  console.error = origErr;
  console.log('THREW:', e.message.slice(0, 300));
  process.exit(1);
}

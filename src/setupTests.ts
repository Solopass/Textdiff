import '@testing-library/jest-dom';
import * as matchers from "vitest-axe/matchers";
import { expect, vi } from "vitest";

expect.extend(matchers);

// The real bootstrap imports Monaco and its workers, which jsdom can't run.
// Report it as ready so the (mocked) editor renders immediately.
vi.mock("./lib/monacoSetup", () => ({
  ensureMonaco: () => Promise.resolve(),
  isMonacoReady: () => true,
}));
import { computeLCS, compute3Way } from './diffWorker';

/**
 * jsdom has no Worker. This stand-in runs the *real* diff functions
 * synchronously and replies with the same message shape the worker uses, so
 * tests exercise the genuine engine and the genuine response handling.
 *
 * The previous stub replied `{ type: 'RESULT', payload: [] }`, which the app
 * never accepts — it has no `requestId`, so the result was silently discarded
 * and a diff could never complete under test. Any test of the comparison flow
 * would have been testing nothing.
 */
class Worker {
  url: string;
  onmessage: ((msg: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;

  constructor(stringUrl: string) {
    this.url = stringUrl;
  }

  postMessage(msg: any) {
    const { requestId, orig, mod, base, isThreeWay, ws, caseInsensitive, trimBlanks } = msg;
    setTimeout(() => {
      if (!this.onmessage) return;
      try {
        let aLines = String(orig ?? '').split('\n');
        let bLines = String(mod ?? '').split('\n');
        let oLines = base ? String(base).split('\n') : [];

        if (trimBlanks) {
          const isNotEmpty = (l: string) => l.trim().length > 0;
          aLines = aLines.filter(isNotEmpty);
          bLines = bLines.filter(isNotEmpty);
          oLines = oLines.filter(isNotEmpty);
        }

        const rawDiff = isThreeWay
          ? compute3Way(aLines, oLines, bLines, ws, caseInsensitive)
          : computeLCS(aLines, bLines, ws, caseInsensitive);

        let adds = 0, dels = 0, unchanged = 0;
        rawDiff.forEach((r) => {
          if (r.type === 'add') adds++;
          else if (r.type === 'del') dels++;
          else if (r.type === 'unchanged') unchanged++;
        });
        const similarity = Math.round(
          (unchanged / Math.max(aLines.length, bLines.length, 1)) * 100,
        );

        this.onmessage({
          data: { requestId, rawDiff, stats: { adds, dels, unchanged, similarity } },
        });
      } catch (err: any) {
        this.onmessage({ data: { requestId, error: err?.message ?? 'diff failed' } });
      }
    }, 0);
  }

  terminate() {}
}
(window as any).Worker = Worker;

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(window as any).ResizeObserver = ResizeObserver;

// jsdom implements neither matchMedia nor scrollIntoView. Components that use
// them for responsive layout and keyboard navigation would otherwise throw
// during render in tests.
(window as any).matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});

(Element.prototype as any).scrollIntoView = () => {};

if (typeof document !== 'undefined' && !(document as any).queryCommandSupported) {
  (document as any).queryCommandSupported = () => false;
}

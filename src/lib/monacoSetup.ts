/**
 * Self-hosted Monaco bootstrap.
 *
 * Monaco and its workers are dynamic imports so they stay out of the
 * first-paint bundle. The catch: `@monaco-editor/react` falls back to fetching
 * Monaco from jsdelivr the moment an <Editor> mounts or `useMonaco()` runs,
 * unless `loader.config({ monaco })` has already been called. The CSP blocks
 * that CDN, so an editor that mounts first hangs on "Loading..." forever.
 *
 * Previously this ran as a fire-and-forget side effect at module scope, which
 * always lost that race. Callers must now await `ensureMonaco()` before
 * rendering anything that touches the loader. Mocked in src/setupTests.ts.
 */
import { loader } from "@monaco-editor/react";

let ready: Promise<void> | null = null;
let done = false;

export const isMonacoReady = () => done;

export const ensureMonaco = (): Promise<void> => {
  if (!ready) {
    ready = Promise.all([
      import("monaco-editor"),
      import("monaco-editor/editor/editor.worker?worker"),
      import("monaco-editor/language/json/json.worker?worker"),
      import("monaco-editor/language/css/css.worker?worker"),
      import("monaco-editor/language/html/html.worker?worker"),
      import("monaco-editor/language/typescript/ts.worker?worker"),
    ])
      .then(([monaco, editorWorker, jsonWorker, cssWorker, htmlWorker, tsWorker]) => {
        (window as any).MonacoEnvironment = {
          getWorker(_: any, label: string) {
            if (label === "json") return new jsonWorker.default();
            if (label === "css" || label === "scss" || label === "less") return new cssWorker.default();
            if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker.default();
            if (label === "typescript" || label === "javascript") return new tsWorker.default();
            return new editorWorker.default();
          },
        };
        loader.config({ monaco });
        done = true;
      })
      .catch((err) => {
        // Don't cache the failure — a flaky chunk fetch shouldn't disable the
        // editor for the rest of the session.
        ready = null;
        throw err;
      });
  }
  return ready;
};

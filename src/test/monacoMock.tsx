/**
 * Monaco replacement for tests.
 *
 * Monaco is a canvas-and-measurement-heavy editor that never finishes booting
 * in jsdom — it renders a "Loading..." placeholder and no editable element, so
 * there is nothing to type into. Swapping it for a plain textarea that honours
 * the same `value` / `onChange` contract lets tests drive the real application
 * state.
 *
 * This tests our integration with the editor (is the value bound, does the
 * change propagate), not Monaco itself, which is the correct split.
 *
 * Usage, at the top level of a test file:
 *
 *   vi.mock("@monaco-editor/react", async () => await import("./test/monacoMock"));
 */
import React, { useEffect } from "react";

type EditorProps = {
  value?: string;
  onChange?: (value: string | undefined) => void;
  language?: string;
  onMount?: (editor: any, monaco: any) => void;
};

export default function Editor({ value = "", onChange, language, onMount }: EditorProps) {
  useEffect(() => {
    if (onMount) {
      onMount(
        {
          setScrollTop: () => {},
          setScrollLeft: () => {},
          onDidScrollChange: () => ({ dispose: () => {} }),
        },
        null,
      );
    }
  }, [onMount]);

  return (
    <textarea
      data-testid="monaco-editor"
      data-language={language}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value)}
    />
  );
}

/** The app calls this to register custom themes; a no-op object is enough. */
export const useMonaco = () => null;

export const loader = {
  config: () => {},
  init: () => Promise.resolve(null),
};

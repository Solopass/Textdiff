/**
 * Monaco-backed editor pane.
 *
 * Replaced with a plain textarea under test — see src/test/monacoMock.tsx for
 * why Monaco itself can't run in jsdom.
 */
import { useEffect } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";

export const TextAreaWithLineNumbers = ({
  value,
  onChange,
  placeholder,
  showLineNums,
  syntaxTheme,
  id,
  onScroll,
  language = "javascript",
  wordWrap = false,
  customTheme,
}: any) => {
  const monaco = useMonaco();

  useEffect(() => {
    if (monaco) {
      if (syntaxTheme === "custom" && customTheme) {
        monaco.editor.defineTheme("custom-theme", {
          base: "vs-dark",
          inherit: true,
          rules: [
            {
              token: "comment",
              foreground: customTheme.comment.replace("#", ""),
            },
            {
              token: "string",
              foreground: customTheme.string.replace("#", ""),
            },
            {
              token: "keyword",
              foreground: customTheme.keyword.replace("#", ""),
            },
            {
              token: "number",
              foreground: customTheme.number.replace("#", ""),
            },
          ],
          colors: {
            "editor.background": customTheme.bg,
            "editor.foreground": customTheme.fg,
          },
        });
      }

      monaco.editor.defineTheme("dracula", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "6272A4", fontStyle: "italic" },
          { token: "string", foreground: "F1FA8C" },
          { token: "keyword", foreground: "FF79C6", fontStyle: "bold" },
          { token: "number", foreground: "BD93F9" },
        ],
        colors: {
          "editor.background": "#282A36",
          "editor.foreground": "#F8F8F2",
        },
      });

      monaco.editor.defineTheme("hacker", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "008F11", fontStyle: "italic" },
          { token: "string", foreground: "00FF41" },
          { token: "keyword", foreground: "00FF41", fontStyle: "bold" },
          { token: "number", foreground: "00FF41" },
        ],
        colors: {
          "editor.background": "#0D0208",
          "editor.foreground": "#00FF41",
          "editorCursor.foreground": "#00FF41",
        },
      });

      monaco.editor.defineTheme("solarized-light", {
        base: "vs",
        inherit: true,
        rules: [
          { token: "comment", foreground: "93A1A1", fontStyle: "italic" },
          { token: "string", foreground: "2AA198" },
          { token: "keyword", foreground: "859900", fontStyle: "bold" },
          { token: "number", foreground: "D33682" },
        ],
        colors: {
          "editor.background": "#FDF6E3",
          "editor.foreground": "#657B83",
        },
      });

      monaco.editor.defineTheme("oceanic", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "65737E", fontStyle: "italic" },
          { token: "string", foreground: "99C794" },
          { token: "keyword", foreground: "C594C5", fontStyle: "bold" },
          { token: "number", foreground: "F99157" },
        ],
        colors: {
          "editor.background": "#1B2B34",
          "editor.foreground": "#D8DEE9",
        },
      });
    }
  }, [monaco, syntaxTheme, customTheme]);

  const getMonacoTheme = () => {
    if (syntaxTheme === "light") return "light";
    if (syntaxTheme === "high-contrast") return "hc-black";
    if (syntaxTheme === "custom") return "custom-theme";
    if (
      ["dracula", "hacker", "solarized-light", "oceanic"].includes(syntaxTheme)
    )
      return syntaxTheme;
    return "vs-dark";
  };

  return (
    <div
      className={`flex w-full h-full min-h-[320px] rounded-md border ${syntaxTheme === "light" ? "border-[#E2E8F0]" : "border-[#334155]"}`}
    >
      <Editor
        height="100%"
        language={language}
        theme={getMonacoTheme()}
        value={value}
        onChange={(val) => onChange(val || "")}
        options={{
          wordWrap: wordWrap ? "on" : "off",
          lineNumbers: showLineNums ? "on" : "off",
          minimap: { enabled: true },
          padding: { top: 16 },
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
};

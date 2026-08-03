/**
 * Syntax highlighting and HTML export.
 *
 * These build HTML strings that are handed to dangerouslySetInnerHTML, so the
 * escaping here is security-relevant — see SECURITY.md.
 */
import Prism from "prismjs";
import { escapeHtml } from "./sanitize";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-json";

export function highlightCode(
  text: string,
  theme:
    | "dark"
    | "light"
    | "high-contrast"
    | "custom"
    | "dracula"
    | "hacker"
    | "solarized-light"
    | "oceanic",
  language: string = "javascript",
) {
  if (!text) return "";

  if (language === "plain") return escapeHtml(text);
  let lang = language;
  if (!Prism.languages[lang]) lang = "javascript";

  const getThemeClasses = (type: string) => {
    const t = type.split(" ")[0];
    if (theme === "custom") {
      if (t === "comment") return "theme-comment italic";
      if (t === "string" || t === "char" || t === "attr-value")
        return "theme-string";
      if (t === "keyword" || t === "builtin" || t === "tag")
        return "theme-keyword font-semibold";
      if (t === "number" || t === "boolean" || t === "constant")
        return "theme-number";
      if (t === "function" || t === "class-name") return "theme-function";
      if (t === "operator" || t === "punctuation") return "theme-operator";
      return "theme-fg";
    }
    if (theme === "high-contrast") {
      if (t === "comment") return "text-[#A1A1AA] italic";
      if (t === "string" || t === "char" || t === "attr-value")
        return "text-[#FDE047]";
      if (t === "keyword" || t === "builtin" || t === "tag")
        return "text-[#F9A8D4] font-bold";
      if (t === "number" || t === "boolean" || t === "constant")
        return "text-[#D8B4FE] font-bold";
      if (t === "function" || t === "class-name") return "text-[#93C5FD]";
      if (t === "operator" || t === "punctuation") return "text-[#94A3B8]";
      return "text-white";
    } else if (theme === "light") {
      if (t === "comment") return "text-[#94A3B8] italic";
      if (t === "string" || t === "char" || t === "attr-value")
        return "text-[#059669]";
      if (t === "keyword" || t === "builtin" || t === "tag")
        return "text-[#DB2777] font-semibold";
      if (t === "number" || t === "boolean" || t === "constant")
        return "text-[#7C3AED]";
      if (t === "function" || t === "class-name") return "text-[#2563EB]";
      if (t === "operator" || t === "punctuation") return "text-[#64748B]";
      return "text-[#0F172A]";
    } else {
      // dark
      if (t === "comment") return "text-[#64748B] italic";
      if (t === "string" || t === "char" || t === "attr-value")
        return "text-[#A7F3D0]";
      if (t === "keyword" || t === "builtin" || t === "tag")
        return "text-[#F472B6] font-semibold";
      if (t === "number" || t === "boolean" || t === "constant")
        return "text-[#C084FC]";
      if (t === "function" || t === "class-name") return "text-[#60A5FA]";
      if (t === "operator" || t === "punctuation") return "text-[#475569]";
      return "text-[#E2E8F0]";
    }
  };

  let html = "";
  try {
    const tokens = Prism.tokenize(text, Prism.languages[lang]);

    const processToken = (token: any) => {
      if (typeof token === "string") {
        return escapeHtml(token);
      }
      if (Array.isArray(token.content)) {
        return `<span class="${getThemeClasses(token.type)}">${token.content.map(processToken).join("")}</span>`;
      }
      return `<span class="${getThemeClasses(token.type)}">${escapeHtml(token.content)}</span>`;
    };

    html = tokens.map(processToken).join("");
  } catch (e) {
    html = escapeHtml(text);
  }
  return html;
}

export function renderSearchHighlights(
  text: string,
  query: string,
  activeIndex: number,
  matchIndices: { index: number; length: number }[],
) {
  if (!query || matchIndices.length === 0) return "";

  let html = "";
  let lastIdx = 0;

  matchIndices.forEach((matchInfo, i) => {
    html += escapeHtml(text.slice(lastIdx, matchInfo.index));
    const isActive = i === activeIndex;
    const bgClass = isActive ? "bg-[#F59E0B]/50" : "bg-[#FCD34D]/30";
    html += `<mark class="${bgClass} text-transparent rounded-sm">${escapeHtml(text.slice(matchInfo.index, matchInfo.index + matchInfo.length))}</mark>`;
    lastIdx = matchInfo.index + matchInfo.length;
  });

  html += escapeHtml(text.slice(lastIdx));
  return html;
}

export function exportHighlightedHtml(
  text: string,
  theme:
    | "dark"
    | "light"
    | "high-contrast"
    | "custom"
    | "dracula"
    | "hacker"
    | "solarized-light"
    | "oceanic",
) {
  if (!text) return "";
  const regex =
    /(\/\/.*|\/\*[\s\S]*?\*\/)|(["'`])(?:(?=(\\?))\3.)*?\2|\b(const|let|var|function|return|if|else|for|while|class|import|export|from|switch|case|break|continue|default|async|await|new|this|true|false|null|undefined)\b|\b(\d+(?:\.\d+)?)\b/g;

  let lastIndex = 0;
  let html = "";
  let match;

  const getThemeStyles = (type: string) => {
    if (theme === "high-contrast") {
      if (type === "comment") return "color: #A1A1AA; font-style: italic;";
      if (type === "string") return "color: #FDE047;";
      if (type === "keyword") return "color: #F9A8D4; font-weight: bold;";
      if (type === "number") return "color: #D8B4FE; font-weight: bold;";
      return "color: #ffffff;";
    } else if (theme === "dracula") {
      if (type === "comment") return "color: #6272A4; font-style: italic;";
      if (type === "string") return "color: #F1FA8C;";
      if (type === "keyword") return "color: #FF79C6; font-weight: 600;";
      if (type === "number") return "color: #BD93F9;";
      return "color: #F8F8F2;";
    } else if (theme === "hacker") {
      if (type === "comment") return "color: #008F11; font-style: italic;";
      if (type === "string")
        return "color: #00FF41; text-shadow: 0 0 2px #00FF41;";
      if (type === "keyword") return "color: #00FF41; font-weight: 900;";
      if (type === "number") return "color: #00FF41; font-weight: bold;";
      return "color: #00FF41;";
    } else if (theme === "solarized-light") {
      if (type === "comment") return "color: #93A1A1; font-style: italic;";
      if (type === "string") return "color: #2AA198;";
      if (type === "keyword") return "color: #859900; font-weight: 600;";
      if (type === "number") return "color: #D33682;";
      return "color: #657B83;";
    } else if (theme === "oceanic") {
      if (type === "comment") return "color: #65737E; font-style: italic;";
      if (type === "string") return "color: #99C794;";
      if (type === "keyword") return "color: #C594C5; font-weight: 600;";
      if (type === "number") return "color: #F99157;";
      return "color: #D8DEE9;";
    } else if (theme === "light") {
      if (type === "comment") return "color: #94A3B8; font-style: italic;";
      if (type === "string") return "color: #059669;";
      if (type === "keyword") return "color: #DB2777; font-weight: 600;";
      if (type === "number") return "color: #7C3AED;";
      return "color: #0F172A;";
    } else {
      // dark
      if (type === "comment") return "color: #64748B; font-style: italic;";
      if (type === "string") return "color: #A7F3D0;";
      if (type === "keyword") return "color: #F472B6; font-weight: 600;";
      if (type === "number") return "color: #C084FC;";
      return "color: #E2E8F0;";
    }
  };

  while ((match = regex.exec(text)) !== null) {
    html += escapeHtml(text.slice(lastIndex, match.index));

    if (match[1]) {
      html += `<span style="${getThemeStyles("comment")}">${escapeHtml(match[0])}</span>`;
    } else if (match[2]) {
      html += `<span style="${getThemeStyles("string")}">${escapeHtml(match[0])}</span>`;
    } else if (match[4]) {
      html += `<span style="${getThemeStyles("keyword")}">${escapeHtml(match[0])}</span>`;
    } else if (match[5]) {
      html += `<span style="${getThemeStyles("number")}">${escapeHtml(match[0])}</span>`;
    } else {
      html += escapeHtml(match[0]);
    }

    lastIndex = regex.lastIndex;
  }

  html += escapeHtml(text.slice(lastIndex));

  const bg =
    theme === "light"
      ? "#ffffff"
      : theme === "high-contrast"
        ? "#000000"
        : theme === "dracula"
          ? "#282A36"
          : theme === "hacker"
            ? "#0D0208"
            : theme === "solarized-light"
              ? "#FDF6E3"
              : theme === "oceanic"
                ? "#1B2B34"
                : "#020617";
  const fg =
    theme === "light"
      ? "#0F172A"
      : theme === "high-contrast"
        ? "#ffffff"
        : theme === "dracula"
          ? "#F8F8F2"
          : theme === "hacker"
            ? "#00FF41"
            : theme === "solarized-light"
              ? "#657B83"
              : theme === "oceanic"
                ? "#D8DEE9"
                : "#E2E8F0";

  return `<pre style="background-color: ${bg}; color: ${fg}; padding: 1rem; font-family: monospace; font-size: 12px; line-height: 1.5rem; overflow: auto; white-space: pre-wrap; word-break: break-all;"><code>${html}</code></pre>`;
}

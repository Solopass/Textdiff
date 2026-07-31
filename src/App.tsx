import React, { useState, useMemo, useRef, useEffect } from "react";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";
import { GitHubIntegration } from './components/GitHubIntegration';
import { MultiplayerMode } from './components/MultiplayerMode';
import {
  
  
  Sparkles, Users, Zap,
  CheckSquare,
  Square,
  FileText,
  SplitSquareHorizontal,
  Rows,
  ArrowLeftRight,
  ArrowLeft,
  UploadCloud,
  Cloud,
  Github,
  Box,
  Download,
  ListOrdered,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Keyboard,
  HelpCircle,
  Trash2,
  Maximize,
  Minimize,
  FileCode,
  Copy,
  Share2,
  History,
  Settings,
  GitMerge,
  Layout,
  Palette,
  Save,
  Upload,
  Share,
  Type,
  Lock,
  Unlock,
  Dices,
  
  
} from "lucide-react";
import { LandingPage } from "./components/LandingPage";
import { SettingsPage } from "./components/SettingsPage";
import { CloudSyncModal } from "./components/CloudSyncModal";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { collection, addDoc, getDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import LZString from "lz-string";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-json";

type HistoryItem = {
  id: string;
  timestamp: number;
  origText: string;
  modText: string;
};

type WordPart = { text: string; type: "unchanged" | "add" | "del" };

type DiffRow = {
  type: "unchanged" | "add" | "del" | "folded";
  lineA: string;
  lineB: string;
  lineNumA: number | null;
  lineNumB: number | null;
  partsA?: WordPart[];
  partsB?: WordPart[];
};

const escapeHtml = (str: string) =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function highlightCode(
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

function renderSearchHighlights(
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

function exportHighlightedHtml(
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

import Editor, { useMonaco } from "@monaco-editor/react";

const TextAreaWithLineNumbers = ({
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

  React.useEffect(() => {
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

// Features that depend on the Node/Socket.IO/Gemini backend (server.ts).
// GitHub Pages only serves static files, so these stay disabled until that
// backend is deployed somewhere separately. Flip via .env: VITE_ENABLE_SERVER_FEATURES=true
const SERVER_FEATURES_ENABLED = import.meta.env.VITE_ENABLE_SERVER_FEATURES === "true";
const COMING_SOON_TITLE = "Coming soon — needs a live server, not available on GitHub Pages yet";

export default function App() {
  const [currentView, setCurrentView] = useState<
    "landing" | "app" | "settings"
  >("landing");
  const [origText, setOrigText] = useState("");
  const [modText, setModText] = useState("");
  const [baseText, setBaseText] = useState("");
  const [isThreeWay, setIsThreeWay] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const [viewMode, setViewMode] = useState<"split" | "unified">("split");
  const [ignoreWs, setIgnoreWs] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [trimBlankLines, setTrimBlankLines] = useState(false);
  const [showLineNums, setShowLineNums] = useState(true);
  const [foldUnchanged, setFoldUnchanged] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [syntaxTheme, setSyntaxTheme] = useState<
    | "dark"
    | "light"
    | "high-contrast"
    | "custom"
    | "dracula"
    | "hacker"
    | "solarized-light"
    | "oceanic"
  >("dark");
  const [appLayout, setAppLayout] = useState<
    "standard" | "fluid" | "compact" | "zen"
  >("standard");
  const [showGitModal, setShowGitModal] = useState(false);
  const [gitConflictText, setGitConflictText] = useState("");
  const [isResolvingAI, setIsResolvingAI] = useState(false);
  const [showGithubPanel, setShowGithubPanel] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [uiFont, setUiFont] = useState<"sans" | "mono" | "serif" | "dyslexic">(
    "sans",
  );
  const [uiRadius, setUiRadius] = useState<"default" | "none" | "lg" | "full">(
    "default",
  );
  const [uiTint, setUiTint] = useState<
    "default" | "blue" | "purple" | "rose" | "amber" | "monochrome" | "invert"
  >("default");
  const [lockedLayout, setLockedLayout] = useState(false);
  const [lockedTheme, setLockedTheme] = useState(false);
  const [lockedFont, setLockedFont] = useState(false);
  const [lockedRadius, setLockedRadius] = useState(false);
  const [lockedTint, setLockedTint] = useState(false);
  const [uiFontSize, setUiFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [uiTexture, setUiTexture] = useState<'none' | 'dots' | 'grid' | 'noise'>('none');
  const [uiMotion, setUiMotion] = useState<'default' | 'reduced'>('default');
  const [uiGlass, setUiGlass] = useState(false);
  const [customCSS, setCustomCSS] = useState('');
  const [uiSound, setUiSound] = useState<'enabled' | 'disabled'>('disabled');

  const randomizeCustomization = () => {
    const layouts = [
      "standard",
      "fluid",
      "compact",
      "zen",
      "presentation",
      "terminal",
    ];
    const themes = [
      "dark",
      "light",
      "high-contrast",
      "dracula",
      "hacker",
      "solarized-light",
      "oceanic",
    ];
    const fonts = ["sans", "mono", "serif", "dyslexic"];
    const radii = ["default", "none", "lg", "full"];
    const tints = [
      "default",
      "blue",
      "purple",
      "rose",
      "amber",
      "monochrome",
      "invert",
    ];

    if (!lockedLayout)
      setAppLayout(layouts[Math.floor(Math.random() * layouts.length)] as any);
    if (!lockedTheme)
      setSyntaxTheme(themes[Math.floor(Math.random() * themes.length)] as any);
    if (!lockedFont)
      setUiFont(fonts[Math.floor(Math.random() * fonts.length)] as any);
    if (!lockedRadius)
      setUiRadius(radii[Math.floor(Math.random() * radii.length)] as any);
    if (!lockedTint)
      setUiTint(tints[Math.floor(Math.random() * tints.length)] as any);
  };
  const [customTheme, setCustomTheme] = useState({
    bg: "#020617",
    fg: "#E2E8F0",
    comment: "#64748B",
    string: "#A7F3D0",
    keyword: "#F472B6",
    number: "#C084FC",
    function: "#60A5FA",
    operator: "#475569",
  });
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [shareCodeInput, setShareCodeInput] = useState("");
  const [presetNameInput, setPresetNameInput] = useState("");
  const [loadedAnnotation, setLoadedAnnotation] = useState("");
  const [savedPresets, setSavedPresets] = useState<
    { name: string; config: any }[]
  >([]);

  const playSound = (type = 'click') => {
    if (uiSound === 'disabled') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(554, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {}
  };

  useEffect(() => {
    try {
      const p = localStorage.getItem("tds_presets");
      if (p) setSavedPresets(JSON.parse(p));
    } catch (e) {}
  }, []);

  const savePreset = () => {
    if (!presetNameInput.trim()) return;
    const newPresets = [
      ...savedPresets,
      {
        name: presetNameInput.trim(),
        config: {
          appLayout,
          syntaxTheme,
          customTheme,
          uiFont,
          uiRadius,
          uiTint,
          uiFontSize,
          uiTexture,
          uiMotion,
          customCSS,
          uiSound,
          uiGlass,
        },
      },
    ];
    setSavedPresets(newPresets);
    localStorage.setItem("tds_presets", JSON.stringify(newPresets));
    setPresetNameInput("");
  };

  const loadPreset = (preset: any) => {
    if (preset.config.appLayout) setAppLayout(preset.config.appLayout);
    if (preset.config.syntaxTheme) setSyntaxTheme(preset.config.syntaxTheme);
    if (preset.config.customTheme) setCustomTheme(preset.config.customTheme);
    if (preset.config.uiFont) setUiFont(preset.config.uiFont);
    if (preset.config.uiRadius) setUiRadius(preset.config.uiRadius);
    if (preset.config.uiTint) setUiTint(preset.config.uiTint);
    if (preset.config.uiFontSize) setUiFontSize(preset.config.uiFontSize);
    if (preset.config.uiTexture) setUiTexture(preset.config.uiTexture);
    if (preset.config.uiMotion) setUiMotion(preset.config.uiMotion);
    if (preset.config.customCSS !== undefined) setCustomCSS(preset.config.customCSS);
    if (preset.config.uiSound) setUiSound(preset.config.uiSound);
    if (preset.config.uiGlass !== undefined) setUiGlass(preset.config.uiGlass);
  };

  const getShareCode = () => {
    return btoa(
      JSON.stringify({
        appLayout,
        syntaxTheme,
        customTheme,
        uiFont,
        uiRadius,
        uiTint,
      }),
    );
  };

  const importShareCode = () => {
    try {
      const config = JSON.parse(atob(shareCodeInput));
      if (config.appLayout) setAppLayout(config.appLayout);
      if (config.syntaxTheme) setSyntaxTheme(config.syntaxTheme);
      if (config.customTheme) setCustomTheme(config.customTheme);
      if (config.uiFont) setUiFont(config.uiFont);
      if (config.uiRadius) setUiRadius(config.uiRadius);
      if (config.uiTint) setUiTint(config.uiTint);
      if (config.uiFontSize) setUiFontSize(config.uiFontSize);
      if (config.uiTexture) setUiTexture(config.uiTexture);
      if (config.uiMotion) setUiMotion(config.uiMotion);
      if (config.customCSS !== undefined) setCustomCSS(config.customCSS);
      if (config.uiSound) setUiSound(config.uiSound);
      if (config.uiGlass !== undefined) setUiGlass(config.uiGlass);
      alert("Customization imported successfully!");
      setShareCodeInput("");
    } catch (e) {
      alert("Invalid share code");
    }
  };
  const [language, setLanguage] = useState("javascript");
  const [splitRatio, setSplitRatio] = useState(50);
  const isDraggingSplitter = useRef(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isDiffing, setIsDiffing] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("./diffWorker.ts", import.meta.url),
      { type: "module" },
    );
    return () => {
      workerRef.current?.terminate();
    };
  }, []);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [diffResult, setDiffResult] = useState<DiffRow[] | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const isSyncingRef = useRef(false);

  const handleAIResolveConflict = async () => {
    if (!gitConflictText.trim()) return;
    setIsResolvingAI(true);
    try {
      playSound('click');
      const res = await fetch('/api/gemini/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: gitConflictText,
          instruction: 'Resolve this git merge conflict. Make sure to combine the logic correctly. Return only the final resolved code.'
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.result) {
        playSound('success');
        
        // Load it directly as modified text, and original as the raw conflict for comparison
        setOrigText(gitConflictText);
        setModText(data.result);
        setShowGitModal(false);
        runDiff(gitConflictText, data.result);
      }
    } catch (err: any) {
      alert(err.message || "Failed to resolve using AI");
    } finally {
      setIsResolvingAI(false);
    }
  };

  const handleParseGitConflict = () => {
    const lines = gitConflictText.split("\n");
    let orig = [];
    let mod = [];
    let base = [];
    let hasBase = false;
    let state = "normal";

    for (let line of lines) {
      if (line.startsWith("<<<<<<< ")) {
        state = "ours";
      } else if (line.startsWith("||||||| ")) {
        state = "base";
        hasBase = true;
      } else if (line.startsWith("=======")) {
        state = "theirs";
      } else if (line.startsWith(">>>>>>> ")) {
        state = "normal";
      } else {
        if (state === "normal") {
          orig.push(line);
          mod.push(line);
          base.push(line);
        } else if (state === "ours") {
          orig.push(line);
        } else if (state === "base") {
          base.push(line);
        } else if (state === "theirs") {
          mod.push(line);
        }
      }
    }
    setOrigText(orig.join("\n"));
    setModText(mod.join("\n"));
    if (hasBase) {
      setBaseText(base.join("\n"));
      setIsThreeWay(true);
    } else {
      setIsThreeWay(false);
    }
    setShowGitModal(false);
  };

  const clearAll = () => {
    if (confirm("Are you sure you want to clear all text and diff results?")) {
      setOrigText("");
      setModText("");
      setDiffResult(null);
    }
  };

  const handleSyncScroll = (
    e: React.UIEvent<HTMLTextAreaElement>,
    source: "orig" | "mod",
  ) => {
    if (isSyncingRef.current) return;

    const isMobile = e.currentTarget.id.includes("-mobile");
    const targetId =
      source === "orig"
        ? `textarea-mod${isMobile ? "-mobile" : "-desk"}`
        : `textarea-orig${isMobile ? "-mobile" : "-desk"}`;
    const target = document.getElementById(targetId) as HTMLTextAreaElement;

    if (target) {
      isSyncingRef.current = true;
      target.scrollTop = e.currentTarget.scrollTop;
      target.scrollLeft = e.currentTarget.scrollLeft;

      window.requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    }
  };

  const handleMergeBToA = async () => {
    if (!modText) return;

    // Save to local history
    const newItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      origText,
      modText,
    };
    setHistory((prev) => {
      const newHistory = [newItem, ...prev].slice(0, 20);
      localStorage.setItem("tds_history", JSON.stringify(newHistory));
      return newHistory;
    });

    // Optional github sync
    const token = localStorage.getItem("tds_github_token");
    if (token) {
      try {
        await fetch("https://api.github.com/gists", {
          method: "POST",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: `TextDiff Studio Merge - ${new Date().toLocaleString()}`,
            public: false,
            files: {
              "versionA.txt": { content: origText || " " },
              "versionB.txt": { content: modText || " " },
            },
          }),
        });
      } catch (err) {
        console.error("Failed to sync history to GitHub:", err);
      }
    }

    setOrigText(modText);
    setModText("");
    setDiffResult(null);
  };

  const swapTexts = () => {
    playSound('click');
    setOrigText(modText);
    setModText(origText);
    if (diffResult) {
      runDiff(modText, origText, ignoreWs, ignoreCase, trimBlankLines);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => alert("Copied to clipboard!"));
  };

  const handleExportHtml = async (text: string) => {
    const html = exportHighlightedHtml(text, syntaxTheme);
    try {
      await navigator.clipboard.writeText(html);
      alert("Copied HTML code to clipboard!");
    } catch (err) {
      console.error("Failed to copy HTML", err);
      alert("Failed to copy HTML to clipboard.");
    }
  };

  useEffect(() => {
    const handleSplitterMove = (e: MouseEvent) => {
      if (!isDraggingSplitter.current) return;
      const container = document.getElementById("split-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      let newRatio = ((e.clientX - rect.left) / rect.width) * 100;
      newRatio = Math.max(20, Math.min(80, newRatio));
      setSplitRatio(newRatio);
    };

    const onMouseUp = () => {
      isDraggingSplitter.current = false;
    };
    window.addEventListener("mousemove", handleSplitterMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleSplitterMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    if (id || window.location.hash) {
      setCurrentView("app");
    }

    const loadFromId = async (id: string) => {
      try {
        const docSnap = await getDoc(doc(db, "diffs", id));
        if (docSnap.exists()) {
          const data = JSON.parse(docSnap.data().data);
          if (data.origText !== undefined) setOrigText(data.origText);
          if (data.modText !== undefined) setModText(data.modText);
          if (data.baseText !== undefined) setBaseText(data.baseText);
          if (data.isThreeWay !== undefined) setIsThreeWay(data.isThreeWay);
          if (data.language) setLanguage(data.language);
          if (data.note) setLoadedAnnotation(data.note);
        }
      } catch (e) {
        console.error("Failed to load from Firestore", e);
      }
    };

    if (id) {
      loadFromId(id);
    } else if (window.location.hash) {
      try {
        const hash = window.location.hash.substring(1);
        const data = JSON.parse(
          LZString.decompressFromEncodedURIComponent(hash) || "{}",
        );
        if (data.origText !== undefined) setOrigText(data.origText);
        if (data.modText !== undefined) setModText(data.modText);
        if (data.baseText !== undefined) setBaseText(data.baseText);
        if (data.isThreeWay !== undefined) setIsThreeWay(data.isThreeWay);
        if (data.language) setLanguage(data.language);
      } catch (e) {
        console.error("Failed to parse URL hash");
      }
    } else {
      const savedOrig = localStorage.getItem("tds_origText");
      const savedMod = localStorage.getItem("tds_modText");
      if (savedOrig !== null) setOrigText(savedOrig);
      if (savedMod !== null) setModText(savedMod);

      try {
        const configStr = localStorage.getItem("tds_config");
        if (configStr) {
          const config = JSON.parse(configStr);
          if (config.viewMode !== undefined) setViewMode(config.viewMode);
          if (config.ignoreWs !== undefined) setIgnoreWs(config.ignoreWs);
          if (config.ignoreCase !== undefined) setIgnoreCase(config.ignoreCase);
          if (config.trimBlankLines !== undefined)
            setTrimBlankLines(config.trimBlankLines);
          if (config.showLineNums !== undefined)
            setShowLineNums(config.showLineNums);
          if (config.foldUnchanged !== undefined)
            setFoldUnchanged(config.foldUnchanged);
          if (config.wordWrap !== undefined) setWordWrap(config.wordWrap);
          if (config.syntaxTheme !== undefined)
            setSyntaxTheme(config.syntaxTheme);
          if (config.language !== undefined) setLanguage(config.language);
          if (config.appLayout !== undefined) setAppLayout(config.appLayout);
          if (config.uiFont !== undefined) setUiFont(config.uiFont);
          if (config.uiRadius !== undefined) setUiRadius(config.uiRadius);
          if (config.uiTint !== undefined) setUiTint(config.uiTint);
          if (config.uiFontSize !== undefined) setUiFontSize(config.uiFontSize);
          if (config.uiTexture !== undefined) setUiTexture(config.uiTexture);
          if (config.uiMotion !== undefined) setUiMotion(config.uiMotion);
          if (config.customCSS !== undefined) setCustomCSS(config.customCSS);
          if (config.uiSound !== undefined) setUiSound(config.uiSound);
          if (config.uiGlass !== undefined) setUiGlass(config.uiGlass);
        }
        const histStr = localStorage.getItem("tds_history");
        if (histStr) {
          setHistory(JSON.parse(histStr));
        }
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("tds_origText", origText);
      localStorage.setItem("tds_modText", modText);
      localStorage.setItem(
        "tds_config",
        JSON.stringify({
          viewMode,
          ignoreWs,
          ignoreCase,
          trimBlankLines,
          showLineNums,
          foldUnchanged,
          wordWrap,
          syntaxTheme,
          language,
          appLayout,
          uiFont,
          uiRadius,
          uiTint,
        }),
      );
    }
  }, [
    origText,
    modText,
    isLoaded,
    viewMode,
    ignoreWs,
    ignoreCase,
    trimBlankLines,
    showLineNums,
    foldUnchanged,
    wordWrap,
    syntaxTheme,
    language,
  ]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runDiff(origText, modText, ignoreWs, ignoreCase, trimBlankLines);
      }
      // Ctrl+Shift+S or Cmd+Shift+S
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "s"
      ) {
        e.preventDefault();
        swapTexts();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [origText, modText, ignoreWs, ignoreCase, trimBlankLines, swapTexts]);

  // Computed stats
  const origStats = useMemo(() => getStatsString(origText), [origText]);
  const modStats = useMemo(() => getStatsString(modText), [modText]);

  function getStatsString(text: string) {
    if (!text) return "0 lines | 0 words | 0 chars";
    const lines = text.split("\n").length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    return `${lines} lines | ${words} words | ${chars} chars`;
  }

  const [sampleIndex, setSampleIndex] = useState(0);

  const loadSample = () => {
    const templates = [
      {
        lang: "javascript",
        orig: `function calculateTotal(items) {\n  let total = 0;\n  for (let i = 0; i < items.length; i++) {\n    total += items[i].price;\n  }\n  return total;\n}\nconsole.log("Calculation finished");`,
        mod: `function calculateTotal(items, discount = 0) {\n  let total = 0;\n  // Use array reduce for clean calculation\n  total = items.reduce((acc, item) => acc + item.price, 0);\n  \n  if (discount > 0) {\n    total = total - (total * discount);\n  }\n  return total;\n}\nconsole.log("Order total computed successfully");`,
      },
      {
        lang: "python",
        orig: `def process_data(data):\n    result = []\n    for item in data:\n        if item != None:\n            result.append(item.lower())\n    return result`,
        mod: `def process_data(data):\n    # More pythonic approach\n    if not data:\n        return []\n    return [item.lower() for item in data if item is not None]`,
      },
      {
        lang: "json",
        orig: `{\n  "name": "TextDiff Studio",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.0.0"\n  }\n}`,
        mod: `{\n  "name": "TextDiff Studio",\n  "version": "2.0.0",\n  "description": "Advanced text comparison",\n  "dependencies": {\n    "react": "^18.2.0",\n    "lucide-react": "^0.250.0"\n  }\n}`,
      },
    ];

    const current = templates[sampleIndex];
    setOrigText(current.orig);
    setModText(current.mod);
    setLanguage(current.lang);
    runDiff(current.orig, current.mod, ignoreWs, ignoreCase, trimBlankLines);
    setSampleIndex((sampleIndex + 1) % templates.length);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setTarget: (val: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setTarget(ev.target?.result as string);
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent, setTarget: (val: string) => void) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setTarget(ev.target?.result as string);
      reader.readAsText(file);
    }
  };

  /**
   * Computes inline token-level differences between two strings.
   * Used to highlight specific words/characters that changed within a modified line.
   *
   * @param {string} strA - The original string line.
   * @param {string} strB - The modified string line.
   * @returns {Object} An object containing partsA and partsB arrays with token-level diff classifications.
   */
  const computeTokenDiff = (strA: string, strB: string) => {
    const tokensA = strA
      .split(/([a-zA-Z0-9_]+|\s+|[^a-zA-Z0-9_\s])/)
      .filter(Boolean);
    const tokensB = strB
      .split(/([a-zA-Z0-9_]+|\s+|[^a-zA-Z0-9_\s])/)
      .filter(Boolean);

    const m = tokensA.length;
    const n = tokensB.length;
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (tokensA[i] === tokensB[j]) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    const partsA: WordPart[] = [];
    const partsB: WordPart[] = [];
    let i = m,
      j = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && tokensA[i - 1] === tokensB[j - 1]) {
        partsA.unshift({ text: tokensA[i - 1], type: "unchanged" });
        partsB.unshift({ text: tokensB[j - 1], type: "unchanged" });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        partsB.unshift({ text: tokensB[j - 1], type: "add" });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        partsA.unshift({ text: tokensA[i - 1], type: "del" });
        i--;
      }
    }
    return { partsA, partsB };
  };

  /**
   * Computes the Longest Common Subsequence (LCS) to find differences between two arrays of lines.
   *
   * @param {string[]} aLines - Array of lines from the original text.
   * @param {string[]} bLines - Array of lines from the modified text.
   * @param {boolean} ignoreWhitespace - Whether to ignore leading/trailing whitespace during comparison.
   * @param {boolean} ignoreCasing - Whether to ignore case differences during comparison.
   * @returns {DiffRow[]} Array of row objects describing the diff line by line.
   */
  const computeLCS = (
    aLines: string[],
    bLines: string[],
    ignoreWhitespace: boolean,
    ignoreCasing: boolean,
  ) => {
    const normalize = (line: string) => {
      let str = line;
      if (ignoreWhitespace) str = str.trim().replace(/\s+/g, " ");
      if (ignoreCasing) str = str.toLowerCase();
      return str;
    };

    const m = aLines.length;
    const n = bLines.length;
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (normalize(aLines[i]) === normalize(bLines[j])) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    const diff: DiffRow[] = [];
    let i = m,
      j = n;

    // Backtracking with fixed syntax (removed |---|j > 0 error)
    while (i > 0 || j > 0) {
      if (
        i > 0 &&
        j > 0 &&
        normalize(aLines[i - 1]) === normalize(bLines[j - 1])
      ) {
        diff.unshift({
          type: "unchanged",
          lineA: aLines[i - 1],
          lineB: bLines[j - 1],
          lineNumA: i,
          lineNumB: j,
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        diff.unshift({
          type: "add",
          lineA: "",
          lineB: bLines[j - 1],
          lineNumA: null,
          lineNumB: j,
        });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        diff.unshift({
          type: "del",
          lineA: aLines[i - 1],
          lineB: "",
          lineNumA: i,
          lineNumB: null,
        });
        i--;
      }
    }

    for (let k = 0; k < diff.length; k++) {
      if (
        diff[k].type === "del" &&
        k + 1 < diff.length &&
        diff[k + 1].type === "add"
      ) {
        const { partsA, partsB } = computeTokenDiff(
          diff[k].lineA,
          diff[k + 1].lineB,
        );
        diff[k].partsA = partsA;
        diff[k + 1].partsB = partsB;
        k++;
      } else if (
        diff[k].type === "add" &&
        k + 1 < diff.length &&
        diff[k + 1].type === "del"
      ) {
        const { partsA, partsB } = computeTokenDiff(
          diff[k + 1].lineA,
          diff[k].lineB,
        );
        diff[k + 1].partsA = partsA;
        diff[k].partsB = partsB;
        k++;
      }
    }

    return diff;
  };

  const [isSharing, setIsSharing] = useState(false);
  const shareUrl = async () => {
    try {
      const note = prompt(
        "Optional: Add an annotation or title for this share link (leave blank to skip):",
      );
      setIsSharing(true);
      const data = {
        origText,
        modText,
        baseText,
        language,
        isThreeWay,
        note: note || "",
      };
      const docRef = await addDoc(collection(db, "diffs"), {
        data: JSON.stringify(data),
        timestamp: Date.now(),
      });
      const url = new URL(window.location.href);
      url.searchParams.set("id", docRef.id);
      url.hash = ""; // clear hash if any
      await navigator.clipboard.writeText(url.toString());
      alert("Permanent Shareable URL copied to clipboard!");
    } catch (err) {
      console.error("Failed to create share link:", err);
      // Fallback to local hash
      const data = { origText, modText, baseText, language, isThreeWay };
      const compressed = LZString.compressToEncodedURIComponent(
        JSON.stringify(data),
      );
      const url = new URL(window.location.href);
      url.hash = compressed;
      navigator.clipboard
        .writeText(url.toString())
        .then(() => alert("Shareable URL (fallback) copied to clipboard!"));
    } finally {
      setIsSharing(false);
    }
  };

  /**
   * Main function to execute the diff comparison and update application state.
   * Extracts lines, normalizes based on filters, computes the LCS, and sets the results.
   *
   * @param {string} orig - The original text.
   * @param {string} mod - The modified text.
   * @param {boolean} ws - Ignore whitespace.
   * @param {boolean} caseInsensitive - Ignore casing.
   * @param {boolean} trimBlanks - Remove blank lines before diffing.
   */
  const runDiff = (
    orig = origText,
    mod = modText,
    ws = ignoreWs,
    caseInsensitive = ignoreCase,
    trimBlanks = trimBlankLines,
  ) => {
    setHistory((prev) => {
      if (
        prev.length > 0 &&
        prev[0].origText === orig &&
        prev[0].modText === mod
      )
        return prev;
      const newItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        origText: orig,
        modText: mod,
      };
      const newHistory = [newItem, ...prev].slice(0, 20);
      localStorage.setItem("tds_history", JSON.stringify(newHistory));
      return newHistory;
    });
    if (!orig && !mod) {
      alert("Please enter text in at least one box to run comparison.");
      return;
    }

    if (workerRef.current) {
      setIsDiffing(true);
      workerRef.current.onmessage = (e) => {
        setDiffResult(e.data.rawDiff);
        setIsDiffing(false);
      };
      workerRef.current.postMessage({
        orig,
        mod,
        base: baseText,
        isThreeWay,
        ws,
        caseInsensitive,
        trimBlanks,
      });
    } else {
      let aLines = orig ? orig.split("\n") : [];
      let bLines = mod ? mod.split("\n") : [];

      if (trimBlanks) {
        aLines = aLines.filter((line) => line.trim() !== "");
        bLines = bLines.filter((line) => line.trim() !== "");
      }

      const diff = computeLCS(aLines, bLines, ws, caseInsensitive);
      setDiffResult(diff);
    }
  };

  const exportHtmlReport = () => {
    if (!diffResult) return;
    const element = document.getElementById("diff-report-container");
    if (!element) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Diff Report</title>
        <style>
          body { background-color: #020617; color: #E2E8F0; font-family: monospace; }
          .diff-container { padding: 2rem; max-width: 1200px; margin: 0 auto; }
          .add { background-color: rgba(6, 78, 59, 0.3); color: #6EE7B7; }
          .del { background-color: rgba(69, 10, 10, 0.3); color: #FCA5A5; }
        </style>
      </head>
      <body>
        <div class="diff-container">
          ${element.innerHTML}
        </div>
      </body>
      </html>
    `;
    const dataStr =
      "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "diff_report.html");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const exportImageReport = () => {
    const container = document.getElementById("diff-render-area");
    if (!container) return;

    html2canvas(container, { backgroundColor: "#020617" }).then((canvas) => {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "diff.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  };

  const exportPdfReport = async () => {
    if (!diffResult) return;

    const element = document.getElementById("diff-report-container");
    if (!element) return;

    try {
      // Create a clone to fix layout for PDF export if needed
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#020617",
        logging: false,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // If content is taller than one page, we might need multiple pages or just fit to width
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("diff_report.pdf");
    } catch (error) {
      console.error("Failed to generate PDF", error);
      alert("Failed to generate PDF report.");
    }
  };

  const exportRawDiff = () => {
    if (!diffResult) return;
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(diffResult, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "textdiff_payload.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Stats calculation
  const stats = useMemo(() => {
    if (!diffResult) return null;
    let addCount = 0,
      delCount = 0,
      unchangedCount = 0;
    diffResult.forEach((item) => {
      if (item.type === "add") addCount++;
      else if (item.type === "del") delCount++;
      else unchangedCount++;
    });
    const totalLines = addCount + delCount + unchangedCount;
    const similarity =
      totalLines > 0 ? Math.round((unchangedCount / totalLines) * 100) : 100;
    return { addCount, delCount, unchangedCount, similarity };
  }, [diffResult]);

  const intensityMap = useMemo(() => {
    if (!diffResult || diffResult.length === 0) return [];

    const BUCKETS = 50;
    const bucketSize = Math.max(1, Math.ceil(diffResult.length / BUCKETS));
    const map = [];

    for (let i = 0; i < BUCKETS; i++) {
      const start = i * bucketSize;
      if (start >= diffResult.length) break;

      const chunk = diffResult.slice(start, start + bucketSize);
      let addCount = 0;
      let delCount = 0;

      chunk.forEach((row) => {
        if (row.type === "add") addCount++;
        else if (row.type === "del") delCount++;
      });

      const totalChanges = addCount + delCount;
      const intensity = Math.min(1, totalChanges / bucketSize);

      let colorClass = "bg-[#334155]";
      if (totalChanges > 0) {
        if (addCount > delCount * 2) colorClass = "bg-[#10B981]";
        else if (delCount > addCount * 2) colorClass = "bg-[#EF4444]";
        else colorClass = "bg-[#F59E0B]";
      }

      map.push({ intensity, colorClass, adds: addCount, dels: delCount });
    }
    return map;
  }, [diffResult]);

  const visibleDiffResult = useMemo(() => {
    if (!diffResult) return null;
    if (!foldUnchanged) return diffResult;

    const contextLines = 3;
    const result: DiffRow[] = [];
    const showMask = new Array(diffResult.length).fill(false);

    for (let i = 0; i < diffResult.length; i++) {
      if (diffResult[i].type !== "unchanged") {
        for (
          let j = Math.max(0, i - contextLines);
          j <= Math.min(diffResult.length - 1, i + contextLines);
          j++
        ) {
          showMask[j] = true;
        }
      }
    }

    let lastWasHidden = false;
    for (let i = 0; i < diffResult.length; i++) {
      if (showMask[i]) {
        result.push(diffResult[i]);
        lastWasHidden = false;
      } else {
        if (!lastWasHidden) {
          result.push({
            type: "folded",
            lineA: "...",
            lineB: "...",
            lineNumA: null,
            lineNumB: null,
          });
          lastWasHidden = true;
        }
      }
    }
    return result;
  }, [diffResult, foldUnchanged]);

  const scrollToNextDiff = () => {
    const elements = document.querySelectorAll(".diff-row-changed");
    if (elements.length === 0) return;

    for (let i = 0; i < elements.length; i++) {
      const rect = elements[i].getBoundingClientRect();
      if (rect.top > window.innerHeight / 2 + 50) {
        elements[i].scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    elements[0].scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToPrevDiff = () => {
    const elements = document.querySelectorAll(".diff-row-changed");
    if (elements.length === 0) return;

    for (let i = elements.length - 1; i >= 0; i--) {
      const rect = elements[i].getBoundingClientRect();
      if (rect.bottom < window.innerHeight / 2 - 50) {
        elements[i].scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    elements[elements.length - 1].scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const handleCopyReport = () => {
    if (!stats) return;
    const report = `--- TextDiff Studio Report ---
Similarity: ${stats.similarity}%
Additions: +${stats.addCount} lines
Deletions: -${stats.delCount} lines
Unchanged: ${stats.unchangedCount} lines
Date: ${new Date().toLocaleString()}
------------------------------`;
    navigator.clipboard.writeText(report).then(() => {
      alert("Diff summary report copied to clipboard!");
    });
  };

  const exportPatchReport = () => {
    if (!diffResult) return;
    let patchStr = `--- Original\n+++ Modified\n`;
    diffResult.forEach((row) => {
      if (row.type === "unchanged") {
        patchStr += ` ${row.lineA}\n`;
      } else if (row.type === "del") {
        patchStr += `-${row.lineA}\n`;
      } else if (row.type === "add") {
        patchStr += `+${row.lineB}\n`;
      }
    });
    const blob = new Blob([patchStr], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diff.patch";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsvReport = () => {
    if (!diffResult) return;
    let csvStr = `Type,Original Line,Modified Line,Original Content,Modified Content\n`;

    const escapeCsv = (str: string) => {
      if (!str) return '""';
      return `"${str.replace(/"/g, '""')}"`;
    };

    diffResult.forEach((row) => {
      const type = row.type;
      const lineA = row.lineNumA || "";
      const lineB = row.lineNumB || "";
      const contentA = escapeCsv(row.lineA || "");
      const contentB = escapeCsv(row.lineB || "");
      csvStr += `${type},${lineA},${lineB},${contentA},${contentB}\n`;
    });

    const blob = new Blob([csvStr], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diff.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportMdReport = () => {
    if (!diffResult) return;
    let mdStr = `# Diff Report\n\n`;
    mdStr += `**Date:** ${new Date().toLocaleString()}\n\n`;

    if (stats) {
      mdStr += `## Summary\n`;
      mdStr += `- **Similarity:** ${stats.similarity}%\n`;
      mdStr += `- **Additions:** +${stats.addCount} lines\n`;
      mdStr += `- **Deletions:** -${stats.delCount} lines\n`;
      mdStr += `- **Unchanged:** ${stats.unchangedCount} lines\n\n`;
    }

    mdStr += `## Changes\n\n`;
    mdStr += `\`\`\`diff\n`;
    diffResult.forEach((row) => {
      if (row.type === "unchanged") {
        mdStr += `  ${row.lineA}\n`;
      } else if (row.type === "del") {
        mdStr += `- ${row.lineA}\n`;
      } else if (row.type === "add") {
        mdStr += `+ ${row.lineB}\n`;
      }
    });
    mdStr += `\`\`\`\n`;

    const blob = new Blob([mdStr], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diff.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (currentView === "landing") {
    return <LandingPage onEnter={() => setCurrentView("app")} />;
  }

  if (currentView === "settings") {
    return <SettingsPage onBack={() => setCurrentView("app")} />;
  }

  return (
    <div
      className={`min-h-screen bg-[#0A0A0C] text-[#E2E8F0] flex flex-col ${appLayout === "zen" ? "p-0" : appLayout === "compact" ? "p-2" : appLayout === "presentation" ? "p-8 md:p-12 text-lg" : appLayout === "terminal" ? "p-2 font-mono" : "p-4 md:p-6"} ${uiFont === "sans" ? "font-sans" : ""} ${uiFont !== "sans" ? "theme-font-" + uiFont : ""} ${uiTint !== "default" ? "theme-tint-" + uiTint : ""} ${uiRadius !== "default" ? "theme-radius-" + uiRadius : ""}`}
    >
      <div
        className={`mx-auto w-full flex flex-col flex-1 ${appLayout === "standard" ? "max-w-7xl gap-6" : appLayout === "compact" ? "max-w-full gap-2" : appLayout === "zen" ? "max-w-full gap-0" : appLayout === "presentation" ? "max-w-5xl gap-10" : appLayout === "terminal" ? "max-w-full gap-1" : "max-w-full gap-6"}`}
      >
        {/* Header */}
        {loadedAnnotation && (
          <div className="bg-[#3B82F6]/20 border border-[#3B82F6] text-[#60A5FA] px-4 py-2 rounded-md flex items-center justify-between animate-in fade-in zoom-in duration-300">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" /> <b>Author's Note:</b>{" "}
              {loadedAnnotation}
            </span>
            <button
              onClick={() => setLoadedAnnotation("")}
              className="hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {appLayout !== "zen" && (
          <header
            className={`flex flex-col md:flex-row md:justify-between md:items-end ${appLayout === "compact" ? "pb-2 mb-1" : "border-b border-[#334155] pb-4 mb-2"}`}
          >
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                <Zap className="text-[#34D399] w-6 h-6" /> TextDiff Studio{" "}
                <span className="text-[#94A3B8] font-mono text-sm align-top ml-2 bg-[#1E293B] px-1.5 py-0.5 rounded">
                  v2.0-PRO
                </span>
              </h1>
              <p className="text-[#64748B] font-serif italic text-sm mt-1">
                Fast, browser-based side-by-side & unified text comparison tool.
              </p>
            </div>
            <div className="flex gap-4 items-center mt-4 md:mt-0">
              <button
                onClick={() => setCurrentView("settings")}
                className="p-2 text-[#94A3B8] hover:text-white hover:bg-[#1E293B] rounded transition-colors"
                title="Settings & Guide"
              >
                <Settings className="w-5 h-5" />
              </button>
              <div className="text-right">
                <span className="block text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
                  Status
                </span>
                <span className="px-2 py-0.5 bg-[#064E3B] text-[#34D399] border border-[#065F46] text-xs font-mono">
                  ACTIVE
                </span>
              </div>
            </div>
          </header>
        )}

        {/* Toolbar */}
        <section className="bg-[#111827] border border-[#334155] p-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-[#020617] p-1 border border-[#334155]">
            <button
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-2 px-3 py-1 text-xs font-mono font-medium transition-colors ${viewMode === "split" ? "bg-[#334155] text-white" : "text-[#64748B] hover:text-[#94A3B8]"}`}
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5" />
              SIDE-BY-SIDE
            </button>
            <button
              onClick={() => setViewMode("unified")}
              className={`flex items-center gap-2 px-3 py-1 text-xs font-mono font-medium transition-colors ${viewMode === "unified" ? "bg-[#334155] text-white" : "text-[#64748B] hover:text-[#94A3B8]"}`}
            >
              <Rows className="w-3.5 h-3.5" />
              UNIFIED
            </button>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                className="hidden"
                checked={isThreeWay}
                onChange={(e) => setIsThreeWay(e.target.checked)}
              />
              {isThreeWay ? (
                <CheckSquare className="w-4 h-4 text-[#34D399]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              3-WAY_MERGE
            </label>
            <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                className="hidden"
                checked={ignoreWs}
                onChange={(e) => {
                  setIgnoreWs(e.target.checked);
                  if (diffResult)
                    runDiff(
                      origText,
                      modText,
                      e.target.checked,
                      ignoreCase,
                      trimBlankLines,
                    );
                }}
              />
              {ignoreWs ? (
                <CheckSquare className="w-4 h-4 text-[#34D399]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              IGNORE_WS
            </label>
            <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                className="hidden"
                checked={ignoreCase}
                onChange={(e) => {
                  setIgnoreCase(e.target.checked);
                  if (diffResult)
                    runDiff(
                      origText,
                      modText,
                      ignoreWs,
                      e.target.checked,
                      trimBlankLines,
                    );
                }}
              />
              {ignoreCase ? (
                <CheckSquare className="w-4 h-4 text-[#34D399]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              IGNORE_CASE
            </label>
            <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                className="hidden"
                checked={trimBlankLines}
                onChange={(e) => {
                  setTrimBlankLines(e.target.checked);
                  if (diffResult)
                    runDiff(
                      origText,
                      modText,
                      ignoreWs,
                      ignoreCase,
                      e.target.checked,
                    );
                }}
              />
              {trimBlankLines ? (
                <CheckSquare className="w-4 h-4 text-[#34D399]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              TRIM_BLANKS
            </label>
            <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                className="hidden"
                checked={foldUnchanged}
                onChange={(e) => setFoldUnchanged(e.target.checked)}
              />
              {foldUnchanged ? (
                <CheckSquare className="w-4 h-4 text-[#34D399]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              FOLD_UNCHANGED
            </label>
            <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors ml-2 border-l border-[#334155] pl-4">
              <input
                type="checkbox"
                className="hidden"
                checked={showLineNums}
                onChange={(e) => setShowLineNums(e.target.checked)}
              />
              {showLineNums ? (
                <CheckSquare className="w-4 h-4 text-[#34D399]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              LINE_NUMS
            </label>
            <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                className="hidden"
                checked={wordWrap}
                onChange={(e) => setWordWrap(e.target.checked)}
              />
              {wordWrap ? (
                <CheckSquare className="w-4 h-4 text-[#34D399]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              WORD_WRAP
            </label>
            <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] ml-2 border-l border-[#334155] pl-4">
              <button
                onClick={() => setShowGitModal(true)}
                className="px-2 py-1 bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-white border border-[#334155] rounded text-[10px] mr-2 flex items-center gap-1"
                title="Resolve Git Conflict"
              >
                <GitMerge className="w-3 h-3" /> GIT
              </button>

              <button
                onClick={() => setShowCustomizeModal(true)}
                className="px-3 py-1.5 border border-[#6D28D9] bg-[#4C1D95] text-[#C4B5FD] hover:bg-[#6D28D9] transition-colors flex items-center gap-2 mr-2"
              >
                <Palette className="w-3.5 h-3.5" />
                CUSTOMIZE
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors flex items-center gap-2"
              title="Diff History"
            >
              <History className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowGithubPanel(!showGithubPanel)}
              className={`px-3 py-1.5 border border-[#334155] ${showGithubPanel ? 'bg-[#334155] text-white' : 'bg-[#1E293B] text-[#E2E8F0]'} hover:bg-[#334155] transition-colors flex items-center gap-2`}
            >
              <Github className="w-3.5 h-3.5" /> GITHUB
            </button>
            <button
              onClick={() => SERVER_FEATURES_ENABLED && setShowMultiplayer(!showMultiplayer)}
              disabled={!SERVER_FEATURES_ENABLED}
              title={SERVER_FEATURES_ENABLED ? undefined : COMING_SOON_TITLE}
              className={`px-3 py-1.5 border border-[#334155] ${showMultiplayer ? 'bg-[#334155] text-[#34D399]' : 'bg-[#1E293B] text-[#E2E8F0]'} transition-colors flex items-center gap-2 ${SERVER_FEATURES_ENABLED ? 'hover:bg-[#334155]' : 'opacity-40 grayscale cursor-not-allowed'}`}
            >
              <Users className="w-3.5 h-3.5" /> MULTIPLAYER
            </button>
            <button
              onClick={() => setShowHelpModal(true)}
              className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors flex items-center gap-2"
              title="Keyboard Shortcuts"
            >
              <Keyboard className="w-3.5 h-3.5" />
              HELP
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors flex items-center gap-2 text-[#FCA5A5] hover:bg-[#450a0a]/30"
              title="Clear All Texts"
            >
              <Trash2 className="w-3.5 h-3.5" />
              CLEAR
            </button>
            <button
              onClick={swapTexts}
              className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors flex items-center gap-2"
              title="Swap Texts (Ctrl+Shift+S)"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              SWAP
            </button>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors outline-none cursor-pointer"
            >
              <option value="javascript">JAVASCRIPT</option>
              <option value="python">PYTHON</option>
              <option value="json">JSON</option>
              <option value="plain">PLAIN TEXT</option>
            </select>
            <button
              onClick={loadSample}
              className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors"
            >
              LOAD_SAMPLE
            </button>
            <button
              onClick={shareUrl}
              className="px-3 py-1.5 border border-[#3B82F6] bg-[#2563EB] text-white hover:bg-[#3B82F6] transition-colors flex items-center gap-2"
            >
              {isSharing ? (
                <span className="animate-spin text-white">...</span>
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              {isSharing ? "SHARING..." : "SHARE"}
            </button>
            <button
              onClick={() => runDiff()}
              className="px-4 py-1.5 border border-[#065F46] bg-[#064E3B] text-[#34D399] hover:bg-[#065F46] active:scale-95 transition-all"
              title="Run Diff (Ctrl+Enter)"
            >
              RUN_DIFF
            </button>
          </div>
        </section>

        {/* Input Textareas Section (Desktop Resizable Panels) */}
        
        {showGithubPanel && (
          <div className="mb-6 h-[400px]">
            <GitHubIntegration onLoadFile={(text, name) => {
              // Intelligently put it in Orig if empty, else Mod
              if (!origText.trim()) setOrigText(text);
              else setModText(text);
              setShowGithubPanel(false);
              playSound('success');
            }} />
          </div>
        )}

        {showMultiplayer && (
          <div className="mb-6">
            <MultiplayerMode onRunDiff={(textA, textB) => {
              setOrigText(textA);
              setModText(textB);
              setShowMultiplayer(false);
              runDiff(textA, textB);
            }} />
          </div>
        )}

        <section
          id="split-container"
          className={`hidden lg:flex h-[400px] mb-6 relative w-full ${showMultiplayer ? 'hidden lg:hidden' : ''}`}
        >
          <div
            style={{ width: `calc(${splitRatio}% - 8px)` }}
            className="flex flex-col"
          >
            <div
              className="bg-[#020617] border border-[#334155] flex flex-col relative group h-full"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, setOrigText)}
            >
              <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-[#334155]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[#94A3B8]" /> Original
                  Text (Version A)
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleCopyText(origText)}
                    className="text-[10px] text-[#94A3B8] hover:text-white flex items-center gap-1"
                    title="Copy Text"
                  >
                    <Copy className="w-3 h-3" />
                    COPY
                  </button>
                  <button
                    onClick={() => handleExportHtml(origText)}
                    className="text-[10px] text-[#94A3B8] hover:text-white cursor-pointer flex items-center gap-1"
                    title="Copy as HTML"
                  >
                    <Download className="w-3 h-3" />
                    HTML
                  </button>
                  <label className="text-[10px] text-[#94A3B8] hover:text-white cursor-pointer flex items-center gap-1">
                    <UploadCloud className="w-3 h-3" />
                    UPLOAD
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt,.md,.json,.js,.ts,.html,.css"
                      onChange={(e) => handleFileUpload(e, setOrigText)}
                    />
                  </label>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 border border-blue-500/30 font-mono">
                    {origStats}
                  </span>
                </div>
              </div>
              <TextAreaWithLineNumbers
                customTheme={customTheme}
                id="textarea-orig-desk"
                value={origText}
                onChange={setOrigText}
                placeholder="Paste, type, or drag & drop original text here..."
                showLineNums={showLineNums}
                syntaxTheme={syntaxTheme}
                onScroll={(e) => handleSyncScroll(e, "orig")}
                language={language}
                wordWrap={wordWrap}
              />
            </div>
          </div>

          <div
            onMouseDown={(e) => {
              e.preventDefault();
              isDraggingSplitter.current = true;
            }}
            className="w-4 flex items-center justify-center cursor-col-resize group z-10 hover:bg-[#334155]/20 h-full"
          >
            <div className="w-1 h-12 bg-[#334155] rounded-full group-hover:bg-[#34D399] transition-colors" />
          </div>

          <div
            style={{ width: `calc(${100 - splitRatio}% - 8px)` }}
            className="flex flex-col"
          >
            <div
              className="bg-[#020617] border border-[#334155] flex flex-col relative group h-full"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, setModText)}
            >
              <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-[#334155]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[#94A3B8]" /> Modified
                  Text (Version B)
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleMergeBToA}
                    className="text-[10px] text-[#34D399] hover:text-[#10B981] flex items-center gap-1"
                    title="Merge B to A & Save History"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    MERGE B TO A
                  </button>
                  <button
                    onClick={() => handleCopyText(modText)}
                    className="text-[10px] text-[#94A3B8] hover:text-white flex items-center gap-1"
                    title="Copy Text"
                  >
                    <Copy className="w-3 h-3" />
                    COPY
                  </button>
                  <button
                    onClick={() => handleExportHtml(modText)}
                    className="text-[10px] text-[#94A3B8] hover:text-white cursor-pointer flex items-center gap-1"
                    title="Copy as HTML"
                  >
                    <Download className="w-3 h-3" />
                    HTML
                  </button>
                  <label className="text-[10px] text-[#94A3B8] hover:text-white cursor-pointer flex items-center gap-1">
                    <UploadCloud className="w-3 h-3" />
                    UPLOAD
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt,.md,.json,.js,.ts,.html,.css"
                      onChange={(e) => handleFileUpload(e, setModText)}
                    />
                  </label>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 border border-blue-500/30 font-mono">
                    {modStats}
                  </span>
                </div>
              </div>
              <TextAreaWithLineNumbers
                customTheme={customTheme}
                id="textarea-mod-desk"
                value={modText}
                onChange={setModText}
                placeholder="Paste, type, or drag & drop revised text here..."
                showLineNums={showLineNums}
                syntaxTheme={syntaxTheme}
                onScroll={(e) => handleSyncScroll(e, "mod")}
                language={language}
                wordWrap={wordWrap}
              />
            </div>
          </div>
        </section>

        {/* Input Textareas Section (Mobile Fallback) */}
        <section className="flex flex-col lg:hidden gap-6">
          <div
            className="bg-[#020617] border border-[#334155] flex flex-col relative group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, setOrigText)}
          >
            <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-[#334155]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#94A3B8]" /> Original
                Text (Version A)
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleCopyText(origText)}
                  className="text-[10px] text-[#94A3B8] hover:text-white flex items-center gap-1"
                  title="Copy Text"
                >
                  <Copy className="w-3 h-3" />
                  COPY
                </button>
                <button
                  onClick={() => handleExportHtml(origText)}
                  className="text-[10px] text-[#94A3B8] hover:text-white cursor-pointer flex items-center gap-1"
                  title="Copy as HTML"
                >
                  <Download className="w-3 h-3" />
                  HTML
                </button>
                <label className="text-[10px] text-[#94A3B8] hover:text-white cursor-pointer flex items-center gap-1">
                  <UploadCloud className="w-3 h-3" />
                  UPLOAD
                  <input
                    type="file"
                    className="hidden"
                    accept=".txt,.md,.json,.js,.ts,.html,.css"
                    onChange={(e) => handleFileUpload(e, setOrigText)}
                  />
                </label>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 border border-blue-500/30 font-mono">
                  {origStats}
                </span>
              </div>
            </div>
            <TextAreaWithLineNumbers
              customTheme={customTheme}
              id="textarea-orig-mobile"
              value={origText}
              onChange={setOrigText}
              placeholder="Paste, type, or drag & drop original text here..."
              showLineNums={showLineNums}
              syntaxTheme={syntaxTheme}
              onScroll={(e) => handleSyncScroll(e, "orig")}
              language={language}
              wordWrap={wordWrap}
            />
          </div>

          {isThreeWay && (
            <div
              className="bg-[#020617] border border-[#334155] flex flex-col relative group"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, setBaseText)}
            >
              <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-[#334155]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[#94A3B8]" /> Base Text
                  (Version O)
                </h2>
                <div className="flex items-center gap-3">
                  <label className="text-[10px] text-[#94A3B8] hover:text-white cursor-pointer flex items-center gap-1">
                    <UploadCloud className="w-3 h-3" />
                    UPLOAD
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt,.md,.json,.js,.ts,.html,.css"
                      onChange={(e) => handleFileUpload(e, setBaseText)}
                    />
                  </label>
                </div>
              </div>
              <TextAreaWithLineNumbers
                customTheme={customTheme}
                id="textarea-base-mobile"
                value={baseText}
                onChange={setBaseText}
                placeholder="Paste, type, or drag & drop base text here..."
                showLineNums={showLineNums}
                syntaxTheme={syntaxTheme}
                language={language}
                wordWrap={wordWrap}
              />
            </div>
          )}

          <div
            className="bg-[#020617] border border-[#334155] flex flex-col relative group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, setModText)}
          >
            <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-[#334155]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#94A3B8]" /> Modified
                Text (Version B)
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleMergeBToA}
                  className="text-[10px] text-[#34D399] hover:text-[#10B981] flex items-center gap-1"
                  title="Merge B to A & Save History"
                >
                  <ArrowLeft className="w-3 h-3" />
                  MERGE B TO A
                </button>
                <button
                  onClick={() => handleCopyText(modText)}
                  className="text-[10px] text-[#94A3B8] hover:text-white flex items-center gap-1"
                  title="Copy Text"
                >
                  <Copy className="w-3 h-3" />
                  COPY
                </button>
                <button
                  onClick={() => handleExportHtml(modText)}
                  className="text-[10px] text-[#94A3B8] hover:text-white cursor-pointer flex items-center gap-1"
                  title="Copy as HTML"
                >
                  <Download className="w-3 h-3" />
                  HTML
                </button>
                <label className="text-[10px] text-[#94A3B8] hover:text-white cursor-pointer flex items-center gap-1">
                  <UploadCloud className="w-3 h-3" />
                  UPLOAD
                  <input
                    type="file"
                    className="hidden"
                    accept=".txt,.md,.json,.js,.ts,.html,.css"
                    onChange={(e) => handleFileUpload(e, setModText)}
                  />
                </label>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 border border-blue-500/30 font-mono">
                  {modStats}
                </span>
              </div>
            </div>
            <TextAreaWithLineNumbers
              customTheme={customTheme}
              id="textarea-mod-mobile"
              value={modText}
              onChange={setModText}
              placeholder="Paste, type, or drag & drop revised text here..."
              showLineNums={showLineNums}
              syntaxTheme={syntaxTheme}
              onScroll={(e) => handleSyncScroll(e, "mod")}
              language={language}
              wordWrap={wordWrap}
            />
          </div>
        </section>

        {/* Diff Output Container */}
        {diffResult && stats && (
          <div
            id="diff-report-container"
            className={`animate-in fade-in duration-300 bg-[#020617] pb-4 ${isFullscreen ? "fixed inset-0 z-50 overflow-y-auto p-4 space-y-4" : "space-y-6"}`}
          >
            {/* Stats Banner */}
            <section className="bg-[#111827] border border-[#334155] p-4 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-around gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1 font-serif italic">
                    Similarity
                  </span>
                  <span className="text-xl font-mono text-[#34D399]">
                    {stats.similarity}%
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1 font-serif italic">
                    Additions
                  </span>
                  <span className="text-xl font-mono text-[#10B981]">
                    +{stats.addCount}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1 font-serif italic">
                    Deletions
                  </span>
                  <span className="text-xl font-mono text-[#EF4444]">
                    -{stats.delCount}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1 font-serif italic">
                    Unchanged
                  </span>
                  <span className="text-xl font-mono text-[#94A3B8]">
                    {stats.unchangedCount}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono"
                  >
                    COPY_REPORT
                  </button>
                  <button
                    onClick={exportPatchReport}
                    className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    EXPORT_PATCH
                  </button>
                  <button
                    onClick={exportCsvReport}
                    className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    EXPORT_CSV
                  </button>
                  <button
                    onClick={exportMdReport}
                    className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    EXPORT_MD
                  </button>
                  <button
                    onClick={exportRawDiff}
                    className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    EXPORT_JSON
                  </button>
                  <button
                    onClick={exportHtmlReport}
                    className="px-3 py-1.5 border border-[#1D4ED8] bg-[#1E3A8A] text-[#93C5FD] hover:bg-[#1D4ED8] transition-colors text-xs font-mono flex items-center gap-2"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    EXPORT_HTML
                  </button>
                  <button
                    onClick={exportPdfReport}
                    className="px-3 py-1.5 border border-[#065F46] bg-[#064E3B] text-[#34D399] hover:bg-[#065F46] transition-colors text-xs font-mono flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    EXPORT_PDF
                  </button>
                  <button
                    onClick={exportImageReport}
                    className="px-3 py-1.5 border border-[#6D28D9] bg-[#4C1D95] text-[#C4B5FD] hover:bg-[#6D28D9] transition-colors text-xs font-mono flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    EXPORT_PNG
                  </button>
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono flex items-center gap-2"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize className="w-3.5 h-3.5" />
                    )}
                    {isFullscreen ? "EXIT_FULLSCREEN" : "FULLSCREEN"}
                  </button>
                </div>
              </div>

              <div className="w-full flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
                  <span>Change Breakdown</span>
                  <span>{stats.addCount + stats.delCount} Total Changes</span>
                </div>
                <div className="w-full h-1.5 flex rounded-full overflow-hidden bg-[#1E293B]">
                  {stats.addCount + stats.delCount > 0 ? (
                    <>
                      <div
                        style={{
                          width: `${(stats.addCount / (stats.addCount + stats.delCount)) * 100}%`,
                        }}
                        className="bg-[#10B981]"
                        title={`Additions: ${stats.addCount}`}
                      />
                      <div
                        style={{
                          width: `${(stats.delCount / (stats.addCount + stats.delCount)) * 100}%`,
                        }}
                        className="bg-[#EF4444]"
                        title={`Deletions: ${stats.delCount}`}
                      />
                    </>
                  ) : (
                    <div className="w-full bg-[#475569]" title="No changes" />
                  )}
                </div>
              </div>
            </section>

            {/* Render Area */}
            <section
              id="diff-render-area"
              className="bg-[#020617] border border-[#334155] flex flex-col"
            >
              <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-[#334155]">
                <div className="flex items-center gap-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                    Diff Results
                  </h2>

                  {intensityMap.length > 0 && (
                    <div
                      className="hidden sm:flex items-center gap-0.5"
                      title="Change Intensity Map"
                    >
                      {intensityMap.map((bucket, i) => (
                        <div
                          key={i}
                          className={`w-1 h-3 ${bucket.colorClass}`}
                          style={{
                            opacity:
                              bucket.intensity > 0
                                ? Math.max(0.2, bucket.intensity)
                                : 0.1,
                          }}
                          title={`+${bucket.adds} / -${bucket.dels}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {diffResult && (
                    <div className="flex border-[#334155] pr-2 mr-2 border-r gap-1">
                      <button
                        onClick={scrollToPrevDiff}
                        className="p-1 rounded transition-colors hover:bg-[#334155] text-[#94A3B8]"
                        title="Previous Change"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={scrollToNextDiff}
                        className="p-1 rounded transition-colors hover:bg-[#334155] text-[#94A3B8]"
                        title="Next Change"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <span className="text-[10px] bg-[#334155] text-white px-2 py-0.5 border border-[#475569] font-mono">
                    {viewMode === "split" ? "SPLIT_VIEW" : "UNIFIED_VIEW"}
                  </span>
                </div>
              </div>

              <div className="bg-black overflow-x-auto font-mono text-[11px] leading-relaxed p-4">
                {viewMode === "split" ? (
                  <TableVirtuoso
                    data={visibleDiffResult}
                    useWindowScroll
                    className="w-full border-collapse table-fixed min-w-[600px]"
                    components={{
                      Table: ({ style, ...props }) => (
                        <table
                          {...props}
                          style={{
                            ...style,
                            width: "100%",
                            tableLayout: "fixed",
                          }}
                          className="border-collapse min-w-[600px]"
                        />
                      ),
                      TableBody: React.forwardRef((props, ref) => (
                        <tbody {...props} ref={ref} />
                      )),
                      TableRow: ({ item, ...props }) => (
                        <tr
                          {...props}
                          className={`border-b border-[#1E293B]/50 last:border-0 ${item.type === "add" || item.type === "del" ? "diff-row-changed" : ""}`}
                        />
                      ),
                    }}
                    itemContent={(idx, item) => (
                      <React.Fragment>
                        {item.type === "folded" && (
                          <td
                            colSpan={showLineNums ? 4 : 2}
                            className="py-2 text-center text-[#475569] bg-[#0F172A] border-y border-[#334155]"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <div className="h-px bg-[#334155] flex-1"></div>
                              <span className="text-[10px] uppercase font-bold tracking-widest">
                                Unchanged Lines Folded
                              </span>
                              <div className="h-px bg-[#334155] flex-1"></div>
                            </div>
                          </td>
                        )}
                        {item.type === "unchanged" && (
                          <>
                            {showLineNums && (
                              <td className="w-10 text-right text-[#64748B] bg-[#111827] border-r border-[#334155] select-none pr-2 py-0.5">
                                {item.lineNumA}
                              </td>
                            )}
                            <td
                              className={`p-0.5 px-3 align-top ${wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"} text-[#94A3B8]`}
                              dangerouslySetInnerHTML={{
                                __html: highlightCode(
                                  item.lineA,
                                  syntaxTheme,
                                  language,
                                ),
                              }}
                            ></td>
                            {showLineNums && (
                              <td className="w-10 text-right text-[#64748B] bg-[#111827] border-r border-l border-[#334155] select-none pr-2 py-0.5">
                                {item.lineNumB}
                              </td>
                            )}
                            <td
                              className={`p-0.5 px-3 align-top ${wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"} text-[#94A3B8]`}
                              dangerouslySetInnerHTML={{
                                __html: highlightCode(
                                  item.lineB,
                                  syntaxTheme,
                                  language,
                                ),
                              }}
                            ></td>
                          </>
                        )}
                        {item.type === "del" && (
                          <>
                            {showLineNums && (
                              <td className="w-10 text-right text-[#EF4444] bg-[#450a0a]/30 border-r border-[#EF4444]/30 select-none pr-2 py-0.5">
                                {item.lineNumA}
                              </td>
                            )}
                            <td
                              className={`p-0.5 px-3 align-top ${wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"} bg-[#450a0a]/20 text-[#FCA5A5] border-r border-[#334155]/30`}
                            >
                              {item.partsA ? (
                                item.partsA.map((part, i) => (
                                  <span
                                    key={i}
                                    className={
                                      part.type === "del"
                                        ? "bg-[#EF4444]/40 text-white rounded-[2px]"
                                        : ""
                                    }
                                    dangerouslySetInnerHTML={{
                                      __html: highlightCode(
                                        part.text,
                                        syntaxTheme,
                                        language,
                                      ),
                                    }}
                                  />
                                ))
                              ) : (
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: highlightCode(
                                      item.lineA,
                                      syntaxTheme,
                                      language,
                                    ),
                                  }}
                                />
                              )}
                            </td>
                            {showLineNums && (
                              <td className="w-10 bg-[#111827] border-r border-l border-[#334155] select-none"></td>
                            )}
                            <td className="p-0.5 px-3"></td>
                          </>
                        )}
                        {item.type === "add" && (
                          <>
                            {showLineNums && (
                              <td className="w-10 bg-[#111827] border-r border-[#334155] select-none"></td>
                            )}
                            <td className="p-0.5 px-3 border-r border-[#334155]/30"></td>
                            {showLineNums && (
                              <td className="w-10 text-right text-[#10B981] bg-[#064E3B]/30 border-r border-[#10B981]/30 border-l border-[#334155] select-none pr-2 py-0.5">
                                {item.lineNumB}
                              </td>
                            )}
                            <td
                              className={`p-0.5 px-3 align-top ${wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"} bg-[#064E3B]/20 text-[#6EE7B7]`}
                            >
                              {item.partsB ? (
                                item.partsB.map((part, i) => (
                                  <span
                                    key={i}
                                    className={
                                      part.type === "add"
                                        ? "bg-[#10B981]/40 text-white rounded-[2px]"
                                        : ""
                                    }
                                    dangerouslySetInnerHTML={{
                                      __html: highlightCode(
                                        part.text,
                                        syntaxTheme,
                                        language,
                                      ),
                                    }}
                                  />
                                ))
                              ) : (
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: highlightCode(
                                      item.lineB,
                                      syntaxTheme,
                                      language,
                                    ),
                                  }}
                                />
                              )}
                            </td>
                          </>
                        )}
                      </React.Fragment>
                    )}
                  />
                ) : (
                  <Virtuoso
                    data={visibleDiffResult}
                    useWindowScroll
                    className="w-full flex flex-col min-w-[600px] border border-[#1E293B]"
                    itemContent={(idx, item) =>
                      item.type === "folded" ? (
                        <div
                          key={idx}
                          className="flex w-full py-2 text-center text-[#475569] bg-[#0F172A] border-y border-[#334155]"
                        >
                          <div className="flex items-center justify-center gap-2 w-full px-4">
                            <div className="h-px bg-[#334155] flex-1"></div>
                            <span className="text-[10px] uppercase font-bold tracking-widest">
                              Unchanged Lines Folded
                            </span>
                            <div className="h-px bg-[#334155] flex-1"></div>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={idx}
                          className={`flex border-b border-[#1E293B]/50 last:border-0 hover:bg-[#111827] transition-colors ${item.type === "add" || item.type === "del" ? "diff-row-changed" : ""} ${
                            item.type === "del"
                              ? "bg-[#450a0a]/20 text-[#FCA5A5]"
                              : item.type === "add"
                                ? "bg-[#064E3B]/20 text-[#6EE7B7]"
                                : "text-[#94A3B8]"
                          }`}
                        >
                          {showLineNums && (
                            <div className="flex w-16 flex-shrink-0 bg-[#111827] text-[#64748B] border-r border-[#334155] select-none text-[10px]">
                              <div className="w-1/2 text-right pr-1.5 py-0.5 border-r border-[#334155]/50">
                                {item.lineNumA}
                              </div>
                              <div className="w-1/2 text-right pr-1.5 py-0.5">
                                {item.lineNumB}
                              </div>
                            </div>
                          )}
                          <div
                            className={`w-8 flex-shrink-0 text-center font-bold select-none border-r ${
                              item.type === "del"
                                ? "border-[#EF4444]/30 bg-[#450a0a]/30 text-[#EF4444]"
                                : item.type === "add"
                                  ? "border-[#10B981]/30 bg-[#064E3B]/30 text-[#10B981]"
                                  : "border-[#334155] bg-[#111827] text-[#64748B]"
                            } py-0.5`}
                          >
                            {item.type === "del"
                              ? "-"
                              : item.type === "add"
                                ? "+"
                                : " "}
                          </div>
                          <div
                            className={`flex-1 px-3 py-0.5 ${wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"}`}
                          >
                            {item.type === "add" ? (
                              item.partsB ? (
                                item.partsB.map((part, i) => (
                                  <span
                                    key={i}
                                    className={
                                      part.type === "add"
                                        ? "bg-[#10B981]/40 text-white rounded-[2px]"
                                        : ""
                                    }
                                  >
                                    {part.text}
                                  </span>
                                ))
                              ) : (
                                item.lineB
                              )
                            ) : item.type === "del" ? (
                              item.partsA ? (
                                item.partsA.map((part, i) => (
                                  <span
                                    key={i}
                                    className={
                                      part.type === "del"
                                        ? "bg-[#EF4444]/40 text-white rounded-[2px]"
                                        : ""
                                    }
                                  >
                                    {part.text}
                                  </span>
                                ))
                              ) : (
                                item.lineA
                              )
                            ) : (
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: highlightCode(
                                    item.lineA,
                                    syntaxTheme,
                                    language,
                                  ),
                                }}
                              />
                            )}
                          </div>
                        </div>
                      )
                    }
                  />
                )}
              </div>
            </section>
          </div>
        )}

        <footer className="mt-4 pt-4 border-t border-[#334155] flex flex-wrap justify-between items-center text-[10px] text-[#64748B] font-mono gap-4">
          <div className="flex gap-4">
            <span>© {new Date().getFullYear()} TEXTDIFF STUDIO</span>
            <span>•</span>
            <span className="text-[#34D399]">OPEN SOURCE (NON-COMMERCIAL)</span>
            <span>•</span>
            <span className="text-[#94A3B8] flex items-center gap-1">
              <Keyboard className="w-3 h-3" />
              SHORTCUTS:{" "}
              <kbd className="bg-[#1E293B] px-1 rounded text-white ml-1">
                CTRL
              </kbd>
              +<kbd className="bg-[#1E293B] px-1 rounded text-white">ENTER</kbd>{" "}
              = Diff &nbsp; | &nbsp;{" "}
              <kbd className="bg-[#1E293B] px-1 rounded text-white">CTRL</kbd>+
              <kbd className="bg-[#1E293B] px-1 rounded text-white">SHIFT</kbd>+
              <kbd className="bg-[#1E293B] px-1 rounded text-white">S</kbd> =
              Swap
            </span>
          </div>
          <div className="flex gap-4 text-[#94A3B8]">
            <span>LICENSE: NC-OS</span>
          </div>
        </footer>
      </div>

      {/* History Modal */}
      {showGitModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#020617] border border-[#334155] rounded-xl w-full max-w-3xl flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-[#334155] flex justify-between items-center bg-[#0F172A] rounded-t-xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-[#34D399]" />
                Git Conflict Resolver
              </h3>
              <button
                onClick={() => setShowGitModal(false)}
                className="text-[#94A3B8] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
              <p className="text-[#94A3B8] text-sm">
                Paste a file containing standard Git conflict markers (
                <code className="bg-[#1E293B] px-1 py-0.5 rounded text-[#F472B6]">
                  {"<<<<<<<"}
                </code>
                ,{" "}
                <code className="bg-[#1E293B] px-1 py-0.5 rounded text-[#60A5FA]">
                  {"======="}
                </code>
                ,{" "}
                <code className="bg-[#1E293B] px-1 py-0.5 rounded text-[#34D399]">
                  {">>>>>>>"}
                </code>
                ). TextDiff Studio will automatically parse it and load it into
                the 3-Way Merge editor.
              </p>
              <textarea
                value={gitConflictText}
                onChange={(e) => setGitConflictText(e.target.value)}
                placeholder={
                  "<<<<<<< HEAD\nconsole.log('local changes');\n=======\nconsole.log('remote changes');\n>>>>>>> feature-branch"
                }
                className="w-full flex-1 min-h-[300px] bg-[#0A0A0C] border border-[#334155] rounded-md p-4 text-[#E2E8F0] font-mono text-xs focus:outline-none focus:border-[#34D399] resize-none"
              />
              <div className="flex gap-4">
                <button
                  onClick={handleParseGitConflict}
                  disabled={!gitConflictText.trim()}
                  className="w-full py-3 bg-[#34D399] text-[#064E3B] font-bold rounded hover:bg-[#10B981] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  MANUAL PARSE
                </button>
                <button
                  onClick={handleAIResolveConflict}
                  disabled={!SERVER_FEATURES_ENABLED || !gitConflictText.trim() || isResolvingAI}
                  title={SERVER_FEATURES_ENABLED ? undefined : COMING_SOON_TITLE}
                  className={`w-full flex items-center justify-center gap-2 py-3 bg-[#8B5CF6] text-white font-bold rounded transition-colors disabled:cursor-not-allowed shadow-[0_0_15px_rgba(139,92,246,0.4)] ${SERVER_FEATURES_ENABLED ? 'hover:bg-[#7C3AED] disabled:opacity-50' : 'opacity-40 grayscale'}`}
                >
                  {isResolvingAI ? (
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  AI RESOLVE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#020617] border border-[#334155] max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-[#334155] bg-[#1E293B]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-[#34D399]" />
                Diff History
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-[#94A3B8] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs">
              {history.length === 0 ? (
                <div className="text-center text-[#64748B] py-8">
                  No history available yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="border border-[#334155] bg-[#0F172A] p-3 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-center text-[#94A3B8] text-[10px]">
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                        <button
                          onClick={() => {
                            setOrigText(item.origText);
                            setModText(item.modText);
                            setShowHistoryModal(false);
                            runDiff(item.origText, item.modText);
                          }}
                          className="px-2 py-1 bg-[#1E293B] hover:bg-[#334155] text-white transition-colors border border-[#334155]"
                        >
                          RESTORE
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[#E2E8F0] opacity-80">
                        <div className="bg-black p-2 overflow-hidden whitespace-nowrap text-ellipsis border border-[#1E293B]">
                          {item.origText.split("\n")[0] || "(empty)"}
                        </div>
                        <div className="bg-black p-2 overflow-hidden whitespace-nowrap text-ellipsis border border-[#1E293B]">
                          {item.modText.split("\n")[0] || "(empty)"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customize UI Modal */}
      {showCustomizeModal && (
        <div className="fixed right-4 top-4 bottom-4 w-full max-w-[450px] z-50 flex flex-col justify-center pointer-events-none">
          <div className="bg-[#0A0A0C]/95 backdrop-blur-xl border border-[#334155] w-full max-h-[calc(100vh-32px)] overflow-hidden flex flex-col shadow-2xl rounded-xl pointer-events-auto animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center p-5 border-b border-[#334155] bg-[#0F172A]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#6D28D9]" />
                Appearance
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={randomizeCustomization}
                  className="text-xs bg-[#1E293B] hover:bg-[#334155] border border-[#334155] px-2 py-1 rounded text-white font-bold flex items-center gap-1 transition-colors"
                >
                  <Dices className="w-3.5 h-3.5" />
                  RANDOMIZE
                </button>
                <button
                  onClick={() => setShowCustomizeModal(false)}
                  className="text-[#94A3B8] hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-8 text-sm">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-[#334155] pb-2">
                  <h4 className="font-bold text-[#E2E8F0] flex items-center gap-2">
                    <Layout className="w-4 h-4" /> Layout Mode
                  </h4>
                  <button
                    onClick={() => setLockedLayout(!lockedLayout)}
                    className={`p-1 rounded transition-colors ${lockedLayout ? "text-[#34D399] bg-[#064E3B]/30" : "text-[#64748B] hover:text-white"}`}
                    title="Lock Layout during randomize"
                  >
                    {lockedLayout ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Unlock className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    "standard",
                    "fluid",
                    "compact",
                    "zen",
                    "presentation",
                    "terminal",
                  ].map((l) => (
                    <button
                      key={l}
                      onClick={() => setAppLayout(l as any)}
                      className={`p-3 border rounded text-xs font-bold uppercase transition-colors ${appLayout === l ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-[#334155] pb-2">
                  <h4 className="font-bold text-[#E2E8F0] flex items-center gap-2">
                    <Palette className="w-4 h-4" /> Syntax Theme
                  </h4>
                  <button
                    onClick={() => setLockedTheme(!lockedTheme)}
                    className={`p-1 rounded transition-colors ${lockedTheme ? "text-[#34D399] bg-[#064E3B]/30" : "text-[#64748B] hover:text-white"}`}
                    title="Lock Theme during randomize"
                  >
                    {lockedTheme ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Unlock className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    "dark",
                    "light",
                    "high-contrast",
                    "dracula",
                    "hacker",
                    "solarized-light",
                    "oceanic",
                    "custom",
                  ].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSyntaxTheme(t as any)}
                      className={`p-3 border rounded text-xs font-bold uppercase transition-colors ${syntaxTheme === t ? "border-[#F472B6] bg-[#831843]/20 text-[#F472B6]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-[#E2E8F0] border-b border-[#334155] pb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Aesthetics & UI Styling
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">
                        Platform Font
                      </label>
                      <button
                        onClick={() => setLockedFont(!lockedFont)}
                        className={`p-1 rounded transition-colors ${lockedFont ? "text-[#34D399]" : "text-[#64748B] hover:text-white"}`}
                      >
                        {lockedFont ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {["sans", "mono", "serif", "dyslexic"].map((f) => (
                        <button
                          key={f}
                          onClick={() => setUiFont(f as any)}
                          className={`p-2 text-left text-xs border rounded ${uiFont === f ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                        >
                          {f === "sans"
                            ? "Inter (Sans)"
                            : f === "mono"
                              ? "Monospace"
                              : f === "serif"
                                ? "Georgia (Serif)"
                                : "Dyslexic / Comic"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">
                        Border Radius
                      </label>
                      <button
                        onClick={() => setLockedRadius(!lockedRadius)}
                        className={`p-1 rounded transition-colors ${lockedRadius ? "text-[#34D399]" : "text-[#64748B] hover:text-white"}`}
                      >
                        {lockedRadius ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {["default", "none", "lg", "full"].map((r) => (
                        <button
                          key={r}
                          onClick={() => setUiRadius(r as any)}
                          className={`p-2 text-left text-xs border rounded ${uiRadius === r ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                        >
                          {r === "default"
                            ? "Standard (4px)"
                            : r === "none"
                              ? "Sharp (0px)"
                              : r === "lg"
                                ? "Rounded (12px)"
                                : "Pill (Full)"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">
                        Color Tint Overlay
                      </label>
                      <button
                        onClick={() => setLockedTint(!lockedTint)}
                        className={`p-1 rounded transition-colors ${lockedTint ? "text-[#34D399]" : "text-[#64748B] hover:text-white"}`}
                      >
                        {lockedTint ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {[
                        "default",
                        "blue",
                        "purple",
                        "rose",
                        "amber",
                        "monochrome",
                        "invert",
                      ].map((t) => (
                        <button
                          key={t}
                          onClick={() => setUiTint(t as any)}
                          className={`p-2 text-left text-xs border rounded uppercase ${uiTint === t ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">Font Size</label>
                    <div className="flex flex-col gap-2">
                      {['sm', 'base', 'lg'].map(t => (
                        <button key={t} onClick={() => setUiFontSize(t as any)} className={`p-2 text-left text-xs border rounded uppercase ${uiFontSize === t ? 'border-[#34D399] bg-[#064E3B]/20 text-[#34D399]' : 'border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white'}`}>
                          {t === 'sm' ? 'Small' : t === 'lg' ? 'Large' : 'Normal'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">Background Texture</label>
                    <div className="flex flex-col gap-2">
                      {['none', 'dots', 'grid', 'noise'].map(t => (
                        <button key={t} onClick={() => setUiTexture(t as any)} className={`p-2 text-left text-xs border rounded uppercase ${uiTexture === t ? 'border-[#34D399] bg-[#064E3B]/20 text-[#34D399]' : 'border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">UI Sound</label>
                    <div className="flex flex-col gap-2">
                      {['disabled', 'enabled'].map(t => (
                        <button key={t} onClick={() => setUiSound(t as any)} className={`p-2 text-left text-xs border rounded uppercase ${uiSound === t ? 'border-[#34D399] bg-[#064E3B]/20 text-[#34D399]' : 'border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">Glassmorphism</label>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => setUiGlass(false)} className={`p-2 text-left text-xs border rounded uppercase ${!uiGlass ? 'border-[#34D399] bg-[#064E3B]/20 text-[#34D399]' : 'border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white'}`}>Solid Panels</button>
                      <button onClick={() => setUiGlass(true)} className={`p-2 text-left text-xs border rounded uppercase ${uiGlass ? 'border-[#34D399] bg-[#064E3B]/20 text-[#34D399]' : 'border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white'}`}>Frosted Glass</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">Animations</label>
                    <div className="flex flex-col gap-2">
                      {['default', 'reduced'].map(t => (
                        <button key={t} onClick={() => setUiMotion(t as any)} className={`p-2 text-left text-xs border rounded uppercase ${uiMotion === t ? 'border-[#34D399] bg-[#064E3B]/20 text-[#34D399]' : 'border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white'}`}>
                          {t === 'default' ? 'Fluid (Springs)' : 'Reduced Motion'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-[#020617] border border-[#334155] rounded-xl p-4 mt-6">
                  <h4 className="font-bold text-[#E2E8F0] border-b border-[#334155] pb-2">
                    Custom CSS Injector
                  </h4>
                  <textarea
                    value={customCSS}
                    onChange={(e) => setCustomCSS(e.target.value)}
                    placeholder="/* Write arbitrary CSS here... e.g. body { background: red; } */"
                    className="w-full h-32 bg-[#0F172A] border border-[#334155] rounded-md p-3 text-sm text-white font-mono focus:outline-none focus:border-[#34D399]"
                  />
                </div>

              {syntaxTheme === 'custom' && (
                <div className="space-y-4 bg-[#020617] border border-[#334155] rounded-xl p-4 mt-6">
                  <h4 className="font-bold text-[#E2E8F0] border-b border-[#334155] pb-2">
                    Custom Theme Builder
                  </h4>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      // simple random hex color palette generator
                      const randomColor = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                      setCustomTheme({
                        bg: randomColor(),
                        fg: randomColor(),
                        comment: randomColor(),
                        string: randomColor(),
                        keyword: randomColor(),
                        number: randomColor(),
                        function: randomColor(),
                        operator: randomColor()
                      });
                      playSound('click');
                    }} className="px-3 py-1.5 bg-[#1E293B] border border-[#334155] rounded text-white text-xs font-bold hover:bg-[#334155] flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      AUTO-GENERATE PALETTE
                    </button>
                    <button onClick={() => {
                      setCustomTheme({ bg: '#020617', fg: '#E2E8F0', comment: '#64748B', string: '#A7F3D0', keyword: '#F472B6', number: '#C084FC', function: '#60A5FA', operator: '#475569' });
                      playSound('click');
                    }} className="px-3 py-1.5 bg-[#1E293B] border border-[#334155] rounded text-white text-xs font-bold hover:bg-[#334155]">
                      RESET
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
                    {Object.entries(customTheme).map(([key, value]) => (
                      <div key={key} className="flex flex-col gap-1">
                        <span className="uppercase text-[#94A3B8]">{key}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={value}
                            onChange={(e) =>
                              setCustomTheme((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                          />
                          <input
                            type="text"
                            value={value}
                            onChange={(e) =>
                              setCustomTheme((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            className="bg-[#0F172A] border border-[#334155] rounded text-white w-full px-2 py-1 outline-none focus:border-[#6D28D9]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="font-bold text-[#E2E8F0] border-b border-[#334155] pb-2 flex items-center gap-2">
                  <Share className="w-4 h-4" /> Export & Import
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getShareCode()}
                    className="flex-1 bg-[#111827] border border-[#334155] rounded px-3 py-2 text-xs font-mono text-[#94A3B8] focus:outline-none"
                    onClick={(e) => {
                      (e.target as HTMLInputElement).select();
                      navigator.clipboard.writeText(getShareCode());
                    }}
                    title="Click to copy your share code"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getShareCode());
                      alert("Share code copied to clipboard!");
                    }}
                    className="px-4 border border-[#334155] bg-[#1E293B] hover:bg-[#334155] transition-colors rounded text-xs font-bold"
                  >
                    COPY
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareCodeInput}
                    onChange={(e) => setShareCodeInput(e.target.value)}
                    placeholder="Paste a share code here..."
                    className="flex-1 bg-[#111827] border border-[#334155] rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#6D28D9]"
                  />
                  <button
                    onClick={importShareCode}
                    disabled={!shareCodeInput}
                    className="px-4 border border-[#6D28D9] bg-[#4C1D95] text-[#C4B5FD] hover:bg-[#6D28D9] transition-colors rounded text-xs font-bold disabled:opacity-50"
                  >
                    IMPORT
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-[#E2E8F0] border-b border-[#334155] pb-2 flex items-center gap-2">
                  <Save className="w-4 h-4" /> Saved Presets
                </h4>
                {savedPresets.length === 0 ? (
                  <p className="text-[#64748B] text-xs italic">
                    No presets saved yet. Customize your layout and theme, then
                    save it!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {savedPresets.map((p, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center bg-[#111827] border border-[#334155] rounded p-3"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-[#E2E8F0]">
                            {p.name}
                          </span>
                          <span className="text-[10px] uppercase text-[#64748B]">
                            {p.config.appLayout} • {p.config.syntaxTheme} •{" "}
                            {p.config.uiTint} tint
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadPreset(p)}
                            className="px-2 py-1 bg-[#1E293B] hover:bg-[#334155] text-xs rounded transition-colors text-white"
                          >
                            LOAD
                          </button>
                          <button
                            onClick={() => {
                              const newPresets = savedPresets.filter(
                                (_, idx) => idx !== i,
                              );
                              setSavedPresets(newPresets);
                              localStorage.setItem(
                                "tds_presets",
                                JSON.stringify(newPresets),
                              );
                            }}
                            className="p-1 hover:bg-[#EF4444]/20 text-[#EF4444] rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 w-full">
                  <input
                    type="text"
                    value={presetNameInput}
                    onChange={(e) => setPresetNameInput(e.target.value)}
                    placeholder="Enter preset name..."
                    className="flex-1 bg-[#111827] border border-[#334155] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6D28D9]"
                  />
                  <button
                    onClick={savePreset}
                    disabled={!presetNameInput.trim()}
                    className="px-4 py-2 border border-[#334155] bg-[#1E293B] hover:bg-[#334155] transition-colors rounded text-xs font-bold flex items-center justify-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    SAVE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#020617] border border-[#334155] max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-[#334155] bg-[#1E293B]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-[#34D399]" />
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-[#94A3B8] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 font-mono text-xs">
              <ul className="space-y-4 text-[#94A3B8]">
                <li className="flex justify-between items-center border-b border-[#1E293B] pb-2">
                  <span>Run Comparison</span>
                  <span className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                      Ctrl
                    </kbd>{" "}
                    +{" "}
                    <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                      Enter
                    </kbd>
                  </span>
                </li>
                <li className="flex justify-between items-center border-b border-[#1E293B] pb-2">
                  <span>Swap Texts</span>
                  <span className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                      Ctrl
                    </kbd>{" "}
                    +{" "}
                    <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                      Shift
                    </kbd>{" "}
                    +{" "}
                    <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                      S
                    </kbd>
                  </span>
                </li>
                <li className="flex justify-between items-center border-b border-[#1E293B] pb-2">
                  <span>Find in Text</span>
                  <span className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                      Ctrl
                    </kbd>{" "}
                    +{" "}
                    <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                      F
                    </kbd>
                  </span>
                </li>
                <li className="flex justify-between items-center border-b border-[#1E293B] pb-2">
                  <span>Next Search Match</span>
                  <span className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                      Enter
                    </kbd>
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Prev Search Match</span>
                  <span className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                      Shift
                    </kbd>{" "}
                    +{" "}
                    <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                      Enter
                    </kbd>
                  </span>
                </li>
              </ul>

              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="px-4 py-2 border border-[#334155] bg-[#1E293B] text-white hover:bg-[#334155] transition-colors w-full"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

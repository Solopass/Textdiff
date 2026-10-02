import React, { useState, useEffect } from "react";
import {
  Palette,
  Layout,
  Type,
  Sparkles,
  Share,
  Save,
  Trash2,
  Lock,
  Unlock,
  Dices,
  X,
} from "lucide-react";
import { safeSetItem } from "../lib/storage";

export interface CustomThemeColors {
  bg: string;
  fg: string;
  comment: string;
  string: string;
  keyword: string;
  number: string;
  function: string;
  operator: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appLayout: string;
  setAppLayout: (l: any) => void;
  syntaxTheme: string;
  setSyntaxTheme: (t: any) => void;
  uiFont: string;
  setUiFont: (f: any) => void;
  uiRadius: string;
  setUiRadius: (r: any) => void;
  uiTint: string;
  setUiTint: (t: any) => void;
  uiFontSize: "sm" | "base" | "lg";
  setUiFontSize: (s: any) => void;
  uiTexture: "none" | "dots" | "grid" | "noise";
  setUiTexture: (t: any) => void;
  uiMotion: "default" | "reduced";
  setUiMotion: (m: any) => void;
  uiGlass: boolean;
  setUiGlass: (g: boolean) => void;
  uiSound: "enabled" | "disabled";
  setUiSound: (s: any) => void;
  customCSS: string;
  setCustomCSS: (css: string) => void;
  customTheme: CustomThemeColors;
  setCustomTheme: React.Dispatch<React.SetStateAction<CustomThemeColors>>;
  playSound?: (type?: string) => void;
}

export const CustomizeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  appLayout,
  setAppLayout,
  syntaxTheme,
  setSyntaxTheme,
  uiFont,
  setUiFont,
  uiRadius,
  setUiRadius,
  uiTint,
  setUiTint,
  uiFontSize,
  setUiFontSize,
  uiTexture,
  setUiTexture,
  uiMotion,
  setUiMotion,
  uiGlass,
  setUiGlass,
  uiSound,
  setUiSound,
  customCSS,
  setCustomCSS,
  customTheme,
  setCustomTheme,
  playSound,
}) => {
  const [lockedLayout, setLockedLayout] = useState(false);
  const [lockedTheme, setLockedTheme] = useState(false);
  const [lockedFont, setLockedFont] = useState(false);
  const [lockedRadius, setLockedRadius] = useState(false);
  const [lockedTint, setLockedTint] = useState(false);
  const [shareCodeInput, setShareCodeInput] = useState("");
  const [presetNameInput, setPresetNameInput] = useState("");
  const [savedPresets, setSavedPresets] = useState<
    { name: string; config: any }[]
  >([]);

  useEffect(() => {
    try {
      const p = localStorage.getItem("tds_presets");
      if (p) setSavedPresets(JSON.parse(p));
    } catch (e) {}
  }, []);

  if (!isOpen) return null;

  const triggerSound = (type = "click") => {
    if (playSound) playSound(type);
  };

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
    safeSetItem("tds_presets", JSON.stringify(newPresets));
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
    if (preset.config.customCSS !== undefined)
      setCustomCSS(preset.config.customCSS);
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

  return (
    <div
      className="fixed right-4 top-4 bottom-4 w-full max-w-[450px] z-50 flex flex-col justify-center pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Appearance customization"
    >
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
              onClick={onClose}
              aria-label="Close appearance panel"
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
                  className={`p-3 border rounded text-xs font-bold uppercase transition-colors ${syntaxTheme === t ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-[#334155] pb-2">
              <h4 className="font-bold text-[#E2E8F0] flex items-center gap-2">
                <Type className="w-4 h-4" /> Interface Theme
              </h4>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">
                    Font Family
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
                      className={`p-2 text-left text-xs border rounded uppercase ${uiFont === f ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">
                    Corner Radius
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
                      className={`p-2 text-left text-xs border rounded uppercase ${uiRadius === r ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">
                    Accent Tint
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
                <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">
                  Font Size
                </label>
                <div className="flex flex-col gap-2">
                  {["sm", "base", "lg"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setUiFontSize(t as any)}
                      className={`p-2 text-left text-xs border rounded uppercase ${uiFontSize === t ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                    >
                      {t === "sm" ? "Small" : t === "lg" ? "Large" : "Normal"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">
                  Background Texture
                </label>
                <div className="flex flex-col gap-2">
                  {["none", "dots", "grid", "noise"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setUiTexture(t as any)}
                      className={`p-2 text-left text-xs border rounded uppercase ${uiTexture === t ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">
                  UI Sound
                </label>
                <div className="flex flex-col gap-2">
                  {["disabled", "enabled"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setUiSound(t as any)}
                      className={`p-2 text-left text-xs border rounded uppercase ${uiSound === t ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">
                  Glassmorphism
                </label>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setUiGlass(false)}
                    className={`p-2 text-left text-xs border rounded uppercase ${!uiGlass ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                  >
                    Solid Panels
                  </button>
                  <button
                    onClick={() => setUiGlass(true)}
                    className={`p-2 text-left text-xs border rounded uppercase ${uiGlass ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                  >
                    Frosted Glass
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-[#94A3B8] uppercase tracking-widest font-bold">
                  Animations
                </label>
                <div className="flex flex-col gap-2">
                  {["default", "reduced"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setUiMotion(t as any)}
                      className={`p-2 text-left text-xs border rounded uppercase ${uiMotion === t ? "border-[#34D399] bg-[#064E3B]/20 text-[#34D399]" : "border-[#334155] bg-[#111827] text-[#94A3B8] hover:border-[#94A3B8] hover:text-white"}`}
                    >
                      {t === "default" ? "Fluid (Springs)" : "Reduced Motion"}
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

          {syntaxTheme === "custom" && (
            <div className="space-y-4 bg-[#020617] border border-[#334155] rounded-xl p-4 mt-6">
              <h4 className="font-bold text-[#E2E8F0] border-b border-[#334155] pb-2">
                Custom Theme Builder
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const randomColor = () =>
                      "#" +
                      Math.floor(Math.random() * 16777215)
                        .toString(16)
                        .padStart(6, "0");
                    setCustomTheme({
                      bg: randomColor(),
                      fg: randomColor(),
                      comment: randomColor(),
                      string: randomColor(),
                      keyword: randomColor(),
                      number: randomColor(),
                      function: randomColor(),
                      operator: randomColor(),
                    });
                    triggerSound("click");
                  }}
                  className="px-3 py-1.5 bg-[#1E293B] border border-[#334155] rounded text-white text-xs font-bold hover:bg-[#334155] flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AUTO-GENERATE PALETTE
                </button>
                <button
                  onClick={() => {
                    setCustomTheme({
                      bg: "#020617",
                      fg: "#E2E8F0",
                      comment: "#64748B",
                      string: "#A7F3D0",
                      keyword: "#F472B6",
                      number: "#C084FC",
                      function: "#60A5FA",
                      operator: "#475569",
                    });
                    triggerSound("click");
                  }}
                  className="px-3 py-1.5 bg-[#1E293B] border border-[#334155] rounded text-white text-xs font-bold hover:bg-[#334155]"
                >
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
                No presets saved yet. Customize your layout and theme, then save
                it!
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {savedPresets.map((p, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-[#111827] border border-[#334155] rounded p-3"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-[#E2E8F0]">{p.name}</span>
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
                          safeSetItem("tds_presets", JSON.stringify(newPresets));
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
  );
};

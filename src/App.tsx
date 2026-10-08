import React, { useState, useMemo, useRef, useEffect, useCallback, Suspense, lazy } from "react";
import { SplitDiffView } from "./components/SplitDiffView";
import { UnifiedDiffView } from "./components/UnifiedDiffView";

// Both of these are optional panels that most sessions never open, and
// MultiplayerMode drags in the whole socket.io client. Loading them lazily
// keeps that weight out of first paint.
const GitHubIntegration = lazy(() =>
  import('./components/GitHubIntegration').then((m) => ({ default: m.GitHubIntegration })),
);
const MultiplayerMode = lazy(() =>
  import('./components/MultiplayerMode').then((m) => ({ default: m.MultiplayerMode })),
);
const FolderDiff = lazy(() =>
  import('./components/FolderDiff').then((m) => ({ default: m.FolderDiff })),
);
// Share/Pro dialogs and the crypto behind them only matter once someone
// shares, opens a share, or activates Pro (~7KB gzipped kept off first paint).
const ShareModal = lazy(() =>
  import('./components/ShareModal').then((m) => ({ default: m.ShareModal })),
);
const UnlockShareModal = lazy(() =>
  import('./components/UnlockShareModal').then((m) => ({ default: m.UnlockShareModal })),
);
const ProActivationModal = lazy(() =>
  import('./components/ProActivationModal').then((m) => ({ default: m.ProActivationModal })),
);
const loadCrypto = () => import('./lib/crypto/symmetric');
// The public feed: composer, drawer, and their Firestore calls are all lazy.
const FeedComposerModal = lazy(() =>
  import('./components/FeedComposerModal').then((m) => ({ default: m.FeedComposerModal })),
);
const FeedDrawer = lazy(() =>
  import('./components/FeedDrawer').then((m) => ({ default: m.FeedDrawer })),
);

/** Shared placeholder while a lazily-loaded panel is being fetched. */
const PanelFallback = ({ label }: { label: string }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex items-center justify-center gap-3 h-full min-h-[120px] border border-[#334155] bg-[#0F172A] text-[#94A3B8] text-sm"
  >
    <span className="w-4 h-4 border-2 border-[#334155] border-t-[#34D399] rounded-full animate-spin" />
    Loading {label}...
  </div>
);
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
import { GitConflictModal, type GitConflictParseResult } from "./components/GitConflictModal";
import { HistoryModal } from "./components/HistoryModal";
import type { ShareOptions } from "./components/ShareModal";
import type { EncryptedEnvelope } from "./lib/crypto/symmetric";
import type { LicensePayload } from "./lib/crypto/license";
import type { FeedItem } from "./lib/feed";
import { StatsBanner } from "./components/StatsBanner";
import { StudioToolbar } from "./components/StudioToolbar";
import { CustomizeModal } from "./components/CustomizeModal";
import { CommandPalette, type Command } from "./components/CommandPalette";
// jspdf, html2canvas and the Firebase SDK are all large and only needed for
// specific user actions, so they are imported dynamically at their call sites
// instead of being pulled into the initial bundle.
import { getDb } from "./firebase";
// Shared with the diff worker so statistics are computed identically on both
// sides. Imported from lib/diffStats, NOT from ./diffWorker — the latter drags
// the LCS engine and node-diff3 into the main bundle. See lib/diffStats.ts.
import { computeDiffStats } from "./lib/diffStats";
import LZString from "lz-string";

import type { DiffRow, WordPart, HistoryItem } from "./lib/types";
import {
  generatePatchReport,
  generateCsvReport,
  generateMdReport,
  downloadFile,
  exportJsonReport,
  exportHtmlReport as exportHtml,
} from "./lib/diffExport";
import { escapeHtml, sanitizeCustomCss } from "./lib/sanitize";
import { safeSetItem } from "./lib/storage";
import {
  SERVER_FEATURES_ENABLED,
  COMING_SOON_TITLE,
  SHARE_TTL_MS,
} from "./lib/constants";
import {
  highlightCode,
  renderSearchHighlights,
  exportHighlightedHtml,
  detectLanguageFromFilename,
} from "./lib/highlight";
import { TextAreaWithLineNumbers } from "./components/EditorPane";
import { ShortcutsModal } from "./components/ShortcutsModal";

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
  const [foldContext, setFoldContext] = useState<number>(3);
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
  const [editingCell, setEditingCell] = useState<{
    side: "orig" | "mod";
    lineNum: number;
    text: string;
  } | null>(null);
  const [showDiffSearch, setShowDiffSearch] = useState(false);
  const [diffSearchQuery, setDiffSearchQuery] = useState("");
  const [uiFont, setUiFont] = useState<"sans" | "mono" | "serif" | "dyslexic">(
    "sans",
  );
  const [uiRadius, setUiRadius] = useState<"default" | "none" | "lg" | "full">(
    "default",
  );
  const [uiTint, setUiTint] = useState<
    "default" | "blue" | "purple" | "rose" | "amber" | "monochrome" | "invert"
  >("default");
  const [uiFontSize, setUiFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [uiTexture, setUiTexture] = useState<'none' | 'dots' | 'grid' | 'noise'>('none');
  const [uiMotion, setUiMotion] = useState<'default' | 'reduced'>('default');
  const [uiGlass, setUiGlass] = useState(false);
  const [customCSS, setCustomCSS] = useState('');
  const [uiSound, setUiSound] = useState<'enabled' | 'disabled'>('disabled');
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
  const [loadedAnnotation, setLoadedAnnotation] = useState("");

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

  const [language, setLanguage] = useState("javascript");
  const [splitRatio, setSplitRatio] = useState(50);
  const isDraggingSplitter = useRef(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showFolderDiff, setShowFolderDiff] = useState(false);

  // Side-by-side needs ~600px to be legible; below that it becomes a
  // horizontally-scrolling strip. Track the viewport so the diff can fall back
  // to unified without discarding the user's stored preference.
  // matchMedia is absent in jsdom and in older embedded webviews, so every
  // access is guarded rather than assumed.
  const NARROW_QUERY = "(max-width: 640px)";
  const [isNarrow, setIsNarrow] = useState(
    () => window.matchMedia?.(NARROW_QUERY).matches ?? false,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW_QUERY);
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    // addListener is the deprecated spelling, still the only one in Safari <14.
    if (mq.addEventListener) {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);
  // What is actually rendered. `viewMode` remains the persisted preference.
  const effectiveViewMode = isNarrow ? "unified" : viewMode;
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [isDiffing, setIsDiffing] = useState(false);
  // Which export is currently running, so the button can show progress while
  // its (lazily fetched) library downloads.
  const [isExporting, setIsExporting] = useState<"png" | "pdf" | null>(null);
  // Names of files loaded by drop/upload, shown in the pane headers so it's
  // clear what's being compared.
  const [fileNameA, setFileNameA] = useState("");
  const [fileNameB, setFileNameB] = useState("");
  // Which pane is currently under a drag, for the drop highlight.
  const [dragTarget, setDragTarget] = useState<"a" | "b" | "base" | null>(null);
  const workerRef = useRef<Worker | null>(null);
  // Monotonic id for diff requests. The worker processes messages serially but
  // a slow run can still resolve after a newer one was posted, so results
  // carrying a stale id are discarded rather than rendered over fresh output.
  const diffRequestId = useRef(0);
  const [diffError, setDiffError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./diffWorker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (e) => {
      if (e.data?.requestId !== diffRequestId.current) return; // stale result
      if (e.data?.error) {
        setDiffError(e.data.error);
        setDiffResult(null);
      } else {
        setDiffError(null);
        setDiffResult(e.data.rawDiff);
      }
      setIsDiffing(false);
    };

    // Without this an exception inside the worker leaves isDiffing stuck true
    // and the UI spinning forever with no way to recover.
    worker.onerror = (event) => {
      console.error("Diff worker failed", event);
      setDiffError(
        "The diff engine crashed on this input. Try smaller files or disable 3-way mode.",
      );
      setIsDiffing(false);
    };

    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [diffResult, setDiffResult] = useState<DiffRow[] | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const isSyncingRef = useRef(false);
  const editorOrigRef = useRef<any>(null);
  const editorModRef = useRef<any>(null);

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

  const handleParseGitConflictResult = (result: GitConflictParseResult) => {
    setOrigText(result.orig);
    setModText(result.mod);
    if (result.isThreeWay && result.base) {
      setBaseText(result.base);
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
      setDiffError(null);
      // Otherwise the pane headers keep showing filenames for content that
      // is no longer loaded.
      setFileNameA("");
      setFileNameB("");
    }
  };

  const handleSyncScroll = (
    e: any,
    source: "orig" | "mod",
  ) => {
    if (isSyncingRef.current) return;

    // First try syncing Monaco editor instances directly
    const targetEditor = source === "orig" ? editorModRef.current : editorOrigRef.current;
    if (targetEditor && typeof targetEditor.setScrollTop === "function") {
      isSyncingRef.current = true;
      targetEditor.setScrollTop(e.currentTarget.scrollTop);
      targetEditor.setScrollLeft(e.currentTarget.scrollLeft);

      window.requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
      return;
    }

    // Fallback for DOM textarea (e.g. test environment)
    const currentId = e.currentTarget?.id || "";
    const isMobile = currentId.includes("-mobile");
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
      safeSetItem("tds_history", JSON.stringify(newHistory));
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
    setFileNameA(fileNameB);
    setFileNameB("");
  };

  const swapTexts = () => {
    playSound('click');
    setOrigText(modText);
    setModText(origText);
    // Keep the filename labels attached to their content.
    setFileNameA(fileNameB);
    setFileNameB(fileNameA);
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

  // Pro licence: re-verified from storage on every load (see lib/crypto/license).
  const [proLicense, setProLicense] = useState<LicensePayload | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showArchiveExportModal, setShowArchiveExportModal] = useState(false);
  const archiveInputRef = useRef<HTMLInputElement>(null);

  // Public diff feed. `?post=<id>` permalinks open the drawer on that post.
  const [showFeed, setShowFeed] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [localPosts, setLocalPosts] = useState<FeedItem[]>([]);
  const [focusPostId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("post"),
  );
  useEffect(() => {
    if (focusPostId) setShowFeed(true);
  }, [focusPostId]);

  useEffect(() => {
    let cancelled = false;
    import("./lib/crypto/license")
      .then((m) => m.loadStoredLicense())
      .then((p) => {
        if (!cancelled) setProLicense(p);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shareLoadStarted = useRef(false);

  /** An encrypted share or archive waiting for its password / private key. */
  const [pendingUnlock, setPendingUnlock] = useState<{
    type: "passphrase" | "asymmetric" | "archive";
    envelope?: EncryptedEnvelope;
    asymEnvelope?: any;
    archiveContent?: string;
    docId?: string;
    burn?: boolean;
  } | null>(null);

  const applySharedData = (data: any) => {
    if (data.origText !== undefined) setOrigText(data.origText);
    if (data.modText !== undefined) setModText(data.modText);
    if (data.baseText !== undefined) setBaseText(data.baseText);
    if (data.isThreeWay !== undefined) setIsThreeWay(data.isThreeWay);
    if (data.language) setLanguage(data.language);
    if (data.note) setLoadedAnnotation(data.note);
  };

  /**
   * Burn-after-reading shares are deleted once their contents are safely in
   * this tab — after decryption succeeds, so a mistyped password doesn't
   * destroy the share. A failed delete is not fatal; the document still
   * expires normally.
   */
  const burnShare = async (docId: string) => {
    try {
      const [{ deleteDoc, doc }, db] = await Promise.all([
        import("firebase/firestore"),
        getDb(),
      ]);
      await deleteDoc(doc(db, "diffs", docId));
      setLoadedAnnotation((prev) =>
        `${prev ? prev + "\n\n" : ""}🔥 This share has now self-destructed. Reloading the link will not bring it back.`,
      );
    } catch (e) {
      console.error("Failed to burn share", e);
    }
  };

  const unlockShare = async (secret: string) => {
    if (!pendingUnlock) return;
    if (pendingUnlock.type === "archive") {
      const { readArchive } = await import("./lib/crypto/archive");
      const data = await readArchive(pendingUnlock.archiveContent!, secret);
      setOrigText(data.origText);
      setModText(data.modText);
      if (data.origFileName) setFileNameA(data.origFileName);
      if (data.modFileName) setFileNameB(data.modFileName);
      if (data.language) setLanguage(data.language);
      setPendingUnlock(null);
      playSound("success");
      return;
    }
    if (pendingUnlock.type === "asymmetric") {
      const { decryptWithPrivateKey } = await import("./lib/crypto/asymmetric");
      const plaintext = await decryptWithPrivateKey(pendingUnlock.asymEnvelope, secret);
      applySharedData(JSON.parse(plaintext));
      const { docId, burn } = pendingUnlock;
      setPendingUnlock(null);
      if (burn && docId) await burnShare(docId);
      playSound("success");
      return;
    }
    const { decryptEnvelope } = await loadCrypto();
    const plaintext = await decryptEnvelope(pendingUnlock.envelope!, { passphrase: secret });
    applySharedData(JSON.parse(plaintext));
    const { docId, burn } = pendingUnlock;
    setPendingUnlock(null);
    if (burn && docId) await burnShare(docId);
    playSound("success");
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    if (id || window.location.hash || urlParams.get("post")) {
      setCurrentView("app");
    }

    const loadFromId = async (id: string) => {
      try {
        // Firestore is pulled in on demand; see getDb() in ./firebase.
        const [{ getDoc, doc }, db] = await Promise.all([
          import("firebase/firestore"),
          getDb(),
        ]);
        const docSnap = await getDoc(doc(db, "diffs", id));
        if (!docSnap.exists()) {
          setDiffError(
            "That share link doesn't exist. It may have expired or the address may be incomplete.",
          );
          return;
        }

        const raw = docSnap.data();

        // Refuse expired links even if the document is still present.
        // Deletion happens out of band (a scheduled job — see SECURITY.md), so
        // a document can outlive its expiry; the client must not rely on
        // cleanup having run. Links created before expiry existed have no
        // `expiresAt` and are treated as non-expiring.
        if (typeof raw.expiresAt === "number" && Date.now() > raw.expiresAt) {
          setDiffError(
            "This share link has expired. Ask whoever sent it to create a new one.",
          );
          return;
        }

        const burn = raw.burnAfterReading === true;

        if (typeof raw.data === "string" && raw.data.startsWith("tdsasy1:")) {
          const asymEnvelope = JSON.parse(raw.data.slice("tdsasy1:".length));
          const savedPrivKey = localStorage.getItem("tds_priv_key");
          if (savedPrivKey) {
            try {
              const { decryptWithPrivateKey } = await import("./lib/crypto/asymmetric");
              const plaintext = await decryptWithPrivateKey(asymEnvelope, savedPrivKey);
              applySharedData(JSON.parse(plaintext));
              if (burn) await burnShare(id);
              return;
            } catch {
              // Saved key didn't match, prompt below
            }
          }
          setPendingUnlock({
            type: "asymmetric",
            asymEnvelope,
            docId: id,
            burn,
          });
          return;
        }

        const shareCrypto = await loadCrypto();
        if (typeof raw.data === "string" && shareCrypto.isEncryptedPayload(raw.data)) {
          const envelope = shareCrypto.parseEnvelope(raw.data);
          if (envelope.mode === "passphrase") {
            setPendingUnlock({ type: "passphrase", envelope, docId: id, burn });
            return;
          }
          try {
            const plaintext = await shareCrypto.decryptEnvelope(envelope, {
              linkKey: shareCrypto.linkKeyFromHash(window.location.hash),
            });
            applySharedData(JSON.parse(plaintext));
          } catch (e) {
            setDiffError(
              `${e instanceof Error ? e.message : "Could not decrypt this share."} ` +
                "Make sure you copied the whole link, including everything after the #.",
            );
            return;
          }
        } else {
          applySharedData(JSON.parse(raw.data));
        }
        if (burn) await burnShare(id);
      } catch (e) {
        console.error("Failed to load from Firestore", e);
        setDiffError("Could not load that share link. Please try again.");
      }
    };

    if (id) {
      // StrictMode runs this effect twice in development. A second fetch of a
      // burn-after-reading share would race the first one's delete.
      if (!shareLoadStarted.current) {
        shareLoadStarted.current = true;
        loadFromId(id);
      }
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
          if (config.foldContext !== undefined)
            setFoldContext(config.foldContext);
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

  // The "Custom CSS Injector" wrote to state but was never applied to the
  // document, so the whole feature silently did nothing. Manage a single
  // dedicated <style> element and keep its contents in sync.
  useEffect(() => {
    const STYLE_ID = "tds-custom-css";
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

    if (!customCSS.trim()) {
      el?.remove();
      return;
    }

    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      // Appended last so user rules win over the app's own stylesheet
      // without needing !important everywhere.
      document.head.appendChild(el);
    }
    // textContent, never innerHTML — the latter would parse the string as
    // markup before it ever reached the CSS parser.
    el.textContent = sanitizeCustomCss(customCSS);

    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [customCSS]);

  useEffect(() => {
    if (!isLoaded) return;

    // Debounced: this effect fires on every keystroke in either editor, and
    // localStorage writes are synchronous + block the main thread.
    const timer = setTimeout(() => {
      // Every key here must match the ones read back in the loader effect
      // above. They previously drifted apart, so uiFontSize/uiTexture/
      // uiMotion/customCSS/uiSound/uiGlass were read but never written and
      // silently reset on each reload.
      safeSetItem("tds_origText", origText);
      safeSetItem("tds_modText", modText);
      safeSetItem(
        "tds_config",
        JSON.stringify({
          viewMode,
          ignoreWs,
          ignoreCase,
          trimBlankLines,
          showLineNums,
          foldUnchanged,
          foldContext,
          wordWrap,
          syntaxTheme,
          language,
          appLayout,
          uiFont,
          uiRadius,
          uiTint,
          uiFontSize,
          uiTexture,
          uiMotion,
          customCSS,
          uiSound,
          uiGlass,
        }),
      );
    }, 400);

    return () => clearTimeout(timer);
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
    foldContext,
    wordWrap,
    syntaxTheme,
    language,
    appLayout,
    uiFont,
    uiRadius,
    uiTint,
    uiFontSize,
    uiTexture,
    uiMotion,
    customCSS,
    uiSound,
    uiGlass,
  ]);

  // Escape closes the topmost overlay. None of the modals handled this, so a
  // keyboard user who opened one had no way out without finding the X.
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The palette handles its own Escape and stops propagation, so if it is
      // open we must not also close whatever is behind it.
      if (showPalette) return;
      // These dialogs close themselves via useFocusTrap; don't also close
      // whatever sits behind them.
      if (showShareModal || showProModal || pendingUnlock || showFeed || showComposer) return;
      if (showDiffSearch) {
        setShowDiffSearch(false);
        setDiffSearchQuery("");
        return;
      }
      if (isFullscreen) return setIsFullscreen(false);
      if (showHelpModal) return setShowHelpModal(false);
      if (showHistoryModal) return setShowHistoryModal(false);
      if (showCloudSyncModal) return setShowCloudSyncModal(false);
      if (showCustomizeModal) return setShowCustomizeModal(false);
      if (showFolderDiff) return setShowFolderDiff(false);
      if (showGitModal) return setShowGitModal(false);
      if (showGithubPanel) return setShowGithubPanel(false);
      if (showMultiplayer) return setShowMultiplayer(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [
    showPalette,
    showShareModal,
    showProModal,
    pendingUnlock,
    showFeed,
    showComposer,
    showDiffSearch,
    isFullscreen,
    showHelpModal,
    showHistoryModal,
    showCloudSyncModal,
    showGitModal,
    showCustomizeModal,
    showFolderDiff,
    showGithubPanel,
    showMultiplayer,
  ]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K toggles the command palette. Checked first so it works
      // even while focus is inside an editor.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowPalette((v) => !v);
        return;
      }
      // Ctrl+F / Cmd+F opens in-diff search if diff is rendered
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && diffResult) {
        e.preventDefault();
        setShowDiffSearch(true);
        return;
      }
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
  }, [origText, modText, ignoreWs, ignoreCase, trimBlankLines, swapTexts, diffResult]);

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

  /**
   * Reads a dropped or selected file as text.
   *
   * The previous version passed any file straight to readAsText, so dropping
   * a PNG or a 500MB archive silently filled an editor with mojibake or hung
   * the tab. This rejects oversized files up front and sniffs for NUL bytes,
   * which no text encoding uses but virtually every binary format contains.
   */
  const MAX_FILE_BYTES = 15 * 1024 * 1024;

  const readTextFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (file.size > MAX_FILE_BYTES) {
        reject(
          new Error(
            `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB, over the 15MB limit.`,
          ),
        );
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) ?? "";
        if (text.slice(0, 8000).includes("\u0000")) {
          reject(new Error(`"${file.name}" looks like a binary file, not text.`));
          return;
        }
        resolve(text);
      };
      reader.readAsText(file);
    });

  const loadFileInto = async (
    file: File,
    setTarget: (val: string) => void,
    setName: (val: string) => void,
  ) => {
    try {
      if (file.name.toLowerCase().endsWith(".tds.enc")) {
        const text = await readTextFile(file);
        setPendingUnlock({
          type: "archive",
          archiveContent: text,
        });
        return;
      }
      const text = await readTextFile(file);
      setTarget(text);
      setName(file.name);
      const detected = detectLanguageFromFilename(file.name);
      if (detected) {
        setLanguage(detected);
      }
      playSound("success");
    } catch (err: any) {
      setDiffError(err?.message || "Could not read that file.");
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setTarget: (val: string) => void,
    setName: (val: string) => void = () => {},
  ) => {
    const file = e.target.files?.[0];
    if (file) loadFileInto(file, setTarget, setName);
    // Reset so selecting the same file twice in a row still fires onChange.
    e.target.value = "";
  };

  const handleDrop = (
    e: React.DragEvent,
    setTarget: (val: string) => void,
    setName: (val: string) => void = () => {},
  ) => {
    e.preventDefault();
    setDragTarget(null);
    const files: File[] = Array.from(e.dataTransfer.files ?? []);
    if (!files.length) return;

    // Dropping two files at once onto either pane is treated as "compare
    // these", filling both sides in the order they were dropped. This is the
    // fastest path to a diff and previously wasn't possible at all.
    if (files.length >= 2) {
      loadFileInto(files[0], setOrigText, setFileNameA);
      loadFileInto(files[1], setModText, setFileNameB);
      const detected =
        detectLanguageFromFilename(files[0].name) ||
        detectLanguageFromFilename(files[1].name);
      if (detected) setLanguage(detected);
      return;
    }
    loadFileInto(files[0], setTarget, setName);
  };

  const [isSharing, setIsSharing] = useState(false);
  const openShare = () => setShowShareModal(true);

  const handleExportArchive = () => {
    if (!proLicense) {
      setShowProModal(true);
      return;
    }
    setShowArchiveExportModal(true);
  };

  /**
   * Creates a share and resolves to its URL. Throws user-facing messages; the
   * ShareModal displays them.
   *
   * Encrypted shares store only ciphertext in Firestore. For link-key shares
   * the key goes in the URL fragment, which browsers never transmit.
   */
  const createShare = async (opts: ShareOptions): Promise<string> => {
    setIsSharing(true);
    try {
      const data = {
        origText,
        modText,
        baseText,
        language,
        isThreeWay,
        note: opts.note,
      };
      const plaintext = JSON.stringify(data);

      let payload = plaintext;
      let linkKey: string | undefined;
      const { encryptWithLinkKey, encryptWithPassphrase, serializeEnvelope } = await loadCrypto();
      if (opts.protection === "link-key") {
        const sealed = await encryptWithLinkKey(plaintext);
        payload = serializeEnvelope(sealed.envelope);
        linkKey = sealed.linkKey;
      } else if (opts.protection === "passphrase") {
        payload = serializeEnvelope(await encryptWithPassphrase(plaintext, opts.passphrase));
      } else if (opts.protection === "recipient") {
        if (!opts.recipientPublicKey) throw new Error("A recipient public key is required.");
        const { encryptForRecipient } = await import("./lib/crypto/asymmetric");
        const sealed = await encryptForRecipient(plaintext, opts.recipientPublicKey);
        payload = "tdsasy1:" + JSON.stringify(sealed);
      }

      // Mirrors the ceiling in firestore.rules. Checking here turns an opaque
      // PERMISSION_DENIED into an actionable message. Measured after
      // encryption, which inflates the payload by about a third (base64).
      const MAX_SHARE_BYTES = 900_000;
      if (new Blob([payload]).size >= MAX_SHARE_BYTES) {
        throw new Error(
          "This comparison is too large to share as a permanent link (limit ~900KB" +
            (opts.protection === "none" ? "" : " after encryption") +
            "). Try sharing a smaller excerpt, or export the diff as a file instead.",
        );
      }

      try {
        // Firestore is pulled in on demand; see getDb() in ./firebase.
        const [{ addDoc, collection }, db] = await Promise.all([
          import("firebase/firestore"),
          getDb(),
        ]);
        const now = Date.now();
        const docRef = await addDoc(collection(db, "diffs"), {
          data: payload,
          timestamp: now,
          // Shared links expire. Without this, every diff anyone has ever shared
          // stays publicly readable forever with no way to revoke it. The field
          // is enforced by firestore.rules on create, checked on read below, and
          // is what a scheduled cleanup job queries on. See SECURITY.md.
          expiresAt: now + SHARE_TTL_MS,
          ...(opts.burnAfterReading ? { burnAfterReading: true } : {}),
        });
        const url = new URL(window.location.href);
        url.searchParams.set("id", docRef.id);
        url.hash = linkKey ? `key=${linkKey}` : "";
        return url.toString();
      } catch (err) {
        console.error("Failed to create share link:", err);
        // The URL-fragment fallback carries plaintext, so it is only offered
        // for open shares — never silently downgrade an encrypted one.
        if (opts.protection !== "none") {
          throw new Error("Could not reach the share server. Check your connection and try again.");
        }
        const compressed = LZString.compressToEncodedURIComponent(
          JSON.stringify({ origText, modText, baseText, language, isThreeWay }),
        );
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = compressed;
        return url.toString();
      }
    } finally {
      setIsSharing(false);
    }
  };

  const postToFeed = async (input: {
    caption: string;
    handle: string;
    includeHunk: boolean;
    attachFull: boolean;
    hunk: string | null;
  }) => {
    const [feed, api] = await Promise.all([import("./lib/feed"), import("./lib/feedApi")]);
    let fullShareId: string | undefined;
    if (input.attachFull) {
      const url = new URL(
        await createShare({ note: input.caption, protection: "none", passphrase: "", burnAfterReading: false }),
      );
      // The offline fallback produces a fragment link with no id; post without it.
      fullShareId = url.searchParams.get("id") ?? undefined;
    }
    const s = stats ?? { addCount: 0, delCount: 0, similarity: 100 };
    const fileName = (fileNameB || fileNameA).slice(0, feed.FEED_FILENAME_MAX) || undefined;
    let item: FeedItem;
    try {
      item = await api.createPost({
        author: input.handle,
        caption: input.caption,
        tags: feed.extractTags(input.caption),
        stats: { additions: s.addCount, deletions: s.delCount, similarity: s.similarity, language },
        hunk: input.includeHunk && input.hunk ? input.hunk : undefined,
        fileName,
        fullShareId,
      });
    } catch (err) {
      console.error("Failed to post to feed", err);
      throw new Error("Couldn't post to the feed. Check your connection and try again.");
    }
    feed.markPosted();
    safeSetItem(feed.FEED_HANDLE_KEY, input.handle);
    setLocalPosts((prev) => [item, ...prev]);
    setShowComposer(false);
    setShowFeed(true);
  };

  const openFeedItem = async (item: FeedItem) => {
    if (item.fullShareId) {
      // Full comparisons are ordinary share links; let the normal load path
      // (expiry checks and all) handle them.
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set("id", item.fullShareId);
      window.location.assign(url.toString());
      return;
    }
    if (!item.hunk) return;
    const { splitHunk } = await import("./lib/feed");
    const { orig, mod } = splitHunk(item.hunk);
    setOrigText(orig);
    setModText(mod);
    setIsThreeWay(false);
    if (item.stats.language) setLanguage(item.stats.language);
    setLoadedAnnotation(`${item.author}: ${item.caption}`);
    setShowFeed(false);
    runDiff(orig, mod);
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
      safeSetItem("tds_history", JSON.stringify(newHistory));
      return newHistory;
    });
    if (!orig && !mod) {
      alert("Please enter text in at least one box to run comparison.");
      return;
    }

    if (workerRef.current) {
      setIsDiffing(true);
      setDiffError(null);
      // Handlers live on the worker itself (see the setup effect) so they are
      // registered exactly once; here we only bump the id that gates them.
      const requestId = ++diffRequestId.current;
      workerRef.current.postMessage({
        requestId,
        orig,
        mod,
        base: baseText,
        isThreeWay,
        ws,
        caseInsensitive,
        trimBlanks,
      });
    }
  };

  const exportHtmlReport = () => {
    if (!diffResult) return;
    exportHtml(document.getElementById("diff-report-container"));
  };

  const exportImageReport = async () => {
    const container = document.getElementById("diff-render-area");
    if (!container) return;

    try {
      setIsExporting("png");
      // html2canvas is ~200KB and most sessions never export, so it is
      // fetched on first use rather than shipped in the initial bundle.
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(container, { backgroundColor: "#020617" });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "diff.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error("Failed to generate PNG", error);
      alert("Failed to generate the PNG export.");
    } finally {
      setIsExporting(null);
    }
  };

  const exportPdfReport = async () => {
    if (!diffResult) return;

    const element = document.getElementById("diff-report-container");
    if (!element) return;

    try {
      setIsExporting("pdf");
      // Both of these are large and only needed for this one action.
      // Loaded in parallel so the wait is one round trip, not two.
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

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

      // Paginate instead of squashing everything onto page one: a long diff
      // previously rendered off the bottom of a single A4 page and was lost.
      const pageHeight = pdf.internal.pageSize.getHeight();
      if (pdfHeight <= pageHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      } else {
        let remaining = pdfHeight;
        let offset = 0;
        while (remaining > 0) {
          pdf.addImage(imgData, "PNG", 0, -offset, pdfWidth, pdfHeight);
          remaining -= pageHeight;
          offset += pageHeight;
          if (remaining > 0) pdf.addPage();
        }
      }
      pdf.save("diff_report.pdf");
    } catch (error) {
      console.error("Failed to generate PDF", error);
      alert("Failed to generate PDF report.");
    } finally {
      setIsExporting(null);
    }
  };

  const exportRawDiff = () => {
    if (!diffResult) return;
    exportJsonReport(diffResult);
  };

  // Stats calculation
  const stats = useMemo(() => {
    if (!diffResult) return null;
    // Shared with the worker (see computeDiffStats in diffWorker.ts) so the
    // displayed figures can't drift from the ones the engine reports. The
    // aliased names keep the existing JSX unchanged.
    const { adds, dels, unchanged, similarity } = computeDiffStats(diffResult);
    return {
      addCount: adds,
      delCount: dels,
      unchangedCount: unchanged,
      similarity,
    };
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

  const searchMatchCount = useMemo(() => {
    if (!diffSearchQuery.trim() || !diffResult) return 0;
    const q = diffSearchQuery.toLowerCase();
    let count = 0;
    for (const row of diffResult) {
      if (row.lineA && row.lineA.toLowerCase().includes(q)) count++;
      if (row.lineB && row.lineB !== row.lineA && row.lineB.toLowerCase().includes(q)) count++;
    }
    return count;
  }, [diffSearchQuery, diffResult]);

  const visibleDiffResult = useMemo(() => {
    if (!diffResult) return null;
    if (!foldUnchanged) return diffResult;

    const contextLines = foldContext;
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
  }, [diffResult, foldUnchanged, foldContext]);

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

  const commitInlineEdit = useCallback(() => {
    if (!editingCell) return;
    const { side, lineNum, text } = editingCell;
    if (side === "orig") {
      const eol = origText.includes("\r\n") ? "\r\n" : "\n";
      const lines = origText.split(/\r?\n/);
      if (lineNum >= 1 && lineNum <= lines.length) {
        lines[lineNum - 1] = text;
        const newOrig = lines.join(eol);
        setOrigText(newOrig);
        if (diffResult) {
          runDiff(newOrig, modText, ignoreWs, ignoreCase, trimBlankLines);
        }
      }
    } else {
      const eol = modText.includes("\r\n") ? "\r\n" : "\n";
      const lines = modText.split(/\r?\n/);
      if (lineNum >= 1 && lineNum <= lines.length) {
        lines[lineNum - 1] = text;
        const newMod = lines.join(eol);
        setModText(newMod);
        if (diffResult) {
          runDiff(origText, newMod, ignoreWs, ignoreCase, trimBlankLines);
        }
      }
    }
    setEditingCell(null);
  }, [editingCell, origText, modText, diffResult, ignoreWs, ignoreCase, trimBlankLines]);

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

  const handleCopyPatch = () => {
    if (!diffResult) return;
    navigator.clipboard.writeText(generatePatchReport(diffResult)).then(() => {
      alert("Unified patch copied to clipboard!");
    });
  };

  const exportPatchReport = () => {
    if (!diffResult) return;
    downloadFile("diff.patch", generatePatchReport(diffResult), "text/plain");
  };

  const exportCsvReport = () => {
    if (!diffResult) return;
    downloadFile("diff.csv", generateCsvReport(diffResult), "text/csv");
  };

  const exportMdReport = () => {
    if (!diffResult) return;
    downloadFile("diff.md", generateMdReport(diffResult, stats), "text/markdown");
  };

  // Every palette entry maps to an action that already exists elsewhere in the
  // UI — the palette is a second route to them, never the only route.
  const paletteCommands: Command[] = [
    {
      id: "run-diff",
      title: "Run comparison",
      group: "Diff",
      shortcut: "Ctrl+Enter",
      keywords: "compare execute",
      run: () => runDiff(),
    },
    {
      id: "swap",
      title: "Swap A and B",
      group: "Diff",
      shortcut: "Ctrl+Shift+S",
      keywords: "reverse invert switch",
      run: swapTexts,
    },
    {
      id: "merge",
      title: "Merge B into A",
      group: "Diff",
      keywords: "apply accept",
      run: handleMergeBToA,
    },
    {
      id: "clear",
      title: "Clear all text",
      group: "Diff",
      keywords: "reset empty delete",
      run: clearAll,
    },
    {
      id: "sample",
      title: "Load sample text",
      group: "Diff",
      keywords: "example demo template",
      run: loadSample,
    },
    {
      id: "next-change",
      title: "Jump to next change",
      group: "Navigate",
      disabled: !diffResult,
      run: scrollToNextDiff,
    },
    {
      id: "prev-change",
      title: "Jump to previous change",
      group: "Navigate",
      disabled: !diffResult,
      run: scrollToPrevDiff,
    },
    {
      id: "search-diff",
      title: "Find in diff results",
      group: "Navigate",
      shortcut: "Ctrl+F",
      keywords: "find search query text filter",
      disabled: !diffResult,
      run: () => setShowDiffSearch(true),
    },
    {
      id: "view-split",
      title: "Switch to split view",
      group: "View",
      keywords: "side by side columns",
      run: () => setViewMode("split"),
    },
    {
      id: "view-unified",
      title: "Switch to unified view",
      group: "View",
      keywords: "inline single column",
      run: () => setViewMode("unified"),
    },
    {
      id: "fullscreen",
      title: isFullscreen ? "Exit fullscreen" : "Enter fullscreen",
      group: "View",
      keywords: "expand maximize zen",
      run: () => setIsFullscreen(!isFullscreen),
    },
    {
      id: "toggle-wrap",
      title: wordWrap ? "Disable word wrap" : "Enable word wrap",
      group: "View",
      run: () => setWordWrap(!wordWrap),
    },
    {
      id: "toggle-linenums",
      title: showLineNums ? "Hide line numbers" : "Show line numbers",
      group: "View",
      run: () => setShowLineNums(!showLineNums),
    },
    {
      id: "toggle-fold",
      title: foldUnchanged ? "Expand unchanged lines" : "Fold unchanged lines",
      group: "View",
      keywords: "collapse context",
      run: () => setFoldUnchanged(!foldUnchanged),
    },
    {
      id: "fold-context-1",
      title: "Fold Context: 1 line",
      group: "View",
      keywords: "context lines collapse 1",
      run: () => {
        setFoldContext(1);
        setFoldUnchanged(true);
      },
    },
    {
      id: "fold-context-3",
      title: "Fold Context: 3 lines (default)",
      group: "View",
      keywords: "context lines collapse 3",
      run: () => {
        setFoldContext(3);
        setFoldUnchanged(true);
      },
    },
    {
      id: "fold-context-5",
      title: "Fold Context: 5 lines",
      group: "View",
      keywords: "context lines collapse 5",
      run: () => {
        setFoldContext(5);
        setFoldUnchanged(true);
      },
    },
    {
      id: "fold-context-10",
      title: "Fold Context: 10 lines",
      group: "View",
      keywords: "context lines collapse 10",
      run: () => {
        setFoldContext(10);
        setFoldUnchanged(true);
      },
    },
    {
      id: "toggle-ws",
      title: ignoreWs ? "Stop ignoring whitespace" : "Ignore whitespace",
      group: "Filters",
      run: () => setIgnoreWs(!ignoreWs),
    },
    {
      id: "toggle-case",
      title: ignoreCase ? "Stop ignoring case" : "Ignore case",
      group: "Filters",
      run: () => setIgnoreCase(!ignoreCase),
    },
    {
      id: "toggle-blanks",
      title: trimBlankLines ? "Keep blank lines" : "Trim blank lines",
      group: "Filters",
      run: () => setTrimBlankLines(!trimBlankLines),
    },
    {
      id: "copy-patch",
      title: "Copy Git patch to clipboard",
      group: "Export",
      keywords: "unified diff patch copy clip clipboard",
      disabled: !diffResult,
      run: handleCopyPatch,
    },
    {
      id: "export-patch",
      title: "Export as Git patch (.patch)",
      group: "Export",
      keywords: "unified diff patch download file",
      disabled: !diffResult,
      run: exportPatchReport,
    },
    {
      id: "export-csv",
      title: "Export report as CSV (.csv)",
      group: "Export",
      keywords: "spreadsheet data comma separated",
      disabled: !diffResult,
      run: exportCsvReport,
    },
    {
      id: "export-md",
      title: "Export report as Markdown (.md)",
      group: "Export",
      keywords: "markdown summary report doc",
      disabled: !diffResult,
      run: exportMdReport,
    },
    {
      id: "export-html",
      title: "Export as HTML",
      group: "Export",
      disabled: !diffResult,
      run: exportHtmlReport,
    },
    {
      id: "export-pdf",
      title: "Export as PDF",
      group: "Export",
      disabled: !diffResult || isExporting !== null,
      run: exportPdfReport,
    },
    {
      id: "export-png",
      title: "Export as PNG",
      group: "Export",
      keywords: "image screenshot",
      disabled: !diffResult || isExporting !== null,
      run: exportImageReport,
    },
    {
      id: "export-json",
      title: "Export raw diff as JSON",
      group: "Export",
      disabled: !diffResult,
      run: exportRawDiff,
    },
    {
      id: "export-archive",
      title: "Export encrypted archive (.tds.enc)",
      group: "Export",
      keywords: "archive encrypted bundle tdsenc backup offline save pro",
      disabled: !diffResult,
      run: handleExportArchive,
    },
    {
      id: "import-archive",
      title: "Import encrypted archive (.tds.enc)",
      group: "Session",
      keywords: "archive load encrypted bundle decrypt open",
      run: () => archiveInputRef.current?.click(),
    },
    {
      id: "share",
      title: "Create share link",
      group: "Share",
      keywords: "url permalink copy encrypt password",
      run: openShare,
    },
    {
      id: "feed-post",
      title: "Post diff to public feed",
      group: "Share",
      keywords: "tweet publish status update twttr",
      disabled: !diffResult,
      run: () => setShowComposer(true),
    },
    {
      id: "feed-open",
      title: "Open the feed",
      group: "Share",
      keywords: "public stream timeline twttr community",
      run: () => setShowFeed(true),
    },
    {
      id: "pro",
      title: proLicense ? "Manage Pro licence" : "Activate Pro encryption",
      group: "Share",
      keywords: "licence license key upgrade burn",
      run: () => setShowProModal(true),
    },
    {
      id: "history",
      title: "Open history",
      group: "Share",
      keywords: "previous past recent",
      run: () => setShowHistoryModal(true),
    },
    {
      id: "cloud-sync",
      title: "Sync with GitHub Gist",
      group: "Share",
      keywords: "cloud gist export import token pat",
      run: () => setShowCloudSyncModal(true),
    },
    {
      id: "git-conflict",
      title: "Open Git conflict resolver",
      group: "Tools",
      keywords: "merge markers HEAD",
      run: () => setShowGitModal(true),
    },
    {
      id: "folder-diff",
      title: "Compare folders or ZIP archives",
      group: "Tools",
      keywords: "directory tree zip archive bulk",
      run: () => setShowFolderDiff(true),
    },
    {
      id: "github",
      title: "Browse a GitHub repository",
      group: "Tools",
      run: () => setShowGithubPanel(true),
    },
    {
      id: "settings",
      title: "Open settings",
      group: "Tools",
      keywords: "preferences customize theme",
      run: () => setCurrentView("settings"),
    },
    {
      id: "shortcuts",
      title: "Show keyboard shortcuts",
      group: "Tools",
      keywords: "help keys",
      run: () => setShowHelpModal(true),
    },
  ];

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
                  v2.0
                </span>
              </h1>
              <p className="text-[#64748B] font-serif italic text-sm mt-1">
                Fast, browser-based side-by-side & unified text comparison tool.
              </p>
            </div>
            <div className="flex gap-4 items-center mt-4 md:mt-0">
              <button
                onClick={() => setShowProModal(true)}
                title={proLicense ? `Pro licensed to ${proLicense.licensee}` : "Pro encryption"}
                className={
                  proLicense
                    ? "px-2 py-0.5 text-xs font-mono font-bold tracking-widest bg-[#F59E0B] text-black border-2 border-black shadow-[2px_2px_0_#000]"
                    : "px-2 py-0.5 text-xs font-mono tracking-widest text-[#F59E0B] border border-[#F59E0B]/50 hover:bg-[#F59E0B]/10"
                }
              >
                {proLicense ? "PRO ENCRYPTION" : "GO PRO"}
              </button>
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
        <StudioToolbar
          viewMode={viewMode}
          setViewMode={setViewMode}
          isNarrow={isNarrow}
          isThreeWay={isThreeWay}
          setIsThreeWay={setIsThreeWay}
          ignoreWs={ignoreWs}
          onToggleIgnoreWs={(checked) => {
            setIgnoreWs(checked);
            if (diffResult)
              runDiff(
                origText,
                modText,
                checked,
                ignoreCase,
                trimBlankLines,
              );
          }}
          ignoreCase={ignoreCase}
          onToggleIgnoreCase={(checked) => {
            setIgnoreCase(checked);
            if (diffResult)
              runDiff(
                origText,
                modText,
                ignoreWs,
                checked,
                trimBlankLines,
              );
          }}
          trimBlankLines={trimBlankLines}
          onToggleTrimBlankLines={(checked) => {
            setTrimBlankLines(checked);
            if (diffResult)
              runDiff(
                origText,
                modText,
                ignoreWs,
                ignoreCase,
                checked,
              );
          }}
          foldUnchanged={foldUnchanged}
          setFoldUnchanged={setFoldUnchanged}
          foldContext={foldContext}
          setFoldContext={setFoldContext}
          showLineNums={showLineNums}
          setShowLineNums={setShowLineNums}
          wordWrap={wordWrap}
          setWordWrap={setWordWrap}
          onOpenGitModal={() => setShowGitModal(true)}
          onOpenCustomizeModal={() => setShowCustomizeModal(true)}
          onOpenHistoryModal={() => setShowHistoryModal(true)}
          showGithubPanel={showGithubPanel}
          onToggleGithubPanel={() => setShowGithubPanel(!showGithubPanel)}
          onOpenCloudSyncModal={() => setShowCloudSyncModal(true)}
          showMultiplayer={showMultiplayer}
          onToggleMultiplayer={() => SERVER_FEATURES_ENABLED && setShowMultiplayer(!showMultiplayer)}
          onOpenHelpModal={() => setShowHelpModal(true)}
          onOpenPalette={() => setShowPalette(true)}
          onClear={clearAll}
          onSwap={swapTexts}
          language={language}
          setLanguage={setLanguage}
          onLoadSample={loadSample}
          onShare={openShare}
          isSharing={isSharing}
          onPostToFeed={() => setShowComposer(true)}
          canPostToFeed={!!diffResult}
          onOpenFeed={() => setShowFeed(true)}
          onRunDiff={() => runDiff()}
        />

        {/* Input Textareas Section (Desktop Resizable Panels) */}
        
        {showGithubPanel && (
          <div className="mb-6 h-[400px]">
            <Suspense fallback={<PanelFallback label="GitHub browser" />}>
            <GitHubIntegration onLoadFile={(text, name) => {
              // Intelligently put it in Orig if empty, else Mod
              if (!origText.trim()) setOrigText(text);
              else setModText(text);
              setShowGithubPanel(false);
              playSound('success');
            }} />
            </Suspense>
          </div>
        )}

        {showMultiplayer && (
          <div className="mb-6">
            <Suspense fallback={<PanelFallback label="multiplayer session" />}>
            <MultiplayerMode onRunDiff={(textA, textB) => {
              setOrigText(textA);
              setModText(textB);
              setShowMultiplayer(false);
              runDiff(textA, textB);
            }} />
            </Suspense>
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
              className={`${dragTarget === "a" ? "ring-2 ring-[#34D399] ring-inset " : ""}bg-[#020617] border border-[#334155] flex flex-col relative group h-full`}
              onDragOver={(e) => { e.preventDefault(); setDragTarget("a"); }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(e) => handleDrop(e, setOrigText, setFileNameA)}
            >
              <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-[#334155]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[#94A3B8]" /> Original
                  Text (Version A)
                  {fileNameA && (
                    <span
                      title={fileNameA}
                      className="ml-1 font-mono normal-case tracking-normal text-[10px] text-[#34D399] bg-[#064E3B]/40 border border-[#065F46] px-1.5 py-0.5 max-w-[160px] truncate"
                    >
                      {fileNameA}
                    </span>
                  )}
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
                      onChange={(e) => handleFileUpload(e, setOrigText, setFileNameA)}
                    />
                  </label>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 border border-blue-500/30 font-mono">
                    {origStats}
                  </span>
                </div>
              </div>
              <TextAreaWithLineNumbers
                editorRef={editorOrigRef}
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
              className={`${dragTarget === "b" ? "ring-2 ring-[#34D399] ring-inset " : ""}bg-[#020617] border border-[#334155] flex flex-col relative group h-full`}
              onDragOver={(e) => { e.preventDefault(); setDragTarget("b"); }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(e) => handleDrop(e, setModText, setFileNameB)}
            >
              <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-[#334155]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[#94A3B8]" /> Modified
                  Text (Version B)
                  {fileNameB && (
                    <span
                      title={fileNameB}
                      className="ml-1 font-mono normal-case tracking-normal text-[10px] text-[#34D399] bg-[#064E3B]/40 border border-[#065F46] px-1.5 py-0.5 max-w-[160px] truncate"
                    >
                      {fileNameB}
                    </span>
                  )}
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
                      onChange={(e) => handleFileUpload(e, setModText, setFileNameB)}
                    />
                  </label>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 border border-blue-500/30 font-mono">
                    {modStats}
                  </span>
                </div>
              </div>
              <TextAreaWithLineNumbers
                editorRef={editorModRef}
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
            className={`${dragTarget === "a" ? "ring-2 ring-[#34D399] ring-inset " : ""}bg-[#020617] border border-[#334155] flex flex-col relative group`}
            onDragOver={(e) => { e.preventDefault(); setDragTarget("a"); }}
            onDragLeave={() => setDragTarget(null)}
            onDrop={(e) => handleDrop(e, setOrigText, setFileNameA)}
          >
            <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-[#334155]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#94A3B8]" /> Original
                Text (Version A)
                {fileNameA && (
                  <span
                    title={fileNameA}
                    className="ml-1 font-mono normal-case tracking-normal text-[10px] text-[#34D399] bg-[#064E3B]/40 border border-[#065F46] px-1.5 py-0.5 max-w-[160px] truncate"
                  >
                    {fileNameA}
                  </span>
                )}
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
                    onChange={(e) => handleFileUpload(e, setOrigText, setFileNameA)}
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
              className={`${dragTarget === "base" ? "ring-2 ring-[#34D399] ring-inset " : ""}bg-[#020617] border border-[#334155] flex flex-col relative group`}
              onDragOver={(e) => { e.preventDefault(); setDragTarget("base"); }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(e) => handleDrop(e, setBaseText, () => {})}
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
            className={`${dragTarget === "b" ? "ring-2 ring-[#34D399] ring-inset " : ""}bg-[#020617] border border-[#334155] flex flex-col relative group`}
            onDragOver={(e) => { e.preventDefault(); setDragTarget("b"); }}
            onDragLeave={() => setDragTarget(null)}
            onDrop={(e) => handleDrop(e, setModText, setFileNameB)}
          >
            <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center border-b border-[#334155]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#94A3B8]" /> Modified
                Text (Version B)
                {fileNameB && (
                  <span
                    title={fileNameB}
                    className="ml-1 font-mono normal-case tracking-normal text-[10px] text-[#34D399] bg-[#064E3B]/40 border border-[#065F46] px-1.5 py-0.5 max-w-[160px] truncate"
                  >
                    {fileNameB}
                  </span>
                )}
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
                    onChange={(e) => handleFileUpload(e, setModText, setFileNameB)}
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

        {/* Diff engine failure (input too large, worker crash, etc.). Without
            this the run would silently produce nothing. */}
        {diffError && (
          <section
            role="alert"
            className="bg-[#450A0A]/40 border border-[#EF4444] text-[#FCA5A5] p-4 flex items-start gap-3"
          >
            <X className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 text-sm">
              <p className="font-semibold mb-1">Comparison failed</p>
              <p className="opacity-90">{diffError}</p>
            </div>
            <button
              type="button"
              onClick={() => setDiffError(null)}
              aria-label="Dismiss error"
              className="p-1 hover:bg-[#EF4444]/20 rounded transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </section>
        )}

        {/* Busy indicator: isDiffing was tracked but never surfaced, so large
            comparisons looked like nothing had happened. */}
        {isDiffing && (
          <section
            role="status"
            aria-live="polite"
            className="bg-[#111827] border border-[#334155] p-4 flex items-center justify-center gap-3 text-[#94A3B8] text-sm"
          >
            <span className="w-4 h-4 border-2 border-[#334155] border-t-[#60A5FA] rounded-full animate-spin" />
            Computing diff…
          </section>
        )}

        {/* Diff Output Container */}
        {diffResult && stats && (
          <div
            id="diff-report-container"
            className={`animate-in fade-in duration-300 bg-[#020617] pb-4 ${isFullscreen ? "fixed inset-0 z-50 overflow-y-auto p-4 space-y-4" : "space-y-6"}`}
          >
            {/* Stats Banner */}
            <StatsBanner
              stats={stats}
              onCopyReport={handleCopyReport}
              onCopyPatch={handleCopyPatch}
              onExportPatch={exportPatchReport}
              onExportCsv={exportCsvReport}
              onExportMd={exportMdReport}
              onExportJson={exportRawDiff}
              onExportHtml={exportHtmlReport}
              onExportPdf={exportPdfReport}
              onExportPng={exportImageReport}
              onExportArchive={handleExportArchive}
              isExporting={isExporting}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
            />

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
                    <button
                      onClick={() => setShowDiffSearch((v) => !v)}
                      className={`p-1 rounded transition-colors ${showDiffSearch ? "bg-[#34D399]/20 text-[#34D399]" : "hover:bg-[#334155] text-[#94A3B8]"}`}
                      title="Search in Diff (Ctrl+F)"
                      aria-label="Search in Diff"
                    >
                      <Search className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                  {diffResult && (
                    <div className="flex border-[#334155] pr-2 mr-2 border-r gap-1">
                      <button
                        onClick={scrollToPrevDiff}
                        className="p-1 rounded transition-colors hover:bg-[#334155] text-[#94A3B8]"
                        title="Previous Change"
                        aria-label="Jump to previous change"
                      >
                        <ChevronUp className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={scrollToNextDiff}
                        className="p-1 rounded transition-colors hover:bg-[#334155] text-[#94A3B8]"
                        title="Next Change"
                        aria-label="Jump to next change"
                      >
                        <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <span className="text-[10px] bg-[#334155] text-white px-2 py-0.5 border border-[#475569] font-mono">
                    {effectiveViewMode === "split" ? "SPLIT_VIEW" : "UNIFIED_VIEW"}
                    {isNarrow && viewMode === "split" && (
                      <span className="ml-2 text-[9px] text-[#64748B] normal-case">
                        (unified on small screens)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {showDiffSearch && (
                <div className="bg-[#0B132B] px-4 py-2 border-b border-[#334155] flex items-center gap-3">
                  <Search className="w-4 h-4 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={diffSearchQuery}
                    onChange={(e) => setDiffSearchQuery(e.target.value)}
                    placeholder="Find in diff..."
                    autoFocus
                    className="flex-1 bg-transparent text-xs text-white placeholder-[#64748B] outline-none font-mono"
                  />
                  {diffSearchQuery && (
                    <span className="text-[11px] text-[#94A3B8] font-mono">
                      {searchMatchCount} match{searchMatchCount === 1 ? "" : "es"}
                    </span>
                  )}
                  {diffSearchQuery && (
                    <button
                      onClick={() => setDiffSearchQuery("")}
                      className="text-[#94A3B8] hover:text-white p-0.5"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowDiffSearch(false);
                      setDiffSearchQuery("");
                    }}
                    className="text-xs text-[#94A3B8] hover:text-white ml-2 px-1.5 py-0.5 bg-[#1E293B] rounded border border-[#334155]"
                  >
                    Esc
                  </button>
                </div>
              )}

              <div className="bg-black overflow-x-auto font-mono text-[11px] leading-relaxed p-4">
                {effectiveViewMode === "split" ? (
                  <SplitDiffView
                    diffResult={visibleDiffResult || []}
                    showLineNums={showLineNums}
                    wordWrap={wordWrap}
                    syntaxTheme={syntaxTheme}
                    language={language}
                    searchQuery={showDiffSearch ? diffSearchQuery : undefined}
                    editingCell={editingCell}
                    onStartEdit={(side, lineNum, text) =>
                      setEditingCell({ side, lineNum, text })
                    }
                    onUpdateEditText={(text) =>
                      setEditingCell((prev) => (prev ? { ...prev, text } : null))
                    }
                    onCommitEdit={commitInlineEdit}
                    onCancelEdit={() => setEditingCell(null)}
                  />
                ) : (
                  <UnifiedDiffView
                    diffResult={visibleDiffResult || []}
                    showLineNums={showLineNums}
                    wordWrap={wordWrap}
                    syntaxTheme={syntaxTheme}
                    language={language}
                    searchQuery={showDiffSearch ? diffSearchQuery : undefined}
                    editingCell={editingCell}
                    onStartEdit={(side, lineNum, text) =>
                      setEditingCell({ side, lineNum, text })
                    }
                    onUpdateEditText={(text) =>
                      setEditingCell((prev) => (prev ? { ...prev, text } : null))
                    }
                    onCommitEdit={commitInlineEdit}
                    onCancelEdit={() => setEditingCell(null)}
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

      <GitConflictModal
        isOpen={showGitModal}
        onClose={() => setShowGitModal(false)}
        conflictText={gitConflictText}
        setConflictText={setGitConflictText}
        onResolveManual={handleParseGitConflictResult}
        onResolveAI={handleAIResolveConflict}
        isResolvingAI={isResolvingAI}
      />

      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        history={history}
        onRestore={(item) => {
          setOrigText(item.origText);
          setModText(item.modText);
          setShowHistoryModal(false);
          runDiff(item.origText, item.modText);
        }}
      />

      {/* Customize UI Modal */}
      <CustomizeModal
        isOpen={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        appLayout={appLayout}
        setAppLayout={setAppLayout}
        syntaxTheme={syntaxTheme}
        setSyntaxTheme={setSyntaxTheme}
        uiFont={uiFont}
        setUiFont={setUiFont}
        uiRadius={uiRadius}
        setUiRadius={setUiRadius}
        uiTint={uiTint}
        setUiTint={setUiTint}
        uiFontSize={uiFontSize}
        setUiFontSize={setUiFontSize}
        uiTexture={uiTexture}
        setUiTexture={setUiTexture}
        uiMotion={uiMotion}
        setUiMotion={setUiMotion}
        uiGlass={uiGlass}
        setUiGlass={setUiGlass}
        uiSound={uiSound}
        setUiSound={setUiSound}
        customCSS={customCSS}
        setCustomCSS={setCustomCSS}
        customTheme={customTheme}
        setCustomTheme={setCustomTheme}
        playSound={playSound}
      />

      {showFolderDiff && (
        <Suspense fallback={<PanelFallback label="folder comparison" />}>
          <FolderDiff
            onClose={() => setShowFolderDiff(false)}
            onOpenPair={(path, textA, textB) => {
              setOrigText(textA);
              setModText(textB);
              setFileNameA(path);
              setFileNameB(path);
              setIsThreeWay(false);
              setShowFolderDiff(false);
              runDiff(textA, textB);
            }}
          />
        </Suspense>
      )}

      {showShareModal && (
        <Suspense fallback={<PanelFallback label="share dialog" />}>
          <ShareModal
            isOpen
            onClose={() => setShowShareModal(false)}
            onCreate={createShare}
            isPro={proLicense !== null}
            onRequestPro={() => setShowProModal(true)}
          />
        </Suspense>
      )}

      {pendingUnlock && (
        <Suspense fallback={<PanelFallback label="unlock dialog" />}>
          <UnlockShareModal
            isOpen
            title={
              pendingUnlock.type === "archive"
                ? "Encrypted Archive (.tds.enc)"
                : pendingUnlock.type === "asymmetric"
                  ? "Recipient-Encrypted Share"
                  : "Password-protected share"
            }
            description={
              pendingUnlock.type === "archive"
                ? "Enter the password used to encrypt this .tds.enc archive file."
                : pendingUnlock.type === "asymmetric"
                  ? "This share is encrypted for a specific recipient public key. Enter your matching private key (tdspriv1:...)."
                  : "This comparison is encrypted. Enter the password the sender gave you — it is checked here in your browser and never sent anywhere."
            }
            label={pendingUnlock.type === "asymmetric" ? "PRIVATE KEY" : "PASSWORD"}
            placeholder={pendingUnlock.type === "asymmetric" ? "tdspriv1:..." : undefined}
            isPassword={pendingUnlock.type !== "asymmetric"}
            onClose={() => {
              setPendingUnlock(null);
              setDiffError(
                pendingUnlock.type === "archive"
                  ? "Archive decryption cancelled."
                  : "This share is protected. Reload the link to try again.",
              );
            }}
            onUnlock={unlockShare}
          />
        </Suspense>
      )}

      {showArchiveExportModal && (
        <Suspense fallback={<PanelFallback label="archive export dialog" />}>
          <UnlockShareModal
            isOpen
            title="Export Encrypted Archive (.tds.enc)"
            description="Enter a password to encrypt this entire diff session into a zero-knowledge .tds.enc file. Stored 100% locally on your machine."
            label="ENCRYPTION PASSWORD"
            submitText="EXPORT"
            isPassword={true}
            onClose={() => setShowArchiveExportModal(false)}
            onUnlock={async (password) => {
              const { createArchive } = await import("./lib/crypto/archive");
              const { downloadFile } = await import("./lib/diffExport");
              const json = await createArchive(
                {
                  origText,
                  modText,
                  origFileName: fileNameA || "original.txt",
                  modFileName: fileNameB || "modified.txt",
                  language,
                },
                password,
              );
              downloadFile(
                `${(fileNameA || "session").replace(/\.[^/.]+$/, "")}.tds.enc`,
                json,
                "application/json",
              );
              setShowArchiveExportModal(false);
              playSound("success");
            }}
          />
        </Suspense>
      )}

      <input
        type="file"
        ref={archiveInputRef}
        accept=".tds.enc"
        aria-label="Import archive file input"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFileInto(f, setOrigText, setFileNameA);
          e.target.value = "";
        }}
      />

      {showComposer && (
        <Suspense fallback={<PanelFallback label="composer" />}>
          <FeedComposerModal
            isOpen
            onClose={() => setShowComposer(false)}
            stats={{
              additions: stats?.addCount ?? 0,
              deletions: stats?.delCount ?? 0,
              similarity: stats?.similarity ?? 100,
              language,
            }}
            fileName={fileNameB || fileNameA || undefined}
            rows={diffResult}
            onPost={postToFeed}
          />
        </Suspense>
      )}

      {showFeed && (
        <Suspense fallback={<PanelFallback label="the feed" />}>
          <FeedDrawer
            onClose={() => setShowFeed(false)}
            onOpenInStudio={openFeedItem}
            localPosts={localPosts}
            focusPostId={focusPostId}
          />
        </Suspense>
      )}

      {showProModal && (
        <Suspense fallback={<PanelFallback label="Pro activation" />}>
          <ProActivationModal
            isOpen
            onClose={() => setShowProModal(false)}
            license={proLicense}
            onActivate={async (token, payload) => {
              (await import("./lib/crypto/license")).storeLicense(token);
              setProLicense(payload);
            }}
            onDeactivate={async () => {
              (await import("./lib/crypto/license")).clearLicense();
              setProLicense(null);
            }}
          />
        </Suspense>
      )}

      <CommandPalette
        open={showPalette}
        onClose={() => setShowPalette(false)}
        commands={paletteCommands}
      />

      {showHelpModal && (
        <ShortcutsModal onClose={() => setShowHelpModal(false)} />
      )}

      {showCloudSyncModal && (
        <CloudSyncModal
          onClose={() => setShowCloudSyncModal(false)}
          origText={origText}
          setOrigText={setOrigText}
          modText={modText}
          setModText={setModText}
          baseText={baseText}
          setBaseText={setBaseText}
          onDiff={(orig, mod) => runDiff(orig, mod)}
        />
      )}
    </div>
  );
}

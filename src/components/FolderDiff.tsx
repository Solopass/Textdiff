import { useMemo, useRef, useState } from "react";
import {
  FolderOpen,
  FileArchive,
  X,
  FilePlus2,
  FileMinus2,
  FileDiff,
  FileCheck2,
  ArrowRight,
} from "lucide-react";

/** A flat path -> contents map for one side of the comparison. */
type FileMap = Map<string, string>;

export type FolderEntryStatus = "added" | "removed" | "modified" | "identical";

export type FolderEntry = {
  path: string;
  status: FolderEntryStatus;
  textA: string;
  textB: string;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 2000;

/** NUL bytes are the cheapest reliable binary signal. */
const looksBinary = (text: string) => text.slice(0, 8000).includes("\u0000");

/**
 * Strips the top-level directory that both browsers and zip archives add.
 * Selecting "my-app" gives paths like "my-app/src/index.ts"; without this,
 * two copies of the same tree under different folder names would appear to
 * share no files at all.
 */
export const stripRoot = (paths: string[]): string[] => {
  if (paths.length < 2) return paths.map((p) => p.split("/").slice(1).join("/") || p);
  const firstSegments = new Set(paths.map((p) => p.split("/")[0]));
  if (firstSegments.size !== 1) return paths;
  return paths.map((p) => p.split("/").slice(1).join("/"));
};

const buildMapFromFiles = async (files: File[]): Promise<FileMap> => {
  const usable = files.slice(0, MAX_FILES);
  const rawPaths = usable.map(
    (f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
  );
  const paths = stripRoot(rawPaths);

  const map: FileMap = new Map();
  await Promise.all(
    usable.map(async (file, i) => {
      const path = paths[i];
      if (!path || file.size > MAX_FILE_BYTES) return;
      try {
        const text = await file.text();
        if (!looksBinary(text)) map.set(path, text);
      } catch {
        /* unreadable entry — skip it rather than failing the whole compare */
      }
    }),
  );
  return map;
};

const buildMapFromZip = async (file: File): Promise<FileMap> => {
  // ~10KB gzipped, and only ever needed when someone actually drops a zip.
  const { unzipSync } = await import("fflate");
  const buf = new Uint8Array(await file.arrayBuffer());
  const unzipped = unzipSync(buf);

  const decoder = new TextDecoder("utf-8", { fatal: false });
  const names = Object.keys(unzipped)
    // Directory entries carry a trailing slash and no content.
    .filter((n) => !n.endsWith("/"))
    // Archive metadata that would otherwise show up as spurious diffs.
    .filter((n) => !n.startsWith("__MACOSX/") && !n.endsWith(".DS_Store"))
    .slice(0, MAX_FILES);

  const stripped = stripRoot(names);
  const map: FileMap = new Map();
  names.forEach((name, i) => {
    const data = unzipped[name];
    const path = stripped[i];
    if (!path || data.length > MAX_FILE_BYTES) return;
    const text = decoder.decode(data);
    if (!looksBinary(text)) map.set(path, text);
  });
  return map;
};

export const compare = (a: FileMap, b: FileMap): FolderEntry[] => {
  const paths = Array.from(new Set([...a.keys(), ...b.keys()])).sort();
  return paths.map((path) => {
    const inA = a.has(path);
    const inB = b.has(path);
    const textA = a.get(path) ?? "";
    const textB = b.get(path) ?? "";
    const status: FolderEntryStatus = !inA
      ? "added"
      : !inB
        ? "removed"
        : textA === textB
          ? "identical"
          : "modified";
    return { path, status, textA, textB };
  });
};

const STATUS_META: Record<
  FolderEntryStatus,
  { label: string; color: string; Icon: typeof FilePlus2 }
> = {
  added: { label: "Added", color: "text-[#6EE7B7]", Icon: FilePlus2 },
  removed: { label: "Removed", color: "text-[#FCA5A5]", Icon: FileMinus2 },
  modified: { label: "Modified", color: "text-[#FDE047]", Icon: FileDiff },
  identical: { label: "Identical", color: "text-[#64748B]", Icon: FileCheck2 },
};

type Props = {
  onClose: () => void;
  /** Opens a single file pair in the main diff view. */
  onOpenPair: (path: string, textA: string, textB: string) => void;
};

export function FolderDiff({ onClose, onOpenPair }: Props) {
  const [entries, setEntries] = useState<FolderEntry[] | null>(null);
  const [busy, setBusy] = useState<"a" | "b" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIdentical, setShowIdentical] = useState(false);
  const [filter, setFilter] = useState("");
  const [labels, setLabels] = useState<{ a: string; b: string }>({ a: "", b: "" });

  const sideA = useRef<FileMap | null>(null);
  const sideB = useRef<FileMap | null>(null);

  const ingest = async (side: "a" | "b", files: File[], label: string) => {
    setError(null);
    setBusy(side);
    try {
      const isZip =
        files.length === 1 && /\.zip$/i.test(files[0].name);
      const map = isZip
        ? await buildMapFromZip(files[0])
        : await buildMapFromFiles(files);

      if (map.size === 0) {
        throw new Error(
          "No readable text files found there. Binary files and anything over 5MB are skipped.",
        );
      }

      if (side === "a") sideA.current = map;
      else sideB.current = map;
      setLabels((prev) => ({ ...prev, [side]: `${label} (${map.size} files)` }));

      if (sideA.current && sideB.current) {
        setEntries(compare(sideA.current, sideB.current));
      }
    } catch (err: any) {
      setError(err?.message || "Could not read that folder or archive.");
    } finally {
      setBusy(null);
    }
  };

  const counts = useMemo(() => {
    const c = { added: 0, removed: 0, modified: 0, identical: 0 };
    entries?.forEach((e) => c[e.status]++);
    return c;
  }, [entries]);

  const visible = useMemo(() => {
    if (!entries) return [];
    const q = filter.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (showIdentical || e.status !== "identical") &&
        (!q || e.path.toLowerCase().includes(q)),
    );
  }, [entries, showIdentical, filter]);

  const Picker = ({ side }: { side: "a" | "b" }) => (
    <div className="flex-1 border border-dashed border-[#334155] p-4 flex flex-col items-center gap-3 text-center">
      <p className="text-xs uppercase tracking-wider text-[#94A3B8] font-bold">
        {side === "a" ? "Side A (original)" : "Side B (modified)"}
      </p>
      {labels[side] ? (
        <p className="text-xs font-mono text-[#34D399] break-all">{labels[side]}</p>
      ) : (
        <p className="text-xs text-[#64748B]">No folder or archive selected</p>
      )}
      <div className="flex gap-2">
        <label className="cursor-pointer text-[11px] px-3 py-1.5 border border-[#334155] bg-[#1E293B] hover:bg-[#334155] transition-colors flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
          FOLDER
          <input
            type="file"
            className="hidden"
            // Non-standard but supported in every major browser; the types
            // don't know about it, hence the cast.
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            multiple
            onChange={(e) => {
              const files: File[] = Array.from(e.target.files ?? []);
              if (files.length) {
                const root =
                  (files[0] as File & { webkitRelativePath?: string })
                    .webkitRelativePath?.split("/")[0] || "folder";
                ingest(side, files, root);
              }
              e.target.value = "";
            }}
          />
        </label>
        <label className="cursor-pointer text-[11px] px-3 py-1.5 border border-[#334155] bg-[#1E293B] hover:bg-[#334155] transition-colors flex items-center gap-1.5">
          <FileArchive className="w-3.5 h-3.5" aria-hidden="true" />
          ZIP
          <input
            type="file"
            className="hidden"
            accept=".zip"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) ingest(side, [f], f.name);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {busy === side && (
        <span className="text-[11px] text-[#94A3B8] flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-[#334155] border-t-[#34D399] rounded-full animate-spin" />
          Reading...
        </span>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Folder and archive comparison"
    >
      <div className="bg-[#020617] border border-[#334155] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center p-4 border-b border-[#334155] bg-[#1E293B]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#34D399]" aria-hidden="true" />
            Compare Folders / Archives
          </h3>
          <button
            onClick={onClose}
            aria-label="Close folder comparison"
            className="text-[#94A3B8] hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col sm:flex-row gap-3">
            <Picker side="a" />
            <Picker side="b" />
          </div>

          <p className="text-[11px] text-[#64748B]">
            Everything is read locally in your browser — nothing is uploaded.
            Binary files, files over 5MB, and anything past {MAX_FILES} files are
            skipped.
          </p>

          {error && (
            <p role="alert" className="text-xs text-[#FCA5A5] border border-[#EF4444] bg-[#450A0A]/40 p-3">
              {error}
            </p>
          )}

          {entries && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-xs border-y border-[#1E293B] py-2">
                {(["added", "removed", "modified", "identical"] as const).map((k) => {
                  const { label, color, Icon } = STATUS_META[k];
                  return (
                    <span key={k} className={`flex items-center gap-1.5 ${color}`}>
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      {counts[k]} {label.toLowerCase()}
                    </span>
                  );
                })}
                <label className="ml-auto flex items-center gap-2 text-[#94A3B8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showIdentical}
                    onChange={(e) => setShowIdentical(e.target.checked)}
                  />
                  Show identical
                </label>
              </div>

              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by path..."
                aria-label="Filter files by path"
                className="bg-[#0F172A] border border-[#334155] px-3 py-2 text-xs text-white font-mono outline-none focus:border-[#34D399]"
              />

              <div className="border border-[#334155] divide-y divide-[#1E293B] max-h-[40vh] overflow-y-auto">
                {visible.length === 0 && (
                  <p className="p-6 text-center text-xs text-[#64748B]">
                    No files to show.
                  </p>
                )}
                {visible.map((entry) => {
                  const { color, Icon, label } = STATUS_META[entry.status];
                  const openable = entry.status !== "identical";
                  return (
                    <div
                      key={entry.path}
                      className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-[#0F172A]"
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} aria-hidden="true" />
                      <span className="font-mono text-[#E2E8F0] truncate flex-1" title={entry.path}>
                        {entry.path}
                      </span>
                      <span className={`shrink-0 ${color}`}>{label}</span>
                      <button
                        onClick={() => onOpenPair(entry.path, entry.textA, entry.textB)}
                        disabled={!openable}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 border border-[#334155] bg-[#1E293B] hover:bg-[#334155] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Open ${entry.path} in the diff view`}
                      >
                        OPEN
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

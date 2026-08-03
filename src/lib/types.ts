/**
 * Shared application types.
 *
 * DiffRow and WordPart are re-exported from the diff worker rather than
 * redefined here. They were previously declared in both places, so a change to
 * the engine's row shape could silently disagree with what the UI expected.
 */
export type { DiffRow, WordPart, DiffStats } from "./diffStats";

export type HistoryItem = {
  id: string;
  timestamp: number;
  origText: string;
  modText: string;
};

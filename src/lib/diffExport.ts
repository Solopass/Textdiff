import type { DiffRow } from "./types";

/**
 * Generates a standard unified diff patch format from DiffRow array.
 */
export function generatePatchReport(diffResult: DiffRow[]): string {
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
  return patchStr;
}

/**
 * Escapes CSV special characters (quotes, commas, newlines).
 */
export function escapeCsv(str: string): string {
  if (!str) return '""';
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generates CSV representation of diff rows.
 */
export function generateCsvReport(diffResult: DiffRow[]): string {
  let csvStr = `Type,Original Line,Modified Line,Original Content,Modified Content\n`;
  diffResult.forEach((row) => {
    const type = row.type;
    const lineA = row.lineNumA || "";
    const lineB = row.lineNumB || "";
    const contentA = escapeCsv(row.lineA || "");
    const contentB = escapeCsv(row.lineB || "");
    csvStr += `${type},${lineA},${lineB},${contentA},${contentB}\n`;
  });
  return csvStr;
}

/**
 * Generates a clean Markdown report with diff statistics and code block.
 */
export function generateMdReport(
  diffResult: DiffRow[],
  stats?: { similarity: number; addCount: number; delCount: number; unchangedCount: number } | null,
  dateStr?: string,
): string {
  let mdStr = `# Diff Report\n\n`;
  mdStr += `**Date:** ${dateStr || new Date().toLocaleString()}\n\n`;

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
  return mdStr;
}

/**
 * Triggers a browser file download for a string blob.
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Exports diff result as raw JSON file.
 */
export function exportJsonReport(diffResult: DiffRow[]): void {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(diffResult, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "textdiff_payload.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

/**
 * Exports rendered diff container HTML.
 */
export function exportHtmlReport(containerElement: HTMLElement | null): void {
  if (!containerElement) return;
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
    ${containerElement.innerHTML}
  </div>
</body>
</html>
  `.trim();
  downloadFile("diff_report.html", htmlContent, "text/html;charset=utf-8");
}

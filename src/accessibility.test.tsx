import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import "vitest-axe/extend-expect";

declare module "vitest" {
  export interface Assertion<T = any> {
    toHaveNoViolations(): void;
  }
  export interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

import { ShortcutsModal } from "./components/ShortcutsModal";
import { HistoryModal } from "./components/HistoryModal";
import { GitConflictModal } from "./components/GitConflictModal";
import { CloudSyncModal } from "./components/CloudSyncModal";
import { CommandPalette } from "./components/CommandPalette";
import { StatsBanner } from "./components/StatsBanner";
import { CustomizeModal } from "./components/CustomizeModal";

// Mock Monaco for jsdom
vi.mock("@monaco-editor/react", async () => await import("./test/monacoMock"));

describe("Accessibility (WCAG compliance)", () => {
  it("ShortcutsModal has no accessibility violations", async () => {
    const { container } = render(<ShortcutsModal onClose={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("HistoryModal has no accessibility violations", async () => {
    const mockHistory = [
      {
        id: "1",
        timestamp: Date.now(),
        origText: "original text",
        modText: "modified text",
      },
    ];
    const { container } = render(
      <HistoryModal
        isOpen={true}
        onClose={() => {}}
        history={mockHistory}
        onRestore={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("GitConflictModal has no accessibility violations", async () => {
    const { container } = render(
      <GitConflictModal
        isOpen={true}
        onClose={() => {}}
        conflictText="<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch"
        setConflictText={() => {}}
        onResolveManual={() => {}}
        onResolveAI={() => {}}
        isResolvingAI={false}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("CloudSyncModal has no accessibility violations", async () => {
    const { container } = render(
      <CloudSyncModal
        onClose={() => {}}
        origText="original text"
        setOrigText={() => {}}
        modText="modified text"
        setModText={() => {}}
        baseText=""
        setBaseText={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("CommandPalette has no accessibility violations", async () => {
    const sampleCommands = [
      {
        id: "test",
        title: "Test Command",
        group: "General",
        run: () => {},
      },
    ];
    const { container } = render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        commands={sampleCommands}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("StatsBanner has no accessibility violations", async () => {
    const mockStats = {
      adds: 2,
      dels: 1,
      unchanged: 5,
      similarity: 71,
    };
    const { container } = render(
      <StatsBanner
        stats={mockStats}
        onExportHtml={() => {}}
        onExportPdf={() => {}}
        onExportPng={() => {}}
        onExportJson={() => {}}
        onCopyReport={() => {}}
        onCopyMarkdown={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("CustomizeModal has no accessibility violations", async () => {
    const { container } = render(
      <CustomizeModal
        isOpen={true}
        onClose={() => {}}
        appLayout="standard"
        setAppLayout={() => {}}
        syntaxTheme="dark"
        setSyntaxTheme={() => {}}
        uiFont="sans"
        setUiFont={() => {}}
        uiRadius="default"
        setUiRadius={() => {}}
        uiTint="default"
        setUiTint={() => {}}
        uiFontSize="base"
        setUiFontSize={() => {}}
        uiTexture="none"
        setUiTexture={() => {}}
        uiMotion="default"
        setUiMotion={() => {}}
        uiGlass={false}
        setUiGlass={() => {}}
        uiSound="disabled"
        setUiSound={() => {}}
        customCSS=""
        setCustomCSS={() => {}}
        customTheme={{
          bg: "#1e1e1e",
          fg: "#d4d4d4",
          comment: "#6A9955",
          string: "#CE9178",
          keyword: "#569CD6",
          number: "#B5CEA8",
          function: "#DCDCAA",
          operator: "#D4D4D4",
        }}
        setCustomTheme={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

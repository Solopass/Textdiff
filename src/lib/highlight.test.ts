import { describe, it, expect } from "vitest";
import { detectLanguageFromFilename, highlightCode } from "./highlight";

describe("detectLanguageFromFilename", () => {
  it("detects JavaScript and TypeScript variants", () => {
    expect(detectLanguageFromFilename("app.js")).toBe("javascript");
    expect(detectLanguageFromFilename("component.jsx")).toBe("javascript");
    expect(detectLanguageFromFilename("module.mjs")).toBe("javascript");
    expect(detectLanguageFromFilename("server.cjs")).toBe("javascript");
    expect(detectLanguageFromFilename("index.ts")).toBe("typescript");
    expect(detectLanguageFromFilename("App.tsx")).toBe("typescript");
  });

  it("detects Python, JSON, and markup/styles", () => {
    expect(detectLanguageFromFilename("script.py")).toBe("python");
    expect(detectLanguageFromFilename("data.json")).toBe("json");
    expect(detectLanguageFromFilename("index.html")).toBe("html");
    expect(detectLanguageFromFilename("styles.css")).toBe("css");
    expect(detectLanguageFromFilename("theme.scss")).toBe("css");
  });

  it("detects Markdown, SQL, Shell, and YAML", () => {
    expect(detectLanguageFromFilename("README.md")).toBe("markdown");
    expect(detectLanguageFromFilename("query.sql")).toBe("sql");
    expect(detectLanguageFromFilename("deploy.sh")).toBe("shell");
    expect(detectLanguageFromFilename("config.yaml")).toBe("yaml");
    expect(detectLanguageFromFilename("ci.yml")).toBe("yaml");
  });

  it("handles plain text and unknown files", () => {
    expect(detectLanguageFromFilename("notes.txt")).toBe("plain");
    expect(detectLanguageFromFilename("app.log")).toBe("plain");
    expect(detectLanguageFromFilename("binary.dat")).toBeNull();
    expect(detectLanguageFromFilename("no_extension")).toBeNull();
  });
});

describe("highlightCode", () => {
  it("escapes plain text without syntax markup", () => {
    const raw = "<div>hello & world</div>";
    const res = highlightCode(raw, "dark", "plain");
    expect(res).toBe("&lt;div&gt;hello &amp; world&lt;/div&gt;");
  });

  it("highlights code using supported languages and aliases", () => {
    const js = "const x = 42;";
    const jsHtml = highlightCode(js, "dark", "javascript");
    expect(jsHtml).toContain("const");
    expect(jsHtml).toContain("42");

    const py = "def hello(): pass";
    const pyHtml = highlightCode(py, "dark", "python");
    expect(pyHtml).toContain("def");

    const sql = "SELECT * FROM users;";
    const sqlHtml = highlightCode(sql, "dark", "sql");
    expect(sqlHtml).toContain("SELECT");

    const sh = "echo 'hello'";
    const shHtml = highlightCode(sh, "dark", "shell");
    expect(shHtml).toContain("echo");
  });
});

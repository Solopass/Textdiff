# TextDiff Studio ⚡

> The ultimate, high-performance client-side text comparison tool with side-by-side and unified diff visualization.

![Build](https://img.shields.io/badge/Status-Active-brightgreen.svg)
![Framework: React](https://img.shields.io/badge/Framework-React-blue.svg)

## Overview

**TextDiff Studio** is a fast browser application that allows developers, writers, and students to perform rapid line-by-line text and code comparisons. It features an automated diff engine using the Longest Common Subsequence (LCS) algorithm to compute additions, deletions, and structural similarity metrics.

This is the **React, Tailwind CSS, & Vite** modernized version of TextDiff Studio.

## Features

- 🌓 **Dual View Modes**: Switch between split side-by-side view and unified single-column view.
- ⚙️ **Smart Comparison Filters**: Toggle flags to ignore whitespace variations, case sensitivity, and trim blank lines.
- 🚀 **High Performance Web Worker**: The LCS diffing algorithm runs in a dedicated Web Worker to ensure the UI never freezes, even on massive files.
- 💻 **Monaco Editor Integration**: Fully-featured code editors with syntax highlighting, line numbers, and minimaps.
- 🔀 **Merge B to A**: Quickly merge modifications into your baseline with one click, automatically storing a snapshot in your session history.
- 🎨 **True Syntax Highlighting**: PrismJS integration across multiple languages (JavaScript, Python, JSON) in the Diff Viewer.
- 🌩️ **Cloud Sync & Permanent URLs**: Share diffs via compressed URL fragments, permanent Firebase links, or sync directly to GitHub Gists via Personal Access Tokens.
- 📜 **Local History**: Automatically saves your last 20 comparisons locally for quick reversion and review.
- 📄 **Export Options**: Export diff results as HTML, high-resolution PNGs (via html2canvas), or PDFs (via jsPDF).
- 📁 **Fold Unchanged Lines**: Option to collapse unmodified sections, displaying only the surrounding context lines.
- 🛠️ **Dev Mode Test Suite**: Integrated environment to run functional tests within the Settings pane.

## Quick Start (Local Setup)

1. Clone or download the repository:
   ```bash
   git clone https://github.com/your-username/textdiff-studio.git
   cd textdiff-studio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

## Development

- `npm run dev`: Start development server.
- `npm run build`: Build production assets.
- `npm run lint`: Run TypeScript linter.

## Roadmap

See `ROADMAP.md` for upcoming features and the long-term vision of the project.

## License

Distributed under a Custom Non-Commercial Open Source License. See `LICENSE` for details.

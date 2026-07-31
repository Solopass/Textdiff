# TextDiff Studio - Roadmap V2 & V3 🚀

## ✅ Completed (V2)
- [x] **Git Merge Conflict Resolver Mode**: A dedicated mode to paste standard `<<<<<<< HEAD` merge conflict markers and automatically populate the 3-way merge tool.
- [x] **Custom Syntax Themes API**: Allow users to share their custom syntax themes via URL or JSON import.
- [x] **Advanced Analytics Dashboard**: Track how much time is saved resolving conflicts and view personal diffing statistics.
- [x] **Annotated Sharing**: Allow users to leave comments or annotations on specific lines of a diff before sharing the permanent URL.
- [x] **PWA & Offline Mode**: Full Progressive Web App support to install TextDiff Studio natively and use the web worker diff engine without an internet connection.
- [x] **Live Customization Previews**: Non-blocking side panel to modify aesthetics in real-time.
- [x] **Customization Randomizer with Locks**: Randomly generate aesthetic profiles while locking preferred traits.

## 🔜 Coming in V3 (Enterprise & Collaboration)
- [x] **Full GitHub & GitLab Integration**: Connect repositories, pull requests, and commit histories to view and resolve diffs directly against live repos.
- [x] **Live Collaboration (Multiplayer)**: Multiplayer mode where multiple users can view and edit the same diff session simultaneously using WebSockets.
- [ ] **Semantic Code Diffing**: Understand code structure (AST-based) so moving a function to a different part of the file is recognized as a "move" rather than deletion/addition.
- [ ] **Folder & Zip Diffing**: Upload zip files or directories to compare multiple files across two folder structures.
- [x] **AI-Assisted Resolution**: Integrate with Gemini API to suggest automated resolutions for complex conflicts and explain changes in plain English.
- [ ] **Self-Hosted Backend**: Provide Docker images for enterprises to host the sharing and sync backend internally.
- [ ] **Inline Editing**: Allow editing text directly within the unified and split diff views, with real-time diff updating.

## 🎨 Customization & Aesthetics Engine Roadmap
- [x] **Advanced Font Settings**: Granular control over font size, line height, and letter-spacing for maximum legibility.
- [x] **Custom CSS Injector**: Allow power users to inject arbitrary CSS to tweak the UI precisely to their liking.
- [x] **Background Textures & Patterns**: Toggleable dot grids, subtle noise overlays, or grid-paper patterns behind the application canvas.
- [x] **UI Sound Design**: Satisfying, toggleable auditory feedback (soft clicks, smooth transitions) for interactions and diff synchronizations.
- [x] **Motion & Transition Controls**: Toggles to enable fluid spring animations or "reduce motion" for strict accessibility.
- [x] **Glassmorphism / Frosted Effects**: Toggles to add sophisticated blur effects to modals, headers, and UI panels.
- [x] **Community Theme Gallery**: A built-in explorer to browse, preview, and install community-created aesthetic profiles.
- [x] **Color Palette Generator**: Input a primary hex code (or upload an image) and automatically derive a cohesive aesthetic tint and syntax theme using AI or color math.

# Changelog

All notable changes to **eQc - Easy Qual Coding** are documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 1.5.4 - 2026-08-16

### Added
- **🚪 Host can remove a member** — while hosting, every connected coder's chip in the LAN panel now has an ✕ button to disconnect that specific person. The removed coder sees a clear **“You were disconnected by the host”** message and returns to local mode.
- **🟢 / ⚪ LAN sync status chip** — a small, always-visible chip next to the 🌐 LAN button shows **“🟢 Synced”** when you're on the session-shared project and **“⚪ Local only (not synced)”** while you're viewing another project.
- **🟢 Shared-project marker** — the project dropdown now prefixes the session-shared project with a green dot, so you always know which project is live even when a different one is open.

### Changed
- **🧭 Free multitasking during LAN sessions** — you can now open, view, and edit **any** local project while a session runs in the background. The old alarm-style “project mismatch” banner is gone (replaced by the quiet status chip); an unlikely host rejection is now logged instead of popping up.
- **📦 Background syncing for the shared project** — if a teammate edits the shared LAN project while you're working on a different project, the incoming changes are saved silently to the database **without switching your screen** (and won't be mistaken for “offline edits” later).
- **🛠️ Cleaner client-side project management** — LAN clients can now freely rename/delete their **own other** local projects during a session; only the session-shared project stays locked (it belongs to the host's live state).

### Fixed
- **🔒 LAN session project lock** — sessions are now hard-locked to exactly **one** project id end-to-end (host accept, client receive/buffer/replay, and client send). Previously, opening or switching to a different local project mid-session could leak its edits into the session or apply/save the wrong project's data; those paths are now rejected at every layer.

## 1.5.2 - 2026-08-13

### Added
- **Auto-Code word matching modes** — the Auto-Coder now has **Literal** (exact substring) and **Word roots & variants** matching: word-boundary-aware, light English inflection normalization (`green` → `greens` / `greenery`, `tree` → `trees`), falling back to whole-word matching for non-English (e.g. Bangla) words.
- **Live match preview** — before executing, the Auto-Coder shows how many **new** segments would be applied across how many documents (debounced; excludes passages already coded with the target code).

### Changed
- **Codebook editing performance** — code name/summary inputs use debounced local state and commit on blur/Enter instead of persisting+re-rendering the app on every keystroke.
- **Performance** — document tree badges, codebook excerpt lookups, and code-tree sorting now use precomputed maps instead of per-row scans.

### Fixed
- **LAN client role** — connecting peers are now broadcast their own role (`client`), name, and the host name, so the client UI shows the **Disconnect** button (and the right session banner) instead of the host's "Stop Session" button.
- **LAN session tab** — the collaboration panel opens on the correct tab (Join) for sessions you joined.

## 1.5.0 - 2026-08-13

### Added
- **LAN collaboration** — a `🌐 LAN` button in the header starts a live, password-protected coding session over the local network:
  - **Host a Session** — shares the currently open project. Joiners authenticate with an optional session password.
  - **Join a Session** — auto-discovers hosts on the same network; pick one and the project is transferred in chunks with a progress bar.
  - **Live sync** — edits, coding, and image-codings made by any connected coder appear in everyone's copy in real time; presence chips show who is connected.
  - **Smart rejoin** — rejoining peers download only the newest state when their copy is stale; up-to-date peers connect instantly.
  - **Robust discovery** — UDP broadcast, plus a same-machine probe (lets you test two app instances on one PC) and a manual "Find by IP" field for networks that drop broadcasts.
- **`ws` dependency** — WebSocket server/client library powering the LAN layer.

## 1.4.4 - 2026-08-13

### Added
- **REFI-QDA (.qdpx) export** — Codebook tab → Export Options → `⬇️ REFI-QDA`. Exports the full project (codebook with hierarchy/colors/memos, text documents and their coded passages, images and their coded regions) as a REFI-QDA-2 `.qdpx` archive.
- **REFI-QDA image import** — picture sources (`<PictureSource>`) inside `.qdpx` files are now imported as images, including their coded regions (`<PictureSelection>`) and memos. Image files from the archive are re-encoded as data URLs.
- **Image rename** — each image in the document tree now has a ✏️ button to rename it.
- **Coded-region count badge** — image rows in the tree show how many coded regions they contain.
- **Reader font controls (Word-style)** — in the header next to Undo/Redo: a font-family picker and `A−` / `A+` font-size controls (8–48 px). Persist per-machine in `localStorage`.
- **Per-coder colors on merge** — when merging projects, each coder is assigned a stable, distinct color instead of random colors.

### Changed
- **Color scheme** — root codes get a color from the palette; subcodes automatically inherit their parent's color (overridable via the codebook swatch picker).
- **Export Options layout** — removed a duplicate "Export Options" group in the Codebook tab; REFI-QDA export now sits at the top of the existing Export Options group, above Manuscript Skeleton.
- **Image zoom steps** — `−` / `+` buttons and the slider now move in 10% steps (was 25%); minimum zoom is now 10%.
- **REFI-QDA import robustness** — the importer now also reads subcodes nested inside a `<SubCodes>` wrapper (the REFI-QDA-2 standard shape), so real MAXQDA/NVivo files import better and exports round-trip.

### Fixed
- **Zoom buttons** — the `−` / `+` / Reset / slider buttons in the image viewer were nested inside the Notes button, so clicking them also opened the notes panel; they are now separate controls.
- **Duplicate Images section** — removed a redundant flat "Images" list from the left panel; images are only shown inside the document tree, per folder.

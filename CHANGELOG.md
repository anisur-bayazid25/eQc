# Changelog

All notable changes to **eQc - Easy Qual Coding** are documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

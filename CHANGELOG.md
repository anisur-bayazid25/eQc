# Changelog

All notable changes to **eQc - Easy Qual Coding** are documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 1.5.6 - 2026-08-16

### Added
- **🗺️ Code Map is now a real canvas** — pick the canvas size (Map, A5, A4, Letter, Legal, or a fully **Custom** W×H) and zoom from 10–400% with the slider. The map renders as a paper with true pixel dimensions inside a scrollable viewport, so zooming in scrolls instead of stretching. Switching canvas size **instantly rescales every placed node** to fit the new bounds (40px padding), and auto-layout for new codes always respects the active canvas.
- **🎨 Style edges and shapes on the Code Map** — every node can be a **circle, square, or diamond** (right-click to cycle). Click any edge to style it: **solid/dashed/dotted**, straight or **curved**, **arrowheads**, custom **colors**, and optional **labels**. Hierarchy and co-occurrence edges keep defaults until you style them; “**✏️ Draw edge**” lets you connect any two nodes with a custom edge, and styled/custom edges persist with the project. Co-occurrence edges (derived from shared documents) can be toggled on/off.
- **📊 Document Portrait is now a vertical coding strip** — the minimap moved from above the document to a narrow strip on the document's right edge. Each colored band sits exactly where that passage is in the text; **click it to scroll the document to the passage** (no popup). Lines **widen on hover** so even single-line codings are easy to hit.
- **🔍 Code while you search** — select a passage, click the code search box, and type: the selection is kept (sticky), and **clicking any search result applies that code**. You can also **drag a code** from the search results or the legend onto the document to apply it, and images can now be **dragged between folders** in the document tree.
- **🧹 Clean redundant codings** — a button merges overlapping codings of the same code on the same document into single segments (notes joined), so duplicated codings never inflate counts.
- **🎨 60 more code colors** — the Codebook color picker gains a “🎨 More colors…” palette.
- **⬇️ Codebook-only REFI-QDA export** — share just the code tree (hierarchy, colors, memos) as a valid `.qdpx` archive with no sources.
- **↕️ Drag-reorder the code legend** — drag a code onto a sibling to reorder it (positions remembered), onto a parent to reparent it, or onto empty tree space to move it to root.

### Changed
- **Deleting a folder** no longer deletes its documents — they move to the root level instead.

### Fixed
- **Code Map clipping** — shrinking the canvas (e.g. Map → A4) no longer leaves nodes cropped outside the white paper; every node now fits with padding, and dragging is rigidly clamped to the canvas bounds.
- **Code Map zoom stretch** — the old percentage-width scaling stretched the map horizontally; zoom now scales the paper while scrollbars handle overflow.

## 1.5.5 - 2026-08-16

### Added
- **🗑️ Bulk delete by coder (Project Settings)** — a new **“Manage Coders (Cleanup)”** section lists every coder that has coded items in the project (sorted; **Unattributed** is excluded on purpose), with their `n seg · n reg` counts and a small 🗑️ button. Clicking it asks you to **type the exact coder name** before anything is removed, so a typo-cloned name (e.g. `bayazid-dev` vs `bayazid_dev`) can be safely wiped. The deletion filters both `codedSegments` and `codedRegions`, stamps the project's `updatedAt` (so LAN offline-edit tracking sees it), persists it, and toasts the removed count.
- **🔘 Compact Undo / Redo / Save buttons** — these header buttons now show only their icon, sized exactly to the icon (26×26 px), with the label moved into the tooltip.

### Changed
- **🌗 Codebook sorting dropdown now theme-aware** — the “Sort by” select in the Codebook centre panel used an undefined CSS variable (`--bg-panel`), which made it near-invisible in dark mode. The variable is now defined for **both** light and dark themes, so sorts are readable everywhere.
- **Project Settings modal scrolls** — added `max-height` + scrolling so the new Cleanup section and the Save/Delete buttons stay reachable on shorter windows.

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

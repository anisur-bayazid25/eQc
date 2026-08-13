# AI Changelog — eQc desktop app

This file is written for AI coding models/agents. It describes **what** changed, **where** (exact files and functions), **how** the code works, and **why** the design decisions were made. Use it to understand the current state before editing and to extend the features.

App: `electron/` (main + preload, CommonJS) + `src/` (renderer, React + TypeScript, Vite). Every renderer↔main call goes through the `window.qv` bridge (`electron/preload.cjs`), typed in `src/global.d.ts` (`QvBridge`). Persistence: one `Project` JSON object per row (see types in `src/domain.ts`). `tsc --noEmit` must stay clean.

## 1. REFI-QDA (.qdpx) export — new

**Goal:** let users export the whole project so other QDA tools (MAXQDA, NVivo, etc.) can open it.

**Flow:** renderer builds the XML + source files → hands them to main → main zips and saves via a save dialog.

### New file: `src/lib/qdpxExport.ts`
- `export interface QdpxExportPayload { fileName; qdeXml; sourceFiles: Record<string,string>; sourceBytes: Record<string,string> }` — the payload the renderer produces and sends to main.
- `export async function buildQdpxExport(project: Project): Promise<QdpxExportPayload>` — the single entry point.
  - Real RFC-4122 v4 UUIDs via `uuid()` (`crypto.randomUUID()` with a manual fallback) — REFI-QDA requires GUID attributes; the app's own `uid()` ids are NOT valid GUIDs.
  - `esc()` handles XML escaping; `sanitizeFileName()` cleans the project name for the default filename.
  - `buildCodebook()` → `<CodeBook><Codes><Code guid="…" name="…" isCodable="true" color="…">` with `<Description>` (code summary memo) and nested `<SubCodes>` children. Colors/memos/summaries preserved.
  - `buildTextSource()` → `<TextSource guid="…" name="…" plainTextPath="internal://<guid>.txt">`; the doc content is written verbatim (so offsets match) to `Sources/<guid>.txt` in `sourceFiles`. Each `CodedSegment` becomes `<PlainTextSelection startPosition endPosition guid name>` honoring the SEGMENT's offsets in `doc.content`, with an optional `<Description>` (segment note) and `<Coding guid><CodeRef targetGUID="<code guid>"/></Coding>`. Segment text (first 48 chars, whitespace-normalized) is used as the selection `name`. Invalid/out-of-range segments are skipped.
  - `buildPictureSource()` → `<PictureSource guid="…" name="…" path="internal://<guid>.<ext>">`; the base64 body is written to `Sources/<guid>.<ext>` in `sourceBytes`. Coded regions are decoded to pixel coordinates — `getImageSize()` loads the data URL via `new Image()` — then emitted as `<PictureSelection firstX firstY secondX secondY guid name="Region">` with `<Description>` (region note) + `<Coding><CodeRef>`. Mime/extension inferred from the data URL (`imageExt()`).
  - Assembly: namespace `urn:QDA-XML:project:2.0`, `xsi:schemaLocation`, a minimal `<Users>` element, then `CodeBook` + `<Sources>` (text then picture). `fileName` = `<sanitized project name>.qdpx`.
- Async on purpose: image dimension decoding requires the browser image loader.

### `electron/main.cjs` — `ipcMain.handle('qdpx:export', …)`
- Opened via save dialog (`dialog.showSaveDialog(mainWindow, …)`, `.qdpx` filter, default filename from the payload).
- Uses the existing `JSZip` dependency (already used by import): `zip.file('project.qde', qdeXml)`, text files via `sourceFiles` as strings, binary via `sourceBytes` with `Buffer.from(base64, 'base64')`.
- Writes with `fs.writeFileSync`, returns the saved path or `null` if cancelled.

### `electron/preload.cjs` + `src/global.d.ts`
- `exportQdpx: (payload) => ipcRenderer.invoke('qdpx:export', payload)` added to the bridge.
- `QdpxExportPayload` interface declared in `src/global.d.ts` (duplicated by design, mirroring the pre-existing `QdpxParsePayload` pattern).

### `src/App.tsx`
- `handleQdpxExport()` → `await buildQdpxExport(project)`, `await window.qv.exportQdpx(payload)`, toast on success/error.
- Button placed **at the top of the existing "Export Options" group** in the Codebook tab left panel, above "Manuscript Skeleton" (a duplicate "Export Options" group created mid-development was removed).

## 2. REFI-QDA (.qdpx) image import — new

**Before:** only `<TextSource>` (text) was imported; everything else was reported as skipped.

**Goal:** import images and their coded regions so the existing image-coding feature works on imported projects.

### `electron/main.cjs` — `qdpx:pickAndParse`
- While unzipping, entries under `Sources/` matching `IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp)$/i` are now read as base64 into `sourceBytes` (new return field) instead of being skipped by the text-decode catch. Everything else stays text (`sourceFiles`) or is skipped.

### `src/lib/qdpxImport.ts`
- `QdpxParsePayload` gained optional `sourceBytes?: Record<string, string>`.
- `QdpxImportSummary` gained `imagesCreated: number`.
- New helpers: `base64ToImageDataUrl(base64, entryName)` (mime from extension, default png), `getImageSize(dataUrl)` (promise-wrapped `new Image()`, returns `{w,h}` or zeros).
- New `importPictureSource()` (async): resolves the image entry from `path`/`picturePath` by the same `internal://` path-matching used for text, builds a data URL, **dedupes by normalized name** (reuses an existing `ImageSource` like docs do), imports the source memo via `resolveMemoText` into `image.notes`, decodes dimensions, then walks `<PictureSelection>` children.
- New `importPictureSelection()` (sync): parses `firstX/firstY/secondX/secondY`, clamps to image bounds, normalizes to the app's **0–1 coordinate space** (`x = min(max(firstX,0),w)/w`, width = `|secondX - firstX| / w`, etc.), skips degenerate/zero-size regions, then for each `<Coding><CodeRef targetGUID>` creates a `CodedRegion` (deduped per image+code+position within 0.001, mirrors the text dedupe philosophy). Region notes go to `region.note`.
- `importSources()` and `importQdpx()` are now `async` (`importQdpx` awaited by the caller) — required because of `await getImageSize()`.

### `src/App.tsx` — `handleQdpxImport`
- `const summary = await importQdpx(draft, payload)` (was sync).
- Toast now includes `+N images`.

## 3. Subcode import fix (REFI-QDA `<SubCodes>` wrapper)

**Why:** REFI-QDA-2 files from real apps nest subcodes inside `<SubCodes>`, but `importCodeTree` only looked for direct `<Code>` children. Our own exports also use `<SubCodes>`.

`src/lib/qdpxImport.ts` → `importCodeTree()`: collects children from both `directChildren(el, 'Code')` AND from an optional `<SubCodes>` element's children. This makes exports round-trip and improves real-file imports.

## 4. Image rename — new

- `src/App.tsx`: `renameImageWithPrompt(image)` reuses the custom prompt modal (`customPrompt`) and the previously orphaned `renameImage` logic to set `image.name`.
- `src/components/DocTree.tsx`: `DocTree` gained an `onRenameImage` prop; `ImageRow` renders a ✏️ button that calls it with `e.stopPropagation()` so it doesn't toggle selection.

## 5. Removed duplicate Images section

The left workspace panel previously showed images twice (once in `DocTree` per-folder, once as a flat "Images" list). Removed the flat list from `src/App.tsx` and the now-dead `.image-row` / `.image-thumb` / `.image-name` rules from `src/styles.css`. Images are only shown inside the document tree now.

## 6. Coded-region count badge

- `src/components/DocTree.tsx`: new `codedRegionCount` prop; image rows show a small badge (`.doc-coded-badge`) with the number.
- `src/App.tsx`: passes `(project.codedRegions || []).filter(r => r.imageId === img.id).length` for each image.

## 7. Color scheme — parent inheritance + palette

### `src/domain.ts`
- `CODE_COLORS` — 15-color palette constant.
- `randomColor(seedIndex)` — palette color by index (mod).
- New `colorForNewCode(codes, parentId, seedIndex)`:
  - If `parentId` → return the **parent's** color (subcodes inherit), so a code family reads as one color.
  - Else → `randomColor(seedIndex)` (palette-based, avoids 0-index bias).

### Applied at every code-creation site (consistent behavior)
- `src/App.tsx`: `addRootCode` / `addSubcode`.
- `src/lib/csvImport.ts`, `src/lib/docxCommentImport.ts`, `src/lib/qdpxImport.ts`. Note `qdpxImport.ts` uses the REFI-QDA file's explicit `color` attribute **when present** and falls back to `colorForNewCode` otherwise.
- Manual override remains: the codebook "Code Details" swatch picker (`updateCode(codebookCode.id, { color })`).

## 8. Per-coder colors on merge — `src/lib/merge.ts`

`buildCoderColorPicker(projectNames/coders)` assigns each coder a **stable** color: prefers unused palette colors, falls back to a deterministic hash color. When merge creates new root codes it colors the segment/code with that coder's color; subcodes inherit via `colorForNewCode`. Replaces the previous random-color assignment, so coders are visually distinct across merges.

## 9. Image viewer zoom controls — fix + step change

- **Fix:** the `−` / `+` / Reset buttons and the range slider were nested *inside* the Notes `<button>`, so any click also toggled the notes panel. They are now siblings of the Notes button in `.doc-title-row`.
- `src/App.tsx` state: `imageZoom` (default 1).
- **Steps:** buttons move by `0.1` (was `0.25`), clamp range `0.1 … 4` (was `0.25 … 4`); slider `min={10} max={400} step={10}` (was 25). Display = `Math.round(imageZoom * 100)%`.
- Applied via `<ImageEditor zoom={imageZoom} …/>`.

## 10. Reader font size + font family (Word-style) — new

**Goal:** change the center-panel document reading font on the fly; persisted per machine.

### `src/App.tsx`
- New state: `readerFontSize` (default `14`, clamped 8–48), `readerFontFamily` (default `''` = inherit). Each persists to/loads from `localStorage` (`qda-reader-font-size`, `qda-reader-font-family`) via `useState` initializers + `useEffect` writers (mirrors `readerTheme`).
- Header (next to Undo/Redo, after a divider): `<select>` of font families (`Georgia, Times New Roman, Arial, Verdana, Calibri, 'Courier New'` + "Font (default)"), `A−` (decrease 1), `A+` (increase 1), and a read-only `Npx` display.
- Passed to the doc editor: `<DocEditor … fontSize={readerFontSize} fontFamily={readerFontFamily} />`.

### `src/components/DocEditor.tsx`
- `Props` gained optional `fontSize?: number` and `fontFamily?: string`.
- Applied as inline `style` on the `.doc-editor` container: `fontSize: fontSize ? \`${fontSize}px\` : undefined`, `fontFamily: fontFamily || undefined`. The CSS default stays `font-size: 14px` in `src/styles.css` (`.doc-editor`).

## 11. LAN collaboration — new

**Goal:** let several users on the same LAN share one project and code together live.

**Design decisions (chosen with the user):** every accepted project state is a **full snapshot** with an increasing `seq`. The **host is the single source of truth** — it orders snapshots, assigns `seq`, and fans them out to connected clients. Live edits from any peer converge; concurrent edits are last-writer-wins. Rejoining peers send the last `seq` they applied; the host hands them only the newest snapshot (minimal transfer). Every peer persists its own full copy (`saveProject` upsert by `id` — never touches other project rows).

### New file: `electron/lan.cjs` (CommonJS, main process)
- `setupLan(ipcMain, { getWindow, saveProject })` — all LAN logic lives here (UDP via `node:dgram`, WebSocket via the `ws` package). The renderer only talks to it over IPC.
- Constants: `UDP_PORT = 8082`, `WS_PORT = 8080`, `CHUNK_SIZE = 500 * 1024`, `BEACON_INTERVAL_MS = 2000`, `HOST_PRUNE_MS = 6000`.
- **Host:** `startHost({hostName, password, project})` creates the WS server, then `startBroadcast()` beacons `project-beacon` to `255.255.255.255:8082` every 2 s (also to `127.0.0.1`). Handshake: `AUTH_REQUEST` → `AUTH_FAILED` (wrong password, then close) or `AUTH_SUCCESS` + chunked snapshot. `acceptDispatch()` bumps `state.host.seq`, stores the snapshot, and broadcasts `ACTION_DISPATCH` to every client except the sender; `state.host.log` (≤1000 entries) records who changed what. `broadcastPresence()` pushes the coder list to the host renderer and to all clients via `PRESENCE`. Clients that vanish (>close) are pruned from the presence list.
- **Discovery (3 layers, see Gotchas):** (1) UDP broadcast reception in `startDiscovery()` fills `hostsByKey` (pruned after 6 s of silence); (2) the broadcast socket answers `lan-ping` datagrams with a beacon straight to the requester (`pingHost` IPC, the "Find by IP" fallback); (3) `probeLocalhost()` opens a short `ws://127.0.0.1:8080` connection every 2 s and sends a pre-auth `LAN_HELLO`; the host answers `LAN_HELLO_INFO` — this is how two app instances on one PC find each other reliably.
- **Client:** `joinSession({hostIp, wsPort, password, coderName, projectId, lastSeq})` authenticates, receives `SYNC_CHUNK`s (index-keyed, reassembled, `JSON.parse`d), and calls `saveProject()` for dual local persistence. If `totalChunks === 0` the peer is up to date and nothing transfers. Live `ACTION_DISPATCH` messages received **during** the initial sync are buffered and replayed after `finishJoin`. Progress is pushed via `lan:syncProgress`.
- **IPC handlers:** `lan:startHost`, `lan:stopHost`, `lan:startDiscovery`, `lan:stopDiscovery`, `lan:pingHost`, `lan:joinSession`, `lan:disconnectSession`, `lan:sendAction`. Push channels: `lan:hostsUpdated`, `lan:sessionState`, `lan:syncProgress`, `lan:remoteProject`.

### `electron/main.cjs`
- `setupLan(ipcMain, { getWindow, saveProject })` wired in `whenReady` (passes the existing `saveProject` store function).

### `electron/preload.cjs` + `src/global.d.ts`
- `window.qv.lan` bridge (invokes + 4 `on*` subscriptions). New types: `LanRole`, `LanCoder`, `LanSessionState`, `LanSyncProgress`, `LanRemoteProject`, `LanStartHostConfig`, `LanJoinCredentials`, `LanPublishPayload`, `LanHostInfo`, `LanBridge`.

### `src/components/LanModal.tsx`
- Host/Join tabs, session password input, discovered-host list, join-password prompt, "Find by IP" field (`window.qv.lan.pingHost`), chunked-download progress overlay, connected-coder chips, and self-stop/disconnect buttons. Starts discovery on mount, stops on unmount.

### `src/App.tsx`
- `🌐 LAN` header button (+ `·Hosting` / `·Joined` badge). `handleRemoteProject()` applies remote snapshots non-destructively (restores previously open doc/selection after load) and toasts a diff (`[Coder] +2 coded passages, +1 code`). A debounced effect broadcasts the current project after local edits (`lan:sendAction`); the per-project last-applied `seq` is tracked in `localStorage` for delta rejoin. The name used for hosting is remembered via `localStorage`.

## Conventions & gotchas when extending
- Never call a renderer↔main bridge method without adding it in **all three places**: `electron/main.cjs` handler, `electron/preload.cjs`, `src/global.d.ts` (`QvBridge`).
- **LAN gotchas:** all networking lives in the main process (`electron/lan.cjs`) — the renderer never touches `ws`/`dgram` directly. On Windows, two sockets sharing `UDP_PORT` with `reuseAddr` deliver loopback datagrams to an *arbitrary* socket, so same-machine discovery uses the WebSocket `LAN_HELLO` probe, not UDP. Cross-machine UDP broadcast/unicast is unaffected. `lan:*` IPC channels are registered in both directions: `ipcMain.handle` (invoke) and `pushToRenderer`/event listeners (push).
- `importQdpx` is async — call with `await`.
- Image coordinates in the app are **normalized 0–1**; REFI-QDA uses pixels, so the converter (export and import) must know the real image dimensions (decode via `new Image()`).
- Offsets for text selections are defined against the document's raw content; keep `Sources/*.txt` identical to `doc.content` or offsets drift.
- `tsc` gate: `npx tsc -p tsconfig.json --noEmit` (run from `E:\Python tests\eQc`). There is no linter configured.
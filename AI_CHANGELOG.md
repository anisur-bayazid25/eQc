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

## 12. Auto-Code word-root matching, live preview, and app perf pass — v1.5.2

### Auto-Code matching modes — `src/lib/autoCode.ts`
- New types: `AutoCodeMatchMode = 'literal' | 'root'`; `runAutoCode(content, keyword, boundary, languageCode, matchMode = 'literal')` gained a `matchMode` parameter (default keeps old behavior).
- `findRootMatches(content, query)` — whole-word, order-preserving phrase matching against `[\p{L}\p{N}]+` tokens. **Word-boundary aware by design**, so it removes literal-mode false positives like `tree` inside `street`/`treehouse`.
- `roughStem(word)` — light English inflection normalizer (not a full stemmer): `-ies/-ied → -y`, `-ing/-ingly/-ers/-est/-ed/-er` with double-consonant collapse (`running→run`, `bigger→big`), sibilant plurals (`classes→class`, `boxes→box`), plain `-s` plural. Non-ASCII words (Bangla etc.) are returned unchanged so they fall back to literal whole-word matching.
- `isInflected(w)` + `wordMatches(queryWord, contentWord)` — allow derived forms sharing a long common root (`green` ↔ `greenery`) **only** when one side is clearly inflected and the other is the base form, avoiding over-eager prefix hits.
- `runAutoCode` now chooses the matcher first via `matchMode`, then applies the existing exact/sentence boundary logic unchanged.

### Auto-Code UI — `src/App.tsx`
- State renamed: the legacy `ac*` auto-code state was removed; single source is `autoCodeQuery` / `autoCodeBoundary` / `autoCodeLanguage` / `autoCodeTargetCodeId` / `autoCodeResultText` (the old duplicate set). New: `autoCodeMatchMode` and `autoCodePreview`.
- **Match-mode radio group** ("Literal" vs "Word roots & variants") in the Auto-Code tab; `handleRunAutoCode` passes `autoCodeMatchMode` into `runAutoCode`.
- **Live preview effect** (debounced 300 ms): for each doc it runs `runAutoCode` with current settings, filters out passages that already carry the target code (same dedupe key as the executor), and accumulates `{count, docs}` shown as "Would apply to **N** new passages across **M** documents (not yet applied)". Cleared when the query/target is empty.

### Codebook form performance — `src/App.tsx`
- New `DebouncedCodeText` component (input/textarea): keeps **local** state while typing, commits to the parent on blur/Enter or after a 500 ms pause. Replaces the direct `updateCode({name})` / `updateCode({summary})` `onChange` bindings, so typing no longer triggers a full app persist + re-render per keystroke. `useEffect` keeps local state in sync when the committed value changes externally.

### Memoized derived data (hook-order + perf) — `src/App.tsx`
- Precomputed count/index maps to replace per-render O(n) scans:
  - `flatCodes` (`flattenCodes`), `docsById` (`Map`), `codebookExcerpts`/`codebookRegions` (filtered once), `codeCodedCounts` (segment count per code) → drives `sortedCodes` (the Codebook tab sort, formerly computed inline inside the JSX).
  - `codedCountByDoc` / `regionCountByImage` → O(1) doc/image tree badge lookups; `codedCountForDoc` and the new `codedRegionCount` callback read from them.
- These are declared **before** the early `!project` return so hook order stays constant whether or not a project is loaded (the old inline computations moved out of the Codebook tab render).
- Doc segments memo `docSegments` used by `DocEditor`'s `segments` prop; excerpt rows now look up the doc via `docsById` instead of `find`.

### Other fixes
- **Prompt modal consolidation** — `IsolatedPromptModal` is rendered once at the app root instead of three times (workspace aside, codebook aside, codebook tree panel); `handlePromptResolve` drives all prompts.
- **global prompt** — the modal is now above the project-settings modal in the tree, and the previous duplicate/misplaced instances were removed.

## 13. LAN presence per-client role + session tab — v1.5.2

**Problem found in testing:** `broadcastPresence()` in `electron/lan.cjs` sent every client a `role: 'host'` payload, so the client UI rendered the host's "Stop Session" button and hid the Disconnect button.

- `electron/lan.cjs` — `broadcastPresence()` now builds a **per-client** `PRESENCE` payload: `role: 'client'`, `myName: <client's own coderName>` (from `state.host.clients`), plus new `hostName` (= the host's name). The host renderer still receives its own `'host'` snapshot unchanged. This is broadcast both on connect and on every presence change (coders join/leave).
- `src/global.d.ts` — `LanSessionState` gained optional `hostName?: string`.
- `src/components/LanModal.tsx` — new `initialTab?: 'host' | 'join'` prop (defaults `'host'`); opened session now starts on the tab matching the active session's role (`App.tsx` passes `lanSession.role === 'host' ? 'host' : 'join'`, so revisiting a joined session lands on Join). The "Connected to…" banner now shows `session.hostName || session.myName`.
- `src/App.tsx` — defensive client-role fix: `onSessionState` sets `role: 'client'` when `lanJoinedRef.current` (i.e. this peer joined), even if a host still runs an older build advertising `role: 'host'`; `lanJoinedRef` is set true on a successful join and cleared on start-host/stop/disconnect.

## 14. DocEditor segment lookup — `src/components/DocEditor.tsx`

- `segById` memo (`Map<s.id, source>`); rendering a chunk now resolves that chunk's segment ids via the map instead of `segments.filter(...)` per chunk — O(1) per row.

## 15. Project `updatedAt` marker — `src/domain.ts`

- `Project` gained optional `updatedAt?: number` — the last edit time. It flows through the LAN transport like any other Project field (host snapshots carry it), which is what makes the offline-edit detection below possible.

## 16. Handle client offline edits on LAN join — new

**Problem:** a client that worked on the shared project offline (at home) then joins the host session gets its local copy overwritten by the host snapshot — the home work is silently lost.

**Model chosen (with the user):** same project `id` ⇒ the local copy came from this host earlier. So "offline edits" = local `updatedAt` newer than the last confirmed sync point for that project id. A sync point (`qda-lan-synced-at-<projectId>`, localStorage) is advanced at **every** moment the local copy equals the session state.

### Sync-point tracking (App.tsx)
- `persist()` stamps `{ ...next, updatedAt: Date.now() }` centrally, so every local content edit advances the marker without touching every call site. Remote applications bypass `persist` (`setProject` + `saveProject` directly) and must NOT advance it — hence they don't.
- `undo`/`redo` stamp `updatedAt` too (they are local mutations).
- Sync points are set in three places:
  - `applyLanRemote()` — every accepted host broadcast (`r.project.updatedAt ?? now`).
  - the 200 ms broadcast effect — after `sendAction` resolves ok, the broadcaster's own edit reached the host (**critical:** otherwise editing *while connected* and reconnecting would falsely prompt "offline edits").
  - `applyJoinedState()` — when a join / conflict resolution lands.

### Detection + pause (App.tsx `handleLanJoin`)
- After `joinSession` resolves with a project snapshot whose `id` equals the currently-open local project:
  - `lastSyncAt = Number(localStorage['qda-lan-synced-at-<id>'] || 0)`, `localUpdatedAt = localProj.updatedAt ?? localProj.createdAt ?? 0`.
  - if `localUpdatedAt > lastSyncAt` → `setLanConflict({ hostProject, hostName, seq })` and **return without applying the snapshot**.
- While a conflict is pending, `applyLanRemote()` drops live host broadcasts for that project id (`lanConflictRef` guard) so incoming snapshots can't stomp the offline-edited local copy the user must still choose on.

### Offline Conflict Modal (App.tsx render, zIndex 11001 — above LanModal's 10000)
Three resolutions:
1. **Merge into Host Session (default)** — `handleLanConflictMerge()`: deep-clones the host snapshot (`JSON.parse(JSON.stringify())`; `mergeProjectInto` mutates its target), merges the offline project in as the source with `coderName: lanMyName` (so every incoming segment is attributable), stamps `updatedAt`, uploads via `window.qv.lan.sendAction` (host `acceptDispatch` fans it out to all clients and its own renderer), then `applyJoinedState(merged)` locally. On upload error the modal stays open.
2. **Save offline work as new project & join** — `handleLanConflictBackup()`: clones the local project with `id: crypto.randomUUID()` and name `"<name> (Home Backup)"`, `saveProject`s it, adds it to the list, then joins the host snapshot untouched.
3. **Discard offline edits** — `handleLanConflictDiscard()`: joins the host snapshot as-is.

`applyJoinedState(p, seq)` is the single landing routine (shared by the plain join path and all three resolutions): sets `lanJoinedRef`/`lanApplyRemoteRef`/`lastLanSeqRef`, writes seq + sync point, replaces the active project, prepends to the project list, switches to Workspace, clears the conflict.

### Gotchas for extending
- `crypto.randomUUID()` is used for the backup id (spec requirement); project ids elsewhere use `uid()` — both are plain strings, so no type impact.
- The deep clone is JSON-based because `hostProject` arrives over JSON transport (always serializable); do not assume `structuredClone` (tsconfig lib is ES2020).
- Detection is deliberately id-based: a *different* host serving a same-named-but-different-id project is treated as a fresh join (no prompt), per spec.
- Pre-existing DBs sync in without a stored `qda-lan-synced-at-<id>` (only v1.5.2+ wrote `qda-lan-seq-<id>`), so their first post-upgrade join may prompt once even without real offline edits; all three options are safe, and Merge is idempotent (dedupe on doc/code/span/coder).

## 17. LAN presence + coder attribution + coder-name disentanglement — v1.5.3

### LAN presence ("who is viewing what")
- `electron/lan.cjs`: clients tell the host which doc/image they're viewing via a new `SET_ACTIVE_DOC` message; `broadcastPresence()` includes each coder's `activeDocId` and re-broadcasts `PRESENCE` on view changes and on join/leave/heartbeat-terminate. Reconnect resync payloads are marked `quiet` so they restore state without a diff toast.
- `electron/preload.cjs` + `src/global.d.ts`: `lan.setActiveDoc(docId)`, `LanCoder { coderName, source, activeDocId }`, `LanSessionState.coders`, `LanRemoteProject.quiet`.
- `src/components/DocTree.tsx`: `PresenceDots` — one-colored dot per teammate viewing that doc/image (stable per-coder color hash), tooltip "Viewing: …"; the viewer's own name is excluded. New `lanCoders`/`lanMyName` props.
- `src/App.tsx`: doc/image select handlers call `setActiveDoc`; `DocTree` receives `lanCoders`/`lanMyName`; `onSessionState` diffs the coder roster and toasts the **host** when someone joins (roster cleared on session-end so a fresh host session never announces itself). `applyLanRemote` honors `quiet`.

### Coder attribution (who coded what)
- `CodedSegment.coder` / `CodedRegion.coder` stamped at **creation time** (manual segment, manual region, auto-code) using `activeCoderName` = the LAN session name while collaborating, else the project's **Coder Name** (Project Settings).
- **Coder filter dropdowns** (Workspace doc-tree panel + Codebook Excerpts header) drive `docSegments`, `codebookExcerpts`, `codebookRegions`; reset per project.
- **Attribution display**: codebook excerpt/region cards, the workspace click popup for text AND images, exports (scoped CSV/DOCX + Starred Quotes get a `Coder` column), and the manuscript skeleton.

### Coder-name disentanglement (stable attribution model)
**Problem:** legacy/imported segments had no coder stamp; display fell back to the *mutable* Project Settings name, so old items flipped to whoever was last saved and the coder filter couldn't capture them.
- `const UNATTRIBUTED_CODER = 'Unattributed'` (`src/domain.ts`) — untagged items display **only** this stable label (never the current project name) on cards, popups, skeleton, and exports.
- `matchesCoder(coder, filter)` (`src/App.tsx`) — untagged items match "Everyone" AND the **Unattributed** group in both dropdowns, so display and filter always agree.
- `src/lib/merge.ts`: removed the auto-backfill that stamped all of `target`'s pre-existing untagged segments with `target.coderName` each merge (the relabeling culprit). Merged-in segments still inherit their source's coder and now preserve `note`/`starred`.
- **Stamps are frozen at creation** — editing Project Settings Coder Name (or the LAN name, which now defaults to the project's Coder Name on load, still editable in the LAN dialog) affects only new codes, never existing ones.
- **Controlled migration**: Project Settings shows "Assign N Unattributed item(s) to this coder" (`claimUnattributed()`), an explicit one-click claim of untagged segments/regions with the entered name — the only code path that ever adds a stamp.

## Conventions & gotchas when extending
- Never call a renderer↔main bridge method without adding it in **all three places**: `electron/main.cjs` handler, `electron/preload.cjs`, `src/global.d.ts` (`QvBridge`).
- **LAN gotchas:** all networking lives in the main process (`electron/lan.cjs`) — the renderer never touches `ws`/`dgram` directly. On Windows, two sockets sharing `UDP_PORT` with `reuseAddr` deliver loopback datagrams to an *arbitrary* socket, so same-machine discovery uses the WebSocket `LAN_HELLO` probe, not UDP. Cross-machine UDP broadcast/unicast is unaffected. `lan:*` IPC channels are registered in both directions: `ipcMain.handle` (invoke) and `pushToRenderer`/event listeners (push).
- `importQdpx` is async — call with `await`.
- Image coordinates in the app are **normalized 0–1**; REFI-QDA uses pixels, so the converter (export and import) must know the real image dimensions (decode via `new Image()`).
- Offsets for text selections are defined against the document's raw content; keep `Sources/*.txt` identical to `doc.content` or offsets drift.
- `tsc` gate: `npx tsc -p tsconfig.json --noEmit` (run from `E:\Python tests\eQc`). There is no linter configured.

## Project-mixing bug: one LAN session is locked to exactly one project

**Bug:** while a host or client was in a LAN session, opening a *different* local project (workspace tab) allowed edits to that other project to be broadcast as the session project, and the client could end up applying/saving another project's snapshot over the session project (or replacing the renderer's screen with the wrong project).

**Root cause:** the host forwarded/overwrote whatever `project` arrived in an `ACTION_DISPATCH` to `state.host.currentProject` and re-broadcast it to all peers without verifying it was the project the session was created for; the client buffered/applied every received `ACTION_DISPATCH` without an id check; and the renderer broadcast the currently open `project` on every change while a session was active, without checking the session's project id.

**Design decision: the session carries a locked project id from the very first `AUTH_SUCCESS`, and every path — host accept, client receive/buffer/replay, client send, and the renderer's broadcast/apply — is gated on that id.** Defense in depth: each layer filters independently, and refusals are surfaced to the single offender via a new `REJECTED` push (client <→ host) instead of failing silently.

### `electron/lan.cjs`
- `startHost()`: new `state.host.sessionProjectId = currentProject.id` snapshot taken at session start. `broadcastPresence()` for the host renderer now emits `sessionProjectId` too, so the host UI knows the lock.
- `handleClientConnection` / `AUTH_SUCCESS`: responses now include `sessionProjectId` (plus the existing `projectId`) so the client gets the lock at handshake time, before any sync/dispatch.
- `acceptDispatch()` (host, routed by `applyPublish` for the host and `setupHost` message handler for clients — both now call the SAME `acceptDispatch` so client+host edits funnel through one reject gate):
  - New hard lock: `if (sessionProjectId && project.id !== sessionProjectId)` → send `REJECTED { reason: 'project-mismatch' }` to the offending sender and return `{ok:false, error:'project-mismatch'}`. It is NOT stored, NOT re-broadcast, NOT applied, NOT sequenced.
  - When accepted, behaviour is unchanged from before: `state.host.currentProject` is replaced and the dispatch is re-broadcast; disk writes happen in the renderer (`lan:remoteProject` → `applyLanRemote` → `saveProject`). The lock only *rejects*, it never re-routes.
- Client side:
  - `client.sessionProjectId` set on `AUTH_SUCCESS`. `.buffered` replay filter re-checks id in `finishJoin()` as defense-in-depth.
  - `ACTION_DISPATCH` receive: drop + never buffer if `msg.project.id !== sessionProjectId`.
  - `sendDispatch` (host) stays as-is: the host's own dispatch is by definition the session project.
  - New `REJECTED` handler pushes `lan:rejected { reason }` to the renderer.
- `applyPublish` (the invoke for a client's own optimistic publish): rejects with `'project-mismatch'` if `project.id !== client.sessionProjectId`. The host path still routes through `acceptDispatch` (and shows the renderer notification via `notifyHostRenderer`).

### `electron/preload.cjs` + `src/global.d.ts`
- `LanBridge.onRejected(cb)` added (same three-place convention). New `LanRejectedNotice { reason }` type. `LanSessionState.projectId` carries the locked id to the renderer (the wire `sessionProjectId` is handed to clients at `AUTH_SUCCESS`, both are equal).

### `src/App.tsx`
- New `lanNotice` state + `lanSessionRef` (ref mirror of `lanSession`, readable synchronously in the [dependencies-less] broadcast effect and `applyLanRemote`).
- `LanBridge.onSessionState` handler syncs `lanSessionRef` and clears the notice when the session ends.
- Broadcast effect: computes `sessionId = lanSessionRef.current?.projectId`; if the open `project.id` differs → sets a top-bar notice ("viewing a different project than your LAN session") and does NOT broadcast; clears the notice when the user switches back. The `sendAction` rejection of `'project-mismatch'` also sets the notice.
- `applyLanRemote`: before applying, ignores any snapshot whose `project.id !== sessionId` (sets the notice) — a stray snapshot can never replace the user's screen.
- `onRejected` subscriber: maps `reason:'project-mismatch'` to the same explanatory notice.
- Notice banner JSX rendered near the top of the app shell (dismissible).
- Host-only project-management while joined (`isLanClient = lanSessionRef.current?.role === 'client'`): `openProjectSettings` rename toasts+returns, `confirmDeleteProject` cancels the modal, header ✏️ rename button is disabled, and the modal's delete-confirm button is replaced by a disabled label.

## Host can disconnect a client from the session

**Goal:** while hosting, the host can remove one specific connected client (not just stop the whole session).

**Design:** every authenticated client connection gets a unique `clientId`; presence (`LanCoder.clientId`) carries it to the host renderer, which renders a small ✕ remove button next to each client chip. Kicking sends a `KICKED` message so the peer's UI can say *why* ("You were disconnected by the host") and then closes the socket with code 1000; the ordinary host-side `close` handler removes the peer and re-broadcasts presence.

### `electron/lan.cjs`
- `state.host.clientSeq` counter; on `AUTH_REQUEST` each client is stored as `{ coderName, activeDocId, clientId: "c<n>" }` (id not coderName — duplicate names are legal).
- `broadcastPresence()` includes `clientId` per client.
- New `kickClient(clientId)`: only when hosting; finds the peer by `clientId`, `sendMsg(KICKED, reason)`, then `ws.close(1000)`. `{ok:false,error}` if not found / not hosting.
- Client `ws.on('message')` new `KICKED` branch → `formalDisconnect(reason)` (clears session UI, toasts `LAN: You were disconnected by the host`) + `ws.close()`; the running `close` handler is inert because `state.client` is already nulled.
- IPC: `ipcMain.handle('lan:kickClient', …)`.

### `electron/preload.cjs` + `src/global.d.ts`
- `LanBridge.kickClient(clientId)` invoke (three-place convention). `LanCoder.clientId?: string`.

### `src/App.tsx` + `src/components/LanModal.tsx`
- `handleLanKickClient(clientId)` → `window.qv.lan.kickClient`, toasts on failure.
- Host view: each client chip gains a ✕ button (host's own chip has none) wired to `onKickClient`.

## 2026-08-16 — Unrestricted local editing during LAN sessions (calm UI + background sync)

**Goal (UX change):** LAN sessions are still locked to ONE project id (`sessionProjectId`), but that lock must never *force* anyone to stay on the shared project. Host and clients can now freely open/view/edit ANY local project while the session runs in the background; the previous alarm-style "project mismatch" warning banner is gone.

**Design:** the screen and the sync pipeline are decoupled. Only three threads care about the session lock, and all three were already correct (see "DO NOT TOUCH"): `lan.cjs` reject-on-mismatch in `acceptDispatch`, the client's pre-send check in `applyPublish`, and the renderer's broadcast guard. This change only re-routes what happen to a *received* snapshot and how the status is shown.

### `src/App.tsx` — status indicators (calm, persistent)
- **Project dropdown:** the `<option>` of the session's locked project is prefixed `🟢 ${p.name}` (emoji inside a native `<select>` is the robust cross-OS way), driven by `lanSession.projectId`. Visible even while a different project is open.
- **Header status chip** (`lan-status-chip`, new CSS in `styles.css`): a small non-clickable span next to the 🌐 LAN button. `isLanSyncedView` (open project === session project) → green `🟢 Synced`; LAN active but a different project open → neutral `⚪ Local only (not synced)`; no session → nothing rendered.
- **Banner removed:** the old dismissible `lanNotice` top-banner is deleted; all `setLanNotice(...)` call sites removed. A `REJECTED` `project-mismatch` (from `onRejected`) and a `sendAction` `project-mismatch` failure are now only `console.warn`ed — defensive fallbacks, never UI popups.

### `src/App.tsx` — background syncing in `applyLanRemote`
- Kept: `lanConflictRef` guard and the session-id lock (`r.project.id !== sessionId` → `console.warn` + drop, defense-in-depth).
- **Viewing the shared project** (`prev.id === r.project.id`): unchanged — set suppression flag, `setProject(r.project)`, `saveProject`, set seq + sync point, toast the diff.
- **Viewing ANY other local project:** `setProject` is NOT called (the user's screen is never yanked away). Only `window.qv.saveProject(r.project)` (silent disk write of the shared project's updated row) and `localStorage.setItem(seqKey, seq)` (keeps offline-edit delta tracking accurate) run. No tab change, no toast, no `setProjects` churn.
- The old `else` branch that used to force `setProject` + `setTab('workspace')` + `setProjects` on a cross-project snapshot is gone — that behaviour is now the background-sync branch.

### `src/App.tsx` — unrestricted switching + precise lock
- `handleSwitchProject`, `handleNewProject`, project loading: confirmed already unrestricted (no LAN gating) — left untouched.
- Lock narrowed from "any client session" to **only the session-shared project**: new `isLanSharedProjectLocked` (LAN client AND open project === session project) replaces the old `isLanClient` in all four places (`openProjectSettings`, `confirmDeleteProject`, header ✏️ button, delete-confirm button). A LAN client can now freely rename/delete their *other* local projects.

### NOT changed (security)
- `sessionProjectId` locking in `startHost`/`AUTH_SUCCESS`/client `sessionProjectId` store — untouched.
- `acceptDispatch` reject-on-mismatch + `REJECTED` push in `electron/lan.cjs` — untouched.
- Client `applyPublish` pre-send id check that refuses to broadcast a non-session project — untouched.
- Renderer broadcast guard (session project only) — the silent `return` remains; only the warning popup was removed.

## 1.5.5 — Bulk delete by coder, theme fix, compact header buttons

Three small but distinct changes; all renderer-only (`src/App.tsx` + `src/styles.css`).

### `src/App.tsx` — bulk delete by coder
- **`activeCoders` memo** (next to `unattributedCount`): unique `coder` stamps across `project.codedSegments` + `project.codedRegions`, filtered to drop `UNATTRIBUTED_CODER` (unattributed legacy data is deliberately not bulk-deletable), sorted `localeCompare`.
- **`handleDeleteCoderData(targetCoder)`** double confirmation: `customPrompt` (`Type the exact name "…" to permanently delete all their coded segments and regions.`) → `null` (cancel) or trimmed-mismatch ("Name did not match, cancelled") aborts. On exact match it counts `segCount`/`regCount`, builds `next` filtering `coder !== targetCoder` from both arrays, and calls **`persist(next)`** — which stamps `updatedAt: Date.now()` (LAN offline-edit tracking) and saves via `saveToDisk`. Toast: `Removed X segment(s) and Y region(s) for coder: Z`.
- **Project Settings modal UI**: "Manage Coders (Cleanup)" section under the Coder Name field + Claim Unattributed button; each row is name / `n seg · n reg` / small 🗑️ button. Uses `persist` (not raw `setProject`+`saveProject`) deliberately: one canonical write path, undo-history push, and the updatedAt stamping are all preserved. Deletion syncs to LAN via the existing broadcast effect (it is a normal content edit).
- **Modal scrollability**: the Project Settings `modal` div gained `maxHeight: 85vh; overflowY: auto; minWidth: 320px` — with the new section, un-scrollable tall content fell off short windows (made the Cleanup section unreachable).

### `src/styles.css` — dark-mode theme fix
- **Bug**: the Codebook "Sort by" select (and two other controls) used inline `backgroundColor: 'var(--bg-panel)'`, but `--bg-panel` was **never defined** (defined vars are `--bg`, `--panel`, `--panel-alt`, …). An undefined custom property without a fallback makes the declaration invalid-at-computed-value → background became transparent → near-invisible controls in dark mode.
- **Fix**: defined `--bg-panel` as an alias of `--panel-alt` in BOTH `:root,[data-theme="light"]` and `[data-theme="dark"]` blocks, so all existing inline `var(--bg-panel)` usages (sort select @ App.tsx ~3287, two other controls ~3074/3084) resolve correctly in both themes without touching the JSX.

### `src/App.tsx` + `src/styles.css` — compact Undo/Redo/Save
- Header buttons `↶ Undo`, `↷ Redo`, `💾 Save` → icons only (`↶`, `↷`, `💾`) with a new `.icon-btn-sm` class: `26×26px`, `padding: 0`, inline-flex centered, `font-size: 14px`. Tooltips (`title`) retain the affordance. `saveStatus` indicator span next to Save is unchanged.

## 2026-08-17 — CodeMap folding: root visibility + rolled-up semantics, persistent doc gutter

Work-in-progress session vs. the milestone "overview + drill-down code map"; three parts landed:

### Part A — shrunken-root force directives (semantics only)
- Backdrop `onDoubleClick` in a free area → **replace-mode force toggle** (`forceRootSearch = { keyword, mode }`). `detail` 1 → fixate shrunken root; `detail` 2 → re-run the search; `onContextMenu` (`detail` 2 on trackpads) → toggle-off ("restore"). No helper text added.
- Banner (`forceBanner` state) shows `Keyword: latest` / `Shrunken: first`, stickier when first set, rendered in the header row next to fold/clear buttons.
- All branches (main search, shrunken tags, `LegendPicker`, force banner ×2, clear, emit of new results) funnel into ONE `emitSearchForces()`/`forEachSearchCodeLeaf` pass, so every activation path keeps multiple droppable targets alive in sync.

### Part B — rolled-up (whole-subtree) semantics for folding
- `rolledUpCounts` + `maxRolledCount`: every code's total coded segments anywhere under it (via `descendantCodeIds`). `radiusFor(codeId, useRollup)` — folded root radii = subtree activity (a busy-grandchild root stays significant); expanded individuals keep their direct count.
- `rolledUpScores` + `rolledUpIntersection(childId)`: per-code sum of pair weights touching its whole subtree. The `visibleCodes` walk now ranks children by rolled-up intersection (tiebreak rolled-up count), filters out roots with zero coding anywhere, and the `childrenPerRoot` cap no longer applies to the root level (every non-empty root always renders).
- Fold badge redesigned: folded nodes show `+N subcodes · M coded` (caption under the label, clickable, doubles as expand affordance); expanded nodes keep `− N total · M shown` in the same caption style. The old +N circle pill is gone.

### Part C — persistent gutter markers
- `DocEditor` (the doc surface) gains a persistent gutter strip beside the code text, implemented like the search-match highlight: purely derived from `segments`, no interaction state, `pointerEvents: none`.
- `lineInfo` memo splits `doc.content` into line starts (binary-search `lineOf`), maps each coded segment to its start line, dedupes one marker per code per line. Average line height is measured post-layout (`useLayoutEffect` on `scrollHeight / line count`) so wraps/font changes stay aligned — no flicker (runs before paint).
- Marker = 3px vertical bar in the code's color + the code name clipped to a single bold line (`nowrap` + `ellipsis` inside a fixed 168px gutter, `minWidth: 0` flex). Multi-code lines join names with ` · `. Gutter anchors to the container via `position: relative` + `paddingLeft` on the text.

## 2026-08-17 — CodeMap fixes round 3 (8 scoped items)

### 1. Shrunken-root force-directive code — confirmed already gone
- Grep-verified: `forceRootSearch`/`forceBanner`/`emitSearchForces`/`forEachSearchCodeLeaf` and the backdrop force toggle do not exist in `CodeMap.tsx` (only unrelated force-directed *layout* comments remain). Nothing to remove; fold expand/collapse was actually broken by the click handler routing (see 2), not by the force code.

### 2. Expand/collapse on folded root nodes (the actual fix)
- `handleNodeClick` (`CodeMap.tsx`): a folded node with hidden descendants (`descendantsCache.get(id) > 0`) now toggles `expandedRoots` (click = add, click again = remove) and returns early — `onSelectCode` navigation only happens for leaf nodes. `movedRef` drag-vs-click distinction unchanged (drag never toggles).
- Node-level `onDoubleClick` toggle removed: with click toggling in place, a double-click would toggle twice and appear broken. Badge caption click (`toggleExpand` with `stopPropagation`) still works as the second affordance. Help text updated to describe click-to-expand.

### 3. Bulk Pull Child Summaries — verified already implemented, untouched
- `pullChildSummariesBulk(rootCodeIds)` in `App.tsx` (single `persist()` call, `additionsById` map; "No subcode summaries…" / "Pulled…" toasts) and `CodeTree.tsx`'s `onPullChildSummaries` prop + `⚡` button (only when `children.length > 0`) were both present and correct. The Codebook sidebar "▸ Bulk Pull Summaries" section (checkbox list of root codes, select-all/none, "⚡ Pull for selected") existed too. The single-code `pullChildSummaries` used by the Code Details ⚡ button was NOT modified.

### 4. Canvas orientation toggle
- New `rotateCanvas()` in `CodeMap.tsx`: swaps `canvas.w`/`canvas.h`, always through `rescalePositionsFor(newW, newH)` first (existing rescale+persist path — no shortcut that could crop nodes), then `setCustomMode(true)` + `setCustomW/H`. Toolbar button next to the canvas-size selector reads `⬜ Landscape` when `canvas.w > canvas.h`, else `▯ Portrait`.

### 5. Code Map tab stays mounted (state persists across tab switches)
- `App.tsx`: replaced `{tab === 'codemap' && (<div …>)}` with the workspace-grid pattern — the `.codemap-panel` div is always mounted, `style={{ display: tab === 'codemap' ? 'flex' : 'none', … }}`. Zoom/canvas/expanded-roots state now survives tab switches (enables 7's Escape handling off-tab too). Other tabs untouched.

### 6. Legend visibility fix + drag + kind filtering
- Root cause confirmed: the legend was `position: absolute` INSIDE the scroll container (which also had `position: relative`), so it anchored to the *scrollable content* — it rode the scroll/zoom and vanished at any non-default zoom or scroll.
- Restructured: an outer `position: relative` wrapper now owns (a) the legend as a sibling at `top/left: 12px` with `zIndex: 10` — fixed regardless of zoom/scroll — and (b) the scroll container (`position: absolute; inset: 0`). Legend also gained drag-to-reposition (`legendPos`/`legendDrag` state + window-listener effect, same pattern as node drag, purely local) and only shows rows for edge kinds currently present (`presentKinds` memo over `edges`; strength scale only when co-occurrence edges are on screen).

### 7. Fullscreen overlay (pure CSS, Electron-safe)
- `isFullscreen` state; when set, the panel's outer div gets `position: fixed; inset: 0; zIndex: 1000; background: var(--bg)` (+ padding). Toolbar button toggles `⛶ Fullscreen` ↔ `✕ Exit fullscreen`; a `keydown` listener (added/removed via the standard effect-cleanup pattern, active only while `isFullscreen`) exits on `Escape`. No native Fullscreen API.

### 8. Free-standing annotation layer
- `domain.ts`: new `MapAnnotation` interface (`rect | circle | arrow | text`, bounds/endpoint/label, `color`, `lineStyle`) + optional `Project.mapAnnotations?: MapAnnotation[]` (additive, no migration).
- `CodeMap.tsx`: `✏️ Annotate` toolbar toggle + shape sub-picker (rect/circle/arrow/text). Drag on empty canvas (`e.target === e.currentTarget` on the svg — never over nodes/edges) draws the shape via a window-listener drag effect with a live semi-transparent preview; release persists with ONE `onUpdateAnnotations([...annotations, anno])` call. `text` kind single-click opens a fixed-position inline input (`textPrompt`, ref-guarded Enter/blur commit, Escape cancels).
- Rendering: annotations layer sits between `</defs>` and the edges — below edges and nodes in z-order. Selecting a shape (click) opens a style bar (line style select + `COLOR_PALETTE` swatches + 🗑 Delete) mirroring the edge panel; edge/annotation selection are mutually exclusive. An `annoClickGuardRef` suppresses the svg-click selection-clear for the click that immediately follows an annotation drag, so a freshly drawn shape stays selected.
- `App.tsx`: `updateMapAnnotations(next)` — one `persist()` per user action (draw, style, delete), mirroring `updateMapEdgeStyle`/`addMapEdgeStyle`; wired as `annotations={project.mapAnnotations || []}` + `onUpdateAnnotations`.
- Export: annotations are plain SVG children of the cloned tree, so `serializeSvg()` and the SVG/PNG/JPEG export paths include them automatically (no export code changes needed).

## 2026-08-17 — Pull split (codings vs summaries), CodeMap stays put, code add/remove, export legend + 300 DPI

### Pull: coded segments/regions vs summaries — two distinct actions
- **⚡ lightning icon = pull CODED SEGMENTS + REGIONS** into the parent (`App.tsx` `pullChildCodings(codeId)`): every `codedSegment`/`codedRegion` whose `codeId` is a descendant of the code is remapped to the code itself (NVivo-style aggregation, full subtree via `descendantCodeIds`, self excluded). One `persist()` call for the whole remap, toasts show pulled counts. Wire-up: `CodeTree.tsx` prop renamed `onPullChildSummaries` → `onPullChildCodings` (title "Pull subcodes' coded segments and regions into this code"), passed to both `<CodeTree>` usages; the Code Details ⚡ is now "⚡ Pull Subcode Codings".
- **Pull CODE SUMMARIES** lives in the Codebook left panel ("▸ Pull Code Summaries", collapsed by default): root codes listed, per-code ⚡ calling the existing single-code `pullChildSummaries(codeId)` (untouched).
- **Bulk removed**: `pullChildSummariesBulk`, the bulk checkbox section, and the `bulkPullOpen`/`bulkSelectedCodes`/`bulkRootCodes`/`bulkDescCounts` states deleted entirely.

### Code Map: no more codebook navigation, add/remove codes from canvas
- `onSelectCode` prop removed from `CodeMap` (and its App wiring). Clicking a node no longer jumps to the Codebook. Leaf-node click now SELECTS on the canvas (`selectedMapCodeId`, blue ring highlight); folded nodes still toggle expand/collapse.
- New persisted project field `hiddenMapCodeIds?: ID[]` (`domain.ts`). CodeMap filters it up-front into `shownCodes` — every downstream computation (positions sync, visibility/fold walk, rolled-up counts/scores, descendants cache, edges, fold threshold) uses only the on-canvas set.
- Toolbar: `✕ Remove from map` (appears while a node is selected → adds to hidden set, one persist), `➕ Add codes` (popover listing hidden codes with per-row Add → removes from set, one persist each), both via App's `updateHiddenMapCodes` single-`persist` handler. Re-added codes get auto-placed by the existing auto-layout effect (missing positions check).

### Export: legend option + 300 DPI raster
- `serializeSvg(scale = 1)` accepts a pixel scale (width/height set to `canvas × scale`); when the new `Export legend` toolbar checkbox is on, it bakes the legend into the clone as plain SVG elements (line swatches + labels + weak→strong scale, white box, no CSS/foreignObject) so it rasterizes identically in every path.
- `exportRaster('png'|'jpeg')` now rasterizes at `scale = 300/96` (≥300 DPI at CSS 96dpi) — the SVG re-renders at the larger target size rather than being stretch-blurred. SVG export stays vector (scale 1).

## 2026-08-17 — lightning = COPY codings; summaries again in Code Details; left-panel "Pull Code Summaries" removed

- **⚡ lightning (tree rows) is now COPY, not move**: `copyChildCodings(codeId)` (`App.tsx`) duplicates every `codedSegment`/`codedRegion` belonging to a descendant of the code (new ids via `uid`, same codeId = the parent), leaving the originals in place — non-destructive aggregation. One `persist()` per action; toast reports copied counts. `CodeTree` prop renamed `onCopyChildCodings`, tooltip "Copy subcodes' coded segments and regions into this code".
- **Code Details Summary/memo button** (next to the textarea) now pulls subcode **summaries/memos**: label changed to `⚡ Pull Subcode Summaries`, calling the existing single-code `pullChildSummaries(codebookCode.id)`.
- **Left-panel "▸ Pull Code Summaries" section removed** (plus its `pullSummariesOpen`/`pullSummaryRoots` state) — that action lives only in Code Details now.

## 2026-08-18 — HTML Analysis report now includes ALL analyses (Framework Matrix, Word Frequencies, KWIC)

**Goal:** the "⬇️ HTML Report" button on the Analysis tab was missing several of the tab's analyses (no Framework Matrix at all, and no Word Frequencies / KWIC). Now the report mirrors everything on screen.

### `src/lib/report.ts`
- `buildReportHtml(project: Project, extras?: ReportExtras)` — new optional second arg.
- `export interface ReportExtras` — carries the Analysis tab's live state: `wordFrequencies?: Array<{word,count}>`, `stopWordsText?`, `kwicKeyword?`, `kwicWindow?`, `kwicResults?: Array<{docName, before[], keyword, after[]}>`.
- New sections (between Relationship Notes and Code Summaries):
  - **Framework Matrix**: root/theme codes as rows (`childCodes(project.codes, null)`), docs as columns, cells from `project.frameworkCells` (`docId::codeId` key), empty cells render a muted `—`.
  - **Word Frequencies**: numbered Word/Count table from `extras.wordFrequencies`, notes the stop-words text used; friendly hint if the user hasn't generated a list yet.
  - **KWIC**: Document / Pre-Context / Keyword / Post-Context table from `extras.kwicResults`, header states the searched keyword + context window; friendly hint if no search has been run.
- New CSS: `.note`, `.muted`, `.kwic-context`, `.kwic-keyword`. All dynamic text passed through `esc()`.

### `src/App.tsx`
- `handleExportReport(extras?: ReportExtras)` (`App.tsx`) passes extras through to `buildReportHtml`.
- `AnalysisTab`'s `onExportReport` prop typed `(extras?: ReportExtras) => void`; the `⬇️ HTML Report` button now calls `onExportReport({ wordFrequencies: wordFreqs, stopWordsText, kwicKeyword, kwicWindow, kwicResults })` — so the report includes the **last generated** word-frequency list and the **last run** KWIC search.

**Note:** Word Frequencies requires the user to click "Generate List" first (the list is held in AnalysisTab state, not derivable from the project), and KWIC requires running a search — the report falls back to a hint when either is empty.

## 2026-08-18 — KWIC: fix input/search state split + match count summary

**Bug:** the KWIC tool's keyword input was also the value the search logic read, so the search state was coupled to every keystroke. Now the text field state and the "actively searched" keyword are distinct, and the search only runs on explicit execution.

### `src/App.tsx` (`AnalysisTab`)
- State split: `kwicKeyword` → `inputValue` (the text field; `onChange` only calls `setInputValue`) and `activeSearch` (the keyword actually searched, set only by `runKwicSearch()`).
- `runKwicSearch()` no longer computes results inline — it just does `setActiveSearch(inputValue.trim().toLowerCase())`. The Search button `onClick` and the input's Enter `onKeyDown` both call it.
- The document-filtering logic moved into a `useEffect` keyed on `[activeSearch, kwicWindow, project]`: it runs **only** when a search is explicitly executed (or the window/project changes), never while typing. An empty `activeSearch` clears `kwicResults`.
- Results table: a summary line `Found {kwicResults.length} match(es) for "{activeSearch}"` now renders **above** the table (when `kwicResults.length > 0`).
- "No matches found for ..." now only shows when `activeSearch` is non-empty **and** `kwicResults.length === 0`.
- HTML report extras still map to `ReportExtras` via `kwicKeyword: activeSearch` (report.ts field name unchanged).

## 2026-08-18 — CodeMap "+ Add codes": no persistent panel when nothing to add

**Bug:** clicking `➕ Add codes` with every code already on the canvas opened the "Add codes to canvas / All codes are on the canvas." panel, which stayed on screen until toggled closed — looked like a permanent toast.

- `src/components/CodeMap.tsx` — the `➕ Add codes` button's `onClick` now checks `hiddenMapCodeIds.length` first: if `0`, it closes the panel and fires `onShowToast('All codes are on the canvas.', 2500)` instead of opening the persistent dropdown. Only when there are actually hidden codes does it toggle the panel.
- `src/App.tsx` — `showToast(msg, durationMs?)` now accepts an optional duration (defaults to the previous 3500ms), so callers can request a shorter auto-dismiss. `CodeMap`'s `onShowToast` prop type updated to `(msg, durationMs?) => void`.

## 2026-08-18 — Remove left-margin coding stripes (gutter) from the document editor

**Decision:** the Workspace document editor's left-margin strip (code-name labels + vertical 3px color bars per line) was visual clutter. Removed completely; text still highlights, right-side `DocumentPortrait` unchanged, click-to-menu still works.

### `src/components/DocEditor.tsx`
- Deleted `GUTTER_W` constant, the `lineInfo` memo (line boundaries + per-line marker set), the `gutterOn` flag, the `lineH` state, and the `useLayoutEffect` that measured line height.
- Removed the absolutely-positioned gutter `<div>` (left:0, width 168px, border-right) and its per-line marker rendering.
- Removed `position: relative` and `paddingLeft: gutterOn ? GUTTER_W : undefined` from the container style, so the text reclaims the full width — no empty left margin.
- Import cleanup: dropped now-unused `useState` and `useLayoutEffect`.
- **Untouched:** `buildChunks` / `<mark>`-style `<span className="coded-segment">` wrapping (background tint, `coded-segment`/`multi-coded`/`search-match-highlight` classes), segment `onClick` popup menu, drag/drop, selection tracking, scroll-to-segment / search-match jump effects.
- **Untouched (right side):** `DocumentPortrait` and its flex wrapper.


# AI Changelog — eQc desktop app


## 2026-10-09 — Release 1.8.0: profiles, time tracking and user-focused Help

- Selected 1.8.0 for additive profile/time, source-format, reader and reliability changes with existing project compatibility. Updated package.json/package-lock metadata, release notes, current guide and versioned guide snapshot.
- Cleaned both in-app Help books: removed the external NVivo reference/verification paragraph, other-QDA lists/comparisons, release-history notes and runtime/loading/storage details. Kept user operations, examples, export choices, import-file requirements, recovery/backup guidance, ICR/Consensus interpretation and actionable LAN setup. Consolidated repeated memo instructions and moved editable reader-size guidance to Reading. Easter eggs remain undocumented in user-facing Help and release notes; their details remain in this file.
- Release verification: 59 unit checks passed, including isolated SQLite migration/time merge, desktop main/preload handlers, HEIC conversion, resource cleanup and data-integrity cases. Production Vite/TypeScript build passed. Windows x64 NSIS packaging passed; app.asar verified version 1.8.0, profile/image-import handlers, notices and cleaned offline Help. Browser checks against the built bundle passed for Help, profiles, milestones, reader menus, inspectors, usability and hidden animations. Adjusted media test matching for production hashed asset filenames. Release workflow uses Node 24 for node:sqlite tests and runs the usability/data-integrity browser checks before packaging. User authorized commit, push and tag-release publication.

## Unreleased — inspector isolation and framework cleanup recheck

- Rechecked finding 7: App.persist already calls cleanResearchLinks, whose frameworkCells filter requires a live document and code. The actual deleteDoc UI regression verifies the deleted document’s cells are absent from the saved project; no redundant second deletion implementation was added.
- Fixed finding 10 with a project-id effect that clears segmentPopup/regionPopup and both inspector note edit ids/drafts. This covers project switches, imports, new/deleted-project replacements and LAN project changes, without resetting open inspectors on ordinary same-project saves. Popup rendering now uses only live coding ids and skips deleted entries instead of falling back to retained snapshots.
- Extended the data-integrity browser test to open each inspector, switch projects through the project selector without dismissing the popup backdrop, and assert the inspector is removed. Existing framework deletion checks remain.

## 2026-10-08 — Unreleased: external audit data-integrity fixes

- Fixed the reported source-view ribbon overlap: formatted-toolbar uses normal static flow for Word/PDF, reserving space above the source and scrolling with it. Formatted browser regression checks assert source starts below the ribbon and ribbon movement matches scroll distance in both viewers; coding/zoom/page navigation checks remain intact.
- Verified reported findings 2–8 against current code. App.deleteFolder moves all matching images to root, not just pdfPage snapshots, and reparents child folders to root. DocTree also displays legacy sources/folders whose folder parent no longer exists, allowing recovery without deleting retained data.
- csvImport generic Summary/Code Summary and Definition/Code Definition target child2 || child1 || parent. Explicit per-level fields keep their existing routing. Repeated real export/parse/import checks cover codesOnly and codesExcerptsSummaries.
- QDPX code Description goes to summary for legacy Project XML without code NoteRefs. Per-code NoteRefs retain Description as definition. QDC keeps standard Description definitions. Modern eQc exporters use the valid Project origin string "eQc; code descriptions=definitions" so definition-only codes remain definitions; older split-format eQc archives are detected once per import through code NoteRefs. Description-only external projects are inherently ambiguous; this follows legacy memo compatibility rather than claiming every vendor uses one meaning.
- CodeMap project-switch effect clears selectedMapCodeId/showAddCodes/drawSource/drawMode/selected annotation/editing annotation/text prompt/node drag. Remove from map is also guarded by membership in shownCodes.
- researchMerge maps only known source ids in cases/groups/annotations/memos/queries and skips annotations without a mapped document. Queries with any dropped filter (including exclusion/AND conditions) receive needsScopeReview; retrieveExcerpts fails closed, and Review shows a notice plus explicit Use reviewed filters before Run query. This avoids broadening formerly restricted or excluded searches when dead references are dropped. CleanResearchLinks retains the existing saved-query deletion semantics but now filters frameworkCells to live document/code pairs.
- Shared domain.normalizeCoderName trims for comparison and maps empty/whitespace stamps to Unattributed; icrCoderName delegates to it. Workspace/Codebook filter options and predicates, unattributed counts/claiming, cleanup counts/deletion, displayed attribution and research query options/results use the same helper. Existing attributed raw stamps are preserved; claiming changes only canonical Unattributed items.
- Finding 9 was stale for this checkout: usability-1.7.0 already contains proper Unicode button labels and passed locally. Added an optional EQC_BROWSER_CHANNEL and a Node-only temporary Vite runner. Tag-release workflow now runs data-integrity unit checks on both platforms and usability/data-integrity browser checks with Playwright Chromium on Windows before packaging. No Electron process is launched by browser tests.
- Validation: actual CSV round trips, missing-reference merges/deduplication/query safety, framework cleanup, canonical coder query/ICR unit checks; legacy/modern/QDC XML browser round trips and XSD validation; actual folder/document/coder/map UI regression checks; existing release/research/usability checks. No app build, push or release.

## 2026-10-08 — Unreleased: SQLite profiles, bounded time updates and memory optimizations

- Removed Small surprises and other easter-egg explanations from Help source books, public README and CHANGELOG. Profile & time is now guide section 13, with updated contents/link targets. Easter-egg implementation, assets, triggers and milestone details remain documented here; functionality is unchanged.

- electron/profileTimeStore.cjs installs research_profiles, research_time_sessions, research_time_days, research_milestones and research_profile_settings in the existing WAL database. Prepared session upserts retain cumulative maxima and validate immutable session identity; rollups update by deltas inside the same transaction. Profile metadata uses timestamp precedence; awards union earliest earned/latest seen. Photo is a separate column: old embedded photos migrate automatically, metadata edits omit unchanged photo bytes, and time ticks use light profile queries. Foreign-key deletion removes only that profile’s time/awards.
- profiles:open/write/select/create/delete/backup/validate/import and flush IPC added to main/preload/global bridge. Legacy localStorage registry/single-profile data transfers once, transactionally. A profile-time-before-sqlite.json recovery copy is written before migration; renderer removes old keys only after successful database acknowledgement. SQL errors never silently create a fresh profile. Desktop with a stale preload requires a full restart; localStorage adapter exists only for browser preview/tests.
- useTimeTracking now queues async IPC in order, loads metadata plus daily summaries for the active profile, and starts a fresh live-session engine. Writes contain only changed session records; acknowledged inactive records/fingerprints are released. Row lookup uses a Map. Inactive tabs do not receive five-second clock state updates; Profile still refreshes every five seconds. No complete history is held for inactive profiles. Full session records are queried only for JSON backup. Import validation occurs before project save; import/export await pending time writes. Profile switches pause the old session and disable controls during transition. Pending failure records remain available for retry; errors surface to the user.
- Normal window close requests a final renderer time flush and awaits the database acknowledgement. Failed/unresponsive saving offers Keep open or Close anyway; beforeunload/pagehide also send best-effort final deltas. Abrupt power/process loss can still lose unflushed seconds.
- ReaderFontSize groups decrement/editable number/increment in one row. Valid integer sizes apply immediately; Enter/blur clamps to 8–48 px, blank restores the last value, and the existing persisted size is reused.
- ToolMenu now caps height by available viewport space rather than feeding constrained scrollHeight back into maxHeight. Above-anchor positioning uses the resulting rendered height. Regression checks cover eight repeated Reading openings and expansion of the preferred-font form.
- Deferred panels load Profile, Research tools, Help, Code map, Image editor, export dialog and formatted/PDF viewers only when used. OCR PDF/tesseract import is deferred to OCR actions. Zoro asset preload happens only after workspace animations are enabled. Word export constructors load docx on first export; removed full-payload serialization/logging during export.
- OCR sends canvases directly to tesseract, avoiding full-page PNG/base64 duplicates; caps render surfaces at eight million pixels and releases canvases/pages/worker/PDF task on success or failure. PDF viewer caps pixel backing surfaces without changing CSS/text-selection coordinates and frees its surface on unmount. Image crop/export frees temporary canvases and decoded Image references. Original files and source coding offsets remain unchanged.
- Added 20/50/100 cumulative coding-hour awards (Gojo, Lucario, Saitama), extending the catalog to fifteen. Hidden designation command pikachu restores the prior role, immediately reveals all fifteen unlocked badges and scrolls the collection into view; no fake time is created. Unlock awards are marked viewed to avoid a forced fifteen-animation queue, persist per profile/JSON, and replay on badge click. Merging outstanding save replies cannot remove the optimistic unlocked collection.
- Checks: isolated SQLite migration/idempotent upserts/rollback/rollups/photos/award merge/deletion and 10,000-session fixture; real SQL bridge browser checks for localStorage cleanup, small writes, deferred assets, all-fifteen cheat replay and unchanged time/role/export/reload/profile isolation; OCR cleanup failure paths; formatted Word/PDF selection/regions/export; profile and milestone browser flows. A 10,000-session fixture returned three daily rows to the renderer; this is not a whole-app RAM benchmark on older hardware. No production build, Electron launch, push or release.


## 2026-10-08 — Unreleased: Profile milestone collection and preferred fonts

- milestones.ts derives permanent, profile-level awards from time records: cumulative active coding at 30/60/120/240/480/1200/3000/6000 minutes; five consecutive coding dates; every Sunday–Saturday week touching a completed month (partial weeks require coding within the month); all twelve months of a completed calendar year; and coding in 3/5/10/50 distinct project IDs. Actual coding actions count for dates/projects even before elapsed time is flushed; app-only time does not count. Date ordinals avoid DST streak errors. Weekly summaries also use Sunday–Saturday.
- Added default-false LocalProfile.workspaceAnimations and My details Bored aria-pressed toggle. JSON parsing restores explicit true only; existing profile merge metadata precedence applies. Latest-profile ref gates workspace surprise detection and confirmed-deletion animation triggers; profile/option changes clear in-flight animations and render guards hide them immediately. Other hidden interactions and milestone rewards are unchanged. Browser validation covers all three quiet-default actions with undo, opt-in, and isolated new-profile preferences.
- Character substitutions retain milestone IDs and earned/viewed state: Charmander has a flickering tail flame, Son Goku a waving pose, L a thinking pose with cake, and Howl’s moving castle walking legs and chimney smoke. Quotes updated to match.
- Replaced the earlier daily Jiji/Totoro reward with fifteen distinct original animated vector character illustrations: Charmander, Eevee, No-Face, Luffy, Psyduck, Satoru Gojo, Lucario, Saitama, Naruto, Son Goku, Catbus, Bulbasaur, L, Dragonite and Howl’s moving castle. Quotes are original. Reduced motion disables animation; badges remain static.
- StoredProfile optionally carries a milestone ledger (id, earnedAt, seenAt). Old profiles derive awards from retained records. saveStore evaluates eligibility even outside Profile. JSON parsing/merge unions award identities, earliest earned time and latest seen state, preserving awards across newer/older/repeated backups. Invalid/unknown entries are ignored; separate profile identities never share awards.
- ProfileMilestones queues unseen awards on opening; each auto-advances after ten seconds, supports Next/Close/defer/Escape, records only displayed awards as viewed, traps dialog focus and restores focus. Earned badges appear below both profile columns and replay individually. Profile switching remounts the queue. Milestone controls are exempt from the rapid-click Snorlax detector to avoid an unrelated popup during celebrations.
- Removed Reading's duplicate stripe checkbox; Workspace Codes & Strips remains. ReaderFontPicker adds/removes installed font names, persists preferred list under eqc-preferred-reader-fonts and uses the existing remembered reader-font-family selection; source Word/PDF formatting remains independent.
- Validation: milestone unit tests cover cumulative thresholds, project uniqueness, consecutive dates, partial Sunday weeks, leap months, completed years, permanent awards and profile/JSON merge isolation. Browser checks exercise all fifteen queued celebrations, defer/reopen/replay/automatic close, persisted seen state, new profile isolation, fonts, Workspace stripes, narrow layouts and reduced motion. No build, push or release.


This file is written for AI coding models/agents. It describes **what** changed, **where** (exact files and functions), **how** the code works, and **why** the design decisions were made. Use it to understand the current state before editing and to extend the features.

App: `electron/` (main + preload, CommonJS) + `src/` (renderer, React + TypeScript, Vite). Every renderer↔main call goes through the `window.qv` bridge (`electron/preload.cjs`), typed in `src/global.d.ts` (`QvBridge`). Persistence: one `Project` JSON object per row (see types in `src/domain.ts`). `tsc --noEmit` must stay clean.

- ResearchWorkspace notes section retains its internal ID but now displays Memos/Notes in the tab and Workspace menu; guide/test labels updated.

## 2026-10-08 — Unreleased: shared identity, multiple profiles and portable time

- useTimeTracking now stores ProfileStore version 2 under eqc-profiles-v2, migrating the old single-profile/time keys once. Active stored profiles own details, UUID, metadata updatedAt, lastWorkedAt and TimeRecord ledger. TimeTracker keeps stable record UUIDs while a foreground session accrues time, starts fresh records after relaunch/import/idle/pause/project/profile changes, and aggregates to daily/project rows for UI. Incremental exports of a live session retain its ID and grow monotonically.
- profileStore.ts validates portable version-1 ProfileBackup. mergeRecords unions UUIDs, takes maximum cumulative app/coding milliseconds for matching IDs, earliest first coding and latest last coding/end, and rejects contradictory identity/day/project/start metadata. mergeProfile matches immutable profile ID, preserves most recently updated details, keeps maximum last-worked timestamp and selects the result; distinct identities remain separate even when names match. No global last-worked cutoff discards independently recorded sessions. Parsing/conflict validation occurs before project import saves; import applies profile only after successful project save. Project payload is stripped of the personal researchProfile field before storing/broadcasting research data.
- ProjectExportDialog obtains a just-flushed active profile backup only for JSON; original/text document choices both retain it. QDPX remains profile-free. Profile has New/select/confirmed Delete, separate time history and last-profile blank fallback. Profile access moved from toolbar text to a circular 32 px top-right image/initials button matching the header logo; two responsive columns place time left and My details right. A centred 150 px portrait with upload/remove controls tops My details; header avatar remains 32 px.
- App saveUnifiedProfile/setIdentityName connects Profile name, Project Settings save and both LAN name inputs. Bootstraps legacy names only if no explicit local identity; profile switches propagate canonical name to future coding and editable local project coderName with 500 ms debounce. Existing text/region stamps stay untouched; guests do not overwrite host-owned shared project metadata. Active sessions use lan:updateName IPC/SET_CODER_NAME authenticated message to refresh own name/presence and reconnect identity. Host/client attribution history is not rewritten. Preload/main changes need a desktop restart.
- Hidden rewards have no goals/countdown/preferences or advance hints; Jiji/Totoro appear only after earned daily coding milestones inside Profile. Async photo processing cannot overwrite another selected profile; local calendar date can follow Today across midnight.
- Tests cover incremental/old/repeated backups, independent-computer sessions, immutable identities, last-worked/details precedence, malformed/conflicting data, switching/deletion, shared names, avatar/photo, responsive two-column layout and actual JSON export/import. All changes remain local: no production build, push or release.

## 2026-10-08 — Unreleased: Profile/time tracking and animation synchronization

- User approved active sessions with five-minute idle pause. timeTracking.ts is a pure local-calendar engine with per-day/project appMs/codingMs and firstCoding/lastCoding. Flush before activity/project/focus/pause transitions; split midnight; new coding required on a new day. Gaps over one minute are treated as suspended timer gaps and not charged. useTimeTracking persists rows/profile in versioned localStorage keys, listens to pointer/keyboard/scroll/focus/visibility, flushes every five seconds and on exit, reports storage failures. No time accrues between launches. Explicit App coding paths cover manual text, PDF/image regions, new in-vivo code, multiple codes and Auto-Code with new matches; imports, copied coding, annotations, undo/redo and LAN are excluded.
- ProfilePanel opens via a toolbar button sized for its text label; existing main navigation order stays unchanged. Optional name/email/designation/organization/photo (PNG/JPEG/WebP under 2 MB, downsampled to 256 px), dates/periods, totals/project tables, first/last action times, selected-period CSV, pause/resume, hidden time rewards. Time records/profile remain local and outside project backups/LAN; no historical reconstruction. At the user’s correction, no goals/countdowns/reward controls or advance hints are shown. Hidden daily coding milestones automatically show Jiji at 25 minutes and Totoro at an hour, only inside Profile.
- ZoroSlash preloads using Image (compatible with packaged file:// assets); unique query per instance restarts GIF. Image onLoad gates card/slash CSS and the full 1.5-second lifetime, with two-second still-frame load fallback. App onDone checks animation ID before clearing, so old cleanup cannot dismiss a newer deletion. Load/close timers clean up on unmount; reduced-motion stills retained. ZoroArtwork is superseded by this coordinated component.
- Jiji_Kiki_Sandwich_Surprise_5s.gif and first-frame PNG bundled; jiji replaces rabbit in workspaceSurprises, GrowingCodeTree and WorkspaceCritter. Thresholds are unchanged at more than five direct children at any depth. Jiji popup lasts five seconds on the code-panel/right side; Totoro remains beside sources/left. Snorlax remains near the clicked button.
- Tests: time-tracking.cjs covers idle, active restart, foreground/pause, switching, sleep/relaunch, midnight/year boundaries and local periods. profile-browser.cjs uses synthetic data for actual coding, local storage, totals/CSV/hidden milestones, pause, reload and responsive layout. Easter browser tests include delayed Zoro asset loading, fresh replay URLs and overlapping confirmed deletions. No build, commit, push or release.

## 2026-10-08 — Unreleased: code-tree and character Easter eggs

- Latest refinement: user-supplied Zoro (1.5 s), Snorlax/Togepi (10 s) and Totoro (10 s) GIFs are bundled in src/assets. GifArtwork uses picture/media sources with extracted first-frame PNGs for reduced motion; no remote assets. Totoro replaces the squirrel throughout Workspace triggers and the code tree, with a document-themed message. Zoro cleanup and card/slash CSS run for 1.5 seconds. Header logo needs five clicks; all brand-logo buttons are excluded from rapid-click Snorlax detection to keep hidden actions independent. Supersedes the earlier Zoro JPEG/SVG and Snorlax SVG designs; existing triggers, click placement and confirmation/undo behavior remain.

- User requested owl, rabbit, memo mushroom and Totoro, plus Poké Ball/header and Pikachu/contact animations; later asked for slower/better Pikachu. All work stays local, without build/commit/push/release or version change.
- EasterEggs.tsx renders hand-drawn SVG characters, a modal growing code tree (three About-logo clicks), five-click header Poké Ball/logo sequence, ten-second Workspace critters and a four-second email courier. PikachuArtwork.tsx has shaded yellow body, black-tipped ears, cheeks, zigzag tail, letter, independently animated feet/ears/tail and gentle trot. No remotely fetched character assets; Zoro uses the image supplied by the user, bundled locally.
- GrowingCodeTree uses codeTreeLeaves, one leaf per code in hierarchy traversal, with cycle/orphan protection. Branches render before leaves to keep labels legible; colour, full-name tooltips and selected definition/summary are read-only. Owl/mushroom cycle every 12 seconds only while the tree is open. Character buttons select other sayings. Modal traps Tab, closes on Escape/backdrop and restores focus; large codebooks scroll internally.
- workspaceSurprises compares before/after IDs only in local persist calls while Workspace is active. Rabbit requires a new code with >5 direct siblings under its parent; any depth works. Totoro requires an added source and >10 combined documents/ordinary images; PDF snapshots excluded. Initial loading, project switches, rename/reparent, incoming LAN updates and undo/redo do not trigger it. One message per kind per action, replaced on another triggering addition, dismissed after exactly ten seconds or manually; clear on tab/project changes. No animation state is persisted/exported.
- Further user request: five rapid clicks on one button within two seconds show PatienceSnorlax (“Calm Down!”) with the supplied Snorlax/Togepi GIF and a reduced-motion still frame, ten-second expiry/manual dismissal and twenty-second trigger cooldown. A single capture-phase click listener counts button/role-button elements; disabled buttons, programmatic/keyboard click events and its own dismiss button are excluded. At the user’s further request, its origin is the fifth click’s viewport position; useLayoutEffect measures the card, places it adjacent to that click, flips above near the lower edge and clamps horizontally. Resize repositions it within viewport bounds. Listener is removed on unmount; original button actions are not suppressed. Browser tests check exact expiry, dismissal, cooldown and normal Save calls, including simultaneous compatibility with five-click logo activation.
- Further user request: ZoroSlash.tsx uses coordinated GifArtwork playback, using the user-supplied Zoro_Sword_Slash_1.5s.gif, bundled as src/assets/zoro.gif, displayed without cropping or distortion with a curved slash and two falling halves of a labelled file/code/project card, 1.5-second cleanup, pointer-events:none, reduced-motion stills. App triggers only inside confirmed deleteDoc/deleteCode/executeDeleteImage paths and after successful deleteProject IPC. Existing deletion/cascade/undo flows remain; no file-system actions are added. Synthetic browser tests cover cancellation, all four deletion types and document undo; no real files/projects are deleted.
- Header/About click counters reset after five-second gaps, after firing and on project/tab changes. Header animation lasts three seconds. contact:openEmail is a fixed mailto target through preload/main shell.openExternal; no renderer-supplied URL. Pikachu completes its four-second run to the viewport border before one bridge call. Duplicate clicks are ignored until completion. The UI never sends mail. Main/preload changes require fully restarting the desktop process.
- SVG/CSS graphics scale at narrow windows, isolate courier motion in an overflow-hidden fixed layer and respect prefers-reduced-motion. About remains one information panel; Easter tree is a separate, deliberately opened dialog.
- Validation: TypeScript no-emit and three new trigger/tree unit tests plus real main/preload integration pass. Headless Edge checks sixth/seventh/nested code additions, mixed-source threshold, exact ten-second expiry, read-only tree leaves/definitions, responsive bounds, keyboard Escape, five-click activation, four-second contact delay/duplicate guard and reduced-motion mode. Captured and inspected tree/email visuals using synthetic project data; no Electron app launches or user research databases.

## 2026-10-08 — Unreleased: Help structure, Workspace tools and HEIC import

- User explicitly requested local edits only: no production build, installer, commit, push, tag or release in this update. Package version remains 1.7.0 until the next release is chosen. Easter eggs were subsequently explicitly requested and implemented as described below.
- HelpPanel imports current USER_GUIDE.md; v1.7.0 and older guides stay historical. Both bundled books start at Table of Contents, default-open; preface content moved into relevant project/Workspace/codebook/analysis sections. Removed redundant Help introductory prose. Search/read/expand controls remain. All document anchors are checked against heading slugs.
- Fixed greedy inline-link parsing: exclude closing parentheses from href, so sentence punctuation does not become part of Section 5.4’s target. helpSections.ts supplies Unicode slugs/section splitting. Help anchor navigation clears filtered search, opens the correct top-level section and scrolls to the target; repeated clicks have a visit counter. Browser tests cover actual subsection visibility, not merely string matching.
- Research tools moved from global Project tools to Workspace Sources toolbar, with direct actions for the five existing sections. Add source also exposes the existing handleCsvImport (dataset/codebook). Menu wraps below Add source/Search text to fit narrow sidebars. Existing research browser tests updated for the new location.
- ResearchWorkspace has collapsed section-specific practical examples. ICR and Consensus add collapsed purpose/workflow/example guidance; occurrence-versus-boundary comparisons, singleton/image exclusions and pre-adjudication export/checkpoint advice describe existing algorithms without changing statistics.
- imageImport.cjs unifies picker/drop format lists and reports per-file failures. BMP now works in both paths; HEIC/HEIF converts its main image locally to PNG via heic-convert 2.1.0 and libheif-js WebAssembly in a worker thread. Imports run sequentially; workers terminate on result/error/exit/120-second timeout. Electron and rendering threads do not run synchronous HEIC decoding. Converted PNG byte count and original photo name are stored; original HEIC bytes, metadata/extra frames/Live Photo videos are not retained. Existing coding/report/QDPX image paths consume the PNG normally.
- App excludes failed image records and reports omissions for both picker and drag-drop. Extension routing includes BMP/HEIC/HEIF; global bridge result types add optional ok/error for compatibility with existing mocks. Main-process changes require a full desktop restart when testing locally.
- New dependency license/source notices are packaged under assets/HEIC_THIRD_PARTY_NOTICES.md. Public libheif HEIC fixture is attributed under tests/fixtures/heic and excluded from app packages.
- Validation: TypeScript no-emit check; 10 regression tests (new Help/import tests, v1.7.0 exports/memos/counts/REFI tests and actual History bridge registration) passed. Real HEIC and uppercase HEIF sample conversion produce decodable PNGs and leave originals unchanged; invalid photos in mixed batches produce per-file errors. Headless Edge checks Help headings/search/links/tables, direct five-section Workspace navigation, 1366/1024/800/640 menus, ICR/Consensus examples, full prior usability and research workflows. No Electron desktop instances or user project databases are used.

## 2026-10-08 — v1.7.0: project export choices, research-tool refinement and offline Help

- Release includes the prior pending narrative Word export, retained originals/stable lines, schema-correct QDPX, formatted coding and eight research capabilities detailed below. Package/lock version is 1.7.0; the complete manual is USER_GUIDE_v1.7.0.md. Older manuals remain historical.
- Workspace Project tools opens ProjectExportDialog with JSON/QDPX and include-originals/text-only choices. projectForExport omits only doc.original immutably; images/PDF page snapshots and all research/coding records remain. Both paths use existing bridges and handle cancellation/failures.
- Unified Project tools Import accepts JSON or discriminated REFI payloads and creates a new project atomically after parsing/saving. projectExchange.cjs shares QDPX/QDC parsing with existing Codebook import and supports extracted QDE sources within the selected directory, without following symlinks. Invalid XML roots/JSON shapes and missing-source-only imports fail with actionable messages.
- Codes & Strips sits beside Portrait/Lines, remembers visibility and shares the reader toolbar's active styling. CodingMargin uses compact vertical labels and separate overlap lanes; hover/focus changes colour width from 4px to 7px without changing passage positions. Tooltips retain full names/coders.
- CodingMargin receives viewer colour tokens from THEME_STYLES, so label hover/focus does not inherit the global dark-app panel background when the reader is White or Paperwhite.
- Review retains simple code/source/text criteria first and places all secondary criteria under Advanced filters and combined queries. Refinement disclosure explains reassignment/splitting and each result exposes boundary adjustment.
- ICR replaces the Reliability label. scopedCoderCounts reports selected-source text/region counts; Consensus discloses assignment totals versus overlap groups and solo/joint groups. The statistics are unchanged. A regression reproduces 62 assignments + 6 regions, 30 groups and 1 joint group.
- listMemoRecords unifies all attached notes, annotations and standalone memos for selection/export/edit. Mixed merges create a new combined memo or retain a selected standalone destination, deduplicate research links, clear only selected attached memo fields and leave source/code/coding identities unchanged. Source/image drafts refresh on external memo edits.
- Notes adds individual copy and Word/CSV export, selected exports and confirmed standalone-memo merge. mergeMemos retains destination identity/purpose/creation date, appends other texts with titles, combines all links, updates the edit date and supports existing Undo. Embedded memos/annotations also expose copy.
- User-facing Help removes build metadata claims, developer architecture/test instructions and outdated screenshot references; Markdown renders links, lists and tables as readable controls/content. Implementation details remain in this AI change history.
- HelpPanel bundles the complete guide and DOCUMENTATION as local raw text, with safe React rendering, full-content keyword search, section disclosures and expand/collapse-all. Exact top navigation order is Workspace, Codebook, Auto-Code, Analysis, Code Map, Help, About. About remains a wide single panel and theme controls remain outside tabs.
- History main/preload integration is verified against isolated real SQLite without desktop windows. Attempted hidden Electron smoke tests encountered a local GPU-process startup failure and were stopped; their temporary profiles were removed. Packaged desktop launch validation remains a limitation on this machine.
- Validation includes TypeScript, source/export/schema/research/history regressions, synthetic-data browser checks for all research actions, formatted selection/region mapping and responsive layout, plus new export/memo/Help/stripe controls. Direct proprietary-app import and exact Microsoft Word pagination remain unverified; retained originals preserve their original bytes.

## 2026-10-08 — Unreleased: eight core research capabilities

- Optional Project cases/groups/annotations/memos/queries in domain.ts retain old-project compatibility. Case links use whole sources or half-open UTF-16 ranges; attributes are strings with validated numeric query comparison.
- research.ts scopes source/case/attribute/coder/star before OR, source-level AND/WITHOUT, intersecting text/image geometry and text character-gap proximity. Empty explicit/deleted scopes never broaden. Reassign/split/resize preserve IDs and metadata. Source edits relocate case/annotation ranges and retain unmatched notes/quotations as unlinked memos.
- ResearchWorkspace.tsx provides five keyboard-navigable sections, searchable disclosure pickers, case CSV import, saved queries, contextual/image review, case coding counts, bulk moves/splits, central notes, result/record exports and recovery. Query edits invalidate stale results. Restore first saves current state and a named checkpoint.
- App.tsx adds Project tools access, annotation/case/in-vivo/multi-code/boundary actions and optional Reading stripes. DocEditor.tsx/formattedCoding.ts render annotations without altering canonical text. CodingMargin.tsx measures marked spans with resize/mutation observers; PDF shows displayed-page text marks.
- researchMerge.ts/merge.ts/mergeCodes.ts remap research references and deduplicate repeat imports, preserving record coder stamps. persist cleans deleted links but retains saved-query references to avoid broadening. Undo is recorded outside updater callbacks. Code Map initializes missing positions in a batch; unchanged position patches are ignored.
- researchExport.ts emits CSV/escaped HTML/narrative Word research records; query-result DOCX uses existing source/code/excerpt reports and crops. report.ts includes research records. QDPX uses human-readable standard Notes plus a labelled versioned JSON Note with source/code/coding GUID maps (image rounding cannot break memo links); importer restores via mergeResearch. Third-party native cases/sets/queries are not claimed. Independent external REFI Notes import as standalone memos without an eQc appendix.
- electron/projectHistory.cjs installs SQLite activity/snapshot tables and records saves within the project transaction: actor/collection counts, latest 5,000 activity entries, ten automatic previous-state snapshots at ten-minute change intervals and retained named points. SHA-256 integrity/project-ID checks; main/preload/global bridge exposes history/checkpoint/readSnapshot. Project deletion removes local recovery data; shared backups do not include that database.
- Validation uses synthetic semantic/mutation/merge/export tests, actual SQLite close/reopen/rotation/isolation/integrity checks, browser coding/modal/export/recovery/layout and QDPX schema/roundtrip checks. No production build or Git publication requested.

## 2026-10-08 — Unreleased: formatted Word and original-page PDF coding

- `FormattedDocView.tsx`: lazy local DOCX rendering with pinned Apache-2.0 `docx-preview@0.3.7`; page styles/tables/lists/embedded images/headers preserved. Strip external relationships before rendering, disable HTML altChunks, disable hyperlink navigation, use embedded data URLs. Body-text DOM mapping excludes generated note references and header/footer text; styles are separate from coding text. Marks split text nodes without flattening tables/paragraphs. Fit width uses ResizeObserver, manual zoom stays selectable. Browser layout approximates Word pagination, not a Word-native layout engine.
- `formattedMapping.ts`: whitespace/case-normalized whole-document alignment via bounded jsdiff, retaining UTF-16 positions. Never locate a quote by first substring occurrence. Selections require every non-whitespace character mapped, monotonic positions and an exact normalized canonical substring; selections including view-only content fail. Stored excerpt text is always `doc.content.slice(start,end)`. `formattedCoding.ts` shares viewer props, DOM selection interactions and highlight decoration without a circular viewer dependency. Decoration uses an event sweep over segment boundaries to retain overlapping marks without scanning every segment per character. Existing hashes are verified before formatted text coding; altered originals remain viewable with text coding disabled.
- `PdfDocumentView.tsx`: bundled PDF.js 3.11 canvas/text-layer rendering, original page sizes/rotation, page navigation, fit/percentage zoom. One page canvas at a time, text data collected for whole-document alignment. Cancel render/loading tasks on changes; disable PDF evaluation. Text layers retain run positioning after highlight wrapping. Go-to-excerpt/search selects the corresponding original page after asynchronous loading. Scans expose Region and explain the OCR Plain text fallback.
- PDF regions store normalized rectangles in existing `CodedRegion`, with one PNG `ImageSource` per original/doc/page identified by a SHA-256 of original base64 bytes. Optional `ImageSource.pdfPage` metadata links parent source, page and original fingerprint. Snapshot creation and coding use one `persist` for undo. Further zooms reuse snapshots; replacement originals do not silently reuse outdated pages. Existing analysis/exports consume the page snapshots unchanged; QDPX represents regions as PictureSource/PictureSelection, not native PDFSelections. Merges match/remap page identities independent of snapshot resolution; document rename/move/delete maintain linked images/regions. Codebook Go to Image opens a snapshot, retaining standard image controls.
- `App.tsx`: remembered Original view/Plain text choice, shared code actions for formatted text/PDF regions, source-lines disabled in Original view, coder-filtered page marks. Workspace navigation targets survive tab entry so async viewer loading does not lose go-to-excerpt/search requests. Reading fonts remain for plain text; source styles/zoom control original viewing. No existing project/segment migration, version bump, production build or Git publication.
- Validation: `tests/formatted-mapping.cjs` and `tests/formatted-browser.cjs` cover repeated quotes, Unicode/table selections, header exclusion, actual persisted text ranges, PDF text/region coding, zoom/page switching, overlapping-capable marks/popups, asynchronous codebook navigation, source bytes, QDPX source/selection exports, page merge links, scans, edited sources and corrupt originals. Read-only `tests/formatted-reference-browser.cjs` checks supplied DOCX references without saving their data: Waterlogging sample 13,141/13,141 non-whitespace characters matched, 179 nonempty paragraphs accepted; ATLAS Word files 26,354/26,368 and 101,784/101,917 matched. Three and 29 differing paragraphs respectively are rejected safely. Browser screenshots of synthetic Word/PDF fixtures inspected. Existing export/layout/QDPX regressions and TypeScript checked.

## 2026-10-07 — Unreleased: source-first narrative Word exports

### QDPX compatibility and the first source-preservation stage

- `qdpxExport.ts`: namespace corrected from nonexistent `project:2.0` to `project:1.0`, matching the REFI-QDA Project XSD and supplied ATLAS.ti 26 export. Removes Project GUID and CodeBook GUID/name attributes and SubCodes wrappers. Empty Sources/CodeBook containers omitted; XML order follows the XSD. Sources use lowercase `sources/` and GUID filenames. Code memos are named Notes with embedded UTF-8 `.txt` files. Actual coder stamps become User/creatingUser references, and coding timestamps are exported. Unsupported image formats convert to PNG using browser canvas; regions remain positive/bounded. Corrupt hierarchies/coding/missing or undecodable sources produce explicit errors.
- `qdpxOffsets.ts`: bridges eQc UTF-16/exclusive ranges and standard Unicode-codepoint/inclusive ranges. `qdpxImport.ts` recognizes old eQc 2.0 ranges, resolves file-based Notes, preserves coder stamps, repeated text positions and separate coder assignments, and keeps repeat imports idempotent. Direct Code nesting and legacy SubCodes both remain supported. Electron import accepts `.qdc` directly, including the supplied ATLAS.ti `codebook:0:4` root. The reference files are read-only test inputs and are not committed to this repository.
- `OriginalSource` in `domain.ts`: optional `{name, format, base64, textHash, textChanged}` within SourceDoc. SHA-256 binds a retained original to the coding text at attachment. Optional storage needs no migration; current text offsets/IDs/persistence remain valid. `electron/sourceOriginal.cjs` captures exact bytes; normal/drop imports retain DOCX/PDF, scanned-PDF import uses `sourceOriginal.ts`, and Word-comment imports retain the original package. QDPX import retains DOCX richTextPath bytes and PDFSource/Representation bytes. Project merging transfers originals, including attachment to matching text-only documents.
- `App.tsx` Original menu: attach/replace without changing coding text; open a temporary copy in the OS viewer or save exact bytes. New bridge handlers in preload/main/global typings. Editing text updates original mismatch state; hash validation before QDPX export prevents stale original/text pairing. Unchanged DOCX uses richTextPath plus `.txt`; PDF uses PDFSource and a TextSource-typed Representation. Other applications may restrict PDF text coding (NVivo documents this limitation). This first stage kept coding in the text view; the user subsequently authorized formatted coding in the 2026-10-08 entry above.
- `sourceLines.ts` / DocEditor: logical CRLF/CR/LF lines retain exact characters; CSS-generated gutter numbers add no DOM text. Chunk boundaries include source-line boundaries, preserving overlapping coding/search highlights and multiline selections. Lines toggle persists locally. Source-line ranges appear on Codebook cards and excerpt CSV/DOCX; image excerpts have no text line range. These are coding-text line numbers, not layout-dependent native Word/PDF page lines.
- Validation: offline `tests/fixtures/refi-qda/Project.xsd` (unmodified schema with attribution/license), `tests/qdpx.cjs`, `validate-qdpx.py`, `qdpx-browser.cjs`, `source-lines.cjs` and `source-lines-browser.cjs`. Set `EQC_PYTHON` to a Python runtime with lxml; browser checks use the existing Playwright/Edge harness and Vite. Optional `qdpx-reference-browser.cjs` takes `EQC_ATLAS_REFERENCE` and `EQC_ATLAS_CODEBOOK` paths and runs entirely in memory. Supplied ATLAS files: 109 codes, 2 text documents, 139 codings and 2 retained DOCX originals, zero skipped, repeat import creates no coding, re-export is XSD-valid. NVivo itself has not been exercised on this machine.

- `src/lib/codeReport.ts`: pure typed `buildCodeReport` groups selected coding by source, full code path and excerpt. Preserves separate coder entries, source/code/excerpt memos, starred flags, document–code framework text in summary mode, image region metadata and uncoded codes. References follow text offsets or image positions. Codes-only lists source associations and counts without excerpts. Missing source references remain labelled. CSV uses the existing table builder.
- `electron/codeReport.cjs`: `buildCodeReportDocx` creates paragraphs only, with Word Title/Heading styles, black headings, muted 9.5pt attribution, 11pt body, preserved line breaks, cropped PNGs scaled within the page, source/region metadata and page numbers. No NVivo-style coverage or reference-path syntax. `safeFilename` preserves Unicode while replacing Windows-forbidden characters, handling reserved names and limiting length.
- `App.tsx` routes all Codebook scopes, Starred Excerpts and Starred Images through the new `codeReport` IPC payload; image crops attach to each excerpt. `src/global.d.ts` extends the existing bridge union; `electron/main.cjs` dispatches the new builder while retaining analysis table and manuscript outline builders. Codebook CSV/DOCX naming uses `codeExportFilename`: project plus explicitly selected code names, parent names when descendants expand, or All codes. Starred filenames use codes represented in the output and a suffix.
- README, current user guide, DOCUMENTATION and CHANGELOG updated. The changes are unreleased; package version and published RELEASE_NOTES remain 1.6.5. No app build, commit, push or release requested.
- Validation: `node --test tests/code-report.cjs tests/release-1.6.4.cjs` and TypeScript no-emit check. New tests cover grouping, scopes, selections, missing sources, filenames and actual OOXML order/content/embedded images/no tables. `tests/layout-1.6.5.cjs` additionally tests CSV naming, all codebook Word scopes, actual browser image crops and both starred actions; asynchronous exports wait for their bridge call. The reference DOCX was inspected read-only via OOXML. Packaged visual rendering could not run because LibreOffice is unavailable on this machine; Word page layout needs a visual check when a renderer is available.

## 2026-10-06 — v1.6.5: task-oriented layout and responsive map controls

- `App.tsx`: compact header groups Project tools and Reading while keeping the Light/Dark toggle and project selection/new/rename/LAN/undo/redo/save direct. Workspace groups Add source actions and collapses sort/coder controls. Codebook separates Details/Merge/Export/Import with `TaskTabs`; hidden panels stay mounted so local debounced editor drafts are retained. Shared searchable code selection feeds Merge and selected-only Export, and global exports sit in a disclosure. Opening a code from Workspace focuses Details. Existing data and export functions are reused unchanged.
- `TaskTabs.tsx`: labelled ARIA tablist/tab/panel relationships, roving focus and Left/Right/Home/End activation. `ToolMenu.tsx`: native details/summary; fixed-position panel bounded to viewport, above/below placement, resize/scroll repositioning, outside pointer/focus and Escape dismissal. Resize event targets may be Window, so contains checks guard with `instanceof Node`.
- Analysis navigation groups all eight views under Coding/Text/Team; long labels become short buttons with full titles. ICR/consensus scope uses a native disclosure with active counts, preserving selections and HTML report payload. About uses one responsive wide panel with every existing acknowledgment and link.
- `CodeMap.tsx`: all controls redistributed into View/Draw/Canvas/Codes/Export/Help menus. Fit is initially active and observes the viewport with ResizeObserver; hidden/zero-sized viewports are ignored. Manual zoom disables Fit; returning to Fit resets scroll. Canvas preset/fullscreen/window changes trigger fitting. SVG width/height now equal logical size × zoom rather than leaving a scaled-down but full-size CSS layout box, eliminating phantom scrollbars. Pointer math still divides screen deltas by current zoom. Node labels get a minimum screen font size and full-name SVG titles; export clone restores logical label font sizes. Label collision offsets stay below nodes. No project migration or persisted-coordinate changes are introduced by Fit.
- `styles.css`: remaining-height flex sizing, responsive sidebars, native disclosures/task tabs, focus styles, bounded tool panels, grouped analysis navigation and wide About. Standard desktop baseline fits; long data and narrow windows keep scroll access. Existing sidebar resizing remains.
- Version/package-lock, CHANGELOG, README, DOCUMENTATION, current USER_GUIDE and RELEASE_NOTES updated. Older manuals preserved.
- Validation: existing feature/DOCX regressions plus `tests/layout-1.6.5.cjs` synthetic browser harness (headless Edge/Playwright). Six viewports: 1920×1080, 1366×768, 1200×800, 1024×720, 800×600 and 640×480. Checks popup bounds, no desktop default-pane overflow, Fit/manual zoom/preset/fullscreen behavior, SVG logical export size, draft/selection retention, task keyboard activation, collapsed scope state, both themes and zero renderer errors.

## 2026-10-06 — v1.6.4: code consolidation, selected exports, image coverage and complete reports

- `src/lib/mergeCodes.ts`: pure immutable `mergeCodes(project, sourceIds, targetId)`. Requires an existing selected survivor; rejects ancestor-to-descendant merges to prevent hierarchy cycles. Removes merged IDs, reparents children, transfers text/image coding without deduplication (preserves coder/notes/stars), appends origin-labelled definitions/memos, coalesces framework cells by doc/code and relation notes by canonical pair, remaps map edges, drops self-edges and removed hidden IDs. Internal relation memos move to survivor summary. Annotations are unaffected. `App.tsx` confirms then calls the existing `persist` once for atomic undo.
- `App.tsx`: project-bound code selection, survivor selector, selected-only export and optional descendant expansion. Selection covers table CSV/DOCX, Starred Excerpts and Starred Images; project-wide QDPX/notes/manuscript retain whole-project scope. Codebook exports cover all coders independently of the excerpt-list coder filter.
- `src/lib/exportBuilders.ts`: removes redundant `full` scope; every mode has Document. Optional selected IDs filter output while ancestry resolves against the full codebook. Codes-only includes source lists, summaries and definitions. Excerpt modes include text and image regions, normalized coordinates, coder attribution, excerpt memo and uncoded-code rows. `imageRows` identifies zero-based row/column locations for embedding crops in DOCX. CSV escapes CR as well as LF/quotes/commas.
- `src/global.d.ts` / `electron/main.cjs`: table DOCX accepts optional `imageCells` (row/column, PNG base64, pixel dimensions), rendered as scaled ImageRuns. Outline image excerpts render independently of text quotes, fixing image-only manuscript entries. Existing export option labels are unchanged.
- `src/lib/report.ts`: extends ReportExtras with active ICR scope/coders/pair and cropped image excerpts. Recomputes statistics through existing `icr.ts` functions; includes pairwise contingency/per-code tables, Fleiss per-code, c-Alpha-binary per-code, Cu-Alpha, consensus summary and assignments. Consensus includes all scoped review statuses, excludes solo units and uses existing participant-based agreement; reports current state, not audit history. Includes an Image Coding table and source lists for code memos. Escapes user text and handles no-coder/empty-scope/undefined-coefficient states. KWIC distinguishes no matches from no search.
- Notes CSV adds Document and whole-image memos. About acknowledges CARE and BRAC James P Grant School of Public Health, BRAC University.
- Version 1.6.4 follows the existing 1.6.3 tag rather than replacing it. README, current user guide, DOCUMENTATION.md and release notes include earlier 1.6.0–1.6.3 ICR/consensus/definition/integrity features. Historical guides preserved.
- `tests/release-1.6.4.cjs`: Node test runner with a TypeScript transpile hook. Exercises the pure models and evaluates isolated Electron DOCX builders with docx/JSZip, verifying embedded media and image-only outlines.

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

**Historical rationale (corrected by the pending update):** Some legacy files nest subcodes inside `<SubCodes>`; standard REFI-QDA uses directly nested `<Code>` elements. At the time, `importCodeTree` only looked for direct `<Code>` children. Our own exports also use `<SubCodes>`.

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

## 2026-09-29 — Inter-coder reliability (ICR) / inter-coder agreement (new, additive)

**Scope constraint:** purely additive — no existing logic refactored or altered. Only a new lib module plus insertions in `AnalysisTab` (import, subTab value, nav button, panel section, memoized state).

### New file: `src/lib/icr.ts` (pure, no React/persistence)
- **Unit of analysis** — standard "code occurrence" agreement: one item = one (source × code) pair, where a source is a text document or an image. A coder marks an item present by applying that code at least once to that source (`codedSegments` for docs, `codedRegions` for images).
- `listIcrCoders(project)` — distinct coders with segment/region counts; unstamped items count as `UNATTRIBUTED_CODER` so nothing is hidden.
- `computePairwiseIcr(project, coderA, coderB)` — overall + per-code 2×2 contingencies (`bothYes/aOnly/bOnly/bothNo`), percent agreement, Cohen's κ; per-code rows sorted most-disagreed-first.
- `computeFleissIcr(project, coders)` — Fleiss' κ over all coders with binary present/absent categories (every coder rates every item, absent counts as a rating), plus % full agreement, overall + per-code.
- `cohenKappa(t)` returns `null` when undefined (no items, or Pe = 1); `kappaInterpretation` uses Landis & Koch (1977) labels; `formatKappa` renders `—` for null.
- **Verified:** κ math checked against hand-computed cases via the compiled module (pairwise κ = −1/3 on a bothYes=2/aOnly=1/bOnly=1/bothNo=0 table; Fleiss' κ = 0.25 on a known 3-rater case).

### `src/App.tsx` (`AnalysisTab` only, additive)
- `subTab` union gains `'icr'`; nav gains an "Inter-Coder Reliability" button.
- New memoized state: `icrCoders`, `icrCoderA/B` picks with fallback to the first two coders with data (`icrEffA/B`), `icrPair`, `icrFleiss` (computed only when ≥3 coders).
- Panel: Coder A/B dropdowns with item counts, pairwise summary (items = sources × codes, % agreement, Cohen's κ + interpretation), 2×2 contingency table, per-code table, CSV/DOCX export of per-code rows via existing `AnalysisExportButtons`, and a Fleiss' κ section (overall + per-code) when applicable. Empty states for <2 coders and same-coder picks.
- **Untouched:** report builder (`report.ts`), all other sub-tabs, `showToast`, persistence, domain types.

## 2026-09-30 — ICR scope + Holsti + Krippendorff (c-α / Cu-α) + Consensus adjudication + Code.definition

Follow-up to the 2026-09-29 ICR drop, same additive-only constraint (no existing behavior refactored).

### `src/lib/icr.ts` (extended, still pure)
- **Scope:** `IcrScope { docIds, includeImages }` + `defaultIcrScope(project)` (all docs + images = old behavior). `computePairwiseIcr` / `computeFleissIcr` take an optional scope; new `computeBinaryAlpha` / `computeCuAlpha` / `buildCodingUnits` take explicit coder/doc arrays.
- **Holsti:** `holstiIndex(t)` = `2·bothYes / (2·bothYes + aOnly + bOnly)` (joint absences excluded by design); `null` when nobody coded. Added to `IcrPairResult` + per-code rows.
- **Krippendorff core:** `krippendorffAlphaNominal(items)` — general coincidence-matrix nominal α = 1 − Do/De, nulls = missing ratings, `null` when undefined (<2 categories, no pairs, De = 0).
- **c-Alpha-binary:** `computeBinaryAlpha(project, coders, scope)` — per-code present/absent α + flattened overall α.
- **Overlap units:** `buildCodingUnits(project, coders, docIds)` — maximal overlapping-segment runs per doc (touching boundaries do NOT merge, same rule as co-occurrence). `CodingUnit { key, docId, docName, start, end, text, segmentIds, perCoder, agreed }`; agreed = every scoped coder coded the unit AND one shared code id.
- **Cu-Alpha:** `computeCuAlpha(project, coders, docIds)` — nominal α over primary-code-per-unit (`ICR_UNCODED` sentinel for partial coverage; multi-code units resolve to largest overlap, tie: earliest start, then code id). Returns units/alpha/full-agreement counts.
- **Verified:** 12 compiled-module checks pass — Holsti 2/3, binary α = 0.42424 on a bothYes=4/aOnly=1/bOnly=2/bothNo=0 table, Cu-α = 0.4444 on a 2-agree/1-disagree fixture, touching spans stay separate, partial coverage disagrees.

### `src/App.tsx` (`AnalysisTab` only, additive)
- Shared scope state (`icrScopeCoders/Docs: string[] | null` = all, `icrIncludeImages`) + `renderIcrScopePicker()` JSX helper (not a component, no remounts) used by both ICR and Consensus tabs. Pairwise A/B fall back to first two scoped coders.
- ICR panel: scope picker, pairwise (+Holsti summary/column/export), scoped Fleiss', c-Alpha-binary table + export, Cu-Alpha summary pointing at Consensus.
- **Consensus sub-tab** (`'consensus'`): All/Agreements/Disagreements filter with counts (disagreements first), per-unit cards (`excerpt-card` + green/amber border) with doc, char range, quote, per-coder code chips, `Keep {coder}` (disabled when sole coder), `Delete all`, per-segment ✕. `adjudicateUnit` → new `onDeleteSegments(ids)` prop.
- Code Details: **Definition** textarea above Summary/memo via existing `updateCode(id, { definition })` partial.
- New `deleteSegmentsByIds` (same persist path as inspector Remove → Ctrl+Z works), passed as `onDeleteSegments`.

### Definitions round-trip (`domain`, `csvImport`, `exportBuilders`, `main.cjs`, `global.d.ts`, `merge.ts`)
- `Code.definition?: string` (optional → old projects unaffected).
- `main.cjs` detects `definitionFields` (`definition` / `code definition` / `coding definition` / `definition of …` / `… definition`); `CsvParseResult.definitionFields`; `csvImport` routes them like summaries but first-wins (`applyDefinition`).
- `exportBuilders`: `codesOnly` gains `Definition of Parent/Child 1/Child 2` (per-level defs via `codeLevelDefinitions`); summary scopes gain `Code Definition`. Re-imports losslessly.
- `merge.ts`: reused codes fill empty definitions; new codes carry `sc.definition`.

## 2026-09-30 — Correctness pass: ICR integrity, delete cascade, merge completeness, qdpx definitions

Follow-up to the ICR work. Driven by a code review that surfaced 17 issues (5 bugs, 7 inconsistencies, 5 dead-code items); all are now resolved. Additive/isolated where possible; no existing behavior changed without a stated reason.

### B1 — `Unattributed` is not a coder (`icr.ts`, `App.tsx`)
`listIcrCoders` mapped unstamped items onto the literal name `"Unattributed"`, so the ICR panel offered legacy data as if it were a person. Comparing it against a real coder yielded a number that looked like agreement but was "legacy data vs. person"; worse, `CodingUnit.agreed` required *every* named rater to have coded a quote, so the phantom made every unit read as a false disagreement.
- `collectIcrCoders(project)` returns `{ attributed, unattributed }`; `listIcrCoders` now returns only `attributed`.
- `buildCodingUnits` filters `UNATTRIBUTED_CODER` out of the rater set defensively; `makeCodingUnit`'s `agreed` also rejects it explicitly.
- `App.tsx` renders an exclusion notice with the item count + pointer to "Assign … Unattributed item(s)".

### A1 — `deleteCode` cascade (`App.tsx`)
Now also prunes `frameworkCells` (by `codeId`), `relationNotes` (by either endpoint), and `hiddenMapCodeIds`. A stale hidden id made the `➕ Add codes` panel open empty instead of reporting "All codes are on the canvas." `mapAnnotations` is deliberately untouched — annotation shapes are not code-keyed.

### C1/C2 — Code Map drag correctness (`CodeMap.tsx`)
- **Label drag persisted per mousemove** (`commitStyle` inside `onMove`), violating the "one persist per action" invariant, and the first drag of an unstyled edge created a partial style row that silently pinned `lineStyle`/`curve`/`arrow` to hardcoded fallbacks. Now held in a local `labelLiveOffset` and committed once on mouseup via `derivedEdgeDefaults(edge)`, which seeds the row from the currently-rendered values.
- `annoMovedRef` was set on drag but only consumed on annotation click, so a drag ending elsewhere swallowed the next click. Now cleared on mouseup and on each annotation mousedown.

### B3 — Honest metric labelling (`icr.ts`, `App.tsx`)
`formatAlpha`/`formatKappa` alias collapsed into `formatIcrValue`. The kappa-specific name invited labelling Holsti's index (an uncorrected ratio) as a chance-corrected coefficient. `kappaInterpretation` is documented as κ/α-only; headers and the summary line now say `(chance-corrected)` vs `(not chance-corrected)`.

### A2 — Definition path resolution (`exportBuilders.ts`)
`codeLevelDefinitions` re-resolved the ancestor chain by *name*; two sibling codes sharing a name could resolve to the wrong branch. Replaced with a `parentId` chain walk plus a `seen` guard (a cyclic `parentId` previously hung). Comment corrected: the 3-column shape cannot carry intermediate levels past depth 3, so "lossless round-trips" was overstated.

### A3 — Removed duplicated passes (`icr.ts`)
`computeFleissIcr` and `computeBinaryAlpha` each walked every (source × code × coder) item twice (once per-code, once flattened). Now a single pass accumulates both. Verified against an independent implementation of Fleiss' formula.

### D1/D2 — Definitions reach every export path
- **DOCX codebook outline** (`buildCodebookOutline` + `buildOutlineDocx` in `main.cjs`): definition rendered as a bold `Definition:` run above the memo.
- **Notes & Memos CSV**: new `Code Definition` rows.
- **HTML report** (`report.ts`): memo blocks now show `Definition:` then summary; a code qualifies with *either* field.
- **Manuscript skeleton**: deliberately NOT changed — still memo-driven (per product decision).
- **qdpx** (`qdpxExport.ts` / `qdpxImport.ts`): the coding definition goes to the code's `<Description>`; the memo becomes a `<Note>` referenced by `<NoteRef>` inside a new `<Notes>` section (REFI-QDA's standard two slots — no custom markers). `resolveDefinition` / `resolveNoteMemo` split the import; sources and selections keep `resolveMemoText` since they have no definition field. Omitted `<Notes>` when empty. The malformed-XML guard now checks `documentElement.localName` instead of `querySelector('parsererror')`.
- **`csvImport.ts`**: `applyDefinition` returns whether it applied; `definitionsSkipped` added to `CsvImportSummary` and surfaced in the import toast (first-wins preserved, skip disclosed).

### E1 — Merge completeness (`merge.ts`)
`mergeProjectInto` now carries, with id remapping and per-item dedupe: image sources (matched by `dataUrl`), image coded regions, framework cells, relationship notes (canonicalised so A×B and B×A collapse to one note), and manual map edge styles. Conflicts *append* rather than overwrite. `mapAnnotations` / `hiddenMapCodeIds` are excluded as view-local. `MergeSummary` gained six counters; `handleMerge` clones the carried arrays so the mutating merge can't edit arrays still referenced by current state, and the toast lists carried artifacts only when non-zero. Region dedupe compares the *source project coder name* (matching the segment loop) — an initial version compared the region's own stamp and duplicated regions on every re-merge.

### F1–F3 — Cleanup
- ATLAS.ti attributions removed from app UI and `CHANGELOG.md`; REFI-QDA partner-tool mentions retained (legitimate).
- `domain.ts`: 7 `// ADD` scaffolding markers replaced with real docs; misindented `MapAnnotation.fontSize` fixed.
- Indentation fixes in `CodeMap.tsx` and `App.tsx`; stale `--- RESTORED TOAST NOTIFICATION ---` comment replaced with an accurate one.

### Verification
`tsc --noEmit` + `npm run build` clean. Compiled-module harnesses: 24 ICR assertions (incl. 5 regression pins for previously verified Holsti/κ/α/Cu-α), 21 exportBuilders assertions (cyclic-parent termination, same-name siblings, deep chains, scope gating), 24 Unattributed assertions (incl. empty-coder-list safety), 36 merge assertions (full idempotency, conflict-append, unmappable-reference skipping), 24 report/outline assertions, 33 qdpx assertions (round-trip, no-leak both directions, legacy-file compatibility, escaping). Encoding audit: no BOM/mojibake in any touched file — after an early PowerShell round-trip corrupted App.tsx's em-dashes, that file was reverted and all edits redone with the edit tool.

## 2026-09-30 — Consensus adjudication: agreement detection + solo-quote filtering

Two user-reported bugs in the Consensus sub-tab, both in the overlap-unit grouping. Reproduced in a compiled-module test before touching code.

### Bug 1 — agreement was almost never detected (`icr.ts`, `makeCodingUnit`)
`agreed` required `perCoder.length === coderOrder.length`, i.e. unanimity across **every coder in the scope**. With 3 coders, Ann and Bob agreeing on a quote Carol never touched was scored as a *disagreement*, so the Agreements filter was effectively always empty — the reported symptom.
```ts
// before: unanimity across the whole scope
agreed = rated.length > 0 && perCoder.length === rated.length && allCodeIds.size === 1;
// after: judged only over coders who actually coded this quote
const voters = perCoder.filter(p => p.coder !== UNATTRIBUTED_CODER && p.segmentIds.length > 0);
agreed = voters.length >= 2 &&
  voters.every(p => p.codeIds.length === 1) &&
  new Set(voters.map(p => p.codeIds[0])).size === 1;
```
A coder who never touched the quote now counts neither for nor against. A coder who assigned two codes to one quote can never be "agreed".

### Bug 2 — single-coder quotes listed as adjudication items (`icr.ts`, `App.tsx`)
`buildCodingUnits` returns every maximal overlapping run, including runs made of one coder's segments only — which then displayed as "Disagreement" via Bug 1. A solo coding is not an adjudication item (there is no competing version to keep or discard).
- `CodingUnit` gains `distinctCoders`.
- New `buildConsensusUnits()` filters to `distinctCoders >= 2`. `buildCodingUnits` is deliberately left unfiltered: Cu-Alpha needs solo units in its pool, since a quote a coder left uncoded is a disagreement there.
- `App.tsx`: `consensusUnits` filters on `distinctCoders >= 2`; `consensusSoloCount` is disclosed in the toolbar and in the empty state; each card shows its coder count.

### Verification
`tsc --noEmit` + build clean. 28 assertions: reported scenario reproduced (Ann+Bob differ, Carol absent), agreement detected for 2- and 3-coder cases, 2-agree+1-differs stays a disagreement with all three chips shown, multi-code coder not agreed, solo quotes excluded from Consensus but retained for Cu-Alpha (Cu-Alpha values byte-identical), Unattributed never a voter, solo-only project yields 0 items without crashing.

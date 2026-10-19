# Changelog

All notable changes to **eQc - Easy Qual Coding** are documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 1.8.7 - 2026-10-19

- Fixed Intel Mac packaging including an Apple Silicon SQLite binary. Build Intel and Apple Silicon installers in separate matching-architecture jobs; check the executable and native modules and exercise packaged SQLite in memory before creating the DMG.
- Verify both Mac disk-image checksums and combine update metadata before publication so separate builds retain both architecture entries.

## 1.8.6 - 2026-10-18

- Connected case/group/attribute/query selections and exact retrieved coding entries to graph generation; scoped word clouds use coded text.
- Added previewed case CSV import and matching export with stable identities, typed attributes and text/image/passage links.
- Standardized ICR statistic identifiers/names across results and exports, with disagreement and coded-only agreement details. Added review confirmations, disagreement evidence and linked methodological resolution memos.
- Added preserved named ICR runs, selectable in manuscript and HTML reports; later coding changes leave historical values intact. Conflicting imported comparison setups remain separately selectable.
- Added case × theme framework summaries with participant attributes, evidence navigation, Memo-Book integration and CSV/Word/HTML/manuscript export connections.
- Added structured REFI-QDA cases, variables and sets, an eQc research appendix, preservation inventories, research import reports and merge previews; retained graph drafts and remapped research links on merge.
- Aligned the ICR research cards and form controls with Comparison setup, including responsive coder checklists and collapsed saved-statistics tables.
- Moved routine LAN updates to a quiet ribbon feed; fixed session-switch cleanup and bounded queued messages.
- Prepared automatic Zenodo citation/README synchronization for future releases, starting with v1.8.6.

## 1.8.5 - 2026-10-18

- Added LAN announcements beside Profile: host-controlled posting permission, project-saved or session-only storage, author/host deletion, 30-second dismissible notices and per-profile unread counts.

- Added searchable single/multiple code selection for word clouds from coded passages, with shared text counted once and selections retained in settings/drafts. Fixed source links when an earlier document has no matching passages.

- Fixed chord ribbon curvature, connected label leaders, wrapped label spacing and number placement. Crowded numbers stay on their ribbons or are hidden with an explanation.
- Added direct line movement and endpoint editing across graph annotations, code relationships and topic links. Number labels support text editing and background colour/opacity controls; manual figure edits preserve calculated evidence.

## 1.8.4 - 2026-10-17

- Excluded generated installer/report files from the development watcher to avoid reloads and Windows file-lock errors during packaging.

- Fixed clipped Code map toolbar labels when extra code controls require vertical scrolling. Tool rails now reserve scrollbar space consistently, with aligned disclosure icons/text and responsive widths.

- Added a co-occurrence network with connected-group, circle, projected-sphere, spatial 3D force and chord presets. Node appearance independently supports shaded balls, flat circles and text-only labels. Added count labels, weighted links, source evidence, coder/scope controls, filters, drafts and figure export.
- Added counted co-occurrence presets to heat maps and Sankey, sharing the same direct-text-code calculation for overlapping range pairs or shared documents. Documented counting units, pooled-coder deduplication, matrix symmetry, chord endpoint totals and non-directional Sankey pair weights.
- Prioritized Code map, Co-occurrence network, Sankey and Word cloud in the first visualization row; moved Mind map to the next row.

- Fixed QualCoder QDPX imports failing on undated notes and duplicate journal titles by including creation dates, author references and unique note titles in project and codebook exports.

- Added resizing of existing coded image regions using corner/edge handles, with Save/Cancel, Escape, zoom-aware image bounds and Undo/Redo. Coding identity, coder attribution, notes and stars are retained.

- Added Linux x64 AppImage and Debian/Ubuntu deb packaging to the release workflow alongside Windows and macOS. Linux uses its PNG application icon and reports the correct platform in manual update notices. Linux packages require validation on real Linux desktops.

## 1.8.3 - 2026-10-17

- Required sender name and email for all feedback, with profile prefill and validation in the app and generated hosted script. Sender name is included in the report; existing rate limits remain. The Apps Script deployment must be updated to enforce the new name requirement.
- Switched the default feedback backend to Google Apps Script for a zero-budget setup without a website/domain. Added a single paste-ready script, quota/rate limits, duplicate protection, conservative uncertain-send handling and Google response-redirect support. Live delivery requires the owner's one-time deployment and public URL.
- Added Feedback in the toolbar/Help and Ctrl/Cmd+Shift+B, with profile-email prefill, screenshot capture/attachment preview, optional device details, direct-send handling and offline report ZIPs. Prepared a hosted email service; live sending requires service activation.
- Reworked HTML reports with all selected ICR coder pairs, saved comparison statistics/settings, calculation help, selected draft graph figures and optional visualization notes. Added contents navigation, collapsible/searchable tables, collapsible code summaries, research records grouped by type, and print expansion.
- Added a Starred Quotes download beside the half-width Starred Images button, with manuscript attribution or full document/code/case details in Word.
- Added ICR comparison units and methods, compact summary cards, expandable/searchable/paginated tables and calculation guidance linked from ICR to Help. Manuscript statistics preview/copy is available only in export options.
- Simplified manuscript content with case-based italic quote attribution, optional framework/co-occurrence memos and separate case attribute fields. Added draggable visualization notes with independent draft snapshots and Memo-Book access.

- Clarified that scanned-PDF OCR uses Bengali/English only, and that media encoding, retained sources, PDF page images and repeated full JSON backups require storage beyond the app installation allowance.

- Reorganized visualization tools into a consistent common set, with Shapes inside Draw, a fully labelled Text button, one Legend control and graph-specific code-node controls.
- Added Heat map Inspector controls to hide all-zero rows/columns and swap axes while retaining heading edits, added objects, palette and source links. Added optional zero-assignment code filtering to Histomap without removing periods or gaps.

## 1.8.2 - 2026-10-16

- Made document-deletion framework cleanup explicit and verified other documents' cells survive, with Undo/Redo restoring/removing the deleted document's cells correctly.
- Removed the duplicate blank-canvas mode from the Code map designer; use the dedicated Blank canvas visualization.

- Fixed whitespace/blank coder filtering consistently across Heat map, Sankey, Histomap and Dendrogram, without rewriting original attribution.
- Kept visible legends through graph regeneration and named-draft loading. Working-view saves now update the local edit timestamp without adding Undo entries; deleting a project removes its LAN tracking keys.
- Completed the Muse Spark audit follow-up, removed unused artwork/type exports, and added browser regression coverage to the CI runner.

- Added minimum/recommended system requirements to the README and both offline Help Overview sections, with provisional hardware estimates and clarification of OCR downloads.

- Added profile-picture pan/zoom, keyboard positioning, reset/cancel and later readjustment, with matching header framing and SQL/JSON persistence.

- Polished the visualization Inspector with labelled font/style/colour groups, consistent control sizes, collapsible direction/rotation and stop-list import, and formatting above word exclusions.
- Prevented in-progress word-cloud updates from overwriting newer canvas edits. Exclusion updates retain individual word styling and remap attached links when word order changes.
- Fixed SVG source metadata respecting document limits above 24, unclear saved-font labels, and invalid-language feedback. Updated beginner help and stale canvas-resume checks.

- Fixed blue primary-action button text contrast throughout light mode, including visualization, research tools and dialogs; retained dark-mode colours.

- Organized Histomap and Dendrogram settings into Prepare data, Choose display and Generate, with live readiness checks for missing periods, conflicting assignments, coding coverage and clustering limits. Heavy graph generation remains explicit.

- Balanced the visualization library into a centered four-by-four desktop grid, with Word Cloud/Sankey in the first row and Histomap/Dendrogram in the last. Smaller screens use two columns.

- Fixed Word Cloud Apply Changes and font-size refitting restoring deleted headings or overwriting edited captions. Existing heading styles and added objects are retained.

- Added uniform-size word clouds alongside frequency scaling, plus automatic local repacking after individual font-size edits with retained size overrides.

- Replaced unreliable native number-suggestion dropdowns with visible, keyboard-accessible preset buttons across visualization limits, retaining custom numeric entry.

- Added Sankey with five weighted-flow/path presets, editable bar-relative labels, boundary spacing, gradients and explicit input requirements.
- Added Word Cloud with shape/PNG/SVG masks, seeded random organic shapes, overlays, glyph-based spacing/density and language-aware filtering shared with word frequencies. Stop words live in the right Inspector with an explicit Apply Changes button.
- Added lightweight imported language profiles, shared text direction/rotation and palette-order inversion. Word-cloud exclusions survive tab navigation; regeneration retains the selected palette.

- Added a 21-item standard drawing gallery in Shapes, with drag previews, Shift-constrained dimensions, editable labels and existing colour/group/draft/export support.
- Replaced reused visualization gallery icons with 14 distinct diagram-specific SVG icons.

- Added named project palettes based on existing presets, including scientific Viridis/Magma/Plasma/Inferno/Cividis ramps and additional categorical schemes.
- Added multi-selection, marquee selection, grouping/ungrouping, shared moving/resizing, centering/alignment and front/back ordering for shapes, text and code nodes. Groups/layers are retained in drafts.
- Added custom numeric code/theme/subcode/document/context/label limits alongside suggested values, with larger graph sizes and explicit matrix/clustering bounds.

- Added 17 coordinated visualization palettes, including colour-blind-friendly, grayscale, monochrome and muted multicolour choices; expanded colour pickers with 60 theme shades, 12 standard colours and recent colours. Heat-map scales remain sequential; all shapes and arrows retain individual colour controls.
- Leaving Visualization or opening a source now retains the working canvas and its view/legend settings while unloading the renderer. Returning resumes editing without requiring a named draft.

- Added guided histomaps (ordered passage/document period tags, unique counts/shares, explicit gaps) and average-linkage Jaccard dendrograms for documents/codes. Both retain source links, editable drafts and vector/image export.
- Centered the canvas and moved tools to a left rail and formatting/sources to a collapsible right Inspector. Fixed the pyramid to use one continuous triangle with a three-vertex apex.
- Revised the fictional climate dataset to 239 uneven sentence-level coding entries across three coders, four event phases, ready-made statistical drafts and an auditable period CSV. Refreshed derived analysis, coder projects and the demo ZIP.

- Replaced the shared sparkle/designer action with type-specific âš™ settings; removed the duplicate Pause button. Library/tab navigation unloads visualization automatically, and cancelling settings preserves the canvas.
- Reviewed all visualization types against the four-transcript, three-coder climate demo. Improved theme coverage, compact hierarchy panels, wrapped process flows, branch routing, heat-map labels/scales, journey guides, Venn overlap labels, honeycomb tiling, ecology keys and typography. Heat maps default to deduplicated passage counts with explicit coder/count-unit choices; word trees can use full documents or merged coded passages.
- Added physical SVG print width, print text/DPI checks, descriptive export filenames and accessible method/source metadata. Added Help explaining histomap time data and dendrogram similarity/clustering requirements.

- Renamed Code Map to Visualization and added a responsive square-card library. Added dynamic mind maps, hierarchy layouts, selected-source heat maps and phrase word trees; editable sequence/cycle/branching process, rated journey, pyramid, Venn, honeycomb and ecology presets. Generation is explicit; drafts retain type/settings and exports share the canvas editor. Data cells/contexts link to sources, and connected diagram arrows follow moved blocks.

- Added editable legends: full wrapped labels, in-place title/entry editing, fonts/colour/emphasis, movement, resizing, entry ordering/hiding, removal, columns and reset. Drafts and exports retain legend edits and layout.

- Map text now edits in place by double-click and saves on click-away. New text starts with a drawn text box. Added resize handles and automatic wrap/shrink-to-fit for node, annotation and link-label containers. Unified formatting into a compact icon toolbar and removed duplicate controls; Delete removes selected map annotations outside typing fields.
- Legends now follow visible node shapes/colours and rendered relationships. Added image-resolution choices with proportional text/legend scaling and output-size limits.

- Added discoverable text/font editing for code labels, relationship labels and all map annotations/topics, with reader fonts, size, colour, bold, italic and underline. Map-only labels and explicit code renaming are separate. Added colour pickers, hex entry and generated palettes for text, node fills/borders, links and annotations.

- Active maps now support mouse-wheel zoom anchored at the pointer, Ctrl/Cmd plus/minus and Ctrl/Cmd+0 to fit. Zoom shortcuts stop when the map is paused or the tab is left.

- Code Map now requires explicit activation on each tab visit/project switch. Pause or leaving the tab unloads the map engine. Added named map drafts retaining geometry, styles, annotations, code references and view/legend settings; drafts travel with project JSON backups.

- Added editable Simple and Detailed code-map suggestions with previews, theme/subcode limits, topic labels, pastel branch colours, wrapped oval nodes and limited shared-document links. Added a blank manual canvas, code search and node styling/details/memo tools. Designs save as one undoable change without changing codebook colours or coding.

- Fixed annotation deletion: empty saves remove the annotation and underline, and existing empty annotations can be found and deleted in Memo-Book. Memo editing now opens inside its entry. Clicking a source annotation focuses its exact Memo-Book entry, including later pages and formatted readers.

- Added Word-style keyboard selection in plain and formatted text readers.
- Made coding faster in large codebooks by deferring hidden Code Map graph refreshes, reusing the code tree, and avoiding redundant annotation filtering. Saves return a small acknowledgement and compare history records without repeated JSON serialization.

- Reordered both Help books to follow Workspace, Codebook, Auto-Code, Analysis, Memo-Book, Code Map and About, then LAN, Profile/time, file support and keyboard shortcuts. Updated contents and section links.
- Added selectable, descriptively named shortcut profiles: Standard, Coding bar, Quick coding, Numbered codes and Selection-first. Supported actions include quick/last-code coding, in-vivo coding, annotations, linked memos, imports, saving, search and navigation. Standard/Numbered codes support project-specific Ctrl+1–9 code assignments.
- Shortcut handling preserves native text editing/clipboard behavior, protects dialogs and ignores composition, AltGr and repeated key events. Help shows the active keys and remembered profile settings without commercial product names.

- Document Notes opens a full-width memo editor directly below its Workspace button and focuses it automatically, keeping it visible without scrolling back to the document header.

## 1.8.1 - 2026-10-14

- Added **Memo-Book**, a top tab after Analysis, replacing Memos/Notes in Research tools. It gathers project, document/image, code, quote/region, annotation, case, framework, co-occurrence and Code Map notes with source navigation and editing.
- Added individual, selected and all-memo Word/Excel exports. Excel separates memo categories into worksheets; Word groups them under headings. Search, source filters and selected-only reading help organise notes.
- Memo exports always identify the source, including document names, quotations, codes, authors and locations for passage notes, and related sources for code/matrix notes.
- Manuscript skeletons include linked code memos, analysis notes, source/case/quote notes and starred evidence; the writing export is also available in Memo-Book.
- Rewrote offline Help for general users, with a complete Memo-Book section and four Research tools sections: Cases, Groups, Review and History.
- About email and GitHub links have right-click copy menus, without separate copy buttons.
- Reduced repeated work in memo lookup/export and manuscript generation; memo lists display 50 cards per page.
- Added a fictional climate-resilience demo: four English interviews, three simulated coders, 24 codes, starred quotes, notes, matrices, saved queries, analysis previews and a video guide.
- Updated the GitHub README with the eQc logo and current workflow. Added memo, contact-copy, Help and dataset validation to release checks.

## 1.8.0 - 2026-10-09

- Simplified offline Help: practical instructions and examples, without development notes, validation claims or comparisons with other applications.

- Switching projects closes text and image coding inspectors and clears unfinished inspector notes. Deleted coding no longer appears from stale popup snapshots.

- Word/PDF zoom controls scroll above the source content instead of sticking over document text.
- Folder deletion keeps ordinary photos, PDF page snapshots and nested folders visible at the root; sources with older broken folder links remain accessible.
- CSV round trips keep generic summaries and definitions on the row’s most specific code instead of attaching them to its parent.
- QDPX import restores Description-only legacy code memos while retaining separate definitions/memos in modern archives and definitions in QDC codebooks.
- Code Map clears selected nodes and drawing state when switching projects.
- Project merges discard invalid research links; saved queries with missing filters require review before they can run.
- Removed framework matrix entries whose document or code was deleted. Coder filters, claiming unattributed coding, research queries and coder cleanup now handle surrounding whitespace consistently.
- Added data-integrity regression checks and included the usability browser check in the release workflow.

- Reading font-size controls now share one row with an editable, remembered 8–48 px size field.
- Fixed Reading menu clipping on alternating openings; controls now use the available window height consistently.
- Moved profile/time storage to SQLite with automatic, duplicate-safe migration, a retained recovery copy, incremental session writes, separate photo storage and a save-before-close check. JSON profile/time import and export remain compatible.
- Reduced renderer memory and background work: selected-profile daily summaries, released acknowledged session records, no clock-driven Workspace redraws, deferred viewer/OCR/export loading, bounded PDF/OCR canvases and explicit temporary resource cleanup.
- Weekly time summaries now use Sunday–Saturday calendar weeks, matching a Sunday–Thursday workweek.
- Kept Codes & Strips beside the Workspace viewer and removed the duplicate Reading toggle. Reading now supports preferred installed fonts with a remembered My fonts list.

- Research tools Notes tab/menu renamed Memos/Notes for consistent wording.

- Multiple profiles through a round top-right avatar; time on the left and My details on the right with a larger centred portrait at the top, responsive stacking, profile switching and confirmed deletion.
- Profile/coder/LAN names share the latest edit; active LAN presence can refresh names while historical coding retains its authors.
- JSON exports carry the selected profile and time sessions. Imports merge matching stable session IDs, retain newer and independent work, add unfamiliar profiles, and keep last-worked timestamps; legacy project backups remain supported.

- Profile & time: optional local details/photo, active app/coding clocks, five-minute idle/foreground pause, daily/weekly/monthly/yearly totals, project breakdowns, first/last coding times, CSV export.

- Help begins with the table of contents; previous release notes are integrated into relevant guide sections. Repaired section links open and scroll to the target even after a filtered search.
- Document formats include Markdown (.md), imported as coding text including markup.
- HEIC/HEIF iPhone main still photos convert locally to PNG for image coding and all exports. BMP is accepted by the image picker and drag-and-drop. Import failures are reported alongside successful images.
- Research tools moved to the Workspace Sources panel with direct links to Cases, Groups, Review, Notes and History; CSV dataset/codebook import is also available under Add source.
- Research tools, ICR and Consensus have clearer practical instructions and worked examples; the current guide is USER_GUIDE.md, with previous versioned guides retained.

## 1.7.0 - 2026-10-08

### Added
- **Offline Help** — searchable complete user guide and application documentation, section dropdowns and expand-all reading. Navigation is Workspace, Codebook, Auto-Code, Analysis, Code Map, Help, About.
- **Unified project import** — the existing Import dialog accepts JSON/QDPX projects, QDC codebooks and extracted QDE XML with adjacent sources; missing sources are reported before creating an unusable project.
- **Workspace project export choices** — JSON/QDPX with originals or smaller text-only document data; coding, memos and image regions remain in both choices without changing local originals.
- **Memo tools** — select, edit, copy and export both standalone and attached memos; individual/selected Word or CSV exports and confirmed consolidation into a new or selected standalone memo, preserving all text and links while keeping sources/codes/coding intact.
- **Research tools** — one workspace under Project tools with Cases, Groups, Review, Notes and History: cases/attributes, FGD passage links/CSV import, overlapping groups, saved scoped Boolean/overlap/proximity queries, contextual text/image review and case counts, linked memos/annotations, bulk reassignment/splitting, boundary adjustment and in-vivo/multiple-code selection actions.
- **Codes & Strips** — discoverable reader-toolbar button beside Portrait/Lines, remembered visibility, narrow vertical code labels and separate overlapping passage lanes. Hover/focus widens the coloured stripe by 3 pixels.
- **Persistent recovery** — local SQLite activity plus named/rotating automatic checkpoints, restore confirmation, pre-recovery checkpoint and integrity checks; activity CSV export.
- **Research-record exports** — CSV/narrative Word/HTML, full analysis HTML inclusion, JSON/LAN/merge preservation and reference remapping. Source edits relocate references or preserve unlinked notes. QDPX includes readable Notes and an eQc research appendix; foreign native case/group/query conversion is not claimed.
- **Formatted Word/PDF coding** — Workspace Original view preserves Word styles, tables, lists and images, and renders original PDF pages with page navigation, text selection, region coding and fit/percentage zoom. Selections map back to existing coding offsets; mismatched passages and edited originals use a safe Plain text fallback. Linked PDF page snapshots reuse image-coding analysis and exports, retain document/page names, survive backups/merges and follow document rename/move/delete actions. Existing projects and table-free narrative reports remain compatible.

### Fixed
- ICR coder labels now distinguish scoped text assignments and image regions. Consensus shows text-entry and overlapping-passage totals, jointly coded review counts and hidden single-coder groups, with explanations of their different units.
- History reports a useful restart instruction when an older running desktop process lacks the new handlers.
- Coding stripe label, hover background and focus colours follow the document viewer theme independently of the application theme.
- In-app Help uses readable Markdown lists/tables/links and user-facing About instructions; developer validation/build details remain in AI_CHANGELOG.
- Batch Code Map position initialization and ignore unchanged patches to prevent repeated saves after adding/splitting codes. Undo history is recorded outside React state updater callbacks.

### Changed
- Excerpt Review starts with code/source/text filters; advanced query criteria are grouped in a disclosure. Refinement controls and the user guide explain reassignment, splitting and boundary adjustment.
- **REFI-QDA compatibility** — QDPX uses the standard Project 1.0 namespace/schema, directly nested codes, valid attributes and nonempty containers, lowercase `sources/` paths, named memo files, coder GUID references and inclusive Unicode-codepoint text positions. Non-JPEG/PNG images are converted to PNG. Invalid coding or unreadable images stop export with a specific error rather than being silently omitted. Import retains legacy eQc QDPX support and now accepts standalone QDC codebooks.
- **Original source retention** — new Word/PDF imports, scanned PDFs and Word-comment imports retain the original bytes alongside coding text. QDPX import retains original Word files and PDF text representations when supplied. Workspace’s Original menu opens/saves the original or attaches one to an older document without replacing coding text. Backups and project merges carry originals. Unchanged originals export through standard DOCX `richTextPath` or PDF `Representation`; edited text exports its current plain representation to avoid pairing coding with an outdated original.
- **Stable source lines** — Workspace’s Lines toggle shows one-based logical line numbers, including blank lines, independent of wrapping/font size. Codebook excerpt cards and CSV/DOCX exports include source line ranges. Native Word page-line numbering remains in the original file; formatted Word/PDF coding is available in Original view.
- Codebook Word exports use a table-free **document/image → code → numbered excerpt** layout. Source names, full code paths, excerpt counts, coder identities, key-excerpt marks and excerpt memos accompany the text and cropped image regions. Summary mode also includes source memos, code definitions/summaries and document–code framework memos. Codes-only retains definitions/summaries and source attribution; uncoded codes have a separate section.
- Starred Excerpts and Starred Images use the same Word layout. Coverage percentages are omitted; counts describe coding entries, retaining overlapping passages and separate coders.
- Codebook CSV/DOCX filenames use `Project name_Code name`; multiple codes are joined with ` + `, and whole-codebook exports use `Project name_All codes`. Starred exports add a descriptive suffix. Unicode names are preserved, forbidden filename characters are replaced, and long names are bounded.
- Complete v1.7.0 user guide, offline in-app Help, README, application documentation, release notes and AI change history updated for this release.

## 1.6.5 - 2026-10-06

### Changed
- **Task-oriented Codebook sidebar** — Details, Merge, Export and Import tabs replace the long stacked panel. Selected-code export and merge use the same searchable code selection. Routine CSV/DOCX and starred exports stay prominent; whole-project exports are grouped in a disclosure. Existing options and export formats are retained.
- **Tidier Workspace** — Add source groups document, image, scanned PDF and folder actions. Text search stays directly accessible; sorting and coder filters move into a collapsible section. Wider, responsive sidebars give trees and controls room to breathe.
- **Compact project header** — Project tools groups backup/import/project merge actions; Reading groups fonts and text size. The Light/Dark theme toggle remains outside menus. Project selection, new/rename, LAN, undo/redo and save remain directly available.
- **Grouped analysis navigation** — Coding, Text and Team groups expose all eight analysis views without a long overflowing row. ICR/consensus scope controls collapse into a summary displaying the current selection.
- **Code Map tools and automatic Fit** — View, Draw, Canvas, Codes, Export and Help menus retain all map options. Fit follows the available viewport; manual zoom remains fixed until Fit is selected again. Node labels remain readable at reduced zoom, full code names are available on hover, and canvas/export dimensions stay independent of screen zoom.
- **Wider About layout** — one wide panel presents the app, version/update links, creator, CARE/BRAC acknowledgments, contact and license. Information rows stack in smaller windows.

### Fixed
- Main work surfaces use the height remaining below the header, preventing unnecessary outer scrolling and clipped controls.
- The scaled Code Map canvas now has matching layout dimensions, eliminating invisible unscaled overflow when zoomed out.
- Tool panels position within the viewport, reposition on resize/scroll, and dismiss with Escape or an outside click. Native disclosures and keyboard-navigable task tabs keep controls accessible.

## 1.6.4 - 2026-10-06

### Added
- **Merge codes** — select two or more codes in Codebook, choose the code to keep, and merge. Text passages, image regions, child codes, definitions, memos, framework cells, relationship notes, and map references are retained or remapped. Undo with Ctrl+Z.
- **Selected-code exports** — export one or multiple codes to CSV or DOCX, optionally including their descendants, using the existing export modes.
- **Image coding in exports** — excerpt exports include image source names, normalized region coordinates, coder identities and region memos. DOCX includes cropped image excerpts. Starred Excerpts includes both text and image coding, with unchanged option titles.
- **Complete analysis HTML report** — includes scoped pairwise agreement, Cohen’s Îº, Holsti, Fleiss’ Îº, Krippendorff’s c-Alpha-binary and Cu-Alpha, per-code results, consensus counts and coder assignments, plus cropped image coding and all existing dashboard analyses.
- **Acknowledgments** — recognize the contributions of the CARE project and BRAC James P Grant School of Public Health, BRAC University, in About and documentation.

### Changed
- All codebook CSV/DOCX modes include document or image source names. Codes-only exports list associated sources and retain uncoded codes; excerpt exports retain uncoded codes and their memos/definitions where enabled.
- Removed the redundant “Document + codes + excerpts + summaries” mode; “Codes + excerpts + summaries” now supplies source names itself.
- Notes & Memos CSV includes a Document column and whole-image memos.
- Updated the user guide and README with previously missing v1.6.0–1.6.3 reliability, consensus, definition, and data-integrity features.

### Fixed
- Image-only manuscript entries now embed their starred regions even when there are no starred text quotes.
- CSV correctly escapes carriage returns; HTML distinguishes an executed KWIC search with no matches from a search not yet run.

## 1.6.3 - 2026-09-30

### Fixed
- **Consensus review now shows agreements** — an agreement is judged by the coders who actually coded a quote, so two coders agreeing on a passage is no longer reported as a disagreement just because a third coder (in scope) never touched that passage. This left the Agreements list empty in most multi-coder projects.
- **Consensus review no longer lists single-coder quotes** — a passage only one coder marked has nobody to disagree with, so it is no longer offered as an adjudication item. The number of such quotes is disclosed instead of silently hidden.

## 1.6.2 - 2026-09-30

### Fixed
- **Deleting a code no longer leaves dangling data** — framework-matrix cells, relationship notes, and hidden-map entries are now removed along with the code and its subcodes. Previously the matrix and notes kept rendering against a deleted code, and a stale hidden entry could make the “âž• Add codes” panel open empty.
- **"Unattributed" is no longer counted as a coder** in the reliability statistics. Unstamped passages have no human behind them, so scoring them against a real coder produced a figure that read like agreement but was not. They are now excluded and disclosed in a notice, with a pointer to the Project Settings action that attributes them.
- **Code Map edge labels** — dragging a label now saves once when you let go, instead of writing to the project on every mouse movement; dragging an unstyled edge for the first time no longer freezes its line style, curvature, and arrowheads.
- **Code Map annotations** — after dragging one annotation, the next click on any other annotation is no longer ignored.
- **Definitions now survive REFI-QDA round-trips** — the coding definition is written to the code's `<Description>` and the memo to a proper `<Note>` in the `<Notes>` section, so both fields return to their own places on import. Definitions also appear in the codebook DOCX export, the Notes & Memos CSV, and the HTML report. (Manuscripts skeletons are unchanged: still memo-driven.)

### Changed
- **Merging another coder's project now carries the analysis** — image sources, image coded regions, framework-matrix cells, relationship notes, and manual Code Map edge styles are merged with their references remapped, instead of being silently dropped. Where two coders wrote different text for the same case or code pair, both are kept. Merging the same file twice still changes nothing.
- **CSV definition import reports skipped rows** — an existing coding rule is never silently overwritten; the import summary now says how many incoming definitions were skipped.
- Agreement figures are labelled by what they are: chance-corrected coefficients (Îº, Î±) carry a strength band, while Holsti's index is marked as an uncorrected ratio.

## 1.6.1 - 2026-09-30

### Added
- **ICR scope selection** — the Inter-Coder Reliability tab now lets you pick exactly which coders and documents count (plus an images toggle). Every metric recomputes over the scope.
- **Holsti's index** — pairwise `2M/(N1+N2)` agreement over positive coding decisions, shown overall and per code.
- **Krippendorff's c-Alpha-binary** — chance-corrected agreement per code over present/absent ratings, with CSV/DOCX export.
- **Krippendorff's Cu-Alpha** — agreement on *which* code each jointly-considered quote received; quotes a coder left uncoded count as disagreements.
- **Consensus sub-tab** — side-by-side adjudication of overlapping quotes with Agreement/Disagreement badges and filters; keep one coder's coding, delete all, or remove single passages (undo with Ctrl+Z).
- **Coding definitions** — each code now has a dedicated Definition field (Code Details), importable from codebook CSVs (`Definition`, `Definition of Parent/Child 1/Child 2`, …), exported back out for lossless round-trips, and preserved across project merges.

## 1.6.0 - 2026-09-29

### Added
- **Inter-coder reliability (ICR)** — new Analysis dashboard sub-tab measuring code-occurrence agreement: one item = one code applied (or not) to one document or image. Compare any two coders with **percent agreement** and **Cohen's Îº** (overall, per-code breakdown, and the 2×2 table, exportable to CSV/DOCX); with 3+ coders **Fleiss' Îº** is computed over all of them automatically.

## 1.5.8 - 2026-08-18

### Changed
- **Cleaner document reader** — the left-margin coding stripe (code-name labels and vertical colour bars beside the text) is removed from the Workspace document editor. Coded passages still highlight in the text, the right-edge **Document Portrait** minimap is unchanged, and clicking a passage still opens the code menu.

## 1.5.7 - 2026-08-18

### Added
- **Complete HTML report** — the Analysis tab's **â¬‡ï¸ HTML Report** now includes **every** analysis: the Framework Matrix, plus the **Word Frequencies** list and the **KWIC** (keyword-in-context) results you last generated/searched — with the searched keyword and context window noted in the report.
- **Code Map annotations** — draw free-standing shapes and notes (**rectangle, circle, arrow, text**) on the map canvas, and style edge **width**.
- **Code Map hidden codes** — âœ• removes a code from the canvas; **âž• Add codes** brings it back.

### Changed
- **KWIC search** — the keyword input and the actively searched keyword are now distinct states: typing never triggers a search, and a summary line reports **how many matches** were found for the searched term.

### Fixed
- **Move-Code dropdown mojibake** — the tree arrows in the move-code dropdown and a curly-quote in the empty-tree message no longer render as `Ã¢â€ Â³`/`Ã¢â‚¬Å“` garbage (escaped Unicode/ASCII used instead).
- **“âž• Add codes” notice** — when every code is already on the canvas, the hint auto-dismisses after a couple of seconds instead of staying on screen.

## 1.5.6 - 2026-08-16

### Added
- **ðŸ—ºï¸ Code Map is now a real canvas** — pick the canvas size (Map, A5, A4, Letter, Legal, or a fully **Custom** W×H) and zoom from 10–400% with the slider. The map renders as a paper with true pixel dimensions inside a scrollable viewport, so zooming in scrolls instead of stretching. Switching canvas size **instantly rescales every placed node** to fit the new bounds (40px padding), and auto-layout for new codes always respects the active canvas.
- **ðŸŽ¨ Style edges and shapes on the Code Map** — every node can be a **circle, square, or diamond** (right-click to cycle). Click any edge to style it: **solid/dashed/dotted**, straight or **curved**, **arrowheads**, custom **colors**, and optional **labels**. Hierarchy and co-occurrence edges keep defaults until you style them; “**âœï¸ Draw edge**” lets you connect any two nodes with a custom edge, and styled/custom edges persist with the project. Co-occurrence edges (derived from shared documents) can be toggled on/off.
- **ðŸ“Š Document Portrait is now a vertical coding strip** — the minimap moved from above the document to a narrow strip on the document's right edge. Each colored band sits exactly where that passage is in the text; **click it to scroll the document to the passage** (no popup). Lines **widen on hover** so even single-line codings are easy to hit.
- **🔍 Code while you search** — select a passage, click the code search box, and type: the selection is kept (sticky), and **clicking any search result applies that code**. You can also **drag a code** from the search results or the legend onto the document to apply it, and images can now be **dragged between folders** in the document tree.
- **ðŸ§¹ Clean redundant codings** — a button merges overlapping codings of the same code on the same document into single segments (notes joined), so duplicated codings never inflate counts.
- **ðŸŽ¨ 60 more code colors** — the Codebook color picker gains a “ðŸŽ¨ More colors…” palette.
- **â¬‡ï¸ Codebook-only REFI-QDA export** — share just the code tree (hierarchy, colors, memos) as a valid `.qdpx` archive with no sources.
- **â†•ï¸ Drag-reorder the code legend** — drag a code onto a sibling to reorder it (positions remembered), onto a parent to reparent it, or onto empty tree space to move it to root.

### Changed
- **Deleting a folder** no longer deletes its documents — they move to the root level instead.

### Fixed
- **Code Map clipping** — shrinking the canvas (e.g. Map → A4) no longer leaves nodes cropped outside the white paper; every node now fits with padding, and dragging is rigidly clamped to the canvas bounds.
- **Code Map zoom stretch** — the old percentage-width scaling stretched the map horizontally; zoom now scales the paper while scrollbars handle overflow.

## 1.5.5 - 2026-08-16

### Added
- **ðŸ—‘ï¸ Bulk delete by coder (Project Settings)** — a new **“Manage Coders (Cleanup)”** section lists every coder that has coded items in the project (sorted; **Unattributed** is excluded on purpose), with their `n seg · n reg` counts and a small ðŸ—‘ï¸ button. Clicking it asks you to **type the exact coder name** before anything is removed, so a typo-cloned name (e.g. `bayazid-dev` vs `bayazid_dev`) can be safely wiped. The deletion filters both `codedSegments` and `codedRegions`, stamps the project's `updatedAt` (so LAN offline-edit tracking sees it), persists it, and toasts the removed count.
- **ðŸ”˜ Compact Undo / Redo / Save buttons** — these header buttons now show only their icon, sized exactly to the icon (26×26 px), with the label moved into the tooltip.

### Changed
- **ðŸŒ— Codebook sorting dropdown now theme-aware** — the “Sort by” select in the Codebook centre panel used an undefined CSS variable (`--bg-panel`), which made it near-invisible in dark mode. The variable is now defined for **both** light and dark themes, so sorts are readable everywhere.
- **Project Settings modal scrolls** — added `max-height` + scrolling so the new Cleanup section and the Save/Delete buttons stay reachable on shorter windows.

## 1.5.4 - 2026-08-16

### Added
- **ðŸšª Host can remove a member** — while hosting, every connected coder's chip in the LAN panel now has an âœ• button to disconnect that specific person. The removed coder sees a clear **“You were disconnected by the host”** message and returns to local mode.
- **ðŸŸ¢ / âšª LAN sync status chip** — a small, always-visible chip next to the ðŸŒ LAN button shows **“ðŸŸ¢ Synced”** when you're on the session-shared project and **“âšª Local only (not synced)”** while you're viewing another project.
- **ðŸŸ¢ Shared-project marker** — the project dropdown now prefixes the session-shared project with a green dot, so you always know which project is live even when a different one is open.

### Changed
- **ðŸ§­ Free multitasking during LAN sessions** — you can now open, view, and edit **any** local project while a session runs in the background. The old alarm-style “project mismatch” banner is gone (replaced by the quiet status chip); an unlikely host rejection is now logged instead of popping up.
- **ðŸ“¦ Background syncing for the shared project** — if a teammate edits the shared LAN project while you're working on a different project, the incoming changes are saved silently to the database **without switching your screen** (and won't be mistaken for “offline edits” later).
- **ðŸ› ï¸ Cleaner client-side project management** — LAN clients can now freely rename/delete their **own other** local projects during a session; only the session-shared project stays locked (it belongs to the host's live state).

### Fixed
- **ðŸ”’ LAN session project lock** — sessions are now hard-locked to exactly **one** project id end-to-end (host accept, client receive/buffer/replay, and client send). Previously, opening or switching to a different local project mid-session could leak its edits into the session or apply/save the wrong project's data; those paths are now rejected at every layer.

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
- **LAN collaboration** — a `ðŸŒ LAN` button in the header starts a live, password-protected coding session over the local network:
  - **Host a Session** — shares the currently open project. Joiners authenticate with an optional session password.
  - **Join a Session** — auto-discovers hosts on the same network; pick one and the project is transferred in chunks with a progress bar.
  - **Live sync** — edits, coding, and image-codings made by any connected coder appear in everyone's copy in real time; presence chips show who is connected.
  - **Smart rejoin** — rejoining peers download only the newest state when their copy is stale; up-to-date peers connect instantly.
  - **Robust discovery** — UDP broadcast, plus a same-machine probe (lets you test two app instances on one PC) and a manual "Find by IP" field for networks that drop broadcasts.
- **`ws` dependency** — WebSocket server/client library powering the LAN layer.

## 1.4.4 - 2026-08-13

### Added
- **REFI-QDA (.qdpx) export** — Codebook tab → Export Options → `â¬‡ï¸ REFI-QDA`. Exports the full project (codebook with hierarchy/colors/memos, text documents and their coded passages, images and their coded regions) as a `.qdpx` archive (the legacy format was corrected to the standard schema in the pending update).
- **REFI-QDA image import** — picture sources (`<PictureSource>`) inside `.qdpx` files are now imported as images, including their coded regions (`<PictureSelection>`) and memos. Image files from the archive are re-encoded as data URLs.
- **Image rename** — each image in the document tree now has a âœï¸ button to rename it.
- **Coded-region count badge** — image rows in the tree show how many coded regions they contain.
- **Reader font controls (Word-style)** — in the header next to Undo/Redo: a font-family picker and `Aâˆ’` / `A+` font-size controls (8–48 px). Persist per-machine in `localStorage`.
- **Per-coder colors on merge** — when merging projects, each coder is assigned a stable, distinct color instead of random colors.

### Changed
- **Color scheme** — root codes get a color from the palette; subcodes automatically inherit their parent's color (overridable via the codebook swatch picker).
- **Export Options layout** — removed a duplicate "Export Options" group in the Codebook tab; REFI-QDA export now sits at the top of the existing Export Options group, above Manuscript Skeleton.
- **Image zoom steps** — `âˆ’` / `+` buttons and the slider now move in 10% steps (was 25%); minimum zoom is now 10%.
- **REFI-QDA import robustness** — the importer now also reads subcodes nested inside a `<SubCodes>` wrapper (a legacy wrapper shape; the standard uses direct nested Code elements), so real MAXQDA/NVivo files import better and exports round-trip.

### Fixed
- **Zoom buttons** — the `âˆ’` / `+` / Reset / slider buttons in the image viewer were nested inside the Notes button, so clicking them also opened the notes panel; they are now separate controls.
- **Duplicate Images section** — removed a redundant flat "Images" list from the left panel; images are only shown inside the document tree, per folder.

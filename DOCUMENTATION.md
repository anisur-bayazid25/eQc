## Table of Contents

- [Overview](#overview)
- [Quick start](#quick-start)
- [Projects and backups](#projects-and-backups)
- [Workspace](#workspace)
- [Codebook](#codebook)
- [Auto-Code](#auto-code)
- [Analysis](#analysis)
- [Memo-Book](#memo-book)
- [Visualization](#visualization)
- [About](#about)
- [LAN collaboration](#lan-collaboration)
- [Profile and time](#profile-and-time)
- [Supported files](#supported-files)
- [Keyboard shortcuts](#keyboard-shortcuts)

## Overview

eQc keeps qualitative research projects locally. Read and code sources, compare themes and cases, develop memos, and export material for writing. Help is available offline.

### System requirements

| Component | Minimum | Recommended |
| --- | --- | --- |
| Windows | Windows 10, 64-bit (x64) | Windows 11, 64-bit (x64) |
| macOS | macOS 10.15 on Intel; macOS 11 on Apple Silicon | A currently supported macOS release; matching Intel or Apple Silicon installer |
| Processor | 64-bit, 2 cores | 4 cores or more |
| Memory | 4 GB RAM | 8 GB RAM; 16 GB for large PDFs, frequent OCR or heavy multitasking |
| Free storage | 1 GB for installation, plus space for projects and backups | SSD with 5 GB free, plus project and backup storage |
| Display | 1366 × 768 | 1920 × 1080 or higher |
| Graphics | Integrated graphics | Integrated graphics; no dedicated GPU required |

**The hardware minimum is a provisional baseline for routine text coding, not a verified low-spec performance guarantee.** Large source collections, scanned PDFs and dense visualizations need more resources. The operating-system floor follows the current [Electron 31 runtime](https://github.com/electron/electron/blob/v31.7.7/README.md#platform-support). Choose the matching Intel or Apple Silicon Mac installer. There is currently no configured Linux release installer.

Normal coding, analysis and Help work offline. Downloads and updates need internet. OCR runs locally, but its current setup downloads engine and Bengali/English language assets; allow internet when using OCR. Offline OCR is not guaranteed because it depends on cached assets.

**OCR languages:** scanned-PDF recognition currently uses Bengali and English only. Other OCR languages are not selectable. This limitation applies to scanned-text recognition, not ordinary imported text; language choices in Word Cloud and word-frequency analysis do not change OCR recognition.

**Project and backup storage:** embedded images use base64, which adds roughly 33% to their binary size. HEIC-to-PNG conversion, retained original documents and PDF page images can add more. Photo-heavy projects can exceed 1 GB each; full JSON backups containing that media require additional space for every saved copy. The 1 GB installation allowance does not include project data or backups.

## Quick start

Create a project, add an interview, create a code, select text and apply it. Review excerpts in Codebook, compare them in Analysis, and write interpretations in Memo-Book. Export a JSON backup.

## Projects and backups

Project tools handles creation, import and export. JSON is the full backup; QDPX is for compatible exchange. Choose retained Word/PDF originals or smaller plain-text document data. Check import reports for missing material. Merge separately coded projects with identical source text and matching code hierarchies. Undo/Redo covers project edits and document deletion; deleting a document removes its coding, framework cells and linked PDF page images/regions. Project deletion cannot be undone. Local History does not travel in backups.

## Workspace

Import/read documents and images; select a passage or draw a region to apply codes. Overlap is supported. Click coding to add notes, star evidence or remove it. Selection actions creates annotations, in-vivo codes, multiple coding or case links.

Document Notes opens below its bottom control and saves on leaving the field. Reading controls adjust theme/font/size, source lines and coding stripes. Retained Word/PDF originals have their own view; review OCR text before coding.

Research tools has Cases/attributes, source/code Groups, contextual Review/saved queries and local History. Review supports scope filters and OR/AND/exclusion/overlap/proximity combinations. For refinement, select excerpts to reassign/split or Adjust passage to replace text boundaries. Cases can link whole sources or focus-group speaker passages.

## Codebook

Definitions are coding rules; summaries are interpretations. Manage the hierarchy, inspect collated excerpts and filter by source or coder. Merge selected codes after reviewing the destination. Import codebooks/coding CSV with a column preview. Export all/selected codes, optional children and starred evidence. Project exports include all notes, REFI-QDA and the manuscript skeleton.

## Auto-Code

Preview word/phrase matches and target codes before applying coding. Review results in context; a matching word need not have the intended meaning.

## Analysis

Frequency/Documents count coding entries, not participants. Co-occurrence counts different codes on overlapping passages/regions; click a pair for evidence and a relationship memo. Framework stores editable source × theme summaries. Word frequencies needs Generate List; KWIC needs Search. Interview prompts and headers can contribute words. Export tables or a combined HTML Report. HTML options include selected saved draft figures and optional visualization notes; figures use isolated copies of the saved canvases and do not restore or edit the working project. Regenerate saved graphs first if their analysis needs updating. Reports embed figures offline, show all selected source-level coder pairs plus the saved additional ICR comparison and calculation details, and use collapsible/searchable tables, individually collapsible code summaries and research records grouped by type. Print expands details and filtered rows temporarily, then restores the previous view.

ICR uses selected sources/coders and includes source × code presence measures. Repeated coding to one code/source counts once for presence; joint absences can raise agreement. Consensus groups overlapping text, with at least two participating coders. Agreement requires the same single code; multi-code groups appear as Disagreements even when sets match. Text-unit nominal alpha uses a dominant code on overlap groups and includes uncoded ratings; it is not semantic-domain Cu-alpha. Regions are not passage-consensus items. Export ICR and save a checkpoint before adjudication removes other coders' entries.

ICR uses one method selector with contextual inputs and an explicit Calculate action. Summary cards lead; pairwise/code tables and diagnostics are collapsed. Detailed tables support search, 20-row pages and complete CSV/Word exports. ICR help opens the Help tab at the formulas, comparison-unit rules and worked examples. Additional comparisons provide character/sentence/paragraph units, presence with RK correction, exact frequency equality, segment overlap with Brennan–Prediger corrections, semantic domains with exclusive-code validation and imported fixed-test decisions with per-code Pearson correlation. Calculate saves settings/test rows in the project. The paragraph preview and copy button are available only in manuscript skeleton export options and produce prose only. Native comparison units and aggregation are explicit; the exploratory global Cu-style coefficient has not been validated as equivalent to published global Cu-alpha and is excluded from manuscript reporting.

## Memo-Book

Gather notes from projects, documents/images, codes, quotes/regions, annotations, cases, framework/co-occurrence and map annotations. Filter/search, select cards or all matches, and read selected notes together. Lists use 50-card pages; selection/export covers all pages.

Create analytic/methodological/journal memos with source/code/case/excerpt links. Attached edits update original fields. Go to source returns to the original item or matrix; project memos provide individual evidence links.

Word/Excel exports include readable memo sources, document names, code names, quotes/annotations, authors, locations and available dates. Missing links retain IDs. Code/pair memos include related documents. Excel uses category worksheets; long text continues with source fields repeated. Manuscript skeleton Word uses the whole project with content options and an ICR scope/paragraph preview before Results. It omits generated document lists, coder labels, excerpt/source/case memos, annotations and visualization notes. Starred quotations have italic case-based attribution or source-name fallback. Framework/co-occurrence memos default on; analytic project memos are optional and not repeated across linked codes. Other exports retain their audit metadata. Case editing uses separate standard fields plus named custom attributes; existing keys remain compatible. Merging memos combines text/links and clears original attached note fields after confirmation; Undo restores them.

## Visualization

The square-card library offers Code map, Mind map, Hierarchy, Heat map, Word tree, Process, Journey, Pyramid, Venn, Honeycomb, Ecology, Histomap, Dendrogram, Sankey, Word cloud and Blank canvas. Code map has Simple and Detailed designs; starting from scratch is available only through the separate Blank canvas card. Select a type/preset, adjust sources or labels, then Generate. No project aggregation runs on a tab visit; leaving the tab or returning through All visualization types unloads the renderer. ⚙ opens settings for the current type, without replacing the canvas until Generate.

Heat maps compare unique passage counts across documents (with coding-decision/presence and coder filters) or shared-document counts between codes. Word trees group up to four source words before/after a literal case-insensitive phrase within sentences, using full documents or merged coded ranges. Select results for document/code source links. Hierarchy/mind maps use the codebook. Interpretive diagrams use researcher-supplied groups, stages and ratings; Venn areas and journey spacing do not encode calculated magnitudes or time.

Histomap and Dendrogram settings use **Prepare data → Choose display → Generate**, with a readiness message for missing inputs and exclusions. Generate stays disabled until the required inputs are valid; readiness checks do not run clustering or graph layout. Histomaps require ordered periods and explicit passage/document period tags; settings provide assignment controls and explain counts, shares, exclusions and gaps. Dendrograms use direct-code presence, Jaccard distance and average linkage, with empty-item exclusions and deterministic ties.

Sankey offers two-stage, multi-stage, alluvial/parallel sets, hierarchical and circular presets. Supply positive weighted links or complete categorical paths; alluvial requires complete paths. Project coding supplies classification summaries, not observed movement. Settings explain each input and provide labelled fictional examples. Select a node label for inside/outside positioning and boundary distance in the Inspector.

Word clouds support standard/random shapes and PNG/SVG masks, overlays, spacing/density, fonts, rotations and up to 300 words. Word exclusions are below selected-item formatting in the right Inspector (open Import a stop-word list for file import): edit, then **Apply Changes** to rebuild positions while keeping settings/palette. A random shape repeats with its layout seed. Analysis word frequencies and clouds share language, stop-list and minimum-base-letter filtering (English >3, Bengali >2 by default; dependent signs do not count). Optional local JSON language profiles avoid bundled models. Shared text controls support rotation, vertical writing and reading direction; **Invert palette** reverses colour order.

The centered canvas uses left-side tools and a right-side Inspector. Toggle the Inspector for more space; zoom controls remain at the top.

Every graph shares Colours, Text, Canvas, Arrange, Draw (including shapes/text boxes), Legend, Drafts and Export. Code-node tools appear only on Code map, Mind map, Hierarchy and Blank canvas; only Code map exposes View/re-layout/shared-document controls. Heat map display in the right Inspector can hide all-zero rows/columns and swap axes immediately. Histomap can hide zero-assignment codes in Choose display while retaining periods and gaps.

Results are editable snapshots: regenerate explicitly after data changes. Draw or double-click text, format in the grouped right Inspector (Font, Size & style, Text colour; Direction & rotation opens advanced controls), resize with automatic fitting, and customise shapes/legends. Connections follow process/journey blocks when moved. Save a named draft before changing designs; drafts retain family/settings and map geometry without copying transcript contents. Export the same canvas as SVG/PNG/JPEG. Set a physical print width and check text size/DPI before export. SVG retains vector text/shapes plus accessible figure/source descriptions. See the [User Guide](USER_GUIDE.md) for controls, limits and the guided period-assignment/clustering settings for histomaps and dendrograms.

Visualization notes are separate draggable cards toggled with Notes, snapshotted independently in named drafts and aggregated under Visualization notes in Memo-Book. Canvas/edge labels are Visualization labels. Notes are excluded from figure exports and manuscripts, but retained in native JSON backups and LAN snapshots. LAN is whole-project last-writer-wins; simultaneous canvas edits can overwrite one another.

## About

Check the installed version and updates. Click the email to open your email app, or right-click to copy the address/link. Right-click Source & releases to copy GitHub's address.

Feedback in the toolbar, Help's reporting button or Ctrl/Cmd+Shift+B opens a direct-report form. It prefills the active profile email, captures the eQc window before opening, previews removable screenshots and reviewable optional device information, and sends only the selected report fields. The default backend is a standalone Google Apps Script web app executed under the developer's authorization; no website, purchased domain or end-user Google login is needed. The recipient is fixed to the developer's email; the reporter's address is Reply-To. Persistent locks/counters enforce a 50-attempt rolling daily cap and shorter rate limits. Accepted retries are deduplicated, and uncertain sends are not repeated automatically. Google ContentService response redirects are followed with a GET only to the expected Google content host. Offline ZIP download is available; failed sends retain the draft in memory. The service must be deployed and its public `/exec` URL configured before Send is enabled. Setup is in `services/feedback/README.md`.

## LAN collaboration

Host/Join shares project work on a trusted local network. Confirm coder identities before teamwork. Personal profiles/time stay separate. Back up before a session; offline colleagues can exchange and merge project files.

## Profile and time

The round avatar opens profiles and active app/coding time. Upload or Adjust photo opens a circular preview: drag, zoom, then Save picture. Reset and Cancel are available, and saved framing is retained in profile backups. New coding uses the current name; previous entries keep their authors. Time pauses outside active use, after five idle minutes or manually. Weeks run Sunday–Saturday. Export time to CSV or include profile history in JSON; repeated import avoids duplicate recorded sessions. Profile deletion removes its local details/time, not projects.

## Supported files

TXT, Markdown, Word and PDF; common images plus HEIC/HEIF still photos; structured coding CSV; JSON/QDPX/QDC/QDE projects/codebooks. QDE needs adjacent sources. Exports include JSON, QDPX, CSV, Word, Memo-Book Excel and HTML.

## Keyboard shortcuts

Choose a profile below and expand Active shortcut keys. Coding actions need a selected source passage/region. Standard/Numbered codes profiles support project-specific Ctrl+1–9 code assignments. Ctrl+S saves current work; Ctrl+Z and Ctrl+Y/Ctrl+Shift+Z undo/redo. F1 opens Help; Esc/Tab support normal dialog/navigation behavior. On macOS, the active table uses Cmd/Option labels. Typing fields keep native clipboard and editing keys. The profiles cover supported eQc actions; multimedia/rich-text/internal-link commands are not assigned.


### Visualization editing and colour palettes

The Colours tool offers 17 built-in palettes, including Viridis, Magma, Plasma, Inferno, Cividis, ColorBrewer Set2, Tableau 10, muted palettes, grayscale and monochrome. Create/edit a custom palette from any preset, change or add swatches, and save a project palette by name. Scientific bases retain a sequential heat-map ramp. Individual text, fill, border and line colours remain editable through the expanded shared picker.

Arrange supports Shift/Ctrl multi-selection, marquee selection, group/ungroup, shared move/resize, proportion locking, center/align and front/back order. Groups and layers are retained in canvas records and named drafts. Returning from a source or another tab resumes the working canvas; inactive visualization does not render or aggregate data.

Settings use editable numeric limits with suggestions. Code/context and document limits support up to 200 separately; generated mind/code maps have a total of 200 nodes. Themes (up to 100) and subcodes per theme (up to 200) are editable. Diagrams support a label/stage limit up to 48, except Venn diagrams (2–3 sets). Matrix generation allows 2,500 cells; dendrograms cluster up to 100 non-empty items. These bounds are shown in settings. Large figures need a larger export or narrower selection for readable labels.

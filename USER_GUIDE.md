## Table of Contents

[Overview](#overview)

1. [Quick start](#1-quick-start)
2. [Projects and backups](#2-projects-and-backups)
3. [Workspace](#3-workspace)
4. [Codebook](#4-codebook)
5. [Auto-Code](#5-auto-code)
6. [Analysis](#6-analysis)
7. [Memo-Book](#7-memo-book)
8. [Visualization](#8-visualization)
9. [About](#9-about)
10. [LAN collaboration](#10-lan-collaboration)
11. [Profile and time](#11-profile-and-time)
12. [Supported files](#12-supported-files)
13. [Keyboard shortcuts](#13-keyboard-shortcuts)

## Overview

eQc is a desktop app for reading, coding and analysing qualitative material. Projects are saved locally. You do not need an account.

| Tab | Use it to |
| --- | --- |
| Workspace | Import, read and code sources; open Research tools |
| Codebook | Manage codes, definitions, summaries and collated excerpts |
| Auto-Code | Find and code matching words or phrases |
| Analysis | Compare coding, build summaries, search text and review team coding |
| Memo-Book | Gather, link, edit and export memos and notes |
| Visualization | Generate editable maps and diagrams, or draw your own |
| Help | Find offline instructions |
| About | Check the version, updates and contact details |


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

## 1. Quick start

1. Create a project from **Project tools**.
2. In Workspace, use **Add source** to import an interview or image.
3. Create a code, then select text and click the code to apply it. For an image, draw a region and apply a code.
4. Open Codebook to review excerpts and write a code summary.
5. Open Analysis to compare sources, or Memo-Book to develop your notes.
6. Use **Project tools → Export → JSON** to save a complete backup.

Try the fictional climate study in the repository's **demo/climate-resilience** folder to explore coding by three users, memos, matrices and consensus.


## 2. Projects and backups

Use the project selector to switch projects. **Project tools** contains project creation, import and export. Project settings lets you rename a project, set a coder name or delete the project.

### Import and export

Import accepts eQc JSON projects and REFI-QDA QDPX/QDC files. An extracted QDE needs its matching source files. Read any import report for missing material.

For a complete backup, export **JSON**. Choose original documents to retain attached Word/PDF files, or plain text for a smaller backup. Both retain coding and research records. JSON can also include the selected profile and time records. QDPX is for exchange with compatible qualitative software.

Save backups outside the app's local storage. Local History checkpoints do not travel in project backups.

### Merge and undo

Merge separately coded project files to combine teamwork. Identical source names and text allow coding to share one source; matching code hierarchies are reused. Check coder names before merging.

Use **Undo/Redo** after changing coding, codes or memos. Changes made in a text field must be saved through that editor first. Deleting a document also removes its coded passages, framework cells and linked PDF page images/regions; Undo restores the deleted document and its analysis. Project deletion cannot be undone.


## 3. Workspace

### Sources and reading

Use folders to organise sources. Select a document or image in the Sources panel. Search text to find passages across documents.

**Reading** lets you choose the reading theme, font and size. Add preferred installed fonts to **My fonts**. **Codes & Strips** shows code labels beside the viewer. **Lines** adds source line numbers.

For retained Word/PDF files, switch between the original view and plain text. Zoom changes the original view; it does not change coding text. If an edited document no longer matches its retained original, use the plain-text view for coding. Scanned PDFs can use local OCR; review the extracted text before coding.

### Text and image coding

Select text, then click a code or drag a code onto the selection. Multiple codes can cover the same passage. Click existing coding to read its note, star it or remove it.

**Selection actions** lets you add an annotation, create an in-vivo code from selected words, apply several codes, or link the passage to a case. Annotations are separate passage notes; they also appear in Memo-Book. Click an underlined annotation to open its exact Memo-Book entry. Edit opens beside the note. Use Delete annotation to remove it; saving an empty annotation also removes its underline.

For images, draw a region and choose a code. Region notes and stars work like passage notes. PDF page regions are stored with a linked page image.

Use a source memo for an observation about the whole document or image. For documents, click **Notes** below the viewer; the memo field opens directly below that button and receives focus. Notes save when you leave the field and also appear in Memo-Book. Starred quotes and images can be exported from [Section 4.3](#43-export-tab).

### Research tools

Open **Workspace → Research tools** in the Sources panel. It has four sections:

- **Cases:** create participants or other units; add attributes such as Country or Age group; link a whole source or a selected passage. Use passage links to distinguish speakers in a focus group.
- **Groups:** create reusable sets of documents or codes. A source or code can belong to several groups.
- **Review:** choose codes/sources and click **Run query** to read matching excerpts in context. Leave selections empty to review all coding. Advanced filters add cases, attributes, coder, groups and code combinations. Save a named query to run it again later.
- **History:** create a named checkpoint before major changes. Restore a checkpoint to replace the current project; the app first saves the current state as a recovery point. Keep separate JSON backups too.

### Refining coding

For coding refinement, check excerpts in Review and open **Refine selected coding**. Reassign them to an existing code or split them into a new sibling code.

To change a text boundary, choose **Adjust passage**, select replacement text in the source, then choose **Selection actions → Update passage**. The coding entry keeps its note, coder, date and star. Export all retrieved results, or check a subset before exporting.


## 4. Codebook

### Details and excerpts

Select a code to edit its name, colour, definition and summary. A **definition** explains what should be coded; a **summary/memo** records your interpretation. Browse the gathered excerpts and filter them by source or coder.

Use parent and child codes to organise themes. **Merge** combines selected codes into the code you choose. Review the destination before confirming.

### Import

Import a codebook or structured coding CSV from the Import tab. Preview the columns and assign the requested mappings. Keep definitions and summaries in their matching columns.

### 4.3 Export tab

Choose **All codes** or **Selected codes**; optionally include child codes. Choose the content scope, then export **CSV** or **DOCX**. Starred excerpts and starred images have their own export options.

Under **Project exports**, export a codebook, all notes, or a **Manuscript Skeleton**. The skeleton uses code summaries, linked memos, analysis notes and starred evidence as material for writing. It is an editable outline, not a finished report. The same writing export is available in Memo-Book.


## 5. Auto-Code

Choose words or phrases, set matching options and target codes, then preview the matches. Review them before applying coding. Matching text can still have different meanings, so check the result in context.


## 6. Analysis

| View | What it shows |
| --- | --- |
| Frequency | Coding-entry counts by code |
| Documents | Code × source counts |
| Co-occurrence | Different codes on overlapping passages or regions |
| Framework | Editable source × theme summaries |
| Word frequencies | Common words after applying the stop-word list |
| KWIC | A keyword with its surrounding words |
| ICR | Agreement measures for selected coders and sources |
| Consensus | Jointly coded passages for comparison and adjudication |

Click a co-occurrence pair to inspect shared excerpts and write a relationship memo. Write framework summaries directly in their cells. Both appear in Memo-Book.

In **Word frequencies**, choose the language and minimum base-letter length, edit stop words and click **Generate List**. A value of 3 keeps words with at least 4 base letters; Bengali vowel/combining signs do not add letters. In **KWIC**, enter a keyword, choose the context size and click **Search**. These views include document text, including interview questions. Generate them again after changing documents or settings.

Use view export controls for Word/CSV tables, or **HTML Report** for a combined report.

### ICR and Consensus

For ICR, select the same sources and coders being compared, then choose Coder A and B. Compare percent agreement, Holsti, Cohen's kappa and the available multi-coder measures. Codes assigned once or many times to a source count as presence for source × code agreement.

Consensus groups overlapping text coding. Image regions are not consensus items. **Agreements** means participating coders each applied the same single code. Multi-code groups appear under **Disagreements** even when their sets match; inspect the actual coding before deciding what differs. A coder who did not touch a passage is not a voter in consensus; Cu-alpha includes uncoded ratings.

Export ICR and create a checkpoint before adjudication. Keeping one coder's coding removes the other entries in that passage group and changes later statistics. Coding counts include separate coders and overlapping entries; they are not counts of participants.


## 7. Memo-Book

Memo-Book is the top tab after Analysis. It gathers project memos, source notes, code summaries, quote/region notes, passage annotations, case notes, framework summaries, co-occurrence memos and code-map notes.

### Find and select

Search the text or choose **Memo source** to filter by category. Check individual memos; use **Select matching memos** for the filtered list. **Show selected memos only** lets you read your selection together. **Clear selection** starts again. Large lists use **Previous memos / Next memos**, with 50 cards per page; filters and export selection can cover all pages.

### Write and return to evidence

Choose **New memo**, add a title and purpose, write your text, link relevant documents/codes/cases/quotes, and save. For example, create **Distance and safety** and link the supporting code and interview passages.

Use **Edit memo** to update a note. Attached notes update their original source field. **Go to source** opens the document, code, passage, case, map or relevant matrix. Project memos show a separate link for each attached item.

### Export and write a report

Export a single card, selected memos or all memos to **Word** or **Excel**. Word groups them by category. Excel uses separate sheets for document, code, framework, co-occurrence and other memo types. Every export identifies the memo source. Quote notes include document names, quotation text, code names, coder and character range; matrix notes identify their source/theme or code pair. Related documents and missing-link IDs are retained where available. Very long Excel text continues on another row.

Choose **Manuscript skeleton Word** to combine code summaries, linked memos, analysis notes and starred evidence into an editable writing outline. This uses the whole project, regardless of memo selection. Review and organise the draft before using it in a report.

### Combine related memos

Select at least two memos, open **Export or merge selected memos**, choose a new or selected project memo as the destination, and review the confirmation. Merging combines text and links, consolidates project memos and clears the selected attached note fields. Sources and coding remain. Use Undo if you need to restore the original notes.

## 8. Visualization

Choose a square type card, choose a preset and settings, then click **Generate visualization**. For a first figure, try Word Cloud: select your documents, Generate, then select a word to see its formatting and sources in the Inspector. Save a named draft before experimenting with a new design. Code map opens its Simple/Detailed preview designer. **Open current canvas** resumes your layout; **Open draft** loads a named version. Visiting this tab does not compile project data. The **▦ All visualization types** button returns to the library and unloads the renderer. Switching tabs also stops it automatically. **⚙ Settings** opens the current graph’s own settings; Back returns without replacing the canvas.

| Type | What it uses |
| --- | --- |
| Code map | Simple/detailed theme clusters; optional shared-document links |
| Mind map | Your topic, codes and subcodes, without cross-theme links |
| Hierarchy | Code parent/child relationships, top down or left to right |
| Heat map | Unique coded-passage counts by document, or shared-document counts between codes |
| Sankey diagram | Weighted source/target flows or categorical paths; two-stage, multi-stage, alluvial, hierarchical and circular presets |
| Word cloud | Word frequencies packed into standard/random shapes or uploaded PNG/SVG masks |
| Word tree | A phrase and its preceding/following source words, grouped by frequency |
| Process map | Your ordered stages: sequence, cycle or branching |
| Journey map | Your stages and one researcher-assigned rating (1–5) per stage |
| Pyramid | Your levels, ordered from top to bottom |
| Venn diagram | Two or three conceptual groups and an editable overlap label |
| Honeycomb | Your related components in hexagonal blocks |
| Ecology map | Your focal issue and surrounding influences, or nested system layers |
| Histomap | Ordered event periods and period-tagged coded passages; shares or unique counts |
| Dendrogram | Documents or codes clustered by Jaccard distance and average linkage |
| Blank canvas | Your own codes, shapes, links and text |

Code map settings contain **Simple code map** and **Detailed code map**. To draw from scratch, choose the separate **Blank canvas** card in the visualization library.

Data views let you select codes/documents and type custom limits, with clickable preset-number buttons. The selected preset is highlighted; the input remains editable. Code/context limits support up to 200; document limits are separate (up to 200). Mind/code maps have editable theme and per-theme subcode limits and a total of 200 generated nodes. Histomaps allow more than eight themes, although six to eight is usually easier to read. Dendrograms cluster up to 100 non-empty items; heat maps allow up to 2,500 cells. Manual diagrams have an editable label/stage limit (up to 48), except Venn diagrams, which support 2–3 sets. Larger layouts need larger exports or a focused selection. Heat maps use direct codes; parent codes do not automatically include subcodes. Unique passages deduplicate identical code/document/range assignments across coders. Choose **All coding decisions** to count each coder assignment, **Document presence** for 0/1, or filter by coder. Different selection boundaries remain different passages. Shared-document counts mean a document contains both codes, not necessarily overlapping passages. Word trees match literal phrases without case sensitivity, show up to four adjacent words within sentence boundaries, and cap scans at 2,000 occurrences or 2 million characters. Choose whole documents (including interview questions) or coded passages only; the coded-only view merges overlapping ranges so coder duplication does not repeat the same text. Select a cell/context and use **Sources** to open its documents or codes.

Diagrams use your interpretation. Venn areas/overlaps are conceptual, pyramid levels do not imply frequency, and journey ratings are yours; stage spacing is not elapsed time. Labels are editable and limited by the selected label/stage limit (Venn: 2–3 sets).

Generated views are **editable snapshots**. Use **⚙ Settings** and Generate again to reflect data changes; **▦** chooses a different type. Generation replaces the current canvas; save a draft first to retain it. It does not change research sources, coding or codebook colours. Use Undo to restore the previous canvas.

**Workspace:** the shallow top bar contains navigation/zoom; the left rail contains drawing, canvas, codes, link, legend, draft and export tools. The right Inspector contains typography, shape appearance and source links. **☷ Toggle inspector** expands the canvas. The paper stays centered horizontally and vertically whenever it fits; use scrollbars when zoomed in.

**Editing:** double-click any label to edit in place; click elsewhere to save or Escape to cancel. Select it to format it in the right **Inspector**. Font, Size & style, and Text colour are grouped together. Open **Direction & rotation** for vertical text, rotation in degrees and reading order. **Edit text** starts in-place editing; the trash button removes the selected annotation. **T** toggles the formatting tools. Open **Shapes**, choose a standard shape, then drag on empty canvas. The gallery includes rectangles, rounded rectangles, ovals, triangles, polygons, block arrows, stars, a cross, callout, line, arrow connector and text box. Hold Shift for equal width/height; Escape stops drawing. Double-click a shape to add or edit its text. Shapes support the same fill/border, grouping, resizing and export tools. Drag items to move and handles to resize; text wraps/shrinks to fit. Process/journey links stay attached when their blocks move. Shape controls include fill, border and opacity; arrows have a line-colour control. **#** opens hex entry and **🎨** generates a palette. Delete/trash removes selected annotations; Delete inside an editor edits text.

**Colours:** **Invert palette** reverses the colour order and heat-map ramp. Open **Colours** on the left rail for 17 built-in canvas presets, including Viridis, Magma, Plasma, Inferno, Cividis, ColorBrewer Set2, Tableau 10, and muted coast, sage garden, earth/clay, lavender dusk, soft spectrum, colour-blind-friendly (Okabe–Ito), blue/amber, grayscale, monochrome slate and monochrome teal. These change visualization colours only. Heat maps keep an ordered light-to-dark scale with readable numbers; keys follow the new colours. Keep labels visible when colours are close. Select any shape/node or line to change its fill/border/line colour individually. **Create / edit custom palette** starts from a preset or a saved custom palette. Change its swatches, enter a name (for example Viridis_1), and save. Custom palettes travel with project backups; reusing a custom name replaces it. Scientific presets retain sequential heat-map ramps. Changing their swatches may change their contrast/order. Every **#** picker offers 60 theme shades, 12 standard colours, recent colours and hex entry.

**Arrange:** Shift/Ctrl-click to select several shapes/text/code nodes, or enable **Arrange → Select multiple** and drag a selection rectangle on empty canvas. **Select shapes** selects the diagram without its title/method text. Group/ungroup objects, move them together, and use the corner handles or width/height inputs to resize. **Lock proportions** preserves their ratio. **Center selection on canvas** centers the whole selection; Align controls align individual objects. Bring forward/backward or front/back changes stacking across shapes, text and code nodes. Ctrl/Cmd+G groups; Ctrl/Cmd+Shift+G ungroups. Arrow keys nudge a multi-selection (Shift = ten units). Groups and layers are saved with the canvas and named drafts.

**Legends:** double-click titles/entries to edit; use the shared text tools. Drag the background to move and the corner to resize. **Legend** offers entry visibility, up/down order, columns and reset; trash removes an entry or the legend. Legends follow visible styles. Fresh generated canvases start without the separate legend to avoid covering labels; use **Legend → Show legend** when needed. Regenerating the current canvas and loading a named draft retain its legend visibility.

**Navigation:** mouse-wheel zooms around the pointer; Ctrl/Cmd plus/minus zooms and Ctrl/Cmd+0 fits. Use scrollbars to pan. Node tools open code details/memos. Removing a code node hides it from the diagram; **Codes → Add codes** restores it.

**Working canvas:** leaving Visualization or following a source link unloads the renderer and retains your edits. Returning to the tab resumes the canvas, including legend formatting and zoom. The library also offers **Open current canvas**. View settings are saved once when leaving the editor; no background graph generation runs. Named drafts remain useful for keeping multiple versions. Generating a new figure replaces the current canvas.

**Save/export:** **Drafts → Save map draft** retains the type, generation settings, layout, text/styles, annotations and legend. Reusing a name replaces that draft. Drafts travel in project JSON backups. Export SVG, PNG or JPEG; image resolution scales text and legends, and SVG remains scalable. Set **Printed width (mm)** and **Check print readability** to estimate the smallest text in points and raster DPI at the intended figure width. Increase fonts, reduce items or use a wider figure when text becomes too small. Vector exports include a title, method description and source-document names.

### Sankey diagram

Choose a preset and read its requirements. Use project coding for document → code/theme summaries, a link table (`source,target,value,source_stage,target_stage`), or complete path rows (2–8 stage columns plus `value`). Values must be positive and stages numbered 1–8. Alluvial paths retain the same cohort through every stage; pairwise links alone cannot establish those paths. Hierarchical diagrams require one parent per node; circular diagrams allow explicit feedback. The fictional example button supplies test data, clearly separate from project coding.

Widths share one linear scale. Imbalanced nodes are reported without inventing flows. Coding summaries show assignments, not movement or causation; multi-coded passages contribute to each code. Settings control stage headings, ordering, bar width/gaps, values/percentages, ribbon opacity, curve and source/target/gradient colours. Keep diagrams focused (up to 200 nodes/500 ribbons, at most 20 feedback ribbons).

Select a node label and use **Node label placement** in the right Inspector: Inside bar, Outside left/right, Above, Below or Free position. **Distance from boundary** sets the outside gap; inside labels use **Inner padding**. Anchored labels follow the bar and fit available space. Set writing direction/rotation with the shared text tools; Free position restores manual placement.

### Word cloud

Select documents, a word limit (up to 300), whole-document or merged-coded text, language and minimum occurrences. **Words longer than** counts Unicode base letters: English defaults to more than 3, Bengali to more than 2. Bengali vowel signs, virama and combining marks do not increase length. These are letter counts, not syllable counts. The same language/length controls appear in Analysis → Word frequencies.

Below selected-item formatting, the right Inspector has **Word exclusions**, a stop-word text box, role-word exclusions and **Import a stop-word list** for text/CSV files. Edit comma/newline-separated words, then click **Apply Changes**. Typing does not regenerate. Applying preserves palette/settings and rebuilds word positions. Edited or deleted headings and added objects remain as you left them; save a named draft to keep an earlier layout. Unapplied exclusions are retained when changing tabs.

Choose ellipse, rectangle, diamond, heart, star, **Random (organic shape)**, or an uploaded PNG/SVG mask. Random shapes and word positions repeat with the same **Layout seed**; change the seed for another version. Images support alpha/dark masks, inversion and front/back overlays. SVG masks are sanitized and rasterized locally; exported words remain vector text. Use a clear silhouette.

**Word spacing** controls gaps; 0–1 packs tightly. Compact/Balanced/Loose controls the position search. Font, size range, scaling, rotations, canvas dimensions and seed are adjustable. Clouds scan at most 2 million characters and report omitted words. Select a word for its source links. Word sizes follow frequency by default (square root, linear or logarithmic). Choose **Uniform size** and a font size for equal words. Manually changing a word’s font size automatically refits the cloud after a brief pause; that size overrides scaling and is retained in drafts. Other manual text/style changes may require regeneration. If a requested size cannot fit, the previous cloud stays in place and a message explains why.

English/Bengali have small built-in stop lists. Other languages use native word segmentation and a locale code. Import a small local JSON language profile (`name`, `locale`, `minLetters`, `stopWords`) to reuse preferences without downloading language models. Review results and stop words for each language; automatic stemming is not performed.

### Histomap

Histomap and Dendrogram settings follow **Prepare data → Choose display → Generate**. The numbered links jump to each section. A readiness message shows missing inputs, the records in scope, and exclusions/gaps to review. Generate becomes available when the required inputs are valid. Readiness checks do not draw a graph or run clustering.

Select the Histomap card. In **Prepare data**, select sources, codes and coder, then read **What this graph needs**. Define 2–12 ordered periods; dates are optional. Assign a document default only when all its material belongs to one period. Use **Passage overrides** for mixed-time interviews. Explicit passage overrides take priority over source passage tags and document defaults. Assignment overrides are saved with this visualization and its named drafts; imported source tags remain the defaults. To remove a passage from temporal analysis, choose Exclude/unassigned. Conflicting periods on identical coder ranges must be resolved or filtered to one coder.

Choose direct codes, documents, a coder and custom limits; six to eight themes are recommended for readability. **Share** makes each available period's band widths sum to 100% of the displayed code assignments; **Count** uses one common passage-count scale. Exact duplicate code/document/range assignments across coders count once, and multi-coded text contributes to each displayed code. Unassigned records are excluded and counted in the caption. Periods without assigned source data are gaps; periods with data but no selected-code assignments show zero. Gaps are not interpolated, and spacing is ordinal rather than elapsed duration. Select bands or period labels for source links.

The updated climate demo provides four researcher-defined story-time phases and an auditable CSV. These are fictional training tags, not import dates or measured longitudinal observations. Open its named Histomap draft for a varied example.

### Dendrogram

In **Prepare data**, choose whether to compare documents or codes and select the sources/coder. You do not enter similarity scores. Readiness requires 2–100 non-empty items and lists excluded empty items. **Choose display** sets the title and tree orientation; **Generate** builds the clustering.

Select documents or codes to cluster, select source documents/features and choose a coder. At least two non-empty items are required; empty items are excluded and listed. Horizontal and vertical layouts use the same calculation.

The algorithm converts direct coding to presence/absence, so repeated coder assignments do not increase similarity. **Jaccard distance** is one minus shared presences divided by all presences in either item. **Average linkage** joins the groups with the smallest average pairwise distance. The joining axis is 0 for identical presence patterns and 1 for no shared presence. Equal distances are ties handled in selected source/code order. Branch height is distance, not confidence, importance or causation. Select leaf labels to read the original document/code evidence.

The revised demo's Dendrogram draft clusters its four interviews using Amina's coding. Inspect the source differences rather than treating a small fictional cluster as a finding about countries.

## 9. About

- **Application:** eQc — Easy Qual Coding.
- **Version:** your installed version; use **Check for Updates** for newer releases.
- **Author:** Anisur Rahman Bayazid.
- **Acknowledgments:** the CARE project and BRAC James P Grant School of Public Health, BRAC University.
- **Contact:** click the email to open your email app; right-click for **Copy email address** or **Copy link address**.
- **License:** MIT, for commercial and non-commercial use.
- **Source & releases:** open GitHub, or right-click the link and choose **Copy link address**.


## 10. LAN collaboration

Use **LAN → Host** to share a project on a trusted local network. Colleagues use **Join**, select the host or enter its address, and connect with the session details.

Check each person's coder name. Project coding and research records are shared; personal profiles and time histories stay separate. For remote or offline teamwork, exchange project files and merge them. Export a backup before starting a team session.


## 11. Profile and time

**Profile picture:** upload a PNG, JPEG or WebP image (up to 2 MB and 25 megapixels), drag to center your face, and use Zoom to frame it. Save picture applies it to the profile and header avatar; Cancel keeps the previous picture. **Adjust photo** reopens the full image, and **Reset position** returns to centered 100%. Arrow keys move the photo; Shift moves farther. Framing is saved with the profile and travels in JSON profile backups.

The round avatar at the top right opens Profile. Choose **Active profile** or create a **New profile**. Name, email, role, organisation and photo are optional. A profile name is also used for new coding and LAN presence; earlier coding keeps its recorded author.

Review app and coding time by day, Sunday–Saturday week, month, year or project. Tracking pauses when the app is not active, after five idle minutes, or when manually paused. Export time records to CSV. JSON project exports can include the selected profile's history; repeated import avoids duplicate recorded sessions.

Profile deletion removes that profile's local details and time records, not research projects. Keep a backup if you need its history.


## 12. Supported files

| Material | Formats | Notes |
| --- | --- | --- |
| Standard documents | .txt, .md, .docx, .pdf | Markdown imports as coding text; Word/PDF can retain originals |
| Images | .png, .jpg/.jpeg, .gif, .webp, .bmp, .heic/.heif | HEIC/HEIF still photos convert locally |
| Structured coding | .csv | Preview and map columns before import |
| Projects/codebooks | .json, .qdpx, .qdc, .qde | QDE needs its adjacent sources |
| Exports | .json, .qdpx, .csv, .docx, .xlsx, .html | Excel is available for Memo-Book exports |


## 13. Keyboard shortcuts

Click inside a text reader to place the selection point. Hold **Shift+Left/Right** to select characters or **Shift+Up/Down** to extend across displayed lines. **Ctrl+Shift+Left/Right** selects by word; **Shift+Home/End** selects to a line edge, and **Ctrl+Shift+Home/End** selects to the start/end of the reader. These keys work in Plain text and matched original text without editing the source.

Choose a **Shortcut profile** below: Standard, Coding bar, Quick coding, Numbered codes or Selection-first. The choice is remembered on this computer. Open **Active shortcut keys** to see the keys that work in the selected profile. Profiles cover existing eQc functions; they do not add features from another application.

| Profile | Main coding keys (Windows) |
| --- | --- |
| Standard | Ctrl+J code picker; Ctrl+L last code; Ctrl+Shift+V in-vivo |
| Coding bar | Ctrl+Q/Ctrl+F2 code picker; Ctrl+F8 in-vivo; Ctrl+F9 last code |
| Quick coding | Ctrl+K new code; Ctrl+J code picker; Ctrl+L last code |
| Numbered codes | Ctrl+1–9 assigned codes; Alt+L last code; Alt+I in-vivo |
| Selection-first | Space opens the code picker for a selected passage/region |

- Select text or an image/PDF region before using a coding shortcut.
- The code picker focuses **Search codes**; type a name and press **Enter** to apply the first match.
- **Last-used code** repeats the code most recently applied in this project.
- For Standard or Numbered codes, open **Assign codes to Ctrl+1–9** and choose your frequent codes. These assignments belong to this project on this computer.
- **Ctrl+S** saves current work, including an open document memo or memo form. **Ctrl+Z** undoes project edits; **Ctrl+Y / Ctrl+Shift+Z** redoes them. Editing fields retain native text undo.
- **F1** opens Help. **Esc** closes supported dialogs. **Tab / Shift+Tab** moves between controls.

On macOS, use **Cmd** for Ctrl and **Option** for Alt; the active table shows your platform's labels. Numbered-code coding aliases also support Cmd+Option combinations. In typing fields, normal clipboard, selection and text-editing keys are preserved. Space opens Selection-first quick coding only with an active source selection, outside a typing field or button.

A linked-memo shortcut starts a memo linked to the current Workspace source or Codebook code. The memo-navigation shortcut opens Memo-Book. Journal and matrix shortcuts open their corresponding eQc writing/analysis views. Playback, rich-text formatting, internal hyperlink and other unsupported commands are not assigned.

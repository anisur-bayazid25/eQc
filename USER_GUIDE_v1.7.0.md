# eQc — Easy Qual Coding

## Complete User Guide & Documentation (v1.7.0)

eQc is a lightweight, **local-first** qualitative data analysis (QDA) desktop application for organising and analysing text and images. All your data — documents, codes, memos, matrices — is stored **locally on your device**. Nothing leaves your computer (except, optionally, the project backups you choose to export or share, or the updates you deliberately send to a LAN session).

This guide walks through **everything** in the app, from your first project to advanced Code Map diagrams, LAN team sessions, and every analysis view.

---

## Help, project exports and everyday coding (v1.7.0)

The top navigation is **Workspace → Codebook → Auto-Code → Analysis → Code Map → Help → About**. **Help** works offline: search the complete user guide or application documentation, open a section from its dropdown, or choose **Read complete documentation** to expand all sections. Search matches section titles and content; use a short phrase or keywords. Light/Dark controls remain outside tabs; About remains one wide panel.

### Export a project

Open **Project tools → Export**, choose **JSON — eQc backup** or **QDPX — REFI-QDA exchange**, then choose **Original documents and coding text** or **Plain text only — smaller file**. Original attachments are included by default. The smaller option omits retained Word/PDF binary files while keeping coding text, codes, memos, cases, groups, queries, annotations and image coding, including coded PDF page snapshots. It does not change the open project or erase its originals. JSON is the full eQc project backup; QDPX exchanges supported sources and coding, with advanced eQc research records carried as notes/appendix. Local activity and recovery checkpoints do not travel with either format. Cancel the save dialog to leave the export unfinished.

### Import a project or codebook

The existing **Project tools → Import** accepts **JSON**, **QDPX**, **QDC** and **QDE** in one file dialog and creates a separate project. JSON restores an eQc backup; QDPX is the packaged project exchange format and is the preferred choice for ATLAS.ti/NVivo transfers. QDC transfers the codebook only, without documents or excerpts. QDE is unpacked project XML: keep it beside the matching `sources` folder, or select the original QDPX archive. Referenced files that are missing cannot be recovered from XML alone. An import with unavailable/unsupported sources reports the omissions; if no referenced source can be imported, it stops without creating an incomplete project. **Codebook → Import → REFI-QDA** remains available to add exchanged coding to the current project.

### Codes & Strips

Select a document and click **Codes & Strips**, beside **Portrait** and **Lines** in the reader toolbar. This remembered toggle shows narrow vertical coloured bars and vertical code names beside coded passages, with separate lanes for overlapping coding. Hover or focus a bar to widen its colour by 3 pixels; click the bar or label to jump to its excerpt. Long names and short passage labels may be truncated: the tooltip gives the full code name and coder. Stripes follow rendered text in Plain text and mapped Word/PDF views; PDF shows coding for the displayed page. The Reading menu also offers the toggle. Labels and hover/focus styling follow the document viewer’s Paperwhite, White or Dark setting independently of the app theme.

### A simple excerpt-review workflow

Open **Project tools → Research tools → Review**. Choose **Query codes** and/or **Sources**, optionally enter words in **Find in excerpts or notes**, then click **Run query**. Empty selections retrieve all coding. Read the highlighted excerpt with surrounding text, or choose **Open source**. Export the results to CSV or Word. Check individual cards only when you want to export or refine a subset; without checks, export includes all retrieved results. **Advanced filters and combined queries** contains code combinations, code/document groups, cases, attributes, coder, child codes and key-excerpt filters. Save a named query for repeat use. Changing filters clears old results so they cannot be mistaken for the new query.

### Memo tools

In **Research tools → Notes**, create and search linked analytic, methodological or journal memos. Each memo has **Copy memo text**, **Export memo Word** and **Export memo CSV**. Select memo checkboxes and expand **Export or merge selected memos** to export a subset or merge into a selected destination. Merging retains the destination title, purpose and creation date, appends other memo texts under their original titles, and combines document/code/case/excerpt links without duplicates. A confirmation explains removal of the other standalone memos; close Research tools and use Undo to restore them if needed. Passage annotations and attached source/code/excerpt/framework memos also have selection, copy and export controls; attached memos can be edited in Notes. **Export research records** still exports all research notes and other research collections.

### Selecting and merging existing memos

All nonempty source, code, excerpt, image, region, case, framework and relationship memos appear with selection checkboxes and individual edit/copy/export controls in Notes. Passage annotations can also be selected for export or consolidation. **Select all memos** includes these attached memos as well as standalone memos. For a merge, choose **New combined memo** and enter its title, or choose a selected standalone memo as the destination. The combined memo retains all text under its original memo titles and combines source/code/case/excerpt links. Confirmation explains that selected attached memo fields will be cleared and selected standalone memos consolidated; the underlying sources, codes, coding and annotations remain. Use Undo after closing Research tools to restore the originals.

### Understanding ICR and Consensus counts

The team-analysis tab is **ICR** (inter-coder reliability). Its coder selectors show **text coding entries** and **image regions** for the current scope. A passage assigned three codes creates three coding entries. The agreement table uses a different unit: one source–code pair, counted once per coder even when a code appears several times in a source. Percent agreement includes pairs neither coder used; many unused pairs can produce a high percentage alongside low Holsti or κ.

**Consensus** groups overlapping text coding entries into passage groups, including multiple codes on the same words. It shows the total text entries, total passage groups, jointly coded groups available for review and single-coder groups hidden. Image regions are excluded. For example, 62 text entries plus 6 image regions for one coder do not imply 68 consensus passages: the text entries may form 30 overlapping groups, and only a few groups may have a second coder. Open **Counts by coder in the current scope** to compare the underlying entries. Changing coders or documents changes both views' scope. These measures describe different units; their totals are not expected to match.

### History in an updated app

History and recovery require the current desktop app process. If the app asks you to restart these tools after an update, first save your project, fully close eQc and open it again. Reloading a document or switching tabs does not load the updated desktop process. Your saved projects remain on this computer.

### Coding refinement: where to find each action

1. **Reassign existing coding:** in Review, Run query, check the relevant cards, open **Refine selected coding**, choose the destination code and click **Reassign coding**. This moves those coding entries; it does not add a second copy.
2. **Split a code:** retrieve one code, check the excerpts that belong in a separate concept, open **Refine selected coding**, enter **New code name for selected excerpts**, then **Split into new code**. The new code is a sibling of the original; unchecked excerpts stay under the original. Text and image coding are supported, but selected entries must come from one code.
3. **Adjust a text boundary:** choose **Adjust passage** on an excerpt card. In the source's Plain text view, select the replacement words, then **Selection actions → Update passage**. The same coding entry retains its memo, coder, creation date and key-excerpt status. Cancel adjustment to keep the old passage. Image regions are reviewed using their existing image controls.
4. **Create an in-vivo code:** select words in the reader, choose **Selection actions → Create in-vivo code**, review the suggested name, then **Create and apply**.
5. **Apply several codes at once:** select text, open **Selection actions → Apply multiple codes**, check codes and choose **Apply selected codes**.
6. **Merge codes:** open **Codebook → Merge**, select the codes and a survivor, review the merge, then apply it. Related coding and research links follow the survivor. Use a named History checkpoint before substantial reorganisation.

## Research tools

Open **Project tools → Research tools**. One workspace has five sections—Cases, Groups, Review, Notes and History—so document coding and existing navigation stay compact. Controls use standard research terminology with original wording and layout. Light/Dark stays outside these sections.

1. **Cases and attributes:** create people, organisations, places or other cases. Enter attributes as one Name=Value per line. Link whole documents/images, or select a participant's passage and choose **Selection actions → Link to case**. One case can span several sources; an FGD can contain several passage-linked participants. Whole-source links associate all coding with that case; use passage links to distinguish speakers. Import CSV with Case, optional Document (exact source names separated by semicolons), and other columns as attributes.
2. **Document and code groups:** create reusable, overlapping sets independently of folders and code hierarchy. Source groups include documents and images. Use groups in Review queries.
3. **Saved queries:** select codes, groups, sources, cases, attributes, coder, excerpt/memo text and key-excerpt status. OR retrieves any selected code. AND requires every selected code somewhere in the scoped source. WITHOUT excludes scoped sources containing B codes. Overlap requires intersecting text ranges/image rectangles. Nearby compares gaps in coding-text characters, for text only. Scope applies before combinations. Save named definitions and rerun against current data. With child codes included, child coding satisfies its selected parent branch; siblings are not all required. Empty code/source selections mean all; explicitly selected empty/deleted groups retrieve none.
4. **Excerpt review:** retrieve text/image coding, show surrounding text, open sources, select results and export CSV or table-free Word reports. With nothing checked, export all results; checked entries restrict export. Compare cases shows coding-entry counts by code with attributes. Shared case membership contributes to each case; counts are descriptive, not participant prevalence.
5. **Coding stripes:** **Codes & Strips**, beside Portrait and Lines, adds an optional coloured margin with code names and full-name/coder tooltips. Click to jump to the passage. Stripes follow rendered text in Plain text and mapped Word/PDF views; PDF shows only the displayed page's text coding.
6. **Annotations and notes:** **Selection actions → Add annotation** creates an independent passage note, shown with dotted underlining. **Notes** searches annotations, existing source/code/excerpt/image/region/framework/relationship memos and standalone analytic, methodological or journal memos. Standalone memos can link documents, codes, cases and excerpts. Attached memos can be edited, copied, selected and exported directly in Notes or through their original controls.
7. **Refinement:** **Review → Refine selected coding** reassigns coding in bulk or moves selected excerpts from one code into a new sibling code. **Adjust passage** opens Plain text; select a replacement and choose **Selection actions → Update passage**. Coding identity, notes, coder, dates and key status are preserved. Selection actions also creates an in-vivo code from selected words or applies multiple codes together. Existing merge and undo/redo remain available.
8. **Activity and recovery:** **History** lists saved-content changes with actor labels and exports CSV. Create named checkpoints before substantial edits. Restore requires confirmation and first saves current work as a “Before recovery” checkpoint. Automatic points retain the previous saved state at most once per ten minutes of content changes, rotating the latest ten. Named points remain until project deletion; activity retains the latest 5,000 entries. Records survive restart on this computer; they are a research aid, not an authenticated audit trail or protection against disk failure.

**Exports and preservation:** Notes → Export research records offers CSV, narrative Word and HTML with source/code/case names and locations. Full analysis HTML includes these records. Coding CSV/Word also carries case names/attributes; summary mode includes overlapping annotations and linked memos. JSON backups/LAN retain the collections; code/project merges remap links. Source edits relocate annotation/case ranges; unmatched notes and case quotations become clearly labelled unlinked memos. QDPX retains these research records for re-import into eQc. Other applications may show them as notes rather than their own cases, groups or queries. Local recovery history/checkpoints stay on this computer and do not travel in JSON/QDPX. Continue exporting regular backups.

Available in v1.7.0.

## Formatted Word and PDF coding

Documents with retained originals now offer **Original view** and **Plain text** in Workspace. Original view is the initial preference; your last view choice is remembered. Text-only documents still use Plain text. Attach a missing original through **Original → Attach original** to enable formatted viewing.

- **Word:** view document styles, headings, tables, lists, headers/footers and embedded images. Select body text (including table cells), then click or drag a code from the existing legend/search. Existing and overlapping coding is highlighted; click a highlight to inspect, memo, star or remove its coding. Zoom starts at **Fit width** and follows the available space. Word pagination and advanced layout can differ from Microsoft Word; the retained file remains unchanged.
- **PDF:** view original pages with **Previous/Next**, a page selector, **Fit width** and percentage zoom. **Text** mode selects the PDF text layer and saves excerpts against the existing source text. **Region** mode draws a rectangle on a page, then applies a code. Scans without a text layer support Region coding; their OCR text stays codeable in Plain text. Text selections are made within one displayed PDF page at a time.
- **Reliable locations:** selected text is connected to the matching passage in your coding text, including repeated quotations. A selection with unmatched/altered text is rejected with a Plain text fallback instead of guessing an excerpt position. Generated header/footer/footnote markers are view-only when absent from the coding text. Text edits or a mismatched attachment disable text coding in Original view; original PDF region coding remains available. **Edit text** changes the coding text, not the Word/PDF original. Source line numbers and reading-font controls apply to Plain text; original views use source formatting and zoom.
- **PDF region exports:** the first region coding on a page stores a linked PNG page snapshot, labelled with the document name and PDF page number. Further regions reuse that snapshot regardless of zoom. These regions participate in existing image coding, memos/stars, analysis and all image-capable CSV/DOCX/HTML/QDPX exports. QDPX transfers them as standard PictureSource/PictureSelection entries alongside the original PDF, rather than native PDF-region selections. **Go to Image** opens the retained page snapshot. JSON backups/LAN retain page links; merges remap document IDs and reuse linked pages. Renaming/moving the document updates linked page names/folders; deleting it also removes linked snapshots and regions after confirmation. Original attachments replaced later do not overwrite older coded page snapshots.

Rendering stays local; original documents are not uploaded. Broken/encrypted/unsupported originals show a recoverable message and leave Plain text available. Saving through **Original → Save original** preserves exact source bytes; narrative excerpt reports keep their established table-free export layout.

## Source lines and REFI-QDA compatibility

Version 1.7.0 retains original Word/PDF files alongside the plain text used for coding. New regular, dropped, scanned-PDF and Word-comment imports retain their originals. **Workspace → Original** opens a copy in your system viewer, saves the exact imported file, or attaches/replaces an original for an older text-only document. Attaching an original does not replace your coding text. Text edits leave the original unchanged; the menu indicates a mismatch. Original bytes travel with JSON backups, LAN project data and project merges, so these projects/backups are larger than text-only ones. Existing projects continue to work without re-importing; attach an original if formatting is needed.

**Lines** shows stable, one-based source-line numbers in the text reader. Blank lines count; screen wrapping, fonts and window size do not change the numbers. Codebook excerpt cards and text-excerpt CSV/DOCX exports include the corresponding line range. Editing the source text can change those ranges. These numbers refer to eQc’s coding text, not Word’s layout-dependent native page lines or inferred PDF text lines. Native numbering, tables, fonts and original page layout stay in the retained file. Formatted Word/PDF coding is available in Original view.

**REFI-QDA export** preserves code hierarchy, memos, coder names and text/image excerpts in a standard exchange file. Other supported image formats convert to PNG. Unreadable images or invalid coding stop export with an explanation. Use **Codebook → Import → REFI-QDA (QDPX / QDC)** to import a full project or standalone codebook; legacy eQc files remain readable.

When the coding text still matches the retained original, QDPX includes the original Word or PDF file alongside the coding text. If the text was edited or an attached file has different extracted text, QDPX exports the current coding text without pairing it with that outdated original; the original remains available locally and in backups. Previously imported text-only documents cannot recover formatting until you attach the original file. Interoperability still depends on the receiving application: [NVivo’s REFI-QDA documentation](https://help-nv.qsrinternational.com/14/win/Content/projects-teamwork/refi-qda%20standard.htm) lists PDF text coding, framework matrices, maps and source-folder structures among transfer limitations. These changes have passed schema and ATLAS.ti-reference round-trip checks; a direct NVivo import is still to be verified.

## Layout and navigation in v1.7.0

All existing functions are retained. Frequently used controls stay visible, with secondary controls grouped by task. Work surfaces fill the space below the header; long source/code lists, long analysis results, expanded tools and small windows still scroll as needed.

- **Header:** choose a project, create/rename it, use LAN, undo/redo and save directly. **Project tools** contains project backup export/import and merging other projects. **Reading** contains the reading font and A−/A+ size controls. Light/Dark stays directly available on the toolbar; document Paperwhite/White/Dark controls also remain visible. Menus close on Escape or clicking outside.
- **Workspace:** use **Add source** for root folders, documents, OCR PDFs and images. **Search text** searches source content; document-name search stays above the tree. Expand **Sort & coder filter** to change ordering or coder scope. Sidebars are responsive and still manually resizable.
- **Codebook:** the left sidebar has **Details**, **Merge**, **Export** and **Import** tabs. Details edits the selected code’s name, color, definition and memo, including Pull Subcode Summaries. Merge has a searchable code picker and survivor selector. Export chooses **All codes** or **Selected codes**, contents and CSV/DOCX; selected exports optionally include descendants. Merge and Export share their selection, which is separate from the code being viewed. **Project exports** expands to show complete-project QDPX, codebook-only QDPX, all notes/memos and Manuscript Skeleton. Starred Excerpts and Starred Images remain available. Import offers CSV, REFI-QDA and Word-comment import. Switch task tabs with Left/Right arrows, Home or End. Draft fields remain mounted when switching sidebar tasks.
- **Analysis:** **Coding** contains Frequency, Documents, Co-occurrence and Framework; **Text** contains Word frequencies and KWIC; **Team** contains Reliability and Consensus. Full analysis names appear in tooltips. In Reliability/Consensus, expand **Scope** to select coders/documents/images; the collapsed summary displays the active selection, which still applies to the HTML report. All eight views and their existing analysis/export actions remain available.
- **Code Map:** **View** contains folding/view modes, child limits, co-occurrence thresholds, re-layout and legend. **Draw** contains edge drawing and all annotation shapes. **Canvas** contains page presets, custom dimensions and orientation. **Codes** contains add/remove-from-map actions. **Export** contains legend inclusion and SVG/PNG/JPEG downloads. **Help** explains interaction. **Fit** initially shows the full canvas and follows window resizing; using the slider, +/− or **100%** switches to manual zoom. Select Fit again to resume automatic fitting. Fullscreen and Esc remain available. Screen zoom does not change the logical canvas or export dimensions; full code names are available on hover.
- **About:** app details and project information share one wide panel, with compact information rows that stack at narrow widths. Creator, CARE/BRAC acknowledgment, contact, license, release link and update check remain available.

Standard desktop layouts (1920×1080, 1366×768, 1200×800 and 1024×720) were checked with representative source and code data. Layouts were also checked at 800×600 and 640×480, including natural scrolling, popup bounds and map fitting. Larger datasets and longer memos may require scrolling even on large screens.

## Updates through v1.6.4

### Merging codes

In **Codebook → Merge**, check the codes in **Select codes**, choose **Code to keep after merge**, then click **Merge selected codes** and confirm. For example, select three sibling codes and keep one to reduce ten child codes to eight. Rename the retained code in Code Details if needed. The retained code keeps its identity, color and position. Its definitions and summaries incorporate the other codes’ text with origin labels. Descendant codes move under the retained code; their own coding stays on those descendants. Text and image coding keeps coder attribution, notes and stars. Framework cells and relationship memos combine; map references follow the retained code, while internal self-links disappear and their relationship memos move into the retained summary. Coding records are preserved individually, including overlapping records, to retain coder history and notes. Use **Ctrl+Z** to undo the merge. An ancestor cannot merge into its descendant; keep the ancestor instead.

### Exporting one or several codes

Open **Codebook → Export**, choose **Selected codes**, then check one or multiple codes in **Choose codes**, or click **Use current code**, optionally enable **Include their subcodes**, choose the existing scope, then click **CSV** or **DOCX**. Choose **All codes** for the whole codebook. The selection also applies to Starred Excerpts and Starred Images; REFI-QDA, Notes & Memos, and Manuscript Skeleton continue to use the whole project.

Every CSV/DOCX scope includes **Document** names (image names for image coding). **DOCX uses no tables:** each source heading is followed by the full code path, then numbered excerpts on separate lines. Small muted labels show the excerpt count, coder and key-excerpt status; text keeps its line breaks, and image excerpts include a cropped preview, region position and memo. **Codes + excerpts + summaries** additionally includes code definitions, code summaries, source memos and document–code framework memos. **Codes only** lists source associations, counts, definitions and summaries without excerpt content. Uncoded codes appear in a separate section. Starred Excerpts and Starred Images use the same Word layout. Counts represent coding entries, including overlapping passages and separate coders; coverage percentages are omitted.

**CSV remains tabular**, with source names, hierarchy, quotes or normalized image coordinates, coders and excerpt memos; summary mode adds code definitions/summaries. Uncoded codes have blank source/excerpt cells. CSV exports retain the importer-compatible headers. The redundant document-inclusive mode remains removed, and option titles stay the same.

**Filenames:** a single-code export defaults to `Project name_Code name.docx` (or `.csv`); multiple selected names are joined with ` + `, and All codes uses `Project name_All codes`. Including descendants keeps the explicitly selected parent names in the filename. Starred exports add a descriptive suffix. Bengali and other Unicode names are preserved; invalid filename characters are replaced and long names shortened. Choose another name in the save dialog if needed. Available in v1.7.0.

### Reliability and consensus (v1.6.0–1.6.4)

**Analysis → Inter-Coder Reliability** compares attributed coders. Select coders, documents and whether to include images; choose two distinct coders for percent agreement, Cohen’s κ and Holsti’s index. Occurrence metrics use one source × code item; multiple quotes with the same code in that source count as one positive occurrence. Fleiss’ κ is available with three or more coders. Krippendorff’s c-Alpha-binary uses present/absent ratings and Cu-Alpha uses overlapping text passages with uncoded ratings included. κ and α are chance-corrected; Holsti is an uncorrected ratio. Undefined coefficients appear as **—**. Unattributed records are excluded and disclosed; assign them a coder in Project Settings if appropriate.

**Analysis → Consensus** reviews overlapping text passages coded by at least two selected coders. Agreement requires the coders who actually coded the passage to assign the same single code. A third coder who did not touch the passage does not turn agreement into disagreement; single-coder passages are counted separately and excluded from review. Filter agreements/disagreements, keep a coder’s coding, delete all coding on a passage, or remove individual segments. Use Ctrl+Z to undo adjudication. Consensus reviews text; the images toggle affects source-occurrence ICR.

The **HTML Report** includes every dashboard analysis, the currently selected ICR scope and pair, all available coefficients and per-code results, the complete consensus summary and coder assignments, and cropped image coding. Consensus exports both statuses regardless of its current filter and describes the current state, not an adjudication audit history. Word frequencies and KWIC use the last generated list/search; sections explicitly state when those have not been run. A KWIC search with no matches is reported as zero matches.

Codes also have a separate **Definition** field for coding rules. CSV import, project merge, REFI-QDA round-trips and reports retain definitions. Merging another coder’s project also preserves images, regions, framework cells, relationship memos and map edge styles; conflicting analysis text is retained. Deleting a code removes its dependent matrix cells, relationship notes and hidden-map entries. v1.6.2–1.6.3 corrected these data-integrity and consensus behaviors.

### Acknowledgments

eQc gratefully acknowledges the contributions of the CARE project and BRAC James P Grant School of Public Health, BRAC University, to its development.

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Start — Your First Project in 5 Minutes](#2-quick-start--your-first-project-in-5-minutes)
3. [Header Bar & Project Management](#3-header-bar--project-management)
4. [The Workspace Tab (Document Editor & Manual Coding)](#4-the-workspace-tab-document-editor--manual-coding)
5. [The Codebook Manager (Codebook Tab)](#5-the-codebook-manager)
6. [The Code Map Tab (Visual Diagramming)](#6-the-code-map-tab-visual-diagramming)
7. [The Auto-Coder Tab (Automated Coding)](#7-the-auto-coder-tab-automated-coding)
8. [The Analysis Dashboard Tab (8 Modes of Analysis)](#8-the-analysis-dashboard-tab-8-modes-of-analysis)
9. [LAN Collaboration (Real-Time Team Sessions)](#9-lan-collaboration)
10. [The About Tab](#10-the-about-tab)
11. [Supported File Types — Quick Reference](#11-supported-file-types--quick-reference)
12. [Keyboard Shortcuts](#12-keyboard-shortcuts)

---

## 1. Overview

### 1.1 What eQc is for 🎯

eQc is built for the classic qualitative research workflow:

1. **Import** your sources — interviews, focus groups, field notes, documents, images, survey datasets.
2. **Code** the text (and images) into themes — a flexible, nested codebook.
3. **Analyze** — matrices, co-occurrence, framework analysis, word frequencies, keyword-in-context.
4. **Write up** — export excerpts, memos, a manuscript skeleton, and a complete HTML report.

### 1.2 Key highlights ✨

- **Local-first & secure** 🔒 — everything lives locally on your machine. No cloud, no account, no uploads.
- **Dual theme** 🌗 — Light "paperwhite" mode (default) and Dark mode, toggled from the header.
- **Flexible workspace** 🪟 — resizable, draggable panels throughout every tab.
- **Multiformat support** 📄 — `.txt`, `.docx`, `.pdf`, scanned PDFs (local OCR), images (`.png`, `.jpg`, `.gif`, `.webp`, `.bmp`), structured `.csv` datasets, Word-comment files, and REFI-QDA `.qdpx` projects (NVivo, MAXQDA, ATLAS.ti, Taguette) — imported **and** exported in **both** directions.
- **Live collaboration** 🌐 — host or join a LAN coding session so a small team can code together in real time (see [Section 9](#9-lan-collaboration)).
- **Coder attribution** 👤 — every coded passage records who coded it, so multi-coder work stays auditable.

### 1.3 The seven main tabs 🗂️

| Tab | What it's for |
| --- | --- |
| **Workspace** | Read documents, code them, manage the document tree |
| **Codebook** | Build and manage your code hierarchy, memos, imports/exports |
| **Auto-Code** | Automatically find and code keywords/phrases across the whole project |
| **Analysis** | Frequencies, matrices, framework, word frequencies, KWIC, HTML report |
| **Code Map** | Turn your codes into a visual diagram on a canvas |
| **Help** | Search the complete guide or open instructions by section |
| **About** | Version, updates, acknowledgments and license information |


---

## 2. Quick Start — Your First Project in 5 Minutes

Here's a minimal end-to-end example so you can see the whole pipeline before diving into details:

> **Example — a small interview study.** You interviewed three teachers about online teaching. You have three `.txt` transcripts, and you want to find themes like "technical problems" and "student engagement".

1. **Create a project** ➕ — click **New project**, give it a name (e.g. `Teacher Interviews 2026`).
2. **Add documents** 📄 — go to the **Workspace** tab, and in the left panel open **Add source** and click **`+ Doc`** and pick your three transcripts. They appear in the document tree.
3. **Make a code** 🏷️ — in the code legend on the right, click **`+ Root Code`** and type `Technical problems`. Then **`+ Subcode`** under it and add `Internet issues`.
4. **Code a passage** ✂️ — click a document in the tree, drag to select the sentence *"the Wi-Fi kept dropping during the class"*, then click the `Technical problems` code in the legend. Done — the passage is highlighted.
5. **Look at your analysis** 📊 — switch to the **Analysis** tab. The Coding Frequency view shows your new code's count. Click **⬇️ HTML Report** to export a complete report.
6. **Save** 💾 — eQc auto-saves; the header shows **`✓ Saved`** when the project is safely stored.

That's the loop: import → code → analyze → export. Everything else in this guide deepens one of those steps.

---

## 3. Header Bar & Project Management

The header has two rows:

- **Top row:** brand + the main tabs (Workspace · Codebook · Auto-Code · Analysis · Code Map · Help · About).
- **Bottom row:** project controls, the **🌐 LAN** button, **Undo/Redo**, reading **font controls**, the **theme toggle**, and **Save**.


### 3.1 Project operations ➕✏️⬇️⬆️🔀

- **➕ New project** — create a fresh local project.
- **✏️ Rename project** — opens the **Project Settings** dialog (which is also where deletion, coder name, and cleanup live).
- **Project tools → Export / Import** — export JSON or QDPX with originals or smaller text-only document data; import JSON/QDPX projects, QDC codebooks or extracted QDE files with matching sources. Imports create a separate project.
- **🔀 Merge** — combine another project's `.json` into the active one. Useful for multi-coder collaboration: when merging, each coder is assigned a stable, distinct color so you can tell their work apart.
- **Project dropdown** — switch between all your projects. The header save indicator shows auto-save status: **`✓ Saved`**, **`Saving…`**, or **`⚠ Save failed`**.

### 3.2 Project Settings (via ✏️) ⚙️

- **Coder name** — this project's coder identity, stamped onto every new coded passage and image region you create (also used when you merge with other projects).
- **Assign N Unattributed item(s) to this coder** — older/imported passages with no coder stamp show as **Unattributed**; this assigns them all to you in one click.
- **Manage Coders (Cleanup)** 🧹 — lists every coder that has coded items with their `n seg · n reg` counts. A small 🗑️ button deletes a coder's work **only after you type the exact coder name** — handy for wiping a typo-cloned coder name (e.g. `bayazid-dev` vs `bayazid_dev`). Unattributed items are deliberately shielded.
- **🗑 Delete this project…** — tucked at the bottom and deliberately *not* a one-click button. It requires **two confirmations in a row** ("Are you sure?" → "This cannot be reverted"), and the safe option is always the green button.

### 3.3 Undo / Redo ↩️↪️

Reverts coding, code-tree changes, memos, image coding, and notes. Shortcuts: **`Ctrl+Z`** (undo) and **`Ctrl+Shift+Z`** (redo).

### 3.4 Reader font controls 🔤

In **Reading** you'll find a **font-family** picker (Georgia, Times New Roman, Arial, Verdana, Calibri, Courier New, or the default) and **`A−` / `A+`** buttons (8–48 px, shown as `Npx`). These only change how *you* read documents — they don't alter the files — and they're remembered on each machine.

### 3.5 Theme toggle 🌗

Switch between Light and Dark mode from the header. The choice is remembered and applied across the whole app.

### 3.6 LAN button 🌐

Opens the collaboration window for hosting/joining live sessions. When a session is active (`·Hosting` or `·Joined`), the button lights up green. Full workflow in [Section 9](#9-lan-collaboration).

---

## 4. The Workspace Tab

The Workspace is where you read and code your sources. It's a three-panel layout: **documents** (left), **document editor** (center), **code legend** (right). All three panels are resizable by dragging the dividers.

### 4.1 Documents panel (left) 📁

- **Folders** — use **`+ Add Root Folder`**, **`+ Doc`**, **`+ Scanned PDF (OCR)`**, and **`+ Add Image`**. Folders nest freely (a folder inside a folder).
- **Document types** — `.txt`, `.docx`, `.pdf` are imported directly. Scanned/image PDFs are turned into selectable text via **local OCR** (everything stays on your machine).
- **Images** 🖼️ — added with **`+ Add Image`**, shown in the tree with a **coded-region count badge** on each row and a **✏️ rename** button. You can drag images between folders.
- **Sort documents** — by name, date added, size, or amount coded.
- **🔍 Search Text** — searches inside the content of *all* documents at once; click a result to jump to that passage in the editor.
- **Document name filter** — narrows the tree as you type.

### 4.2 Document editor (center) 📄

#### Reading 📖

- The document text fills the panel. A **vertical coding strip** (the Document Portrait minimap) runs down the right edge: each colored band marks a coded passage, positioned exactly where it is in the text. **Click a band to jump straight to that passage.** Bands widen on hover so even one-line codings are easy to click.

#### Coding a passage 🖊️

1. Select text in the document (drag across it).
2. Apply a code one of two ways:
   - **Click** a code in the right-hand legend, **or**
   - **Drag** a code from the legend (or from the code-search results) and drop it onto the selection.

> **Example:** select the sentence *"parents never checked the homework portal"*, then click the `Parental involvement` code. The sentence is now highlighted in that code's color.

#### Overlapping & nested coding 🧬

You can code a sub-portion of already-coded text with a *different* code. Both highlight together, and text covered by more than one code gets a **solid underline** to mark that it's multi-coded. Overlapping codings of the **same** code can be cleaned up with the "Clean redundant codings" action (merges them into one passage so counts aren't inflated).

#### The code inspector 🕵️

Click any highlighted passage to open a small popup showing **every** code applied there. From it you can:
- **Remove** a code from that passage,
- **⭐ Star / unstar** it as a key quote (starred quotes feed the Manuscript Skeleton and Starred Excerpts export),
- Add or edit a short **note** on that specific coded excerpt.

#### Code-while-you-search 🔍

Select a passage, click the code search box, and type: your selection is kept (sticky), and **clicking any search result applies that code** to the still-selected text.

#### Document-level notes 📝

The **📝 Notes** button (near "Edit text") opens a memo field for the whole document — whole-case interpretation, observations that apply to the transcript as a whole. A filled-in note shows a bullet marker on the button.

### 4.3 Image coding 🖼️

Images behave like a unit of "text":

1. Open an image from the tree.
2. Use the image editor to **draw a rectangle** over a region.
3. **Apply a code** to that region (same legend click/drag as text).

The editor has **zoom controls** (`−` / `+`, a 10%-step slider, and Reset). Coded regions:
- appear in the Codebook's collated excerpts,
- count toward the Analysis dashboard,
- can be **starred** and exported with a screenshot of the region (see [Section 5.4](#54-export-options-left-panel)).

### 4.4 Code legend (right) 🏷️

The complete coding hierarchy of your project:

- **`+ Root Code`** adds a top-level theme.
- **`+ Subcode`** adds a child under any code — **unlimited nesting**.
- Each row offers **rename**, **recolor**, **move** (via the dropdown arrow), **expand/collapse**.
- **Drag-reorder**: drag a code onto a sibling to reorder it, onto another code to reparent it, or onto empty space to move it to root. Order is remembered.
- **⚡ Copy codings**: the lightning icon on a code with subcodes **copies** every subcode's coded passages (segments and image regions) *up* into that code — a non-destructive aggregation. The originals stay where they are.

**Colors:** new root codes get a color from a palette; **subcodes automatically inherit their parent's color** so a code family reads as one color. Override any code's color anytime via the swatch picker (Codebook → Code Details).

---

## 5. The Codebook Manager

The Codebook tab is your code "bank": manage the hierarchy, write memos, inspect collated excerpts, and import/export data.


### 5.1 Details tab (left panel, when a code is selected) 📋

- **Code name** — rename inline.
- **Color** — choose from the swatch palette (overrides the inherited color).
- **Summary / memo** — write operational definitions, theories, or thematic summaries for the code.
- **⚡ Pull Subcode Summaries** — appends every subcode's memo into the parent's memo, saving you copy-paste when consolidating themes.

### 5.2 Collated excerpts (center panel) 📚

Select a code to see **every** excerpt coded to it, across every document. Sort by: **Default order**, **Notes First**, or **Starred First**. Each excerpt has **⭐ Star / remove** controls and its own per-excerpt note.

### 5.3 Import tab (left panel) 📥

- **CSV dataset / codebook** — import pre-coded tabular data (see [5.5](#55-importing-coded-datasets-csv)).
- **REFI-QDA project (QDPX)** — import a project exported from NVivo, MAXQDA, ATLAS.ti, Taguette, or another REFI-QDA-compliant tool. Brings in the **code hierarchy**, **text sources and coded passages**, **images and their coded regions**, and memos (code-level and source-level). Sources that can't be represented are reported by name rather than silently dropped. Re-importing the same file is safe — no duplicates.
- **Word comments (DOCX)** — import **Word comments** as coded passages (works with Word's "New Comment" feature). Configure the **separator** used to split structured comment text into fields (e.g. `;`), whether the **first field is the speaker**, and whether the **last field echoes the highlighted excerpt** (so it can be verified, not stored as a code).

### 5.4 Export tab (left panel) 📤

- **⬇️ REFI-QDA** — export the complete project as a `.qdpx` archive: codebook (hierarchy, colors, memos), text documents and their coded passages, images and their coded regions. Open it in NVivo / MAXQDA / ATLAS.ti, or keep it as an interoperable backup.
- **📄 Manuscript Skeleton** — a `.docx` outline of your write-up: every code with a written memo becomes a **heading**, its memo text underneath, and any **starred quotes** coded to that exact code appear as indented, italicized lines with source attribution. Codes without a memo are skipped, so the skeleton only shows what you've actually written up.
- **Scope selector** — choose what to export:
  - *Codes only (codebook)*
  - *Codes + excerpts*
  - *Codes + excerpts + summaries*
  - *Starred Excerpts* — starred text quotes and image regions in the chosen export scope, with its code and source document, formatted for pasting straight into a manuscript.
- **⬇️ CSV / ⬇️ DOCX** — export the selected scope in either format. The spreadsheets use the same header names your CSV importer recognizes, so exports can be re-imported into another project.
- **⭐ Starred Images (DOCX)** — export every starred image region with its code and a screenshot of the region.

### 5.5 Importing coded datasets (CSV) 📊

eQc recognizes common header names so you can import an existing spreadsheet as documents + codebook:

| Category | Accepted headers | Required |
| --- | --- | --- |
| Document name | Participant, Document, Source | Yes |
| Excerpt / quote | Quote, Quotes, Excerpt, Text | Yes |
| Parent code | Parent Node, Parent | Optional |
| Child code 1 | Child Node 1, Child 1 | Optional |
| Child code 2 | Child Node 2, Child 2 | Optional |
| Summaries / memos | Summary of Parent, Child 1 Summary | Optional |

> **Example CSV row:** `Mary Smith, "the Wi-Fi kept dropping", Technical problems, Internet issues,`
> This creates (or reuses) document *Mary Smith*, codes the quoted text under parent *Technical problems* / child *Internet issues*, and adds any summary text as a code memo.

CSVs are read as **UTF-8** by default with an automatic **Windows-1252 fallback** (fixes smart quotes turning into `�` from Excel's plain "CSV" option). For best results from Excel, use **"CSV UTF-8 (Comma delimited)"**.

---

## 6. The Code Map Tab

The Code Map turns your code hierarchy into a **visual diagram you can arrange, style, and export** — perfect for conceptual maps, interview-theme posters, or presenting your analysis.

### 6.1 The canvas 🖼️

- **Canvas size** — pick **Map, A5, A4, Letter, Legal**, or a fully **Custom** W×H (width × height in px). Changing size **instantly rescales every placed node** to fit the new bounds (40px padding), so nothing is ever cropped.
- **Rotate** ⬜/▯ — swap landscape/portrait, which swaps the canvas dimensions and rescales all nodes.
- **Zoom** 🔍 — from **10–400%** with the slider or `−`/`+` buttons; **100%** returns to actual size; **Fit** shows the whole canvas and follows resizing. Zooming in scrolls the paper instead of stretching it.
- **⛶ Fullscreen** — expand the map to fill the whole window (press **Esc** or ✕ to exit).

### 6.2 Nodes — your codes 🔵🔶🔷

- Each code is a **node**. Its **size reflects its coding frequency** (how many coded passages it has).
- **Drag** any node to rearrange the diagram.
- **Right-click** a node to cycle its shape: **circle → square → diamond** (and back).
- **Click a leaf node** to select it — the toolbar then shows **`✕ Remove from map`** to hide it from the canvas (it stays safe in the codebook; bring it back anytime with **➕ Add codes**).
- **Folded nodes** show a `+` badge — click the node (or its badge) to **expand/collapse** it and its children.

### 6.3 Edges — the connections ➖➰

Three kinds of edges connect nodes:

- **Hierarchy edges** — parent → child, from your code tree.
- **Co-occurrence edges** — drawn between codes that share documents. Toggle with the **Co-occurrence** checkbox, and set the **min** shared-document threshold (**1, 2, 3, 5, 8**) to only draw meaningful links.
- **Custom edges** — draw your own: click **`✏️ Draw edge`**, then click the **source** node and a **second** node to connect them (click **Cancel draw** to abort).

**Styling an edge:** click any edge to select it, then adjust:
- **Line style** — solid / dashed / dotted
- **Curve** — straight or curved
- **Arrowheads** — none / end / both
- **Color** — custom override
- **Width** — 1–8
- **Label** — your own text on the edge

Styled and custom edges **persist with the project**.

### 6.4 Annotations — free-standing marks ✏️

Annotations are **not tied to any code** — they're for interpretation notes, callouts, or diagram labels:

1. Click **`✏️ Annotate`**.
2. Pick a shape: **rect, circle, arrow, text**.
3. **Drag on empty canvas** to draw the shape; the **text** shape places a labeled note.
4. Click an annotation to select it; click ✕ to delete it.

### 6.5 Views & layout 🧭

- **View: Auto** — shows the most relevant codes, keeping the diagram readable.
- **View: Show everything** — every code, no matter how large the project.
- **View: Custom (pick expanded roots)** — you choose which roots are expanded; when a fold mode is active, a **Children/root** control (**3 / 5 / 10 / All**) limits how many children of each expanded node are rendered (ranked by co-occurrence weight).
- **↻ Re-layout** — re-runs the auto layout for the visible codes (great after dragging things around).
- **◆ Legend** — toggles the legend overlay on the map.

### 6.6 Adding codes back ➕

- **`✕ Remove from map`** hides a selected code.
- **`➕ Add codes`** opens a panel listing codes hidden from the canvas — click **Add** next to one to bring it back. If every code is already on the canvas, eQc tells you with a brief toast instead of opening an empty panel.

### 6.7 Exporting the map 📤

- **Export legend** checkbox — bakes the legend into the exported image.
- **⬇️ SVG** — true vector export (infinitely zoomable, editable in Inkscape/Illustrator).
- **⬇️ PNG / ⬇️ JPEG** — raster images rendered at **≥300 DPI**, so they print cleanly.

> **Example:** build a one-page "theme map" of your study: drag the major themes into a circle, style co-occurrence edges between connected themes, add a `text` annotation with your research question in the corner, then export PNG for your slides.

---

## 7. The Auto-Coder Tab

Scans the whole project for a keyword or phrase and codes every match automatically. Great for first-pass coding of recurring terms.

### 7.1 The workflow ⚙️

1. **Enter a keyword or phrase**, e.g. `climate change`.
2. Choose the **capture boundary**:
   - **Exact match** — code only the matched words themselves.
   - **Enclosing sentence** — code the whole sentence around each match (pick the **language** for correct sentence-boundary parsing).
3. Choose the **word matching** mode:
   - **Literal** — exact substring matching (`tree` also matches inside `street`).
   - **Word roots & variants** — word-boundary aware with light English inflection matching: `green` also matches `greens`/`greenery`, but `tree` no longer fires inside `street`/`treehouse`. Non-English words (e.g. Bangla) fall back to whole-word matching.
4. **Choose the target code** (existing or one you add).
5. Watch the **live preview** — as you type, it shows how many *new* passages would be coded across how many documents (passages already coded with the target code are excluded).
6. Click **Execute Auto-Code Job**.


> **Example:** you want every mention of *zoom fatigue* coded. Choose "Word roots & variants" so *zoom fatigues* and *zooming* matches are handled sensibly, capture the **enclosing sentence**, target the code `Well-being → Digital fatigue`, and execute. eQc codes all matches and tells you how many new passages it created.

---

## 8. The Analysis Dashboard Tab

The dashboard uses the full window width and has **eight views**, grouped under Coding, Text and Team (plus the HTML Report button). Analysis tables retain their own sorting and CSV/DOCX exports; Consensus retains its adjudication controls. The HTML report includes all analyses using the active reliability scope.


### 8.1 Coding Frequency 📊

Bar chart of coded-segment volume per code, with **parent/theme roll-up**: a parent's total includes its own direct codings plus every descendant subcode's — shown as *(N direct + M nested)*. Eight sort modes: **Grouped** (hierarchy preserved) A→Z / Z→A / highest→lowest / lowest→highest, and **Flat** (every code ranked together) highest→lowest / lowest→highest / A→Z / Z→A.

### 8.2 Code × Document Matrix 🗺️

Codes vs. documents; each cell = coded-segment count. Rows and columns sort independently — by name (A→Z / Z→A) or by total coded volume (highest→lowest / lowest→highest).

> **Example:** rows = your themes, columns = your three teachers. The cell at *Technical problems × Teacher 2* tells you how many passages Teacher 2 had coded to that theme — an instant "who talks about what" view.

### 8.3 Code Co-occurrence Matrix 🔗

Shows how often two different codes are applied to **overlapping (or identical)** text spans — genuine partial overlap counts, not just exact duplicates. Only codes that co-occur with at least one other code are shown, so a large codebook doesn't become an unreadable grid of mostly-zero cells.

**Click any cell** to open a three-panel view:
- the matrix on the left (it shrinks to make room),
- the **shared excerpts** in the middle,
- a **relationship memo** on the right — write analytic notes on *why* two categories relate, not just that they do (useful for grounded-theory axial coding).

All three panels are resizable. Relationship memos get their **own CSV/DOCX export** and are included in the HTML report.


### 8.4 Framework Matrix 🧩

A **case (document) × theme (top-level code)** grid where each cell is a short, **directly editable text summary** — not a count. Rows and columns sort independently, by name or by how many cells are filled in. This is the classic applied/policy "Framework Matrix" workflow: structured per-case analytic summaries.

> **Example:** rows = themes (*Budget, Staffing, Outcomes*), columns = your cases. Click a cell and type a 1–3 sentence summary of how that theme played out for that case. Click away to save.

### 8.5 Word Frequencies 🔤

Lists the most frequent words across **all** documents:

1. Edit the comma-separated **stop words** box if you like (a sensible default is pre-filled, including common Bangla words like `এবং`, `ও`, `কি`).
2. Click **Generate List**.
3. See the **top 100 words** by count in a ranked table.

The list you generate is what the HTML report includes — generate it **before** exporting the report if you want it in there.

### 8.6 KWIC (Keyword in Context) 🔎

Find every occurrence of a word with its surrounding context:

1. Type a **keyword** (e.g. `education`).
2. Set the **context window** — how many words to show on each side (1–20).
3. Press **Enter** or click **Search**.
4. The table shows, for every match: the document, the **pre-context**, the **keyword** (bolded in the middle), and the **post-context**.
5. A summary line above the table reports **how many matches** were found for your term. If there are zero matches, eQc says so explicitly.

The last-run search is included in the HTML report.

### 8.7 HTML Report 📄

**⬇️ HTML Report** generates a single, self-contained file covering **everything** on the dashboard:
- Coding Frequency
- Code × Document Matrix
- Code Co-occurrence Matrix
- Code Relationship Notes
- **Framework Matrix**
- **Word Frequencies** (your latest generated list)
- **KWIC** results (your latest search, with keyword and context window noted)
- **Inter-Coder Reliability**, all available scoped coefficients and per-code results
- **Consensus Summary**, counts and coder assignments for all review passages
- **Image Coding**, source names, regions, coder identities and memos

Export it for sharing or archiving — it's fully self-contained (styles inline, no internet needed).

---

## 9. LAN Collaboration

LAN collaboration lets you and your colleagues work on the **same project at the same time over your local network**. Built for small, trusted research teams: anyone with the session password can join, and every participant keeps a full local copy of the project.

> **How the model works (short version):** the host is the single source of truth. Every accepted change gets a sequence number and is broadcast live to all connected peers. Whoever edits last "wins" in a simultaneous-edit race. A rejoining peer automatically receives only the newest state when their copy is stale.

### 9.1 Host a session 🖥️

1. Open the project you want to share (Workspace tab).
2. Click **`🌐 LAN`** in the header, then the **🖥️ Host a Session** tab.
3. Enter your **name** (shown to joiners) and optionally set a **session password** ("Require a session password").
4. Click **▶ Start Hosting**. eQc listens on port **8080** and advertises itself on the network (UDP port **8082**).
5. The panel lists connected coders as **chips**. As host you can **kick** a specific person with the ✕ on their chip — they see "You were disconnected by the host".

### 9.2 Join a session 📡

1. Click **`🌐 LAN`**, then the **📡 Join a Session** tab.
2. eQc scans the network and lists every host it finds (name, project, address). If the host requires a password, you'll be asked for it.
3. Select a host and click **🔗 Join Session**. The project downloads in chunks with a **progress bar**, then your document tree fills with the shared project.
4. When you leave, click **⏹ Disconnect** — your copy of the project stays saved on your machine.

### 9.3 Discovery fallbacks 🧭

UDP broadcast works on most home/office Wi-Fi, but some routers drop broadcast packets. Two fallbacks are built in:

- **Find by IP** — type the host's IP (e.g. `192.168.1.24`) into the "Host IP" field on the Join tab and click **🔍 Find by IP**.
- **Same-PC testing** — two eQc windows on one computer work fine: the app probes `127.0.0.1` directly, so a second instance automatically finds a host on the same machine.

### 9.4 What syncs 🔄

- All **edits, coding, un-coding, renaming, recolor, image-region coding, memos, folder/doc structure** — anything that changes the project — is broadcast and applied on every connected peer.
- A small **toast** shows what changed and who made it (e.g. `[Coder] +2 coded passages, +1 code`).
- **Presence chips** show who is connected; hosts drop off the join list about 6 seconds after they stop advertising.

### 9.5 Practical tips 💡

- Both machines must be on the **same network** (same Wi-Fi or LAN). Ports **8080** (WebSocket) and **8082** (UDP discovery) must be open in any local firewall.
- The host PC should stay on and awake while the session is running.
- Rejoining an up-to-date peer is instant (no resync); a stale peer only downloads the changed state.
- LAN sessions are **unencrypted on the wire** — fine for trusted internal networks; don't share sensitive data over untrusted Wi-Fi without a VPN.
- You can keep working on your **other local projects** while a session runs in the background; only the shared project syncs. A quiet chip next to the 🌐 LAN button shows **🟢 Synced** (on the shared project) or **⚪ Local only** (on another one).

---

## 10. The About Tab

- **Application:** eQc — Easy Qual Coding
- **Version:** the installed application version. Use **Check for Updates** to check for a newer release.
- **Author:** Anisur Rahman Bayazid
- **Acknowledgments:** the CARE project and BRAC James P Grant School of Public Health, BRAC University.
- **Contact:** anisur.rahman.bayazid@gmail.com
- **License:** MIT — free for commercial and non-commercial use.
- **Source & releases:** opens the project repository and available downloads.


---

## 11. Supported File Types — Quick Reference

| Task | Format | Details |
| --- | --- | --- |
| Project backup & transfer | `.json`, `.qdpx` | Export/import; choose originals or text-only documents. JSON project merge is also available. |
| Codebook import | `.qdc` | Codes and definitions/memos, without source documents |
| Extracted project import | `.qde` | Requires matching source files beside the XML |
| External QDA projects (in **and** out) | `.qdpx` | REFI-QDA export & import — codes, text sources, coded passages, images + coded regions, memos |
| Standard documents | `.txt`, `.docx`, `.pdf` | Direct import |
| Scanned documents | `.pdf` | Local OCR |
| Images | `.png`, `.jpg/.jpeg`, `.gif`, `.webp`, `.bmp` | Import, code regions, rename, star, export |
| Structured datasets | `.csv` | Tabular import into docs + codebook |
| Coded comments | `.docx` | Word-comment import as codes/passages |
| Starred quotes | `.csv`, `.docx` | Manuscript-ready excerpt export |
| Starred image regions | `.docx` | Screenshots of starred regions |
| Manuscript skeleton | `.docx` | Auto-structured Results-section draft |
| Any analysis view | `.csv`, `.docx` | Per-view export, matches on-screen sort/filter |
| Code Map export | `.svg`, `.png`, `.jpeg` | Vector or ≥300 DPI raster, optional baked legend |
| Analysis report | `.html` | Self-contained shareable report |
| LAN collaboration | Local network | Live multi-coder sessions on a local network |

---

## 12. Keyboard Shortcuts

| Action | Shortcut |
| --- | --- |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Shift+Z` |
| Auto-Code: run search | `Enter` (in the keyword box) |
| KWIC: run search | `Enter` (in the keyword box) |
| Code Map: exit fullscreen | `Esc` |

---

*eQc — Easy Qual Coding · MIT License · local-first qualitative data analysis.*

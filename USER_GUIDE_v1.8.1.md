# eQc 1.8.1 — User Guide

## Table of Contents

1. [Overview](#1-overview)
2. [Quick start](#2-quick-start)
3. [Projects and backups](#3-projects-and-backups)
4. [The Workspace Tab (Document Editor & Manual Coding)](#4-the-workspace-tab)
5. [Codebook](#5-the-codebook-manager)
6. [Code Map](#6-the-code-map-tab)
7. [Auto-Code](#7-the-auto-code-tab)
8. [Analysis](#8-the-analysis-tab)
9. [LAN collaboration](#9-lan-collaboration)
10. [About](#10-the-about-tab)
11. [Supported files](#11-supported-files)
12. [Keyboard shortcuts](#12-keyboard-shortcuts)
13. [Profile and time](#13-profile-and-time)
14. [Memo-Book](#14-memo-book)

## 1. Overview

eQc is a desktop app for reading, coding and analysing qualitative material. Projects are saved locally. You do not need an account.

| Tab | Use it to |
| --- | --- |
| Workspace | Import, read and code sources; open Research tools |
| Codebook | Manage codes, definitions, summaries and collated excerpts |
| Auto-Code | Find and code matching words or phrases |
| Analysis | Compare coding, build summaries, search text and review team coding |
| Memo-Book | Gather, link, edit and export memos and notes |
| Code Map | Arrange codes and relationships as a diagram |
| Help | Find offline instructions |
| About | Check the version, updates and contact details |

## 2. Quick start

1. Create a project from **Project tools**.
2. In Workspace, use **Add source** to import an interview or image.
3. Create a code, then select text and click the code to apply it. For an image, draw a region and apply a code.
4. Open Codebook to review excerpts and write a code summary.
5. Open Analysis to compare sources, or Memo-Book to develop your notes.
6. Use **Project tools → Export → JSON** to save a complete backup.

Try the fictional climate study in the repository's **demo/climate-resilience** folder to explore coding by three users, memos, matrices and consensus.

## 3. Projects and backups

Use the project selector to switch projects. **Project tools** contains project creation, import and export. Project settings lets you rename a project, set a coder name or delete the project.

### Import and export

Import accepts eQc JSON projects and REFI-QDA QDPX/QDC files. An extracted QDE needs its matching source files. Read any import report for missing material.

For a complete backup, export **JSON**. Choose original documents to retain attached Word/PDF files, or plain text for a smaller backup. Both retain coding and research records. JSON can also include the selected profile and time records. QDPX is for exchange with compatible qualitative software.

Save backups outside the app's local storage. Local History checkpoints do not travel in project backups.

### Merge and undo

Merge separately coded project files to combine teamwork. Identical source names and text allow coding to share one source; matching code hierarchies are reused. Check coder names before merging.

Use **Undo/Redo** after changing coding, codes or memos. Changes made in a text field must be saved through that editor first. Project deletion cannot be undone.

## 4. The Workspace Tab

### Sources and reading

Use folders to organise sources. Select a document or image in the Sources panel. Search text to find passages across documents.

**Reading** lets you choose the reading theme, font and size. Add preferred installed fonts to **My fonts**. **Codes & Strips** shows code labels beside the viewer. **Lines** adds source line numbers.

For retained Word/PDF files, switch between the original view and plain text. Zoom changes the original view; it does not change coding text. If an edited document no longer matches its retained original, use the plain-text view for coding. Scanned PDFs can use local OCR; review the extracted text before coding.

### Text and image coding

Select text, then click a code or drag a code onto the selection. Multiple codes can cover the same passage. Click existing coding to read its note, star it or remove it.

**Selection actions** lets you add an annotation, create an in-vivo code from selected words, apply several codes, or link the passage to a case. Annotations are separate passage notes; they also appear in Memo-Book.

For images, draw a region and choose a code. Region notes and stars work like passage notes. PDF page regions are stored with a linked page image.

Use a source memo for an observation about the whole document or image. Starred quotes and images can be exported from [Section 5.4](#54-export-tab).

### Research tools

Open **Workspace → Research tools** in the Sources panel. It has four sections:

- **Cases:** create participants or other units; add attributes such as Country or Age group; link a whole source or a selected passage. Use passage links to distinguish speakers in a focus group.
- **Groups:** create reusable sets of documents or codes. A source or code can belong to several groups.
- **Review:** choose codes/sources and click **Run query** to read matching excerpts in context. Leave selections empty to review all coding. Advanced filters add cases, attributes, coder, groups and code combinations. Save a named query to run it again later.
- **History:** create a named checkpoint before major changes. Restore a checkpoint to replace the current project; the app first saves the current state as a recovery point. Keep separate JSON backups too.

### Refining coding

For coding refinement, check excerpts in Review and open **Refine selected coding**. Reassign them to an existing code or split them into a new sibling code.

To change a text boundary, choose **Adjust passage**, select replacement text in the source, then choose **Selection actions → Update passage**. The coding entry keeps its note, coder, date and star. Export all retrieved results, or check a subset before exporting.

## 5. The Codebook Manager

### Details and excerpts

Select a code to edit its name, colour, definition and summary. A **definition** explains what should be coded; a **summary/memo** records your interpretation. Browse the gathered excerpts and filter them by source or coder.

Use parent and child codes to organise themes. **Merge** combines selected codes into the code you choose. Review the destination before confirming.

### Import

Import a codebook or structured coding CSV from the Import tab. Preview the columns and assign the requested mappings. Keep definitions and summaries in their matching columns.

### 5.4 Export tab

Choose **All codes** or **Selected codes**; optionally include child codes. Choose the content scope, then export **CSV** or **DOCX**. Starred excerpts and starred images have their own export options.

Under **Project exports**, export a codebook, all notes, or a **Manuscript Skeleton**. The skeleton uses code summaries, linked memos, analysis notes and starred evidence as material for writing. It is an editable outline, not a finished report. The same writing export is available in Memo-Book.

## 6. The Code Map Tab

Arrange code nodes to explore your themes. Show hierarchy or co-occurrence connections, draw custom relationships and add text or shape annotations. Adjust line styles, labels and node appearance as needed.

Removing a node from the map hides it from this view; it does not delete the codebook code. Add hidden codes back with the map controls. Export the diagram for a report or presentation.

## 7. The Auto-Code Tab

Choose words or phrases, set matching options and target codes, then preview the matches. Review them before applying coding. Matching text can still have different meanings, so check the result in context.

## 8. The Analysis Tab

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

In **Word frequencies**, edit stop words and click **Generate List**. In **KWIC**, enter a keyword, choose the context size and click **Search**. These views include document text, including interview questions. Generate them again after changing documents or settings.

Use view export controls for Word/CSV tables, or **HTML Report** for a combined report.

### ICR and Consensus

For ICR, select the same sources and coders being compared, then choose Coder A and B. Compare percent agreement, Holsti, Cohen's kappa and the available multi-coder measures. Codes assigned once or many times to a source count as presence for source × code agreement.

Consensus groups overlapping text coding. Image regions are not consensus items. **Agreements** means participating coders each applied the same single code. Multi-code groups appear under **Disagreements** even when their sets match; inspect the actual coding before deciding what differs. A coder who did not touch a passage is not a voter in consensus; Cu-alpha includes uncoded ratings.

Export ICR and create a checkpoint before adjudication. Keeping one coder's coding removes the other entries in that passage group and changes later statistics. Coding counts include separate coders and overlapping entries; they are not counts of participants.

## 9. LAN Collaboration

Use **LAN → Host** to share a project on a trusted local network. Colleagues use **Join**, select the host or enter its address, and connect with the session details.

Check each person's coder name. Project coding and research records are shared; personal profiles and time histories stay separate. For remote or offline teamwork, exchange project files and merge them. Export a backup before starting a team session.

## 10. The About Tab

- **Application:** eQc — Easy Qual Coding.
- **Version:** your installed version; use **Check for Updates** for newer releases.
- **Author:** Anisur Rahman Bayazid.
- **Acknowledgments:** the CARE project and BRAC James P Grant School of Public Health, BRAC University.
- **Contact:** click the email to open your email app; right-click for **Copy email address** or **Copy link address**.
- **License:** MIT, for commercial and non-commercial use.
- **Source & releases:** open GitHub, or right-click the link and choose **Copy link address**.

## 11. Supported files

| Material | Formats | Notes |
| --- | --- | --- |
| Standard documents | .txt, .md, .docx, .pdf | Markdown imports as coding text; Word/PDF can retain originals |
| Images | .png, .jpg/.jpeg, .gif, .webp, .bmp, .heic/.heif | HEIC/HEIF still photos convert locally |
| Structured coding | .csv | Preview and map columns before import |
| Projects/codebooks | .json, .qdpx, .qdc, .qde | QDE needs its adjacent sources |
| Exports | .json, .qdpx, .csv, .docx, .xlsx, .html | Excel is available for Memo-Book exports |

## 12. Keyboard shortcuts

- **Ctrl+Z / Ctrl+Y:** undo / redo project edits.
- **Esc:** close the current dialog where supported.
- **Tab / Shift+Tab:** move between controls.

## 13. Profile and time

The round avatar at the top right opens Profile. Choose **Active profile** or create a **New profile**. Name, email, role, organisation and photo are optional. A profile name is also used for new coding and LAN presence; earlier coding keeps its recorded author.

Review app and coding time by day, Sunday–Saturday week, month, year or project. Tracking pauses when the app is not active, after five idle minutes, or when manually paused. Export time records to CSV. JSON project exports can include the selected profile's history; repeated import avoids duplicate recorded sessions.

Profile deletion removes that profile's local details and time records, not research projects. Keep a backup if you need its history.

## 14. Memo-Book

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

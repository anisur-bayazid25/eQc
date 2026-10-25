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

**The hardware minimum is a provisional baseline for routine text coding, not a verified low-spec performance guarantee.** Large source collections, scanned PDFs and dense visualizations need more resources. The operating-system floor follows the current [Electron 31 runtime](https://github.com/electron/electron/blob/v31.7.7/README.md#platform-support). Choose the matching Intel or Apple Silicon Mac installer. Linux x64 downloads include AppImage and Debian/Ubuntu `.deb` packages, built on Ubuntu 22.04. Linux desktop validation remains limited; update notices link to a manual download.

Normal coding, analysis and Help work offline. Downloads and updates need internet. OCR runs locally, but its current setup downloads engine and Bengali/English language assets; allow internet when using OCR. Offline OCR is not guaranteed because it depends on cached assets.

**OCR languages:** scanned-PDF recognition currently uses Bengali and English only. Other OCR languages are not selectable. This limitation applies to scanned-text recognition, not ordinary imported text; language choices in Word Cloud and word-frequency analysis do not change OCR recognition.

**Mac installation:** Intel processors use the `x64.dmg` installer; Apple M-series chips use `arm64.dmg`. Open the disk image and drag eQc into Applications, then open it from Applications. If an Intel v1.8.6 installation does not start because of an incompatible SQLite architecture, replace the application with v1.8.7 or later; retain existing project/profile data.

**Project and backup storage:** embedded images use base64, which adds roughly 33% to their binary size. HEIC-to-PNG conversion, retained original documents and PDF page images can add more. Photo-heavy projects can exceed 1 GB each; full JSON backups containing that media require additional space for every saved copy. The 1 GB installation allowance does not include project data or backups.

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

Merge separately coded project files to combine teamwork. Identical source names and text allow coding to share one source; matching code hierarchies are reused, and a source memo or period on the incoming copy is kept. Folders are matched rather than duplicated, so merging the same file twice adds nothing the second time. Check coder names before merging.

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

To resize existing image coding, click inside the coded region and choose **Resize** beside the relevant code. Drag any corner or edge, then choose **Save region size**. **Cancel resize** or Escape discards the preview. Overlapping codes are resized individually. The code, coder, star and memo stay attached; Undo/Redo restores saved size changes.

Use a source memo for an observation about the whole document or image. For documents, click **Notes** below the viewer; the memo field opens directly below that button and receives focus. Notes save when you leave the field and also appear in Memo-Book. Starred quotes and images can be exported from [Section 4.3](#43-export-tab).

### Research tools

Open **Workspace → Research tools** in the Sources panel. It has four sections:

- **Cases:** create participants or other units; add attributes such as Country or Age group; link a whole source or a selected passage. Use passage links to distinguish speakers in a focus group.
- **Groups:** create reusable sets of documents or codes. A source or code can belong to several groups.
- **Review:** choose codes/sources and click **Run query** to read matching excerpts in context. Leave selections empty to review all coding. Advanced filters add cases, attributes, coder, groups and code combinations. Save a named query to run it again later.
- **History:** create a named checkpoint before major changes. Restore a checkpoint to replace the current project; the app first saves the current state as a recovery point. Keep separate JSON backups too.

Cases now offer individual **Age**, **Gender**, **Location / area**, **Country**, **Occupation / livelihood** and optional **Name for quote attribution** fields, plus separate named custom attributes. Existing Setting/Livelihood fields are displayed without changing their stored attribute names or filters. Link a whole source to a case or use passage links for interviews with several people.

### Refining coding

For coding refinement, check excerpts in Review and open **Refine selected coding**. Reassign them to an existing code or split them into a new sibling code.

To change a text boundary, choose **Adjust passage**, select replacement text in the source, then choose **Selection actions → Update passage**. The coding entry keeps its note, coder, date and star. Export all retrieved results, or check a subset before exporting.


## 4. Codebook

### Details and excerpts

Select a code to edit its name, colour, definition and summary. A **definition** explains what should be coded; a **summary/memo** records your interpretation. Browse the gathered excerpts and filter them by source or coder.

Use parent and child codes to organise themes, to any depth. **Merge** combines selected codes into the code you choose; review the destination before confirming. Merging keeps excerpts, image regions, definitions, summaries, case × theme summaries and saved comparison settings that referred to the codes being merged, removes duplicate excerpts left on the survivor, and can be undone with Ctrl+Z.

### Import

Import a codebook or coded data from the Import tab: CSV, tab-separated text, an Excel workbook, or Excel “Unicode text”. Choose the file, pick the worksheet when the workbook has several, then build the code tree level by level. **Add level** adds another step of depth — there is no limit — and each level has its own code column plus an optional definition and summary/memo column, so a five- or six-level codebook imports with the right text on every level. Header names do not have to follow a fixed wording; **— not in this file —** leaves a column unused, and the preview shows the first rows plus what the import will add before anything changes. A codebook file may contain only code columns; a coded-data file needs a document and quote column, and an optional coder column records attribution. Quotes are matched against the source text exactly, case and punctuation included; a quote that is not found is reported and the existing source text is never altered.

### 4.3 Export tab

Choose **All codes** or **Selected codes**; optionally include child codes. Choose the content scope, then export **CSV** or **DOCX**. **Starred Images** and **Starred Quotes** sit side by side. Starred Quotes downloads only starred text as Word: choose **Manuscript format** for quotes with the same italic participant attribution as the manuscript skeleton, or **Document, code & all case attributes** for source names, code paths and every attribute of linked cases. Both choices respect the code selection, omit memos and images, and show repeated coding of the same quote once per code. The existing **Starred Excerpts** content scope still exports both text and image excerpts.

Under **Project and codebook files**, export the whole project or just the codebook as REFI-QDA (QDPX), all notes as a spreadsheet, or a **Manuscript Skeleton**. The skeleton uses code summaries, linked memos, analysis notes and starred evidence as material for writing. It is an editable outline, not a finished report. The same writing export is available in Memo-Book. These exports always cover the whole project, not the code selection above.


## 5. Auto-Code

Choose words or phrases, set matching options and target codes, then preview the matches. Review them before applying coding. Matching text can still have different meanings, so check the result in context.


## 6. Analysis

| View | What it shows |
| --- | --- |
| Frequency | Coding-entry counts by code |
| Documents | Code × source counts |
| Co-occurrence | Different codes on overlapping passages or regions; identical ranges are counted once across coders |
| Framework | Editable source × theme summaries |
| Word frequencies | Common words after applying the stop-word list |
| KWIC | A keyword with its surrounding words |
| ICR | Agreement measures for selected coders and sources |
| Consensus | Jointly coded passages for comparison and adjudication |

Click a co-occurrence pair to inspect shared excerpts and write a relationship memo. Write framework summaries directly in their cells. Both appear in Memo-Book.

In **Word frequencies**, choose the language and minimum base-letter length, edit stop words and click **Generate List**. A value of 3 keeps words with at least 4 base letters; Bengali vowel/combining signs do not add letters. In **KWIC**, enter a keyword, choose the context size and click **Search**. These views include document text, including interview questions. Generate them again after changing documents or settings.

Use view export controls for Word/CSV tables, or **HTML Report** for a combined offline report. HTML export options show the selected ICR coder/source scope and saved comparison method. Source-level results include every selected coder pair and available multi-coder measures; the saved additional comparison includes its settings, warnings and calculation details. Select which saved graph drafts to embed, with visualization notes optional and off by default. Figures capture saved canvases; regenerate a graph before exporting if its analysis needs updating.

The HTML report opens with a contents list. Tables and individual code summaries/memos start collapsed; research records have separate tables for cases/attributes, annotations, memo types, source/code groups and saved queries. Expand only what you need, search within any table, or use **Expand all sections** / **Collapse all sections**. Wide tables scroll within their section. **Print report** temporarily expands all details and includes all rows, then restores your view. Figures and report controls work offline; native disclosure controls also work when scripts are disabled.

### ICR and Consensus

For ICR, select the same sources and coders being compared, then choose Coder A and B. Compare percent agreement, Holsti, Cohen's kappa and the available multi-coder measures. Codes assigned once or many times to a source count as presence for source × code agreement.

The ICR workspace has one **Comparison method** selector. Open Scope to change coders or documents, select the method and click **Calculate agreement** or **Calculate ICR comparison**. Summary cards show the main figures. Open Pairwise comparison, Results by code, Detailed results or Overlapping-passage diagnostic only when needed. Tables have search and 20-row pages; CSV/Word exports contain all rows, not just the current page or search. Changing inputs clears the displayed calculation. **ICR help** opens the calculation reference below in the top Help tab.

### Connected research workflows

**Case tables:** Export cases CSV creates a matching import template with stable Case IDs, one attribute per column, attribute types, and explicit source/passage links. Import previews additions, updates and unmatched sources before applying changes. Choose update matching IDs/unique names or add separate cases. Duplicate identities, ambiguous names and invalid typed values are rejected. Cases can link text, images or selected FGD passages. This case-table format differs from the long research-records CSV.

**Research selections:** In Excerpt review, run a query, optionally check individual entries, choose a graph and click Use results in graph. Visualization settings also offer cases, source/code groups, saved queries and attribute filters under Research scope. The scope retains exact coding entries and never expands a selected passage to all coding in its document. Scoped word clouds use coded text. An empty or image-only selection cannot generate a text graph. Existing results CSV/Word exports retain the selected entries and their source information.

**Reviewed sources:** In ICR, select a source and mark each coder who independently reviewed it. Missing review confirmations stay visible; an absent code alone cannot establish that a source was reviewed.

**Disagreements and resolutions:** Inspect disagreements provides coder selectors, distinguishes source-level presence differences from boundary/region differences, and opens the actual passages or image sources. A resolution is saved as a linked methodological memo without modifying the original coding. Fixed-excerpt CSV units are separate from project-source coding.

**Saved ICR runs:** Name and save a run to preserve its results, coders, source/code scope, settings and review confirmations. Later source/coding changes mark it historical; graph movement and memo edits do not. CSV/Word exports are available inside Saved run statistics. HTML report and manuscript export let you choose a historical run explicitly. The methodology paragraph and copy-paragraph option remain in manuscript export only. Imported conflicting settings are kept as selectable setups; loading settings does not change coding.

**Case framework:** Analysis → Framework → Case × theme framework provides summaries for cases that span sources or selected passages. Choose participant attribute columns, click a case/theme cell, inspect supporting excerpts and linked memos, then save the summary. CSV/Word exports include case identifiers and selected attributes. Summaries also appear in Memo-Book and analytical HTML reports; the manuscript's optional framework section includes summary text without adding operational notes.

**Exchange:** The project export dialog shows a preservation inventory. QDPX uses structured cases, typed variables and source/code sets, plus an eQc appendix for saved queries, graph drafts, ICR runs, starred evidence, analysis periods, folder paths, code order and coder identity. Sources, coding positions, the code hierarchy and coder attribution stay in the standard parts, so other applications read them normally; appendix information may appear there as notes instead of recreating eQc tools. Import reports list research-object counts and unresolved/unsupported references. Merge previews changes, keeps the working canvas, remaps research links and preserves conflicting ICR settings separately. Local recovery history stays on its original computer.

### ICR calculations and reporting

Contingency and detailed comparison tables include disagreement, both-coded, neither-coded and coded-only agreement percentages where the comparison supplies binary contingency counts. Coded-only agreement is intersection divided by the union of positive coding decisions; it differs from the positive-decision Holsti index. Missing or inapplicable values remain distinct from zero.

**Choose the unit before choosing a coefficient.** A source × code item asks whether a code was used anywhere in a source. A character × code item asks whether a particular text position was coded. A sentence or paragraph is treated as present when any coding overlaps it. These are different questions and can give different results for the same project. Text offsets use UTF-16 character positions. Sentences use Unicode sentence segmentation; paragraphs are non-empty newline-delimited units. Character intervals with identical coding are weighted by length rather than expanded into separate rows.

**Source-level example:** Amina applies Water access to five passages in Interview 1; Ravi applies it to two. Both marked the same one source × code item present, even if their passages differ. If only Amina applies Cost in that interview, that item is a disagreement. These totals do not measure exact word or passage-boundary agreement. Select the same reviewed sources and compare the same direct codes. Images are available for source-level comparisons; the additional text comparisons exclude image regions.

**Scope and missing work:** all attributed coders are initially selected. Coding without a coder identity is excluded. A code absent from a source is counted as a negative decision; eQc cannot distinguish an unreviewed source from a reviewed source containing no applicable code. Choose the common independently reviewed material. Coding entries are not participants, and coding the same source many times does not make additional source-level items. Imported fixed-excerpt decisions handle missing rows differently: missing decisions remain missing observations and are excluded from that pair's calculation.

**Observed agreement:** for two coders, let a = both coded, b = A only, c = B only and d = neither. N = a + b + c + d. Observed agreement is `100 × (a + d) / N`. Joint absences can make it high when many codes are unused. For multiple coders, **full agreement** means every selected coder gave the same rating to an item. That is stricter than average pairwise agreement.

**Holsti:** `2a / (2a + b + c)`. This is a positive-decision overlap index; joint absences do not contribute. It is not corrected for chance. It is undefined when there are no positive decisions. The meaning of a, b and c follows the selected comparison unit.

**Cohen's kappa:** `κ = (Po − Pe) / (1 − Pe)`, where `Po = (a + d) / N` and `Pe = ((a + b)(a + c) + (c + d)(b + d)) / N²`. Use two coders' binary ratings of the same items. A zero denominator makes κ undefined, even if observed agreement is 100%. Pooled κ combines item counts before calculation. Equal-document mean κ averages defined document coefficients with equal document weights; undefined document coefficients are excluded and counted. It is not a pooled coefficient.

**Fleiss' kappa:** for m coders and item-category counts n(j), each item's pair agreement is `P = sum(n(j) × (n(j) − 1)) / (m × (m − 1))`. Average this over items to obtain observed pair agreement. Expected agreement is the sum of squared overall category proportions. Apply `(Po − Pe) / (1 − Pe)`. eQc offers Fleiss' κ for at least three coders with complete binary ratings. The displayed full-agreement percentage is a separate descriptive figure, not the Po used in Fleiss' formula.

**Krippendorff's nominal alpha:** `α = 1 − Do / De`. Coincidence counts compare pairable ratings within each item; nominal disagreement is 0 for the same category and 1 for different categories. Do is observed disagreement; De is expected disagreement from the category marginals with finite-sample correction. Missing ratings are omitted, and an item needs two observed ratings to contribute. Character counts are weighted by interval length. Alpha is undefined when there is no pairable information or no expected disagreement; it must not be replaced with zero. Source-level nominal alpha binary uses present/absent source × code items. Text-unit nominal alpha uses the chosen text units instead.

**Code occurrence with RK correction:** source-level presence can count joint absences as matches or exclude them. When they count as matches, the Rädiker–Kuckartz correction uses `Pe = 0.5^q`, where q is the number of selected codes, then `(Po − Pe) / (1 − Pe)`. This is labelled RK κ, not Cohen's κ. RK is not reported when joint absences are excluded. The correction becomes small as q increases.

**Exact code frequency:** a document × code item agrees only if both coders applied that code the same number of times. One vs three applications is a disagreement regardless of passage locations. Equal zero counts are included or excluded according to the joint-absence setting. eQc does not attach a chance-corrected coefficient to this equality percentage.

**Segment overlap:** each selected segment from each coder is checked against the other coder's segments with the same code in the same document. A match requires `intersection length / length between the outermost boundaries ≥ threshold`. Both directions are counted: a matching pair contributes two checks. Jointly uncoded text is excluded. The default threshold is 90%. Brennan–Prediger correction uses `Pe = 1/q` for q active codes, followed by `(Po − Pe) / (1 − Pe)`. With one active code this form is undefined; the separately labelled binary correction uses `Pe = 0.5`. Do not present either as Cohen's κ.

**Semantic domains:** explicitly group codes into disjoint domains. Within a domain, each coder must use at most one code at any overlapping position; conflicts stop the calculation rather than silently selecting one code. Global binary alpha compares relevant vs uncoded characters. Per-domain/code binary alpha compares presence on the character continuum. Within-domain cu-alpha compares the assigned code only at positions with at least two domain ratings; domain absence is missing for that calculation. The global domain-set coefficient uses set disagreement `|C||K| − |C∩K|²`, normalized by `|C||K|`, with finite-sample coincidence correction. It is exploratory, has not been validated as equivalent to published global Cu-alpha and is excluded from manuscript statistics.

**Fixed-excerpt tests and numeric ratings:** import CSV columns `Unit,Coder,Code,Present,Rating`. Unit identifies a predefined test excerpt; Present must be true/false, yes/no or 1/0. Rating is optional. Each Unit/Coder/Code combination must be unique. Cohen's κ compares explicit binary decisions shared by a coder pair. All selected test-coder pairs are compared. Rating correlation uses only units where both coders marked the code present and both supplied a number, calculated separately for each code. Pearson's `r = sum((x − mean(x))(y − mean(y))) / sqrt(sum((x − mean(x))²) × sum((y − mean(y))²))`. At least two paired values and variation in both rating series are required. A high correlation does not imply absolute agreement: scores 1,2,3 and 2,4,6 correlate perfectly but differ systematically.

**Overlapping-passage diagnostic:** maximal overlapping text groups are distinct from predefined test units. The legacy diagnostic assigns each coder the code with the largest overlap; ties use earliest start then code ID. An uncoded rating is an explicit category. This is nominal alpha on a dominant-code approximation, not semantic-domain Cu-alpha. Use Consensus to inspect original assignments, particularly multi-coded passages.

**Interpretation and manuscript use:** 1 indicates perfect chance-corrected agreement, 0 agreement at the chosen chance baseline and negative values more disagreement than that baseline. Undefined means the coefficient has no valid denominator for the selected data. No single cutoff establishes the quality of a qualitative analysis. Report the coefficient, units, scope and aggregation together, and describe independent coding, codebook calibration and disagreement handling based on what the team actually did. The manuscript skeleton has the paragraph preview and copy button; they are not part of the ICR workspace. Figures are recalculated from current coding, so save an export/checkpoint before adjudication changes those records.

Additional comparisons are available in the **Comparison method** selector. Choose Characters, Sentences or Paragraphs for text-unit agreement; Segment overlap for a configurable intersection/outer-span threshold and Brennan–Prediger correction; Code presence for RK correction and joint-absence choices; Code frequency for exact count equality; Semantic domains for binary/domain alpha with exclusive-code validation; or Fixed-excerpt test and ratings for CSV decisions and per-code Pearson correlation. Click **Calculate ICR comparison** to save settings. Missing fixed-test decisions remain missing. Pearson correlation is not absolute agreement. The exploratory global Cu-style coefficient has not been validated as equivalent to published global Cu-alpha and is excluded from the reporting paragraph.

Paragraph preview and **Copy ICR paragraph** are available only in **Manuscript skeleton Word** export options. Choose source-level statistics or the saved additional comparison, using all selected coders and coder pairs. Verify that all selected coders reviewed the selected material: an absent code does not prove a source was reviewed.

Consensus groups overlapping text coding. Image regions are not consensus items. **Agreements** means participating coders each applied the same single code. Multi-code groups appear under **Disagreements** even when their sets match; inspect the actual coding before deciding what differs. A coder who did not touch a passage is not a voter in consensus; The legacy text-unit nominal alpha uses a dominant code per overlap group and includes uncoded ratings; it is not semantic-domain Cu-alpha.

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

Choose **Manuscript skeleton Word** to preview options for a project-wide writing outline, regardless of the memo selection. An optional ICR Methodology paragraph precedes Results; review its coders, sources and comparison method. Code summaries omit generated document lists. Starred quotes omit coder names and excerpt notes; a separate italic line uses linked case name/pseudonym, age, gender, occupation and area/country, or falls back to the source name. Framework and co-occurrence memos are optional and selected by default. Analytic project memos are optional; linked memos appear once. Source/case memos, annotations, visualization labels and visualization notes are omitted. Other exports retain their source metadata. Authored memo text is kept as written.

### Combine related memos

Select at least two memos, open **Export or merge selected memos**, choose a new or selected project memo as the destination, and review the confirmation. Merging combines text and links, consolidates project memos and clears the selected attached note fields. Sources and coding remain. Use Undo if you need to restore the original notes.

## 8. Visualization

Select a line in any visualization to move it; drag either endpoint to change its length and direction. The Inspector controls annotation line width, style, curve, arrowhead, colour and opacity; Link controls code relationships. Topic-to-code lines are editable too. Moving an attached line gives it a manual position; moving or resizing a Sankey ribbon makes that ribbon a free shape. Regenerate to restore automatic connections and proportional geometry. Double-click number labels to edit their displayed text, and use Label background in the Inspector for colour and opacity (0 makes it transparent). These edits change the figure only: calculated counts, supporting evidence and coding stay unchanged. Save a named draft to retain edits; generating a new figure replaces them.

The first row focuses on **Code map → Co-occurrence network → Sankey diagram → Word cloud**. Mind map starts the next row.

Choose a square type card, choose a preset and settings, then click **Generate visualization**. For a first figure, try Word Cloud: select your documents, Generate, then select a word to see its formatting and sources in the Inspector. Save a named draft before experimenting with a new design. Code map opens its Simple/Detailed preview designer. **Open current canvas** resumes your layout; **Open draft** loads a named version. Visiting this tab does not compile project data. The **▦ All visualization types** button returns to the library and unloads the renderer. Switching tabs also stops it automatically. **⚙ Settings** opens the current graph’s own settings; Back returns without replacing the canvas.

| Type | What it uses |
| --- | --- |
| Code map | Simple/detailed theme clusters; optional shared-document links |
| Co-occurrence network | Direct-code overlap or shared-document counts; grouped, circular, spherical, spatial 3D and chord layouts |
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

**Workspace:** the shallow top bar contains navigation/zoom. Every graph has the same left-side tools: **Colours, Text, Canvas, Arrange, Draw, Legend, Drafts and Export**. **Draw** contains the shape and text-box gallery. A separate **Code nodes** group appears on Code map, Mind map, Hierarchy and Blank canvas, with Codes, Link and Node controls; draw code connections from Link. Code map alone also offers View, branch visibility, re-layout and shared-document links. Legend visibility is controlled in one place: Legend. The right Inspector contains typography, shape appearance and source links. **Text** opens formatting even when the Inspector is collapsed. **☷ Toggle inspector** expands the canvas. The paper stays centered horizontally and vertically whenever it fits; use scrollbars when zoomed in.

**Visualization notes:** open **Notes → Add visualization note**, write the note and Save note; drag its header to position it. Show/hide notes from Notes. The working visualization and each named draft have separate notes, listed in Memo-Book under **Visualization notes**. Ordinary canvas text and connection labels remain under **Visualization labels**. Notes are omitted from figure exports and manuscript skeletons. Native project JSON backups and LAN snapshots include notes and drafts. LAN accepts complete project snapshots with the most recent accepted state winning; simultaneous edits can overwrite each other, so coordinate canvas editing and keep named drafts.

**Compact Heat maps:** the right Inspector's **Heat map display** offers **Hide all-zero rows**, **Hide all-zero columns** and **Swap rows and columns**. These update immediately, retain edited/deleted headings and added objects, and leave source coding unchanged. Only entire zero-only axes are hidden; zero cells within remaining data stay visible. The caption records hidden-axis counts, and column keys follow the new orientation. An empty-state message appears if all data are zero. These choices travel with the working canvas and named drafts. Histomap's **Choose display** also offers **Hide codes with zero assignments**; periods and missing-data gaps stay visible. Dendrogram and Sankey already exclude empty items when generating.

**Editing:** double-click any label to edit in place; click elsewhere to save or Escape to cancel. Select it to format it in the right **Inspector**. Font, Size & style, and Text colour are grouped together. Open **Direction & rotation** for vertical text, rotation in degrees and reading order. **Edit text** starts in-place editing; the trash button removes the selected annotation. **Text** shows or hides formatting in the Inspector. Open **Draw → Shapes**, choose a standard shape, then drag on empty canvas. The gallery includes rectangles, rounded rectangles, ovals, triangles, polygons, block arrows, stars, a cross, callout, line, arrow connector and text box. Hold Shift for equal width/height; Escape stops drawing. Double-click a shape to add or edit its text. Shapes support the same fill/border, grouping, resizing and export tools. Drag items to move and handles to resize; text wraps/shrinks to fit. Process/journey links stay attached when their blocks move. Shape controls include fill, border and opacity; arrows have a line-colour control. **#** opens hex entry and **🎨** generates a palette. Delete/trash removes selected annotations; Delete inside an editor edits text.

**Colours:** **Invert palette** reverses the colour order and heat-map ramp. Open **Colours** on the left rail for 17 built-in canvas presets, including Viridis, Magma, Plasma, Inferno, Cividis, ColorBrewer Set2, Tableau 10, and muted coast, sage garden, earth/clay, lavender dusk, soft spectrum, colour-blind-friendly (Okabe–Ito), blue/amber, grayscale, monochrome slate and monochrome teal. These change visualization colours only. Heat maps keep an ordered light-to-dark scale with readable numbers; keys follow the new colours. Keep labels visible when colours are close. Select any shape/node or line to change its fill/border/line colour individually. **Create / edit custom palette** starts from a preset or a saved custom palette. Change its swatches, enter a name (for example Viridis_1), and save. Custom palettes travel with project backups; reusing a custom name replaces it. Scientific presets retain sequential heat-map ramps. Changing their swatches may change their contrast/order. Every **#** picker offers 60 theme shades, 12 standard colours, recent colours and hex entry.

**Arrange:** Shift/Ctrl-click to select several shapes/text/code nodes, or enable **Arrange → Select multiple** and drag a selection rectangle on empty canvas. **Select shapes** selects the diagram without its title/method text. Group/ungroup objects, move them together, and use the corner handles or width/height inputs to resize. **Lock proportions** preserves their ratio. **Center selection on canvas** centers the whole selection; Align controls align individual objects. Bring forward/backward or front/back changes stacking across shapes, text and code nodes. Ctrl/Cmd+G groups; Ctrl/Cmd+Shift+G ungroups. Arrow keys nudge a multi-selection (Shift = ten units). Groups and layers are saved with the canvas and named drafts.

**Legends:** double-click titles/entries to edit; use the shared text tools. Drag the background to move and the corner to resize. **Legend** offers entry visibility, up/down order, columns and reset; trash removes an entry or the legend. Legends follow visible styles. Fresh generated canvases start without the separate legend to avoid covering labels; use **Legend → Show legend** when needed. Regenerating the current canvas and loading a named draft retain its legend visibility.

**Navigation:** mouse-wheel zooms around the pointer; Ctrl/Cmd plus/minus zooms and Ctrl/Cmd+0 fits. Use scrollbars to pan. Node tools open code details/memos. Removing a code node hides it from the diagram; **Codes → Add codes** restores it.

**Working canvas:** leaving Visualization or following a source link unloads the renderer and retains your edits. Returning to the tab resumes the canvas, including legend formatting and zoom. The library also offers **Open current canvas**. View settings are saved once when leaving the editor; no background graph generation runs. Named drafts remain useful for keeping multiple versions. Generating a new figure replaces the current canvas.

**Save/export:** **Drafts → Save map draft** retains the type, generation settings, layout, text/styles, annotations and legend. Reusing a name replaces that draft. Drafts travel in project JSON backups. Export SVG, PNG or JPEG; image resolution scales text and legends, and SVG remains scalable. Set **Printed width (mm)** and **Check print readability** to estimate the smallest text in points and raster DPI at the intended figure width. Increase fonts, reduce items or use a wider figure when text becomes too small. Vector exports include a title, method description and source-document names.

### Co-occurrence network, matrix and ribbons

Open **Visualization → Co-occurrence network**. Choose **Connected groups**, **Circle**, **Projected sphere**, **Spatial network (3D layout)** or **Chord diagram**. For node-based layouts, choose shaded balls, flat circles or text-only labels independently of the layout. Spatial network uses a force layout in three dimensions; horizontal/vertical viewing angles choose its projection. Projected labels are spread for readability. Depth is illustrative, not an extra measured variable. Click Generate to calculate an editable snapshot.

Choose **Overlapping coded passages** or **Codes in the same document**. The overlap unit counts pairs of different direct codes on intersecting text ranges; touching boundaries do not overlap. Unique coding-range pairs deduplicate identical code/document/ranges across coders. All coding-decision pairs retain repeated coder assignments. All coders pools coding across people; choose one coder for an individual view. Shared documents counts each unordered code pair once per selected document, regardless of overlap. Image regions are not included. Source/code limits and the selected coder apply before counting.

Network line labels show pair counts; line thickness increases with count. Minimum count and maximum links reduce clutter, with omitted links reported in the caption. Node or text size reflects coding frequency with label space. Colours distinguish connected groups, rather than statistically inferred communities. Select a line for its count, source links and up to 30 distinct supporting overlap ranges in the Inspector. Excerpts use current source text; regenerate after coding/source changes. Drag nodes, edit labels, save drafts and export SVG, PNG or JPEG normally. Named drafts can also be included in HTML reports.

**Heat map → Codes × codes: co-occurrence** uses the same counting options. Cells contain counts, the diagonal is zero, and the two halves repeat the same pairs. Do not sum both halves. All pair counts are shown; network/Sankey link limits do not apply. Existing zero-axis filters and transpose remain available.

**Sankey diagram → Code co-occurrence** uses proportional ribbons with count labels. Each unordered pair is shown once, with left/right placement chosen by codebook order. Ribbon direction is graphical, not temporal or causal. Node totals and percentages describe displayed pair weight, not participants; one document or passage can contribute to several pairs.

**Chord diagram** uses the same unordered pairs, with proportional ribbon widths at both endpoints. Outer code labels show the sum of incident pair counts. The sum of all outer totals is twice the displayed pair-count total; these are not participant or coding frequencies. Zero-link codes are omitted. Use up to 40 connected codes, or narrow the selection for readable labels.

### Sankey diagram

Choose a preset and read its requirements. Use project coding for document → code/theme summaries, a link table (`source,target,value,source_stage,target_stage`), or complete path rows (2–8 stage columns plus `value`). Values must be positive and stages numbered 1–8. Alluvial paths retain the same cohort through every stage; pairwise links alone cannot establish those paths. Hierarchical diagrams require one parent per node; circular diagrams allow explicit feedback. The fictional example button supplies test data, clearly separate from project coding.

Widths share one linear scale. Imbalanced nodes are reported without inventing flows. Coding summaries show assignments, not movement or causation; multi-coded passages contribute to each code. Settings control stage headings, ordering, bar width/gaps, values/percentages, ribbon opacity, curve and source/target/gradient colours. Keep diagrams focused (up to 200 nodes/500 ribbons, at most 20 feedback ribbons).

Select a node label and use **Node label placement** in the right Inspector: Inside bar, Outside left/right, Above, Below or Free position. **Distance from boundary** sets the outside gap; inside labels use **Inner padding**. Anchored labels follow the bar and fit available space. Set writing direction/rotation with the shared text tools; Free position restores manual placement.

### Word cloud

To make a cloud from particular codes, choose **Text scope → Coded passages only**, then search the **Codes** checklist and select one or several codes. Use **Clear codes** to start a focused selection or **Select all codes** for all coded text. Only passages assigned directly to selected codes are included; select subcodes separately. Overlapping ranges and repeated coder assignments are merged so shared text counts once. Document selection still applies, and the word limit controls the number of words, not codes. Code selections are retained in the working cloud and named drafts.

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

### Report a problem or suggest a feature

Use **Feedback** in the toolbar, the reporting button at the top of **Help**, or **Ctrl+Shift+B** (**Cmd+Shift+B** on macOS). Choose Bug report, Feature request or Other feedback. **Your name and email are required.** Both are filled from the active profile when present; otherwise enter them. You can edit them without changing your profile. The name appears in the report and the email is used for replies. These are supplied contact details rather than verified identity; sending limits still apply.

An eQc-window screenshot is previewed before sending. Capture it again, attach a PNG/JPEG, or remove it. Review or exclude the device details. Only the form and selected attachments are submitted; project files and transcripts are not attached automatically. A screenshot can contain visible research text, so check it before sending.

**Send report** submits directly to the developer when the reporting service is configured. An accepted report receives a reference number. Connection failures keep the draft for retry; **Save report instead** saves a ZIP with the report and chosen screenshot. Closing the form keeps the draft in memory during this app session. The default backend uses Google Apps Script with a cap of 50 sending attempts per rolling 24 hours; if the service limit is reached, keep/save the report and try later. If delivery cannot be confirmed, the same report is not automatically resent. Developer activation instructions are in `services/feedback/README.md`.

- **Application:** eQc — Easy Qual Coding.
- **Version:** your installed version; use **Check for Updates** for newer releases.
- **Author:** Anisur Rahman Bayazid.
- **Acknowledgments:** the CARE project and BRAC James P Grant School of Public Health, BRAC University.
- **Contact:** click the email to open your email app; right-click for **Copy email address** or **Copy link address**.
- **License:** MIT, for commercial and non-commercial use.
- **Source & releases:** open GitHub, or right-click the link and choose **Copy link address**.


## 10. LAN collaboration

Use **LAN → Host** to share a project on a trusted local network. Enter a session password of at least 4 characters — hosting is disabled until you do, because the session listens on the network and anyone who can reach it could otherwise read or overwrite the project. Share that password with your team only. Colleagues use **Join**, select the host or enter its address, and type the same password.

Check each person's coder name. Project coding and research records are shared; personal profiles and time histories stay separate. For remote or offline teamwork, exchange project files and merge them. Export a backup before starting a team session.

### Announcements

Routine LAN project updates appear as small, unboxed text at the right of the **Saved** ribbon, below Announcements and Profile. Messages appear one at a time for four seconds and fade away; rapid updates keep only the latest few waiting messages. These activity messages clear when you leave the shared project or session. Important errors still use the usual notification.

Use the **📣 Announcements** button beside Profile to post and read team notices. New notices appear below it for **30 seconds** and can be dismissed; dismissing or timing out does not delete the notice. The highlighted badge counts unread announcements. Opening the announcement list marks its current notices as read on that local profile.

The host can post immediately. In **LAN → Host a Session → participants**, enable **Allow announcements** for each person who may post. This permission is enforced by the host and can be revoked at any time; it resets when that person reconnects.

Choose **Save with project** to keep an announcement in the project and native project backups, or **This LAN session only** to keep it until the host ends the session. Members joining later can read the current session notices. Session notices disappear locally on disconnect and are available again if you rejoin the same ongoing session. Saved notices remain available offline. Announcements allow up to 2,000 characters.

The host can delete any announcement. A permitted member can delete their own announcements; other members can read and dismiss notices. Deletion removes the notice for everyone in the active session. Outside a session, deleting a saved notice changes only the local project copy.


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
| Structured coding | .csv, .tsv, .txt, .xlsx, .xlsm | Workbook sheet selection and column mapping before import; Excel “Unicode text” is read as well |
| Projects/codebooks | .json, .qdpx, .qdc, .qde | QDE needs its adjacent sources |
| Exports | .json, .qdpx, .csv, .docx, .xlsx, .html | Excel is available for Memo-Book exports |


## 13. Keyboard shortcuts

**Ctrl+Shift+B** opens Feedback from any shortcut profile (**Cmd+Shift+B** on macOS), including while typing. The shortcut applies inside eQc.

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

# eQc — Easy Qual Coding

## Complete User Guide & Documentation (v1.5.8)

eQc is a lightweight, **local-first** qualitative data analysis (QDA) desktop application built with Electron, React, and SQLite. All your data — documents, codes, memos, matrices — is stored **locally on your device**. Nothing leaves your computer (except, optionally, the project backups you choose to export or share, or the updates you deliberately send to a LAN session).

This guide walks through **everything** in the app, from your first project to advanced Code Map diagrams, LAN team sessions, and every analysis view.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
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

## 1. Overview & Architecture

### 1.1 What eQc is for 🎯

eQc is built for the classic qualitative research workflow:

1. **Import** your sources — interviews, focus groups, field notes, documents, images, survey datasets.
2. **Code** the text (and images) into themes — a flexible, nested codebook.
3. **Analyze** — matrices, co-occurrence, framework analysis, word frequencies, keyword-in-context.
4. **Write up** — export excerpts, memos, a manuscript skeleton, and a complete HTML report.

### 1.2 Key highlights ✨

- **Local-first & secure** 🔒 — everything lives in a local SQLite database on your machine. No cloud, no account, no uploads.
- **Dual theme** 🌗 — Light "paperwhite" mode (default) and Dark mode, toggled from the header.
- **Flexible workspace** 🪟 — resizable, draggable panels throughout every tab.
- **Multiformat support** 📄 — `.txt`, `.docx`, `.pdf`, scanned PDFs (local OCR), images (`.png`, `.jpg`, `.gif`, `.webp`, `.bmp`), structured `.csv` datasets, Word-comment files, and REFI-QDA `.qdpx` projects (NVivo, MAXQDA, ATLAS.ti, Taguette) — imported **and** exported in **both** directions.
- **Live collaboration** 🌐 — host or join a LAN coding session so a small team can code together in real time (see [Section 9](#9-lan-collaboration)).
- **Coder attribution** 👤 — every coded passage records who coded it, so multi-coder work stays auditable.

### 1.3 The six main tabs 🗂️

| Tab | What it's for |
| --- | --- |
| **Workspace** | Read documents, code them, manage the document tree |
| **Codebook** | Build and manage your code hierarchy, memos, imports/exports |
| **Code Map** | Turn your codes into a visual diagram on a canvas |
| **Auto-Code** | Automatically find and code keywords/phrases across the whole project |
| **Analysis** | Frequencies, matrices, framework, word frequencies, KWIC, HTML report |
| **About** | Version and license information |

![Workspace tab](screenshots/eQc_Workspace.png)

---

## 2. Quick Start — Your First Project in 5 Minutes

Here's a minimal end-to-end example so you can see the whole pipeline before diving into details:

> **Example — a small interview study.** You interviewed three teachers about online teaching. You have three `.txt` transcripts, and you want to find themes like "technical problems" and "student engagement".

1. **Create a project** ➕ — click **New project**, give it a name (e.g. `Teacher Interviews 2026`).
2. **Add documents** 📄 — go to the **Workspace** tab, and in the left panel click **`+ Doc`** and pick your three transcripts. They appear in the document tree.
3. **Make a code** 🏷️ — in the code legend on the right, click **`+ Root Code`** and type `Technical problems`. Then **`+ Subcode`** under it and add `Internet issues`.
4. **Code a passage** ✂️ — click a document in the tree, drag to select the sentence *"the Wi-Fi kept dropping during the class"*, then click the `Technical problems` code in the legend. Done — the passage is highlighted.
5. **Look at your analysis** 📊 — switch to the **Analysis** tab. The Coding Frequency view shows your new code's count. Click **⬇️ HTML Report** to export a complete report.
6. **Save** 💾 — eQc auto-saves; the header shows **`✓ Saved`** when the project is safely stored.

That's the loop: import → code → analyze → export. Everything else in this guide deepens one of those steps.

---

## 3. Header Bar & Project Management

The header has two rows:

- **Top row:** brand + the main tabs (Workspace · Codebook · Code Map · Auto-Code · Analysis · About).
- **Bottom row:** project controls, the **🌐 LAN** button, **Undo/Redo**, reading **font controls**, the **theme toggle**, and **Save**.

![Workspace dark variant](screenshots/eQc_Workspace_dark_white.png)

### 3.1 Project operations ➕✏️⬇️⬆️🔀

- **➕ New project** — create a fresh local project.
- **✏️ Rename project** — opens the **Project Settings** dialog (which is also where deletion, coder name, and cleanup live).
- **⬇️ Export / ⬆️ Import** (`.json`) — full project backup and restore (documents, codes, highlights, memos, relationships). Handy for moving a project to another machine.
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

Next to Undo/Redo you'll find a **font-family** picker (Georgia, Times New Roman, Arial, Verdana, Calibri, Courier New, or the default) and **`A−` / `A+`** buttons (8–48 px, shown as `Npx`). These only change how *you* read documents — they don't alter the files — and they're remembered on each machine.

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

![Codebook tab](screenshots/eQc_Codebook.png)

### 5.1 Code Details (left panel, when a code is selected) 📋

- **Code name** — rename inline.
- **Color** — choose from the swatch palette (overrides the inherited color).
- **Summary / memo** — write operational definitions, theories, or thematic summaries for the code.
- **⚡ Pull Subcode Summaries** — appends every subcode's memo into the parent's memo, saving you copy-paste when consolidating themes.

### 5.2 Collated excerpts (center panel) 📚

Select a code to see **every** excerpt coded to it, across every document. Sort by: **Default order**, **Notes First**, or **Starred First**. Each excerpt has **⭐ Star / remove** controls and its own per-excerpt note.

### 5.3 Import options (left panel) 📥

- **➕ CSV** — import pre-coded tabular data (see [5.5](#55-importing-coded-datasets-csv)).
- **➕ REFI-QDA** — import a project exported from NVivo, MAXQDA, ATLAS.ti, Taguette, or another REFI-QDA-2-compliant tool. Brings in the **code hierarchy**, **text sources and coded passages**, **images and their coded regions**, and memos (code-level and source-level). Sources that can't be represented are reported by name rather than silently dropped. Re-importing the same file is safe — no duplicates.
- **➕ DOCX** — import **Word comments** as coded passages (works with Word's "New Comment" feature). Configure the **separator** used to split structured comment text into fields (e.g. `;`), whether the **first field is the speaker**, and whether the **last field echoes the highlighted excerpt** (so it can be verified, not stored as a code).

### 5.4 Export options (left panel) 📤

- **⬇️ REFI-QDA** — export the complete project as a `.qdpx` archive: codebook (hierarchy, colors, memos), text documents and their coded passages, images and their coded regions. Open it in NVivo / MAXQDA / ATLAS.ti, or keep it as an interoperable backup.
- **📄 Manuscript Skeleton** — a `.docx` outline of your write-up: every code with a written memo becomes a **heading**, its memo text underneath, and any **starred quotes** coded to that exact code appear as indented, italicized lines with source attribution. Codes without a memo are skipped, so the skeleton only shows what you've actually written up.
- **Scope selector** — choose what to export:
  - *Codes only (codebook)*
  - *Codes + excerpts*
  - *Codes + excerpts + summaries*
  - *Document + codes + excerpts + summaries* (full)
  - *Starred Excerpts* — every starred quote across the project, with its code and source document, formatted for pasting straight into a manuscript.
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
- **Zoom** 🔍 — from **10–400%** with the slider or `−`/`+` buttons; **Reset** returns to 100%. Zooming in scrolls the paper instead of stretching it.
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

![Auto-Coder tab](screenshots/eQc_Autocode.png)

> **Example:** you want every mention of *zoom fatigue* coded. Choose "Word roots & variants" so *zoom fatigues* and *zooming* matches are handled sensibly, capture the **enclosing sentence**, target the code `Well-being → Digital fatigue`, and execute. eQc codes all matches and tells you how many new passages it created.

---

## 8. The Analysis Dashboard Tab

The dashboard uses the full window width and has **six sub-tabs** (plus the HTML Report button). Every sub-tab has **its own sort controls and its own ⬇️ CSV / ⬇️ DOCX export** — exports always reflect exactly what's on screen (current sort, current filters).

![Analysis Dashboard](screenshots/eQc_Analysis.png)

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

![Co-occurrence detail](screenshots/eQc_Analysis_3.png)

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
- **Version:** read live from the app's own build metadata (always accurate — never manually maintained)
- **Author:** Anisur Rahman Bayazid
- **License:** MIT

![About tab](screenshots/eQc_About.png)

---

## 11. Supported File Types — Quick Reference

| Task | Format | Details |
| --- | --- | --- |
| Project backup & transfer | `.json` | Full export / import / merge |
| External QDA projects (in **and** out) | `.qdpx` | REFI-QDA-2 export & import — codes, text sources, coded passages, images + coded regions, memos |
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
| LAN collaboration | UDP + WebSocket | Live multi-coder sessions on a local network |

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

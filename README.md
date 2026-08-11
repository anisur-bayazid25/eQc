# eQc — Easy Qual Coding

> **Complete User Guide & Documentation (v1.1.0)**

Welcome to **eQc — Easy Qual Coding**, a lightweight, local-first qualitative data analysis (QDA) desktop application built with **Electron**, **React**, and **SQLite**.

eQc is designed to remove the complexity of traditional QDA software while providing researchers with an intuitive, flexible, and responsive workspace for coding, memoing, and analyzing qualitative data.

---

# Table of Contents

* [1. Overview & Architecture](#1-overview--architecture)
* [2. Header Bar & Project Management](#2-header-bar--project-management)
* [3. Workspace Tab](#3-workspace-tab)

  * [3.1 Document Management](#31-document-management)
  * [3.2 Document Editor](#32-document-editor)
  * [3.3 Code Legend](#33-the-code-legend)
  * [3.4 Manual Coding Workflow](#34-manual-coding-workflow)
* [4. Codebook Tab](#4-codebook-tab)

  * [4.1 Importing Coded Datasets (CSV)](#41-importing-coded-datasets-csv)
* [5. Auto-Coder Tab](#5-auto-coder-tab)
* [6. Analysis Dashboard](#6-analysis-dashboard)
* [7. About](#7-about)
* [8. Supported File Types](#8-supported-file-types)

---

# 1. Overview & Architecture

## Key Highlights

### 🔒 Local-First & Secure

* All project data is stored locally using SQLite.
* Documents, codes, memos, highlights, and analysis never leave your computer.

### 🎨 Dual Theme Support

* Dark Mode
* Paperwhite Light Mode

Switch anytime without affecting your project.

### 🖥 Flexible Workspace

Resizable and draggable panels allow you to customize your workspace for any screen size.

### 📄 Multi-format Support

Supported document formats include:

* `.txt`
* `.docx`
* `.pdf`
* Scanned PDFs (OCR)

---

# 2. Header Bar & Project Management

The header controls project management, backups, and application settings.

## Project Operations

### Create a New Project

Click the **➕** button beside the project selector.

Creates a fresh local project database.

---

### Switch Projects

Use the project dropdown to change the active project.

---

### Rename a Project

Click the **✏️** icon beside the project name.

---

### Export Project

Click **⬇ Export**

Exports the complete project as a standalone JSON file containing:

* Documents
* Codes
* Highlights
* Memos
* Relationships

---

### Import / Restore Project

Click **⬆ Import**

Imports a previously exported JSON project.

---

### Merge Projects

Click **🔀 Merge**

Merge another exported project into the currently open project.

Useful for collaborative coding.

---

## Global Controls

| Feature      | Description                                   |
| ------------ | --------------------------------------------- |
| Undo / Redo  | Reverse or reapply coding operations          |
| Theme Toggle | Switch between Dark and Light modes           |
| Save         | Force-save all changes to the SQLite database |

---

# 3. Workspace Tab

The Workspace is the primary environment for:

* Managing documents
* Creating folders
* Coding text
* Writing notes

| Left Panel        | Center Panel    | Right Panel    |
| ----------------- | --------------- | -------------- |
| Documents         | Document Editor | Code Legend    |
| Folder Management | Text Editing    | Code Hierarchy |
| File Upload       | Highlighting    | Code Tree      |

---

# 3.1 Document Management

## Creating Folders

Use:

* **+ Root Folder**
* **+ Folder**

Organize data into categories such as:

* Interviews
* Focus Groups
* Field Notes

Nested folders are supported.

---

## Upload Documents

Click **+ Doc**

Supported formats:

* TXT
* DOCX
* PDF

Batch uploads are supported.

---

## Upload Scanned PDFs

Click:

**+ Scanned PDF (OCR)**

OCR converts image-based PDFs into searchable, selectable text.

---

## Sort Documents

Available sorting methods:

* Name
* Date Added
* Size
* Most Coded

---

# 3.2 Document Editor

Selecting a document loads it into the center editor.

Features include:

* Editable text
* Highlight overlays
* Color-coded coded segments
* Inline code inspector
* Remove applied codes

---

# 3.3 The Code Legend

The right panel contains the complete coding hierarchy.

## Create Codes

* **+ Root Code**
* **+ Subcode**

Supports unlimited nesting.

---

## Expand / Collapse

Use:

* ▶ Expand
* ▼ Collapse

to navigate large code trees.

---

# 3.4 Manual Coding Workflow

## Method 1 — Drag & Drop

1. Select text.
2. Drag the highlighted text.
3. Drop onto the desired code.

---

## Method 2 — Click to Code

1. Highlight text.
2. Click the desired code.

The selected passage is immediately coded.

---

# 4. Codebook Tab

The Codebook manages:

* Code definitions
* Memos
* Summaries
* Collated excerpts

| Panel       | Purpose                        |
| ----------- | ------------------------------ |
| Code Tree   | Select codes                   |
| Excerpts    | Review all coded segments      |
| Memo Editor | Definitions and thematic notes |

---

## Features

### Collated Excerpts

Selecting a code displays every excerpt coded with that theme across all documents.

---

### Code Definitions

Store:

* Operational definitions
* Theoretical notes
* Theme descriptions
* Analytical memos

---

### Pull Child Summaries

Click:

**⚡ Pull Child Summaries**

Automatically appends all child summaries into the selected parent memo.

---

### Rename & Recolor Codes

Modify:

* Code names
* Display colors

directly from the memo panel.

---

# 4.1 Importing Coded Datasets (CSV)

Click:

**➕ Import Dataset (CSV)**

to import structured qualitative datasets.

## Automatic Header Mapping

| Category      | Accepted Headers                   | Required |
| ------------- | ---------------------------------- | -------- |
| Document Name | Participant, Document, Source      | ✅        |
| Quote         | Quote, Quotes, Excerpt, Text       | ✅        |
| Parent Code   | Parent Node, Parent                | Optional |
| Child Code 1  | Child Node 1, Child 1              | Optional |
| Child Code 2  | Child Node 2, Child 2              | Optional |
| Summaries     | Summary of Parent, Child 1 Summary | Optional |

---

## Example CSV

| Participant  | Parent Node    | Child Node | Quote                                      | Summary                                          |
| ------------ | -------------- | ---------- | ------------------------------------------ | ------------------------------------------------ |
| Interview_01 | Infrastructure | Drainage   | The main problem was the blocked drainage. | Mentions physical blockages in the sewer system. |
| Interview_01 | Community      | Mutual Aid | Neighbors helped stack sandbags.           | Grassroots volunteering.                         |
| Survey_Res   | Government     | Delay      | City officials took three days to arrive.  | Delayed official response.                       |

---

# 5. Auto-Coder Tab

Automatically code large datasets using keywords or phrases.

## Workflow

### Step 1

Enter a keyword or phrase.

Example:

```
climate change
```

---

### Step 2

Choose capture boundary.

Options:

* Exact Match
* Enclosing Sentence

---

### Step 3

Select language

Required for sentence detection.

---

### Step 4

Choose the target code.

---

### Step 5

Click:

**Execute Auto-Code Job**

---

# 6. Analysis Dashboard

Generate quantitative summaries of coded qualitative data.

All outputs can be exported as:

* CSV
* DOCX

---

## Available Analyses

| Analysis         | Description             | Use                             |
| ---------------- | ----------------------- | ------------------------------- |
| Coding Frequency | Counts coded segments   | Identify dominant themes        |
| Code × Document  | Code-by-document matrix | Compare participants            |
| Co-occurrence    | Code overlap matrix     | Discover relationships          |
| Framework Matrix | Case × Theme summaries  | Structured qualitative analysis |

---

## Coding Frequency

Displays a bar chart showing:

* Most frequent codes
* Rare codes
* Coding balance

---

## Code × Document Matrix

Rows:

* Codes

Columns:

* Documents

Cells:

* Number of coded excerpts

Useful for comparing participants or groups.

---

## Code Co-occurrence Matrix

Shows how frequently two codes overlap on the same text.

High values indicate strong conceptual relationships.

---

## Framework Matrix

Creates an editable:

**Case (Document) × Theme (Code)**

summary table.

---

# 7. About

| Item        | Value                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| Application | eQc – Easy Qual Coding                                                    |
| Version     | 3 (2026)                                                              |
| Author      | Anisur Rahman Bayazid *(with help from borrowed intellect)*               |
| Contact     | [anisur.rahman.bayazid@gmail.com](mailto:anisur.rahman.bayazid@gmail.com) |
| License     | MIT                                                                       |

---

# 8. Supported File Types

| Task               | Format                  | Notes                               |
| ------------------ | ----------------------- | ----------------------------------- |
| Project Backup     | `.json`                 | Export, import, merge               |
| QDA Exchange       | `.qdpx`                 | REFI-QDA compatible                 |
| Documents          | `.txt`, `.docx`, `.pdf` | Standard imports                    |
| Scanned Documents  | `.pdf`                  | OCR supported                       |
| Structured Dataset | `.csv`                  | Imports documents and codebook data |

---

# License

This project is released under the **MIT License**.

---

# Version

**eQc — Easy Qual Coding**
Version **1.2.0 (2026)**

<p align="center">
  <img src="public/eqc-logo.png" alt="eQc logo" width="180">
</p>

# eQc — Easy Qual Coding

**Version 1.8.9** · A local desktop app for qualitative research.

[![ORCID](https://img.shields.io/badge/ORCID-0000--0001--9015--4422-green?style=flat-square&logo=orcid&labelColor=A6CE39)](https://orcid.org/0000-0001-9015-4422) [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23451326.svg)](https://doi.org/10.5281/zenodo.23451326) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

If you use eQc in published work, please cite it using the **Cite this repository** link on the GitHub page (APA and BibTeX), or the metadata in [`CITATION.cff`](CITATION.cff).

<!-- zenodo-citation:start -->
Archived release **v1.8.8**: [10.5281/zenodo.23646205](https://doi.org/10.5281/zenodo.23646205). Use this version DOI when citing this release.
The [all-versions DOI](https://doi.org/10.5281/zenodo.23451326) above opens the latest archived release.
<!-- zenodo-citation:end -->

Import interviews, field notes, documents and images; code passages and regions; organise your codebook; write memos; and explore your analysis. No account or cloud upload is required.

## What eQc is

**eQc — Easy Qual Coding** is a local-first qualitative data analysis workbench for researchers who want the depth of a professional QDA package without an account, a subscription, or a cloud upload.

It is a desktop application built with **Electron 31, React 18, TypeScript and better-sqlite3** — running entirely on your own machine. Interviews, field notes, documents, images and the coding built on top of them stay on disk, so the work continues on a train, in a rural clinic, or in an archive with no signal.

Think of it as a free, offline alternative to paid qualitative coding and analysis softwares, that keeps **REFI-QDA interoperability**, so a project can still travel to and from those tools when collaboration or archiving demands it. It grew out of a mixed-methods researcher's frustration working with paid Qualitative Data Analysis (QDA) softwares, and lack of easy to use open source QDA softwares, which have all the necessary functions: everything here exists because a real analysis needed it, and even paid licences failed to provide what was needed.

## What's inside

| Area | Capability |
| --- | --- |
| **Workspace** | TXT, Markdown, Word and PDF sources — including scanned PDFs read with local Tesseract OCR in Bengali and English — plus PNG, JPEG, GIF, WebP, BMP and HEIC images. Folder trees, overlapping coding, coding stripes, line numbers, reading themes and typefaces, image-region coding with resize handles, annotations, in-vivo codes, multi-code application, case links, coder filters and source memos. Retained originals open in a formatted Word view or the PDF reader. Research tools add cases with attributes, groups, a filtering Review panel, saved queries and local History. |
| **Codebook** | A code tree of any depth with drag-order, definitions kept distinct from interpretive summaries, collated excerpts per code, code consolidation, and codebook or coded-data import from CSV, TSV or Excel with sheet choice and column mapping. Exports carry child codes and starred evidence. |
| **Auto-Code** | Keyword and phrase scanning across every source, with exact-match or enclosing-sentence boundaries, literal or word-root matching, duplicate suppression and a preview of what will be applied. |
| **Analysis** | Coding frequency, code × document matrix, co-occurrence with relationship memos, framework matrices for documents and for case × theme, word frequencies, KWIC contexts, intercoder reliability with eight comparison methods, consensus adjudication, and a combined offline HTML report. |
| **Memo-Book** | Every note in one place — project, document, code, quote, case, framework and co-occurrence memos — with filters, paging, Word and Excel export, and a manuscript skeleton for drafting. |
| **Visualization** | Seventeen diagram families, seventeen colour presets including Viridis and Okabe–Ito, custom palettes, a fully editable canvas, named drafts, and SVG, PNG or JPEG export with a publication print width. |
| **Help and About** | The complete user guide and application reference ship inside the app, searchable offline. About carries version, update checks and a hardened feedback form. |
| **Across the app** | LAN host and join with team announcements; researcher profiles with time tracking and milestones; project exchange as JSON, QDPX, QDC or QDE; recovery snapshots and checkpoints; undo and redo; five keyboard-shortcut profiles; light and dark themes. |

Every feature is reachable from the eight tabs at the top of the window, and the Help tab explains the app without needing an internet connection.

## Downloads and Help

- [Latest release](https://github.com/anisur-bayazid25/eQc/releases/latest)
- [Complete user guide](USER_GUIDE.md)
- [Application reference](DOCUMENTATION.md)
- [Release notes](RELEASE_NOTES.md)
- [Changelog](CHANGELOG.md)

The **Help** tab includes the complete guide and application reference offline. Search a function or open a section to find instructions and examples.

## System requirements

| Component | Minimum | Recommended |
| --- | --- | --- |
| Windows | Windows 10, 64-bit (x64) | Windows 11, 64-bit (x64) |
| macOS | macOS 10.15 on Intel; macOS 11 on Apple Silicon | A currently supported macOS release; matching Intel or Apple Silicon installer |
| Processor | 64-bit, 2 cores | 4 cores or more |
| Memory | 4 GB RAM | 8 GB RAM; 16 GB for large PDFs, frequent OCR or heavy multitasking |
| Free storage | 1 GB for installation, plus space for projects and backups | SSD with 5 GB free, plus project and backup storage |
| Display | 1366 × 768 | 1920 × 1080 or higher |
| Graphics | Integrated graphics | Integrated graphics; no dedicated GPU required |

**The hardware minimum is a provisional baseline for routine text coding, not a verified low-spec performance guarantee.** Large source collections, scanned PDFs and dense visualizations need more resources. The operating-system floor follows the current [Electron 31 runtime](https://github.com/electron/electron/blob/v31.7.7/README.md#platform-support); macOS installers are configured for Intel and Apple Silicon. The release workflow also builds Linux x64 AppImage and Debian/Ubuntu `.deb` packages on Ubuntu 22.04. Linux desktop compatibility still needs validation on real systems. Linux update notices link to a manual download.

Normal coding, analysis and Help work offline. Installation downloads and updates need internet. OCR runs locally, but its current setup retrieves engine and Bengali/English language assets from online services; allow internet when using OCR. Offline OCR availability depends on those assets being available in the cache and is not guaranteed.

**OCR languages:** scanned-PDF recognition currently uses Bengali and English only. Other OCR languages are not selectable. This limitation applies to scanned-text recognition, not ordinary imported text; language choices in Word Cloud and word-frequency analysis do not change OCR recognition.

**Project and backup storage:** embedded images use base64, which adds roughly 33% to their binary size. HEIC-to-PNG conversion, retained original documents and PDF page images can add more. Photo-heavy projects can exceed 1 GB each; full JSON backups containing that media require additional space for every saved copy. The 1 GB installation allowance does not include project data or backups.

## What's new in 1.8.9

- Assign participant cases directly from a selected or coded passage, with searchable profiles and a compact picker.
- Build demographic tables with source scopes, category rules, descriptive summaries, comparison groups and saved table layouts.
- Write framework and relationship memos beside their evidence in resizable drawers, and return to your analysis or memo draft after inspecting a source.
- Compact, responsive headers, clearer icons, dark-mode fixes, lighter memo lists and Excel spreadsheet exports throughout the app.

## What's new in 1.8.8

- **Codebook import you can map yourself:** bring a codebook or coded dataset in from CSV, tab-separated text or an Excel workbook (choose the worksheet). Build the tree level by level — there is no depth limit — and give every level its own code, definition and summary column, so header names such as “Parent code” or “Child node 1” no longer decide what the importer understands. A preview and a dry run show the counts before anything is written.
- **Safer editing:** appending to a document no longer stretches the last coded quote over the new text, and editing a Windows-line-ending source no longer drops the coding that spans a line break.
- **Safer exchange:** QDPX now carries starred evidence, analysis periods, folder paths, code order and coder identity in the eQc appendix while keeping the standard parts other tools read; consolidating codes and re-merging projects no longer strand case-framework memos, duplicate excerpts or duplicate folders.
- **Clearer numbers:** the dashboard and HTML report co-occurrence matrix count identical ranges once across coders, matching the heat map, network and Sankey views.
- **LAN sessions require a password:** hosting is disabled until one of at least four characters is set, and every joiner must enter it.
- **Polish:** confirmation dialogs close with Escape and keep keyboard focus, light and dark themes are consistent across dialogs and toolbars, duplicated export buttons are labelled, and the interface text now names the controls it describes.

## Previous release: 1.8.7

- **Intel Mac startup fix:** corrected the Intel installer carrying an Apple Silicon SQLite component. Intel and Apple Silicon installers now build on separate matching-architecture runners, with binary checks and an in-memory packaged database startup check before publication.
- **Mac installation:** choose `x64.dmg` for Intel processors or `arm64.dmg` for Apple M-series chips. Copy eQc into Applications before opening it. Replace the app with this version if the Intel v1.8.6 installation would not start; keep existing project/profile data.

## Previous release: 1.8.6

- **Connected research tools:** use cases, groups, attributes, saved queries or selected passages to scope graphs and coded-text word clouds.
- **Clearer intercoder agreement:** consistent statistic names, source review confirmations, disagreement evidence, resolution memos and preserved named runs for manuscript/HTML reports. Research controls follow the Comparison setup layout.
- **Case exchange and framework analysis:** preview typed case CSV imports, retain stable identities and passage links, and write case × theme summaries with supporting evidence and participant attributes.
- **Safer project exchange:** structured QDPX cases, variables and sets, preservation inventories, import reports and merge previews. App-specific research records and graph drafts travel in the eQc appendix.
- **Quieter collaboration:** routine LAN changes appear as brief text beside Saved. Release citation metadata and the README synchronize automatically after Zenodo archives the release.

## Previous release: 1.8.5

- **LAN announcements:** a button beside Profile shows unread counts and opens team notices. Hosts control each member's posting permission. Save notices with the project or keep them for the current session; pop-up notices close after 30 seconds or can be dismissed. Hosts can delete any notice, and permitted members can delete their own.
- **Word clouds from selected codes:** choose coded passages, then search/select one or multiple codes. Shared ranges and repeated coder assignments count once, with matching source evidence.
- **Editable graph lines and labels:** drag lines or either endpoint, including topic links. Edit number text and label background colour/opacity; Sankey ribbons can be moved/resized manually. Drafts retain manual styles and source evidence.
- **Cleaner chord diagrams:** smoother ribbons, connected label leaders, spacing for wrapped code names and counts placed on their own ribbons.
- **Updated Help:** offline instructions cover announcements, permissions, code-scoped clouds and the new graph editing controls.

## Previous release: 1.8.4

- **Co-occurrence network:** connected groups, circle, projected sphere, spatial 3D force and chord presets; shaded balls, flat circles or text-only labels; weighted/count-labelled links and source evidence.
- **Matching analytical views:** co-occurrence presets in Heat map and Sankey use the same explicit overlapping-range or shared-document counts, coder filters and scope. Drafts and HTML report figures retain their calculation details.
- **Clearer visualization workspace:** Code map, Network, Sankey and Word cloud lead the gallery; scrollbar-safe toolbars keep labels aligned at different window sizes.
- **Resize image coding:** adjust existing regions with corner/edge handles, preview, Save/Cancel and Undo/Redo while retaining attribution, notes and stars.
- **Project exchange:** QDPX notes include dates, author references and unique titles to avoid external software import errors.
- **Linux packages:** x64 AppImage and Debian/Ubuntu `.deb` builds join Windows and macOS releases. Linux desktop validation remains limited.

## Previous release: 1.8.3
- **Visualization workspace:** sixteen diagram types, including Word Cloud, five Sankey presets, guided Histomap/Dendrogram setup and one dedicated Blank canvas. Code map offers Simple and Detailed designs.
- **Figure editing:** edit text in place, draw standard shapes, group/align/resize objects, edit legends and apply 17 palettes or named custom palettes. The working canvas resumes after source navigation.
- **Word Cloud:** shaped clouds and PNG/SVG masks, adjustable spacing, frequency/uniform sizing, local refitting and language-aware word filters shared with word frequencies.
- **Bug reports and feedback:** send a bug report, feature request or general message from inside the app (toolbar, Help, or Ctrl/Cmd+Shift+B). Describe the problem, attach a screenshot with an optional device note, and eQc emails it to the maintainer. A copy can be saved as a ZIP to send manually when you are offline.
- **Comfort and reliability:** a clearer Inspector, readable light-mode buttons, profile-photo positioning/zoom, expanded keyboard selection and fixes for coder filters, legends, view saves and document cleanup.
- **Help and demo:** system requirements, refreshed offline instructions and uneven fictional coding with period assignments for statistical diagrams.

## Previous release: 1.8.2
- **Memo-Book:** a top tab after Analysis that gathers notes from documents, codes, quotations, cases, annotations, matrices and Code Map, with links back to their sources.
- **Writing and export:** search, filter and select memos; export one, several or all to Word or Excel. Excel separates memo categories into worksheets. Manuscript skeletons now include analysis memos and linked research notes.
- **Clearer Help:** concise offline instructions, a dedicated Memo-Book section, and Research tools focused on Cases, Groups, Review and History.
- **About links:** right-click the email or GitHub link to copy its address without extra buttons.
- **Large memo lists:** indexed source lookups, paged cards and one memo collection per manuscript export reduce repeated work.
- **Fictional demo study:** four English interviews, three simulated coders, a questionnaire/codebook, starred evidence, memos and analysis previews.

## Research workflow

1. Create a project and add sources in **Workspace**.
2. Create codes, select a passage or image region, and apply a code.
3. Use **Codebook** for definitions, summaries, merge and export — or import an existing codebook from CSV, TSV or Excel and map its columns to your tree.
4. Open **Workspace → Research tools** for cases, groups, queries and recovery history.
5. Use **Analysis** for frequencies, matrices, framework analysis, text searches, ICR and Consensus. **Visualization** offers a square-card library of editable code/mind/hierarchy maps, heat maps, word trees, word clouds (shapes and PNG/SVG masks), six Sankey presets, co-occurrence networks, histomaps, dendrograms, and process/journey/pyramid/Venn/honeycomb/ecology diagrams, with presets, manual drawing, named drafts and SVG/image export. Generation runs only when requested.
6. Use **Memo-Book** to link evidence, develop writing and export notes or a manuscript skeleton.
7. Export selected coding, analysis reports and regular JSON project backups.

## Files and sharing

Documents: TXT, Markdown, DOCX and PDF; scanned PDFs support local OCR. Images: PNG, JPEG, GIF, WebP, BMP and HEIC/HEIF. Structured coding and codebooks import from CSV, tab-separated text or an Excel workbook — pick the worksheet, then map each column to a code level, definition, summary, document, quote or coder — and Word-comment coding can be imported too.

Project import accepts JSON, QDPX, QDC and extracted QDE files with their matching sources. Project export offers JSON or QDPX, with original attachments or smaller plain-text document data. Selected coding exports to Word/Excel; Memo-Book exports to Word/Excel; analysis reports export to HTML. JSON is the complete eQc backup format and can include the selected profile and time history.

LAN collaboration shares research projects with colleagues on a trusted local network. Profiles and personal time records are kept separate from LAN sessions.

## Try the fictional demo

For instructions, use the [current user guide](USER_GUIDE.md). The [complete v1.6.4 guide](USER_GUIDE_v1.6.4.md) is retained as a historical reference.

Import [the ready-to-use project](demo/climate-resilience/dataset/03_READY_TO_IMPORT_EQC.json) through **Project tools → Import**. The [demo kit](demo/climate-resilience/eQc_Fictional_Climate_Demo.zip) also includes an uncoded starter and individual coder projects.

All people, interviews, events and findings are invented for training. Three simulated coder identities support ICR and consensus demonstrations; they are not authenticated user accounts.

## Development

Install dependencies with `npm install` using **Node 22.13 or newer** (CI uses Node 24; several tests use the built-in `node:sqlite`). `npm run dev` starts the development app, `npm run check` checks TypeScript, `npm run build` creates the web bundle, and `npm run pack -- --publish never` packages Windows without publishing.

Feature checks use Node's test runner. The authoritative list is the **Run feature regression tests** step in [`.github/workflows/build.yml`](.github/workflows/build.yml); the same command runs locally, for example:

`node --test tests/data-integrity.cjs tests/codebook-levels.cjs tests/cooccurrence.cjs tests/icr-comparisons.cjs tests/code-report.cjs tests/formatted-mapping.cjs tests/source-lines.cjs`

The QDPX schema checks additionally need Python with `lxml`.

For browser checks without starting Electron, install Playwright and its Chromium browser, set `EQC_BROWSER_CHANNEL=chromium`, and run `node tests/run-browser-checks.cjs`. The runner starts and stops a temporary Vite server. Without the browser-channel setting, it uses installed Microsoft Edge.

Implementation history is in [AI changelog](AI_CHANGELOG.md).

## Author and acknowledgments

Created by Anisur Rahman Bayazid. eQc gratefully acknowledges the contributions of the CARE project and BRAC James P Grant School of Public Health, BRAC University.

MIT License — see [LICENSE](LICENSE).

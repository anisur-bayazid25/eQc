<p align="center">
  <img src="public/eqc-logo.png" alt="eQc logo" width="180">
</p>

# eQc — Easy Qual Coding

**Version 1.8.1** · A local desktop app for qualitative research.

Import interviews, field notes, documents and images; code passages and regions; organise your codebook; write memos; and explore your analysis. No account or cloud upload is required.

## Downloads and Help

- [Latest release](https://github.com/anisur-bayazid25/eQc/releases/latest)
- [Complete user guide](USER_GUIDE.md)
- [Application reference](DOCUMENTATION.md)
- [Release notes](RELEASE_NOTES.md)
- [Changelog](CHANGELOG.md)

The **Help** tab includes the complete guide and application reference offline. Search a function or open a section to find instructions and examples.

## What's new in 1.8.1

- **Memo-Book:** a top tab after Analysis that gathers notes from documents, codes, quotations, cases, annotations, matrices and Code Map, with links back to their sources.
- **Writing and export:** search, filter and select memos; export one, several or all to Word or Excel. Excel separates memo categories into worksheets. Manuscript skeletons now include analysis memos and linked research notes.
- **Clearer Help:** concise offline instructions, a dedicated Memo-Book section, and Research tools focused on Cases, Groups, Review and History.
- **About links:** right-click the email or GitHub link to copy its address without extra buttons.
- **Large memo lists:** indexed source lookups, paged cards and one memo collection per manuscript export reduce repeated work.
- **Fictional demo study:** four English interviews, three simulated coders, a questionnaire/codebook, starred evidence, memos, analysis previews and a video walkthrough.

## Research workflow

1. Create a project and add sources in **Workspace**.
2. Create codes, select a passage or image region, and apply a code.
3. Use **Codebook** for definitions, summaries, merge and export.
4. Open **Workspace → Research tools** for cases, groups, queries and recovery history.
5. Use **Analysis** for frequencies, matrices, framework analysis, text searches, ICR and Consensus. **Code Map** diagrams the codebook.
6. Use **Memo-Book** to link evidence, develop writing and export notes or a manuscript skeleton.
7. Export selected coding, analysis reports and regular JSON project backups.

## Files and sharing

Documents: TXT, Markdown, DOCX and PDF; scanned PDFs support local OCR. Images: PNG, JPEG, GIF, WebP, BMP and HEIC/HEIF. Structured CSV datasets, codebooks and Word-comment coding can also be imported.

Project import accepts JSON, QDPX, QDC and extracted QDE files with their matching sources. Project export offers JSON or QDPX, with original attachments or smaller plain-text document data. Selected coding exports to Word/CSV; Memo-Book exports to Word/Excel; analysis reports export to HTML. JSON is the complete eQc backup format and can include the selected profile and time history.

LAN collaboration shares research projects with colleagues on a trusted local network. Profiles and personal time records are kept separate from LAN sessions.

## Try the fictional demo

Import [the ready-to-use project](demo/climate-resilience/dataset/03_READY_TO_IMPORT_EQC.json) through **Project tools → Import**. The [demo kit](demo/climate-resilience/eQc_Fictional_Climate_Demo.zip) also includes an uncoded starter and individual coder projects. Follow the [video walkthrough](demo/climate-resilience/dataset/README_VIDEO_GUIDE.md).

All people, interviews, events and findings are invented for training. Three simulated coder identities support ICR and consensus demonstrations; they are not authenticated user accounts.

## Development

Install dependencies with `npm install`. `npm run dev` starts the development app, `npm run check` checks TypeScript, `npm run build` creates the web bundle, and `npm run pack -- --publish never` packages Windows without publishing.

Feature checks: `node --test tests/data-integrity.cjs tests/release-1.6.4.cjs tests/release-1.7.0.cjs tests/code-report.cjs tests/formatted-mapping.cjs tests/source-lines.cjs`.

For browser checks without starting Electron, install Playwright and its Chromium browser, set `EQC_BROWSER_CHANNEL=chromium`, and run `node tests/run-browser-checks.cjs`. The runner starts and stops a temporary Vite server. Without the browser-channel setting, it uses installed Microsoft Edge.

Implementation history is in [AI changelog](AI_CHANGELOG.md).

## Author and acknowledgments

Created by Anisur Rahman Bayazid. eQc gratefully acknowledges the contributions of the CARE project and BRAC James P Grant School of Public Health, BRAC University.

MIT License — see [LICENSE](LICENSE).

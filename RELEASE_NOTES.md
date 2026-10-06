# eQc 1.6.4

### Added
- **Merge codes** — select two or more codes in Codebook, choose the code to keep, and merge. Text passages, image regions, child codes, definitions, memos, framework cells, relationship notes, and map references are retained or remapped. Undo with Ctrl+Z.
- **Selected-code exports** — export one or multiple codes to CSV or DOCX, optionally including their descendants, using the existing export modes.
- **Image coding in exports** — excerpt exports include image source names, normalized region coordinates, coder identities and region memos. DOCX includes cropped image excerpts. Starred Excerpts includes both text and image coding, with unchanged option titles.
- **Complete analysis HTML report** — includes scoped pairwise agreement, Cohen’s κ, Holsti, Fleiss’ κ, Krippendorff’s c-Alpha-binary and Cu-Alpha, per-code results, consensus counts and coder assignments, plus cropped image coding and all existing dashboard analyses.
- **Acknowledgments** — recognize the contributions of the CARE project and BRAC James P Grant School of Public Health, BRAC University, in About and documentation.

### Changed
- All codebook CSV/DOCX modes include document or image source names. Codes-only exports list associated sources and retain uncoded codes; excerpt exports retain uncoded codes and their memos/definitions where enabled.
- Removed the redundant “Document + codes + excerpts + summaries” mode; “Codes + excerpts + summaries” now supplies source names itself.
- Notes & Memos CSV includes a Document column and whole-image memos.
- Updated the user guide and README with previously missing v1.6.0–1.6.3 reliability, consensus, definition, and data-integrity features.

### Fixed
- Image-only manuscript entries now embed their starred regions even when there are no starred text quotes.
- CSV correctly escapes carriage returns; HTML distinguishes an executed KWIC search with no matches from a search not yet run.


# eQc 1.8.8

This release makes codebook import fit real-world files, protects existing coding from three quiet data-loss paths, and completes the exchange and interface polish begun in 1.8.6–1.8.7.

## Import any codebook, at any depth

- **A mapping dialog instead of fixed header names.** Choose a CSV, tab-separated file, Excel workbook or Excel “Unicode text”; pick the worksheet when the workbook has more than one. Each column is matched to a role from a dropdown, so “Parent code”, “Parent node”, “Theme”, “Sub-code 1” and “Code definition” all work — and so does a language the importer has never seen.
- **No depth limit.** Add a level for every step of the tree. Each level has its own code column plus an optional definition and summary/memo column, so a five- or six-level codebook arrives with the right text on every level.
- **Preview before writing.** The first rows, the mapped columns and a dry run (“will add 24 codes, 4 documents, 118 coded passages, 2 quotes not found”) appear before anything changes.

## Coding that survives editing

- Appending text to a document no longer extends the last coded quote over the new text; quotes keep their exact boundaries when text is inserted at their edge.
- Editing a Windows (CRLF) source no longer drops coded passages that span a line break. Stored sources and comparisons now agree on line endings.
- CSV import never rewrites an existing transcript: an unmatched quote is reported and the source is left untouched. Flat codebooks (no parent column) keep their definitions and summaries, an optional coder column is preserved, and UTF-16 “Unicode text” files are decoded correctly.

## Exchange and merging

- QDPX carries starred evidence, analysis periods, folder paths, code order and coder identity in the eQc appendix, and restores them on import; the standard REFI-QDA elements other applications read are unchanged.
- Consolidating codes remaps case × theme framework summaries, ICR settings and decisions, saved queries, canvas drafts and annotations, and removes duplicate excerpts left on the surviving code. Previously the case-framework memos were deleted on the next save.
- Re-merging a project no longer duplicates the folder tree, and a source memo or period on an incoming document is kept.

## Numbers that agree

The dashboard and HTML report co-occurrence matrix now count identical ranges once across pooled coders, matching the heat map, network and Sankey views. Two coders coding the same two passages show 1 pair, not 4. Single-coder projects are unaffected.

## Lan sessions require a password

Hosting is disabled until a session password of at least four characters is entered, enforced again in the main process before the server starts. Without one, the session was reachable by any device on the network.

## Interface and accessibility

- Confirmation dialogs close with Escape, keep keyboard focus inside, and use theme colours in light and dark mode; merge confirmations no longer look destructive, and the delete copy no longer claims it cannot be undone.
- The duplicated export buttons in the co-occurrence view are captioned (Matrix, Relationship memos), and the codebook's project exports are grouped and renamed.
- Interface text names the controls it describes, search results are keyboard reachable, analysis sort and filter controls are announced, and the document editor follows the chosen reading font and size.
- PDF import disables pdf.js font-program evaluation, closing CVE-2024-4367 in the OCR path.

## Documentation

The in-app Help, user guide, application reference and README are updated for the new import, the required LAN password, the co-occurrence definition and the appendix contents.

Windows, Intel and Apple Silicon macOS, and Linux x64 AppImage/deb packages are provided. Existing projects and profiles do not need any migration.

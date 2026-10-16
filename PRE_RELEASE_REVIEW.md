# Pre-release review — 16 October 2026

## Completed changes

| Finding | Resolution |
| --- | --- |
| Inspector controls had uneven sizes, unclear numeric fields and crowded typography | Grouped Font, Size & style and Text colour; consistent 34-pixel controls; explicit Edit text; Direction & rotation disclosed separately |
| Word exclusions displaced the selected item's formatting | Formatting comes first; exclusions use a smaller editor and optional file-import disclosure; source lists have a bounded scroll area |
| Pending cloud generation could replace newer edits or styles | Context checks reject stale results, including when the canvas, sources, palette or visualization changes |
| A completed refit could jump selection back to an earlier word | Selection is retained and remapped by word identity |
| Applying exclusions could reset individual word appearance | Current typography, colours, underline and grouping/layers are retained |
| Word-order changes could attach a custom connector to a different word | Connector endpoints are remapped by word; connectors to excluded words are removed |
| SVG source descriptions stopped at 24 documents despite a higher configured limit | Source metadata follows the selected document limit; verified with 32 sources |
| Saved font labels and invalid locale errors were unclear | Font families are identified; invalid locales receive actionable feedback; malformed cached language profiles are ignored |
| Several regression checks expected the obsolete extra canvas-resume step | Updated assertions to match automatic return to the working canvas |

## Muse Spark audit follow-up

| Reported finding | Disposition |
| --- | --- |
| A: Raw coder comparisons and duplicate dropdown names | Fixed in Heat map/Sankey and the same affected Histomap/Dendrogram paths; normalized comparison/list values without changing historical stamps |
| #7: Deleted documents leave framework cells | Explicit deleteDoc filtering plus the shared cleanResearchLinks guard; browser checks verify other documents' cells survive and Undo/Redo restore/remove the deleted cells |
| B: Generated designs hide a restored legend | Removed unconditional design-effect reset; fresh generated default is set once; regeneration and draft restoration retain visible legends |
| C: View checkpoints omit updatedAt | Added edit timestamp to the direct save path, preserving Undo/Redo history |
| D: Per-project LAN keys accumulate | Remove both keys after successful deletion; another project's keys are retained |
| #10: Text/image inspectors survive project switches | Existing project-id reset clears both; browser checks exercise switches with each inspector open |
| Unused ZoroArtwork / MilestoneId | Removed; no remaining source/test references |
| Browser/usability checks unwired | Already wired through tests/run-browser-checks.cjs in Windows CI; added the audit follow-up to that runner |
| Repeated draft dimensions | Retained for complete design/backward compatibility; documented that view dimensions are authoritative after canvas resizing |
| Optional phrase/labels/ratings access | Added empty-string fallbacks for defensive validation |
| Duplicate blank canvas inside Code map | Removed the designer's manual branch; Simple/Detailed remain, with one Blank canvas entry in the library; browser checks generation and Undo |

The new browser check verifies canonical coder dropdowns for all four graph types, unchanged attribution stamps, view timestamps without an Undo entry, legends through regeneration/draft loading, and isolated LAN-key cleanup. Aggregation tests verify counts with both canonical and whitespace-padded saved filters.

## Profile picture controls

Added drag-to-position, 100–400% zoom, keyboard movement, Reset, Cancel and Save picture. Adjust photo reopens the retained full-frame image. The profile portrait and header avatar use identical framing. Crop metadata is validated and retained in SQLite and JSON profile backups; removing the photo clears its framing.

Images stay bounded to 1024 pixels on their longest side. Source files are limited to 2 MB and 25 megapixels. No image-editing dependency was added.

## Help review

Updated both Help books to match the Inspector labels, advanced controls, word-exclusion import, language/length filtering and photo editing. Added a simple first-visualization example. Contents, section links, responsive Help layout and offline instructions were checked.

## Verification

### Requirements estimate

README and both offline Help books now include minimum/recommended system requirements. Hardware figures are provisional for routine text coding, pending testing on a physical 4 GB, dual-core machine. The operating-system floor follows the locked Electron 31.7.7 runtime and configured release architectures; macOS compatibility has not been verified by this Windows browser review.

Evidence: the existing `release/win-unpacked` directory contains 102 files totaling 413.3 MiB. This is an older packaged artifact, not a measurement of the upcoming installer. OCR renders sequential pages, caps each canvas at 8 million pixels (about 30.5 MiB for one RGBA surface), clears each canvas, and terminates its worker. Additional PDF/OCR buffers, language models, runtime processes and operating-system memory prevent deriving total system RAM by adding dependency sizes. SVG/cloud memory depends on object counts and raster masks. OCR's default remote assets mean offline recognition is not guaranteed.

Before confirming the minimum, measure aggregate memory across all installed-app processes, responsiveness and failures on a low-spec PC during text coding, PDF reading/OCR, graph generation and export. Check peak demand and installation/update free-space use, including temporary files; leave room for the operating system and other applications. The existing UI benchmark does not certify a minimum hardware configuration.

### Completed checks

- TypeScript check and production build passed.
- All **105 feature regression tests** passed in the follow-up run.
- All **19 functional browser test files** passed in one complete runner invocation, including the Muse Spark audit follow-up, coding, annotations, Memo-Book, Help, visualization settings, palettes, drafts, grouping, exports, stale updates and profile-photo persistence. The strengthened audit check also passed separately after adding hidden-legend regeneration and a second timestamp assertion.
- The first hosted Windows release run exposed a cold-load timing assumption in the shape-gallery test. Added an explicit wait for the lazy-loaded library before counting icons, and ensured the test creates its own screenshot directory.
- Inspector layout was checked in light and dark themes; profile-photo controls were also checked at mobile width.
- Both Help Overview requirements tables were checked for search, seven requirement rows and responsive layout at 1366, 800 and 640 pixels; existing Help navigation/table checks also passed.
- Large-project coding UI benchmark: **600 codes, 80 sources and 4,000 initial coding entries**, median **47.6 ms** from applying a code through two rendered frames. Save transport was simulated; this is a UI response measurement rather than an end-to-end installed-app saving guarantee.

UI checks used headless Edge with controlled desktop bridges; profile-photo checks used the SQLite store. This review did not install a packaged release or run a live two-computer LAN session. The v1.8.2 tag runs Windows/macOS installer builds and publishes the release only after both build jobs pass.

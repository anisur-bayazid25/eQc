# Visualization review — 15 October 2026

The review uses `dataset/03_READY_TO_IMPORT_EQC.json`: four fictional interviews, 24 codes and three coders. No participant data or real research results are used. Browser checks run against temporary in-memory copies, without altering the demo or a user project.

## What was reviewed

Twenty-two configurations cover all fourteen types: Simple/Detailed code maps, detailed mind map, vertical/horizontal hierarchies, document/shared-document heat maps, before/after phrase trees, sequence/cycle/branch processes, journey, pyramid, Venn, honeycomb, ecology network/layers, a histomap, document/code dendrograms and blank canvas. The blank canvas is intentionally empty; manual editing has its own browser coverage.

Each graph is opened through the app and exported through its real SVG export path. Checks cover the correct settings page, cancel without project changes, no duplicate Pause button, disabled graph zoom while configuring, text staying within the canvas and absence of editing widgets in exports. Representative PNGs are decoded to verify output dimensions. A contact-sheet gallery supports visual inspection.

## Findings and changes

| Finding | Change |
| --- | --- |
| Every type opened the Code Map designer | A gear opens the current type's settings, preserving prior choices; cancelling returns to the same canvas |
| Pause duplicated library navigation | Removed Pause; library/tab navigation unloads automatically |
| Legends obscured titles and labelled nodes | New typed figures initially hide separate legends; the editable Legend menu remains available |
| Mind-map limits could omit later themes | Include roots first, then distribute descendant slots across branches |
| Hierarchy forests were extremely wide or had crossing connections | Compact subtree-centred panels retain actual code parent/child links |
| Repeated coder assignments inflated passage counts | Default to unique code/document/start/end ranges; retain explicit decision, presence and coder modes |
| Long heat-map filenames shrank to tiny text; colour keys were clipped | Short C/D column identifiers, full source keys, numeric colour ticks and correctly sized paper |
| Phrase trees mixed prompts with participant text | Explicit whole-document versus merged-coded-range scope, with the chosen method labelled |
| Branching flows crossed other blocks | Fan branches into a separate column; sequence flows wrap into ordered rows |
| Journey points were difficult to align with stages | Rating gridlines and vertical stage guides; trend connectors have no arrowheads |
| Venn overlap text straddled circle edges | A compact, configurable overlap label and more visible transparent fills |
| Hexagons overlapped incorrectly | Flat-top honeycomb geometry with matching staggered columns |
| Ecology layer labels competed with the rings | Numbered rings and a separate readable key |
| Short words split inside narrow labels | Shrink common Latin words to fit before splitting characters |
| Pixel scaling was described as physical DPI | Physical SVG width and an explicit print-readability/DPI check |

## Reading these demo figures

- The repeated coder entries are decisions, not additional residents. Unique-passage mode merges only identical ranges; different boundaries remain separate.
- Most broad codes occur in all four documents. A uniform shared-document matrix can therefore be a correct result, rather than evidence of especially strong or causal relationships. Use selected subcodes and read the source passages.
- The revised demo includes uneven sentence-level coding, including Restarting work examples. A parent code may still have zero direct assignments even when children are used; zero should remain visible, and must not be treated as missing data.
- Full-text word trees include interviewer questions. Use coded-only scope for a focused reading of selected evidence, and remember that coding itself determines that selection.
- Journey ratings, pyramid order, process pathways and Venn overlap labels are researcher-specified illustrations. They are not calculated findings from these four interviews.
- A 24-code matrix or 24-context tree can still be too dense for a single journal column. Check text at the actual printed width, select fewer items or use a full-page figure. SVG preserves text and lines; extra pixels do not enlarge type on paper.

## Outputs and reproduction

Run `npm run test:visualization-publication` with Playwright available. `EQC_PLAYWRIGHT_PATH` and `EQC_BROWSER_CHANNEL` can select the installed runtime/browser. The script uses a temporary Vite server and writes `release/publication-qa/gallery.html`, individual SVGs, representative PNGs, five contact sheets and `measurements.json`. The earlier review is in `release/publication-before` for comparison.

Histomaps and dendrograms are now implemented with requirements in their settings. The revised demo includes four story-time periods, an assignment CSV and ready-made drafts. The new workspace centers paper between a left tool rail and a collapsible right Inspector. Statistical methods are checked against hand-calculated cases; pyramid edges are tested for a common triangular slope.

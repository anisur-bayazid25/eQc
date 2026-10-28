# eQc 1.8.9

This release improves participant attribution, demographic tables, evidence-led memo writing and everyday performance. The changes work in new and existing projects.

## Participant attribution while coding

- Assign cases directly from selected text, coded-passage popups, Codebook excerpts and review results.
- Search case names, IDs and profile attributes. The compact picker defaults to cases linked to the current document, with a checkbox to include the wider project.
- Passage attribution is shared across codes on the same text. Removing an attribution preserves the case links outside that range.
- Quotes and long notes use compact previews; the complete text remains available when needed.

## Demographic tables ready for writing

- Filter participants by folders, documents and source groups; select the attributes to report. A participant counts once in the selected scope.
- Choose sectioned summaries, merged variable/category tables, comparison columns or participant profiles.
- Rename and combine categories without changing participant profiles. Numeric categorisation supports greater/less than, inclusive comparisons, equality, ranges, cutoff splits and equal-width groups, with overlap checks.
- Choose counts, percentages and their denominator, missing-value handling, mean/sample SD, median/quartiles or minimum/maximum.
- Edit labels, type, sizes and table styles in a resizable right-hand drawer. Save named table configurations in the project.
- Export Word, Excel or HTML, or copy a formatted table. Wide tables keep a readable background across every column.

## Frameworks, evidence and return navigation

- Compare cases across themes or compare whole documents in separate framework views.
- Framework summaries and co-occurrence memos open in collapsible, resizable drawers, with writing beside independently scrolling evidence.
- Frozen matrix labels, search/jump, keyboard navigation, compact spacing and drag-to-pan make large matrices easier to use.
- Open a supporting source and return to the retained Analysis, Memo-Book or Visualization view. Working navigation state lasts while that project stays open; saved summaries and named drafts remain in the project.

## A cleaner, lighter workspace

- Analysis opens with a card grid, matching the Visualization library, with distinct icons.
- Compact, wrapping command ribbons give more room to content. Fixed Memo-Book controls reserve their own height, and pagination and source filters retain their padding.
- Native dropdowns, code controls and reader controls have readable light/dark colours. Reader controls follow Paperwhite, White or Dark independently of the surrounding app theme.
- Source sorting supports both directions. Shared actions use compact icons with tooltips and accessible names.
- Memo-Book renders fewer cards at once and opens long source-link lists on demand. Hidden views avoid unnecessary recalculation; transcript highlighting and participant-link lookup do less repeated work.
- Memo-Book follows Codebook in the main navigation, then Auto-Code, Analysis and Visualization.

## Consistent exports and reading fonts

- All spreadsheet export options now save genuine Excel workbooks instead of CSV. Duplicate spreadsheet choices are removed; Word, HTML and project-backup formats remain available.
- Memo-Book has one Export menu. Project data exports are under More exports and include participant profiles, case links, groups, saved queries and notes. The project-wide HTML report is on Analysis home rather than repeated in every analysis view.
- Case tables exported to Excel can be imported again with stable IDs, attributes and passage links. Existing delimited-file import remains supported.
- The reading font picker searches installed families, previews them, remembers favourites and detects unavailable fonts with suggested alternatives. Failed font enumeration can be retried instead of leaving a permanently empty list.

Existing research text, quotes and participant profiles are not rewritten by these interface changes. Keep native JSON backups for complete project recovery.

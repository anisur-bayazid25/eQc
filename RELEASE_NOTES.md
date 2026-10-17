# eQc 1.8.3

- Required sender name and email for all feedback, with profile prefill and validation in the app and generated hosted script. Sender name is included in the report; existing rate limits remain. The Apps Script deployment must be updated to enforce the new name requirement.
- Switched the default feedback backend to Google Apps Script for a zero-budget setup without a website/domain. Added a single paste-ready script, quota/rate limits, duplicate protection, conservative uncertain-send handling and Google response-redirect support. Live delivery requires the owner's one-time deployment and public URL.
- Added Feedback in the toolbar/Help and Ctrl/Cmd+Shift+B, with profile-email prefill, screenshot capture/attachment preview, optional device details, direct-send handling and offline report ZIPs. Prepared a hosted email service; live sending requires service activation.
- Reworked HTML reports with all selected ICR coder pairs, saved comparison statistics/settings, calculation help, selected draft graph figures and optional visualization notes. Added contents navigation, collapsible/searchable tables, collapsible code summaries, research records grouped by type, and print expansion.
- Added a Starred Quotes download beside the half-width Starred Images button, with manuscript attribution or full document/code/case details in Word.
- Added ICR comparison units and methods, compact summary cards, expandable/searchable/paginated tables and calculation guidance linked from ICR to Help. Manuscript statistics preview/copy is available only in export options.
- Simplified manuscript content with case-based italic quote attribution, optional framework/co-occurrence memos and separate case attribute fields. Added draggable visualization notes with independent draft snapshots and Memo-Book access.

- Clarified that scanned-PDF OCR uses Bengali/English only, and that media encoding, retained sources, PDF page images and repeated full JSON backups require storage beyond the app installation allowance.

- Reorganized visualization tools into a consistent common set, with Shapes inside Draw, a fully labelled Text button, one Legend control and graph-specific code-node controls.
- Added Heat map Inspector controls to hide all-zero rows/columns and swap axes while retaining heading edits, added objects, palette and source links. Added optional zero-assignment code filtering to Histomap without removing periods or gaps.

Full details in CHANGELOG.md. All demo content is fictional training data.


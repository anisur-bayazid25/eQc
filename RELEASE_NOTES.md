# eQc 1.8.4

This release adds co-occurrence visualizations, editable image-coding boundaries, improved QDPX exchange and Linux downloads.

- **Co-occurrence network:** connected-group, circle, projected-sphere, spatial 3D force and chord layouts. Choose shaded balls, flat circles or text-only labels independently of layout. Spatial settings include horizontal/vertical viewing angles. Counts, weighted links, filters and source evidence help interpret the network.
- **Matching heat maps and Sankey:** new co-occurrence presets share the network's direct-text-code calculation. Choose overlapping coding-range pairs or shared documents, with explicit coder and scope settings. Captions explain deduplication, matrix symmetry, chord totals and association-only Sankey ribbons.
- **Visualization usability:** Code map, Network, Sankey and Word cloud form the first gallery row. Toolbars keep arrows, icons and labels aligned when scrolling. Saved drafts work with figure export and offline HTML reports.
- **Resize existing image coding:** click a region, choose Resize, drag an edge/corner and save. Cancel/Escape discards the preview. Undo/Redo works; the code, coder, star and memo stay attached.
- **QualCoder exchange fixes:** exported QDPX notes now include creation dates, author references and unique titles. Verified against the REFI-QDA schema and QualCoder's note importer; this does not guarantee complete cross-application feature equivalence.
- **Linux x64:** AppImage and Debian/Ubuntu `.deb` downloads join the Windows installer and Intel/Apple Silicon macOS packages. Linux packages are built on Ubuntu 22.04; broader desktop compatibility testing is still needed. Linux updates use manual downloads.
- **Help and citation:** updated offline guidance, calculation explanations, platform notes and citation metadata for v1.8.4.

Co-occurrence figures currently use text coding, not image regions. Layout positions, 3D depth and decorative shading are not additional measured variables. Regenerate saved figures after changing coding or source text.

Existing project JSON backups remain supported. Make a project backup before upgrading. All demonstration content is fictional.

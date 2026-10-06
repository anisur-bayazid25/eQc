# eQc documentation — v1.6.4

The complete manual is [USER_GUIDE_v1.6.4.md](USER_GUIDE_v1.6.4.md). Historical guides remain available for earlier releases. Release history is in [CHANGELOG.md](CHANGELOG.md), and implementation details are in [AI_CHANGELOG.md](AI_CHANGELOG.md).

### Merging codes

In **Codebook → Export Options**, check the codes in **Select codes**, choose **Code to keep after merge**, then click **Merge selected codes** and confirm. For example, select three sibling codes and keep one to reduce ten child codes to eight. Rename the retained code in Code Details if needed. The retained code keeps its identity, color and position. Its definitions and summaries incorporate the other codes’ text with origin labels. Descendant codes move under the retained code; their own coding stays on those descendants. Text and image coding keeps coder attribution, notes and stars. Framework cells and relationship memos combine; map references follow the retained code, while internal self-links disappear and their relationship memos move into the retained summary. Coding records are preserved individually, including overlapping records, to retain coder history and notes. Use **Ctrl+Z** to undo the merge. An ancestor cannot merge into its descendant; keep the ancestor instead.

### Exporting one or several codes

Check one or multiple codes in **Select codes**, or click **Use current code**. Enable **Export selected codes only**, optionally enable **Include their subcodes**, choose the existing scope, then click **CSV** or **DOCX**. Leave the selection toggle off for the whole codebook. The selection also applies to Starred Excerpts and Starred Images; REFI-QDA, Notes & Memos, and Manuscript Skeleton continue to use the whole project.

Every CSV/DOCX scope includes **Document** names (image names for image coding). Codes-only output lists associated source names and definitions/memos in a table. Excerpt modes include both text quotes and image regions, coder identities and excerpt memos. Image coordinates are normalized from 0 to 1; DOCX also embeds the cropped image. CSV records the source, coordinates and memo rather than binary image content. Summary mode adds code summaries and definitions. Uncoded codes remain in the output with blank source/excerpt cells. **Codes + excerpts + summaries** supplies source attribution, so the former separate document-inclusive mode is removed. Existing option titles stay the same.

### Reliability and consensus (v1.6.0–1.6.4)

**Analysis → Inter-Coder Reliability** compares attributed coders. Select coders, documents and whether to include images; choose two distinct coders for percent agreement, Cohen’s κ and Holsti’s index. Occurrence metrics use one source × code item; multiple quotes with the same code in that source count as one positive occurrence. Fleiss’ κ is available with three or more coders. Krippendorff’s c-Alpha-binary uses present/absent ratings and Cu-Alpha uses overlapping text passages with uncoded ratings included. κ and α are chance-corrected; Holsti is an uncorrected ratio. Undefined coefficients appear as **—**. Unattributed records are excluded and disclosed; assign them a coder in Project Settings if appropriate.

**Analysis → Consensus** reviews overlapping text passages coded by at least two selected coders. Agreement requires the coders who actually coded the passage to assign the same single code. A third coder who did not touch the passage does not turn agreement into disagreement; single-coder passages are counted separately and excluded from review. Filter agreements/disagreements, keep a coder’s coding, delete all coding on a passage, or remove individual segments. Use Ctrl+Z to undo adjudication. Consensus reviews text; the images toggle affects source-occurrence ICR.

The **HTML Report** includes every dashboard analysis, the currently selected ICR scope and pair, all available coefficients and per-code results, the complete consensus summary and coder assignments, and cropped image coding. Consensus exports both statuses regardless of its current filter and describes the current state, not an adjudication audit history. Word frequencies and KWIC use the last generated list/search; sections explicitly state when those have not been run. A KWIC search with no matches is reported as zero matches.

Codes also have a separate **Definition** field for coding rules. CSV import, project merge, REFI-QDA round-trips and reports retain definitions. Merging another coder’s project also preserves images, regions, framework cells, relationship memos and map edge styles; conflicting analysis text is retained. Deleting a code removes its dependent matrix cells, relationship notes and hidden-map entries. v1.6.2–1.6.3 corrected these data-integrity and consensus behaviors.

### Acknowledgments

eQc gratefully acknowledges the contributions of the CARE project and BRAC James P Grant School of Public Health, BRAC University, to its development.

## Implementation and validation

Projects are persisted as JSON in SQLite through the Electron bridge. `src/lib/mergeCodes.ts` consolidates code IDs atomically through the existing persist/undo flow. `src/lib/exportBuilders.ts` builds source-aware tables with optional selected IDs and image row references; the renderer crops regions and the Electron DOCX builder embeds them. `src/lib/report.ts` reuses the existing pure ICR calculations and overlap units rather than separate statistical formulas. The report receives the active analysis scope and last generated word/KWIC outputs.

Run `npm run check`, `npm run build`, and `node --test tests/release-1.6.4.cjs`. The regression tests cover merges, hierarchy protection, selection, CSV escaping, image coding, ICR/consensus report content and DOCX media embedding (including image-only manuscript entries). GitHub Actions builds Windows and macOS installers and publishes the version tag with `RELEASE_NOTES.md`.

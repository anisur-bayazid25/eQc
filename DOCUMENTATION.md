## Table of Contents

- [Workspace and research tools](#workspace-and-research-tools)
- [Project import and export](#project-import-and-export)
- [Document views and formats](#document-views-and-formats)
- [Codebook and reports](#codebook-and-reports)
- [ICR and Consensus](#icr-and-consensus)
- [Help and navigation](#help-and-navigation)
- [About and acknowledgments](#about-and-acknowledgments)
- [Profile and time tracking](#profile-and-time-tracking)

## Workspace and research tools

Open **Workspace → Research tools** in the Sources panel. One workspace has five sections—Cases, Groups, Review, Memos/Notes and History—so document coding and existing navigation stay compact.

1. **Cases and attributes:** create people, organisations, places or other cases. Enter attributes as one Name=Value per line. Link whole documents/images, or select a participant's passage and choose **Selection actions → Link to case**. One case can span several sources; an FGD can contain several passage-linked participants. Whole-source links associate all coding with that case; use passage links to distinguish speakers. Import CSV with Case, optional Document (exact source names separated by semicolons), and other columns as attributes.
2. **Document and code groups:** create reusable, overlapping sets independently of folders and code hierarchy. Source groups include documents and images. Use groups in Review queries.
3. **Saved queries:** select codes, groups, sources, cases, attributes, coder, excerpt/memo text and key-excerpt status. OR retrieves any selected code. AND requires every selected code somewhere in the scoped source. WITHOUT excludes scoped sources containing B codes. Overlap requires intersecting text ranges/image rectangles. Nearby compares gaps in coding-text characters, for text only. Scope applies before combinations. Save named definitions and rerun against current data. With child codes included, child coding satisfies its selected parent branch; siblings are not all required. Empty code/source selections mean all; explicitly selected empty/deleted groups retrieve none.
4. **Excerpt review:** retrieve text/image coding, show surrounding text, open sources, select results and export CSV or table-free Word reports. With nothing checked, export all results; checked entries restrict export. Compare cases shows coding-entry counts by code with attributes. Shared case membership contributes to each case; counts are descriptive, not participant prevalence.
5. **Coding stripes:** **Codes & Strips**, beside Portrait and Lines, adds an optional coloured margin with code names and full-name/coder tooltips. Click to jump to the passage. Stripes follow rendered text in Plain text and mapped Word/PDF views; PDF shows only the displayed page's text coding.
6. **Annotations and notes:** **Selection actions → Add annotation** creates an independent passage note, shown with dotted underlining. **Memos/Notes** searches annotations, existing source/code/excerpt/image/region/framework/relationship memos and standalone analytic, methodological or journal memos. Standalone memos can link documents, codes, cases and excerpts. Attached memos can be edited, copied, selected and exported directly in Memos/Notes or through their original controls.
7. **Refinement:** **Review → Refine selected coding** reassigns coding in bulk or moves selected excerpts from one code into a new sibling code. **Adjust passage** opens Plain text; select a replacement and choose **Selection actions → Update passage**. Coding identity, notes, coder, dates and key status are preserved. Selection actions also creates an in-vivo code from selected words or applies multiple codes together. Existing merge and undo/redo remain available.
8. **Activity and recovery:** **History** lists saved-content changes with actor labels and exports CSV. Create named checkpoints before substantial edits. Restore requires confirmation and first saves current work as a “Before recovery” checkpoint. Automatic points retain the previous saved state at most once per ten minutes of content changes, rotating the latest ten. Named points remain until project deletion; activity lists recent changes. Keep JSON backups in a separate location as well.

**Exports and preservation:** Memos/Notes → Export research records offers CSV, narrative Word and HTML with source/code/case names and locations. Full analysis HTML includes these records. Coding CSV/Word also carries case names/attributes; summary mode includes overlapping annotations and linked memos. JSON backups/LAN retain the collections; code/project merges remap links. Source edits relocate annotation/case ranges; unmatched notes and case quotations become clearly labelled unlinked memos. QDPX retains these research records for re-import into eQc. Local recovery history/checkpoints stay on this computer and do not travel in JSON/QDPX. Continue exporting regular backups.

#### Research examples

- **Cases:** create Participant 01 with `Village=Khalilnagar` and `Age group=Adult`. Link their interview. For a focus group, link their selected speaking turns rather than the whole document, which includes every speaker.
- **Groups:** put women’s focus groups in one source group and Water access, Cost and Safety in a code group. These overlapping sets make recurring Review searches easier without changing folders or code parents.
- **Queries and Review:** choose Water access, run the query and read the excerpts with context. Add `Village=Khalilnagar` as a case-attribute filter to compare accounts from that village. AND finds sources containing every selected code; Overlap finds coding on intersecting passages. Save a named query to repeat after new coding.
- **Memos and annotations:** write Distance and safety as a linked analytic memo; use an annotation to explain a specific sentence. Select related memos to export or consolidate after reading the merge confirmation.
- **Refinement:** if Transport and Walking distance were used inconsistently, retrieve the relevant excerpts and reassign the selected entries. To separate Cost from a broad Access code, split only the relevant checked excerpts into a new code.
- **History:** create a Before merging access codes checkpoint before reorganising. Restore it if needed; this replaces the current project state and first saves a recovery point. Export JSON backups as well, because local History does not travel with the project.

#### Reviewing excerpts

Open **Workspace → Research tools → Review**. Choose **Query codes** and/or **Sources**, optionally enter words in **Find in excerpts or notes**, then click **Run query**. Empty selections retrieve all coding. Read the highlighted excerpt with surrounding text, or choose **Open source**. Export the results to CSV or Word. Check individual cards only when you want to export or refine a subset; without checks, export includes all retrieved results. **Advanced filters and combined queries** contains code combinations, code/document groups, cases, attributes, coder, child codes and key-excerpt filters. Save a named query for repeat use. Changing filters clears old results so they cannot be mistaken for the new query.

#### Memo tools

Use **New memo** to create an analytic, methodological or journal memo. Search existing notes, or use **Copy memo text**, **Export memo Word** and **Export memo CSV** on a memo card. For several memos, select their checkboxes and expand **Export or merge selected memos**.

All nonempty source, code, excerpt, image, region, case, framework and relationship memos appear with selection checkboxes and individual edit/copy/export controls in Memos/Notes. Passage annotations can also be selected for export or consolidation. **Select all memos** includes these attached memos as well as standalone memos. For a merge, choose **New combined memo** and enter its title, or choose a selected standalone memo as the destination. The combined memo retains all text under its original memo titles and combines source/code/case/excerpt links. Confirmation explains that selected attached memo fields will be cleared and selected standalone memos consolidated; the underlying sources, codes, coding and annotations remain. Use Undo after closing Research tools to restore the originals.

#### Refining coding

1. **Reassign existing coding:** in Review, Run query, check the relevant cards, open **Refine selected coding**, choose the destination code and click **Reassign coding**. This moves those coding entries; it does not add a second copy.
2. **Split a code:** retrieve one code, check the excerpts that belong in a separate concept, open **Refine selected coding**, enter **New code name for selected excerpts**, then **Split into new code**. The new code is a sibling of the original; unchecked excerpts stay under the original. Text and image coding are supported, but selected entries must come from one code.
3. **Adjust a text boundary:** choose **Adjust passage** on an excerpt card. In the source's Plain text view, select the replacement words, then **Selection actions → Update passage**. The same coding entry retains its memo, coder, creation date and key-excerpt status. Cancel adjustment to keep the old passage. Image regions are reviewed using their existing image controls.
4. **Create an in-vivo code:** select words in the reader, choose **Selection actions → Create in-vivo code**, review the suggested name, then **Create and apply**.
5. **Apply several codes at once:** select text, open **Selection actions → Apply multiple codes**, check codes and choose **Apply selected codes**.
6. **Merge codes:** open **Codebook → Merge**, select the codes and a survivor, review the merge, then apply it. Related coding and research links follow the survivor. Use a named History checkpoint before substantial reorganisation.

## Project import and export

### Export a project

Open **Project tools → Export**, choose **JSON — eQc backup** or **QDPX — REFI-QDA exchange**, then choose **Original documents and coding text** or **Plain text only — smaller file**. Original attachments are included by default. The smaller option omits retained Word/PDF binary files while keeping coding text, codes, memos, cases, groups, queries, annotations and image coding, including coded PDF page snapshots. It does not change the open project or erase its originals. JSON is the full eQc project backup; QDPX exchanges supported sources and coding, including eQc research records for re-import. Local activity and recovery checkpoints do not travel with either format. Cancel the save dialog to leave the export unfinished.

### Import a project or codebook

**Project tools → Import** accepts **JSON**, **QDPX**, **QDC** and **QDE** in one file dialog and creates a separate project. JSON restores an eQc backup; QDPX transfers a project with its supported sources and coding. QDC transfers the codebook only, without documents or excerpts. QDE is unpacked project XML: keep it beside the matching `sources` folder, or select the original QDPX archive. Referenced files that are missing cannot be recovered from XML alone. An import with unavailable/unsupported sources reports the omissions; if no referenced source can be imported, it stops without creating an incomplete project. **Codebook → Import → REFI-QDA** remains available to add exchanged coding to the current project.

## Document views and formats

Documents with retained originals now offer **Original view** and **Plain text** in Workspace. Original view is the initial preference; your last view choice is remembered. Text-only documents still use Plain text. Attach a missing original through **Original → Attach original** to enable formatted viewing.

- **Word:** view document styles, headings, tables, lists, headers/footers and embedded images. Select body text (including table cells), then click or drag a code from the existing legend/search. Existing and overlapping coding is highlighted; click a highlight to inspect, memo, star or remove its coding. Zoom starts at **Fit width** and follows the available space. Word pagination and advanced layout can differ from Microsoft Word; the retained file remains unchanged.
- **PDF:** view original pages with **Previous/Next**, a page selector, **Fit width** and percentage zoom. **Text** mode selects the PDF text layer and saves excerpts against the existing source text. **Region** mode draws a rectangle on a page, then applies a code. Scans without a text layer support Region coding; their OCR text stays codeable in Plain text. Text selections are made within one displayed PDF page at a time.
- **Reliable locations:** selected text is connected to the matching passage in your coding text, including repeated quotations. A selection with unmatched/altered text is rejected with a Plain text fallback instead of guessing an excerpt position. Generated header/footer/footnote markers are view-only when absent from the coding text. Text edits or a mismatched attachment disable text coding in Original view; original PDF region coding remains available. **Edit text** changes the coding text, not the Word/PDF original. Source line numbers and reading-font controls apply to Plain text; original views use source formatting and zoom.
- **PDF region exports:** the first region coding on a page stores a linked PNG page snapshot, labelled with the document name and PDF page number. Further regions reuse that snapshot regardless of zoom. These regions participate in existing image coding, memos/stars, analysis and all image-capable CSV/DOCX/HTML/QDPX exports. QDPX transfers them as standard PictureSource/PictureSelection entries alongside the original PDF, rather than native PDF-region selections. **Go to Image** opens the retained page snapshot. JSON backups/LAN retain page links; merges remap document IDs and reuse linked pages. Renaming/moving the document updates linked page names/folders; deleting it also removes linked snapshots and regions after confirmation. Original attachments replaced later do not overwrite older coded page snapshots.

Rendering stays local; original documents are not uploaded. Broken/encrypted/unsupported originals show a recoverable message and leave Plain text available. Saving through **Original → Save original** preserves exact source bytes; narrative excerpt reports keep their established table-free export layout.

Imported Word/PDF sources retain their original file. **Workspace → Original** lets you open or save it, or attach an original to an older text-only source. Attaching a file preserves existing coding. If you edit the coding text, the Original menu indicates that it differs from the retained file.

**Lines** shows stable, one-based source-line numbers in the text reader. Blank lines count; screen wrapping, fonts and window size do not change the numbers. Codebook excerpt cards and text-excerpt CSV/DOCX exports include the corresponding line range. Editing the source text can change those ranges. These numbers refer to eQc’s coding text, not Word’s layout-dependent native page lines or inferred PDF text lines. Native numbering, tables, fonts and original page layout stay in the retained file. Formatted Word/PDF coding is available in Original view.

**REFI-QDA export** preserves code hierarchy, memos, coder names and text/image excerpts in a standard exchange file. Other supported image formats convert to PNG. Unreadable images or invalid coding stop export with an explanation. Use **Codebook → Import → REFI-QDA (QDPX / QDC)** to import a full project or standalone codebook; legacy eQc files remain readable.

When the coding text still matches the retained original, QDPX includes the original Word or PDF file alongside the coding text. If the text was edited or an attached file has different extracted text, QDPX exports the current coding text without pairing it with that outdated original; the original remains available locally and in backups. Previously imported text-only documents cannot recover formatting until you attach the original file.

Markdown (.md) imports as plain text, including its markup. Add Image accepts PNG, JPEG, GIF, WebP, BMP and HEIC/HEIF. HEIC/HEIF main still photos are converted locally to PNG for coding and export, retaining the source name. Original HEIC files, metadata and additional frames are not stored; retain originals separately.

## Codebook and reports

### Merging codes

In **Codebook → Merge**, check the codes in **Select codes**, choose **Code to keep after merge**, then click **Merge selected codes** and confirm. For example, select three sibling codes and keep one to reduce ten child codes to eight. Rename the retained code in Code Details if needed. The retained code keeps its identity, color and position. Its definitions and summaries incorporate the other codes’ text with origin labels. Descendant codes move under the retained code; their own coding stays on those descendants. Text and image coding keeps coder attribution, notes and stars. Framework cells and relationship memos combine; map references follow the retained code, while internal self-links disappear and their relationship memos move into the retained summary. Coding records are preserved individually, including overlapping records, to retain coder history and notes. Use **Ctrl+Z** to undo the merge. An ancestor cannot merge into its descendant; keep the ancestor instead.

### Exporting one or several codes

Open **Codebook → Export**, choose **Selected codes**, then check one or multiple codes in **Choose codes**, or click **Use current code**, optionally enable **Include their subcodes**, choose the existing scope, then click **CSV** or **DOCX**. Choose **All codes** for the whole codebook. The selection also applies to Starred Excerpts and Starred Images; REFI-QDA, Notes & Memos, and Manuscript Skeleton continue to use the whole project.

Every CSV/DOCX scope includes **Document** names (image names for image coding). **DOCX uses no tables:** each source heading is followed by the full code path, then numbered excerpts on separate lines. Small muted labels show the excerpt count, coder and key-excerpt status; text keeps its line breaks, and image excerpts include a cropped preview, region position and memo. **Codes + excerpts + summaries** additionally includes code definitions, code summaries, source memos and document–code framework memos. **Codes only** lists source associations, counts, definitions and summaries without excerpt content. Uncoded codes appear in a separate section. Starred Excerpts and Starred Images use the same Word layout. Counts represent coding entries, including overlapping passages and separate coders; coverage percentages are omitted.

**CSV remains tabular**, with source names, hierarchy, quotes or normalized image coordinates, coders and excerpt memos; summary mode adds code definitions/summaries. Uncoded codes have blank source/excerpt cells. CSV exports retain the importer-compatible headers. The redundant document-inclusive mode remains removed, and option titles stay the same.

**Filenames:** a single-code export defaults to `Project name_Code name.docx` (or `.csv`); multiple selected names are joined with ` + `, and All codes uses `Project name_All codes`. Including descendants keeps the explicitly selected parent names in the filename. Starred exports add a descriptive suffix. Bengali and other Unicode names are preserved; invalid filename characters are replaced and long names shortened. Choose another name in the save dialog if needed.

## ICR and Consensus

### ICR — inter-coder reliability

Use **Analysis → ICR** to compare independent coding and identify coding rules that need clarification. First select the same documents, coders and optional images in Scope. Choose two different coders for pairwise results. Export the results before consensus decisions if you need a record of independent agreement.

**Example:** Amina applies Water access to five passages in Interview 1; Ravi applies it to two. In the occurrence table, both marked the same one source–code item. If only Amina applies Cost in that interview, that item is a disagreement. This comparison measures whether a code occurs in a source; it does not measure exact selection boundaries. Cu-Alpha instead compares grouped text passages.

Percent agreement includes source–code pairs neither coder used. A high percentage can therefore coexist with low chance-corrected agreement. Read the coefficient and per-code results alongside your coding definitions and scope; no one threshold establishes research quality. An undefined value appears as **—**.

### Consensus — reviewing coding differences

Use **Analysis → Consensus** after coders have worked independently. Select the coders and documents, then compare overlapping coded passages with their code names and surrounding text. Discuss the coding definitions before retaining one coder’s entries, removing individual entries or leaving the passage unchanged. Create a History checkpoint before substantial adjudication; Ctrl+Z reverses removal.

**Example:** Amina labels “The pump is too far away” as Water access; Ravi labels overlapping words as Transport. The passage appears as one disagreement group. If both use only Water access, it is an agreement. A third coder who never coded this passage is excluded. Passages coded by one person are counted separately and hidden; image regions are outside Consensus review.

Consensus changes the stored coding; it does not save a separate log of your discussion or prove that one interpretation is correct. Record your reasoning in a memo and export ICR before adjudication.

#### Understanding the counts

The team-analysis tab is **ICR** (inter-coder reliability). Its coder selectors show **text coding entries** and **image regions** for the current scope. A passage assigned three codes creates three coding entries. The agreement table uses a different unit: one source–code pair, counted once per coder even when a code appears several times in a source. Percent agreement includes pairs neither coder used; many unused pairs can produce a high percentage alongside low Holsti or κ.

**Consensus** groups overlapping text coding entries into passage groups, including multiple codes on the same words. It shows the total text entries, total passage groups, jointly coded groups available for review and single-coder groups hidden. Image regions are excluded. For example, 62 text entries plus 6 image regions for one coder do not imply 68 consensus passages: the text entries may form 30 overlapping groups, and only a few groups may have a second coder. Open **Counts by coder in the current scope** to compare the underlying entries. Changing coders or documents changes both views' scope. These measures describe different units; their totals are not expected to match.

**Analysis → ICR** compares attributed coders. Select coders, documents and whether to include images; choose two distinct coders for percent agreement, Cohen’s κ and Holsti’s index. Occurrence metrics use one source × code item; multiple quotes with the same code in that source count as one positive occurrence. Fleiss’ κ is available with three or more coders. Krippendorff’s c-Alpha-binary uses present/absent ratings and Cu-Alpha uses overlapping text passages with uncoded ratings included. κ and α are chance-corrected; Holsti is an uncorrected ratio. Undefined coefficients appear as **—**. Unattributed records are excluded and disclosed; assign them a coder in Project Settings if appropriate.

**Analysis → Consensus** reviews overlapping text passages coded by at least two selected coders. Agreement requires the coders who actually coded the passage to assign the same single code. A third coder who did not touch the passage does not turn agreement into disagreement; single-coder passages are counted separately and excluded from review. Filter agreements/disagreements, keep a coder’s coding, delete all coding on a passage, or remove individual segments. Use Ctrl+Z to undo adjudication. Consensus reviews text; the images toggle affects source-occurrence ICR.

The **HTML Report** includes every dashboard analysis, the currently selected ICR scope and pair, coefficients and per-code results, the complete consensus summary and coder assignments, and cropped image coding. Consensus exports both statuses regardless of its current filter and describes the current state, not an adjudication audit history. Word frequencies and KWIC use the last generated list/search; sections explicitly state when those have not been run. A KWIC search with no matches is reported as zero matches.

Codes also have a separate **Definition** field for coding rules. CSV import, project merge, REFI-QDA round-trips and reports retain definitions. Merging another coder’s project also preserves images, regions, framework cells, relationship memos and map edge styles; conflicting analysis text is retained. Deleting a code removes its dependent matrix cells, relationship notes and hidden-map entries.

## Help and navigation

The top navigation is **Workspace → Codebook → Auto-Code → Analysis → Code Map → Help → About**. **Help** works offline: search the complete user guide or application documentation, open a section from its dropdown, or choose **Read complete documentation** to expand all sections. Search matches section titles and content; use a short phrase or keywords. Light/Dark controls remain outside tabs; About remains one wide panel.

For step-by-step instructions, open the [User guide](USER_GUIDE.md).

## About and acknowledgments

About shows the installed version, author, MIT license, contact, release downloads and update checks. eQc gratefully acknowledges the contributions of the CARE project and BRAC James P Grant School of Public Health, BRAC University.

## Profile and time tracking

The **round avatar at the top right** opens Profile: time on the left, **My details** on the right, stacked in narrow windows. Add/select profiles with separate time records and optional name, email, role/designation, organization and picture. A larger centred picture appears at the top of My details; the header avatar remains compact. A picture can be PNG, JPEG or WebP under 2 MB. No account is needed. Delete a profile with confirmation; its local details/time are removed while research projects/coding remain. The last profile is replaced by a blank one.

Profile name, project coder name and LAN host/join name share the most recently edited name. Switching profiles selects the corresponding name for future coding. Past authorship stays unchanged; LAN guests do not overwrite host-owned project metadata.

App time counts foreground use until five idle minutes. Coding sessions start on applied text/image/PDF coding or Auto-Code with new matches, include active reading/related work, and stop on inactivity, leaving the app, project/profile changes, pause or midnight. Apply another code to start after a break. Imports, merges, copies, annotations, undo/redo and incoming LAN changes do not start coding time. Sleep and closed-app time are excluded.

Choose a date and Daily/Weekly/Monthly/Yearly for coding/app totals, project breakdowns and daily first/last actions. Weeks are Sunday–Saturday; days follow local time. Today returns to the current day. Old records remain. Pause/resume tracking and export the selected period to CSV. Coding time is included in app time; summaries refresh every five seconds.

JSON project exports include the selected profile’s details, photo, complete time sessions and last-worked timestamp. Imports match the saved profile identity, merge matching sessions without duplication, retain later/local and independent-computer work, and add/select unfamiliar profiles. Older JSON files without profiles still work. QDPX/LAN exchange research data without the personal profile. No historical time is reconstructed.

### Preferred reading fonts

**Reading → Add font…** adds an installed font by name to **My fonts**, remembers the list and selected font locally, and provides **Remove font**. Install new font files with the operating system first. Font controls affect coding text, while Original Word/PDF retain source formatting. Coding stripes are controlled only by **Codes & Strips** beside the Workspace viewer.

Profiles and time records are saved automatically on this computer. Include the selected profile and its time history in a JSON project backup; profiles are not shared in LAN sessions.

Time records save during use and before a normal close. If saving fails, eQc displays an error rather than discarding your history; closing gives you a choice to keep the app open. A sudden power loss can still lose the final unsaved seconds.

In **Reading**, **A−**, the editable size field and **A+** share one row. Type a size in pixels (8–48); valid values apply immediately. Press Enter or leave the field to confirm. The size is remembered on this computer.

Saved queries imported during a project merge pause when some filter links cannot be resolved. Review the remaining selections and choose **Use reviewed filters** before running the query.

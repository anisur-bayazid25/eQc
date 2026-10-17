# Intercoder agreement and manuscript export review

Reviewed on 17 October 2026. This compares documented agreement tools, the previous eQc implementation and the changes in this working copy. A matching coefficient name alone does not establish numerical equivalence: comparison units, uncoded material, code selection, aggregation and missing observations also matter.

## Vendor comparison

| Tool | Documented agreement statistics and comparison units | eQc before this change | Added in this change and remaining limits |
| --- | --- | --- | --- |
| NVivo | Percentage agreement and Cohen’s κ; characters, sentences or paragraphs; file/code results and weighted or unweighted aggregation | Agreement and Cohen’s κ on source × code presence only | Character, sentence and paragraph comparisons; per-code and per-document results, pooled κ and equal-document mean κ. eQc uses stored UTF-16 offsets, Unicode sentence segmentation and non-empty newline-delimited paragraphs. Parsing and aggregation must be matched before comparing values. |
| MAXQDA | Code occurrence, equality of code frequency and segment overlap; percentage agreement, Brennan–Prediger κ for segments and RK κ for code occurrence | Source × code presence, without the other comparison modes or corrections | Presence with joint-absence choice and RK correction; exact frequency equality; segment overlap using intersection divided by outer span, with a configurable threshold and both coders’ segments tested. Brennan–Prediger correction uses active-code categories and a separately labelled binary correction. |
| ATLAS.ti | Percentage agreement, Holsti and Krippendorff’s alpha family, including binary alpha and semantic-domain cu/Cu alpha | Percentage agreement, positive-decision Holsti and nominal binary alpha on source-level items; a dominant-code overlap-unit alpha labelled Cu-alpha | Character-based binary alpha by code/domain and globally; within-domain nominal cu-alpha with mutual-exclusivity validation. The global domain-set calculation is explicitly **Cu-style**, not a validated ATLAS.ti equivalent, and is excluded from manuscript reporting. The older dominant-code calculation is relabelled as text-unit nominal alpha. Full ATLAS.ti numerical parity remains unverified. |
| Dedoose | Fixed expert/trainee excerpt tests; overall/per-code Cohen’s κ for code application and Pearson correlation for code weights/ratings | Project occurrence-based Cohen’s κ, without fixed tests or rating correlation | Fixed Unit/Coder/Code decisions imported from CSV, pooled/per-code κ and per-code paired-rating Pearson r. All test coder pairs are available. This adds the calculations, not Dedoose’s complete interactive training centre. Missing decisions are excluded, not silently changed to “not coded”. |

Official sources: [NVivo coding comparison](https://help-nv.qsrinternational.com/20/mac/Content/queries/coding-comparison-query.htm), [MAXQDA intercoder agreement](https://www.maxqda.com/help/coding/problem-intercoder-agreement-qualitative-research?view=full), [ATLAS.ti methods](https://manuals.atlasti.com/Win/en/manual/ICA/ICAMethodsForTesting.html), [ATLAS.ti coding requirements](https://manuals.atlasti.com/Win/en/manual/ICA/ICARequirementsForCoding.html), [Dedoose testing centre](https://helpdesk.dedoose.com/hc/en-us/articles/12905437600269-Testing-Center-IRR-using-Cohen-s-Kappa).

The exploratory domain-set distance follows the set-distance discussion in [Krippendorff’s ATLAS.ti appendix](https://atlasti.com/home/intercoder-agreement-with-atlas.ti-by-prof.-krippendorff.pdf), with finite-sample coincidence correction. It must not be presented as software-validated Cu-alpha. Likewise, eQc’s source-level binary alpha is not a character-level alpha merely because both are nominal alpha calculations.

## What journal articles report

The articles below illustrate reporting practices; they do not establish a universal cutoff or make ICR compulsory for every qualitative methodology.

| Journal example | What the authors report | Implication for the skeleton |
| --- | --- | --- |
| [Enacting inclusive science, PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0293953) | A Dedoose reliability test using Cohen’s kappa, with a pooled estimate of .96 across ratings, described in the analysis methods | Name the coefficient and aggregation. Do not replace a pooled estimate with an unlabeled average of pairwise coefficients. |
| [Educational interventions to improve pediatric emergency care, PLOS Global Public Health](https://journals.plos.org/globalpublichealth/article?id=10.1371/journal.pgph.0004095) | Codebook testing/refinement until κ = .80; two coders per interview across 20 interviews; Dedoose identified in the analysis methods | Describe the independently reviewed material and codebook process when known. The app cannot infer those procedures from coder labels alone. |
| [Cultural concepts of distress among Albanian young adults living in Switzerland](https://pmc.ncbi.nlm.nih.gov/articles/PMC11104449/) | MAXQDA-2018, Brennan–Prediger kappa, independently coded interviews and discussion of disagreements; reported κ = .9 | State which kappa variant was used. Agreement after discussion should not be represented as an initial independent reliability test. |
| [Psychological safety among critical care staff, BMJ Open](https://bmjopen.bmj.com/content/11/8/e046699) | A second researcher coded 10% of transcripts; percentage agreement and kappa were calculated in NVivo; discrepancies were discussed | Identify the comparison subset and disagreement procedure. “All coders” does not mean every project source was independently reviewed by everyone. |

The new paragraph reports measured units, source/code counts, coefficients, aggregation and exclusions. All attributed coders are the default, with all coder pairs used for pairwise ranges. Undefined values are explicit. Users can change the comparison scope before export. No claim of independence, satisfactory reliability, calibration, or resolved disagreements is invented. Statistics belong before Results, as a Methodology paragraph. The paragraph preview and prose-only copy button are available only in manuscript export options, not in the ICR tab. Zero-count source types are omitted. The ICR workspace uses one method selector, compact summary cards and collapsed tables with search, 20-row pages and complete CSV/Word export; formulas and examples are available through its Help link.

## Manuscript content decisions

- Keep project-wide code summaries and starred evidence; include quote-only codes and deduplicate the same starred source/range/text within a code across coders.
- Remove generated document lists from summaries and remove coder attribution, excerpt memos, document/case memos, annotations and visualization labels/notes. Text deliberately written inside an analytic memo is preserved, not automatically rewritten.
- Framework and co-occurrence memos are optional and selected by default. They can support synthesis but may need author editing; framework headings retain the code without appending document names.
- Analytic project memos are optional. Linked memos appear once under a code, rather than repeating under every linked code. Methodological/journal memos are not automatically inserted into Results.
- Starred text quotations receive a separate italic attribution paragraph. Use linked case name/pseudonym, age, gender, occupation/livelihood and area/country; omit other attributes. The source name is the fallback when no case is linked. For group interviews, passage-specific case links prevent incorrect attribution to a whole document.
- Existing code/excerpt/memo exports retain source names and their audit metadata.

## Visualization notes and collaboration

The previous “Code map notes” category aggregated canvas labels and edge labels, including generated text. Those are now labelled **Visualization labels**. New **Visualization notes** are separate, draggable cards controlled by Notes on each working canvas. They can contain interpretation, questions or team instructions. They are absent from figure SVG/PNG/JPEG exports and the manuscript skeleton.

Named drafts snapshot their own note arrays. Later working-note changes do not edit a saved draft. Draft notes can be edited through Memo-Book; Go to source loads that draft. Switching to another visualization type starts its working notes separately. Regenerating the same type retains its working notes. Save a draft to retain multiple figures of one type.

Native eQc project JSON backups include working notes, named drafts, notes in those drafts and saved ICR comparison settings/test rows. Omitting original imported binaries does not remove these records. REFI-QDA exchange should not be assumed to preserve eQc-specific canvas or comparison settings. Independent-project Merge is not a visualization-draft merge workflow.

LAN broadcasts complete project snapshots, including visualizations and notes, and saves the received project locally. The host orders accepted snapshots; the most recent snapshot wins. Teams can share and take turns editing a figure, but this is not conflict-free simultaneous canvas editing: concurrent changes can overwrite one another. Saved drafts are useful checkpoints, not a replacement for coordination.

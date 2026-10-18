# Research workflow and ICR terminology audit

Reviewed 18 October 2026 against the local eQc source and official product
documentation. This is an implementation proposal, not a claim that eQc produces
identical results or fully exchanges projects with the products reviewed.

## Implementation status

The accepted work has now been implemented locally: standard statistic identifiers and labels; previewed case CSV exchange; reviewed-source records; disagreement navigation and linked resolution memos; saved ICR runs selectable in reports; exact-entry graph scopes; case framework summaries; structured QDPX cases, variables and sets; and research-aware import/merge inventories. Sections below retain the original audit rationale. Validation does not establish numerical equivalence or full compatibility with every external application.

## Main finding

The greatest benefit would come from connecting existing tools through a shared,
explicit analysis scope and improving structured research-data exchange. Adding
more disconnected tables or copying other applications' menu names would not
solve these gaps. Keep standard statistical names, independently of product names.

## ICR terminology and coverage

| Product reviewed | Documented terminology/measures | Local eQc status |
| --- | --- | --- |
| NVivo | Coding comparison query; Percentage agreement; Cohen's kappa coefficient | Percentage agreement and Cohen's kappa exist. Character comparisons are available, separately from source-level code presence. Source-level presence must not be presented as character coverage agreement. |
| ATLAS.ti | Inter-Coder Agreement (ICA); Percent Agreement; Holsti Index; Krippendorff's alpha family, including alpha binary, cu-alpha and Cu-alpha | Percent agreement, positive-decision Holsti, nominal binary alpha and semantic-domain comparisons exist. The global domain-set coefficient is explicitly exploratory and not validated as equivalent to published Cu-alpha. It is excluded from the manuscript paragraph. |
| MAXQDA | Intercoder Agreement; Code occurrence; Code frequency; Segment overlap; Kappa (RK); Brennan–Prediger correction | These comparison modes/corrections exist. Expand RK to Rädiker–Kuckartz in visible labels. Document the chance model, overlap threshold and aggregation. |
| Dedoose | Inter-rater reliability (IRR); pooled and per-code Cohen's Kappa; Pearson's correlation coefficient for weights/ratings | Fixed-excerpt CSV decisions and paired numeric-rating correlations exist. This is not an integrated expert/trainee testing workflow linked to project excerpts. Pearson r must remain labelled correlation, not absolute agreement. |
| QualCoder | Agreement %, Disagree %, A and B %, Not A and Not B %, Agree coded only %, Cohen's Kappa; coding comparison by file | eQc has agreement, contingency counts, per-document comparisons and kappa for text. Some additional percentages could be derived but are not all displayed. Source-level image presence is not pixel-area agreement; text-character comparison must not imply image coverage comparison. |

Recommended visible statistical names:

- **Percentage agreement (%)**; distinguish pairwise observed agreement from
  **Full agreement (%)** across all selected coders.
- **Cohen's kappa (κ)**.
- **Fleiss' kappa (κ)**.
- **Krippendorff's alpha (α), nominal binary**. Specify whether the units are
  sources, UTF-16 text positions, sentences or paragraphs.
- **Holsti index**, qualified as positive decisions only where that is the
  implemented definition.
- **Brennan–Prediger kappa (κ)**, with chance model displayed in details.
- **Rädiker–Kuckartz kappa (RK)** for the implemented occurrence correction.
- **Pearson's correlation coefficient (r)** for paired ratings.
- **Semantic-domain cu-alpha**, keeping its mutual-exclusivity/missing-rating
  rules visible. Reserve an unqualified **Cu-alpha** label for a separately
  validated implementation; use **Exploratory global domain-set alpha** now.

Current labels such as `Nominal alpha binary`, `Nominal α`, `Holsti`,
`Code presence and RK correction` and a generic `Coefficient κ / α / r` column
are less explicit than this proposed naming. Pairwise result rows often identify
the coder pair but not the statistic; exports need a separate statistic field.

Use one shared statistic-label definition for the ICR screen, CSV/Word tables,
HTML report, methodology paragraph and Help. Prefer machine-readable statistic
IDs over detecting the statistic by searching a human-readable label. Current
`icrComparisons.ts` uses label/title substrings when building reporting text,
and `ComparisonRow.kappa` holds kappa, alpha or correlation values. Renaming
these strings without separating their meaning could break reporting.

The ICR screen already uses method names rather than these product brands.
Researcher surnames in statistic names should remain. Software names in this
comparison document are references, not proposed application labels.

## Connections worth adding, in priority order

### 1. Structured project exchange and an import/export inventory

Current `qdpxExport.ts` writes research cases, attributes, groups, annotations,
memos and saved queries as readable standard Notes plus an eQc-specific JSON
archive. `qdpxImport.ts` reconstructs that labelled archive. This preserves
eQc meaning when the appendix survives, but another application may expose
notes rather than reconstructing cases, variables or runnable queries.

Add standard REFI-QDA structures for the objects the specification supports,
with clear mappings for case/source/passage membership. Import those structures
from external projects too. Retain an extension only for semantics without a
portable mapping. Do not promise that saved queries or graph editors are
portable just because a project is valid QDPX.

Before export show an inventory: structured exchange, readable appendix only,
native-backup only, and omitted. After import show counts, unresolved links and
unsupported objects. Validate with real projects in each destination in addition
to XSD and eQc round-trip checks. Not every product accepts the same interchange
formats or implements every part identically.

Native JSON backups and project merging are separate operations: current
`merge.ts`/`researchMerge.ts` remap coding and research references but do not
merge every native project property. In particular, an ICR setup or saved graph
draft should not be assumed to survive an arbitrary merge. Define explicit
import, merge and overwrite policies, with conflict previews.

### 2. Reuse case/group/query scope across tools

Research queries already use cases, attributes, source/code groups, coders and
logical code conditions. Visualization setup independently selects documents
and codes. Add **Use these results in…** for Review → word cloud, network,
Sankey, heat map and scoped export; add case/group/attribute selection to the
shared scope picker.

Carry exact passage/region IDs where a query selects passages. Passing only
document IDs would incorrectly include unrelated passages from the same
interview or FGD. Preview source, case, passage, code and coder counts before
calculation. Preserve text/image distinctions, descendant-code choices and
the counting unit.

### 3. Link ICR disagreements to evidence and consensus

eQc already has ICR, consensus, excerpt navigation and linked memos. ICR tables
currently render values and offer CSV/Word exports; they do not drill into a
row's disagreement evidence. Add **Inspect disagreements** for a coder pair,
code and source, then navigate to the exact passages/regions. Let the researcher
record a linked methodological memo and an explicit resolution.

Keep original independent coder decisions separate from the resolved coding.
Add a reviewed-source assignment/status so an unreviewed source is not silently
interpreted as deliberate non-coding. The existing warning is useful but cannot
establish that a coder reviewed a source.

### 4. Snapshot ICR runs for reproducible exports

Additional comparison settings are saved, and HTML/manuscript exports already
reuse calculation functions. They generally recompute against the current
project, rather than preserving a named historical run. Save a run with its
data revision, coder/source/code IDs, method, units, exclusions, settings and
results. Export a chosen run with a clear stale/current status; do not silently
substitute post-consensus results for a previously assessed independent run.

Keep the methodology-paragraph option in manuscript export, as requested.
This does not require putting it back into the ICR tab.

### 5. Make case CSV genuinely round-trip

Case import currently expects wide `Case, Document, attribute...` rows and adds
new cases; it links document names to whole text documents. Research-record CSV
uses long `Item type, Name, Document, Code, Case, Location, Text / value...` rows.
These are different formats, so the latter is not a case-import template.

Add a dedicated case-table export matching import, stable IDs, an update/add
preview, duplicate handling, unmatched-source warnings, and typed attributes.
Preserve image links and passage links explicitly where applicable. Offer a
separate survey workflow if desired: open responses become sources linked to
the participant's attributes. Do not overload the existing case import with
implicit survey coding.

### 6. Framework summaries with evidence and participant attributes

The framework is presently document × code. Cases can span documents or identify
individual speakers in an FGD. Add an explicit case × code view and optional
attribute columns. Link each summary cell to its supporting passages and linked
memos, then include that provenance in the appropriate analytical export.

Keep the manuscript skeleton selective: retain its existing quote-attribution
rules and optional analytical memos rather than dumping the full research
archive into it. Full analytical exports can include the richer provenance.

## Suggested implementation order

1. Shared statistic IDs/names and consistent labels across UI/exports/Help;
   validate reference examples before claiming numerical equivalence.
2. Dedicated round-trip case CSV and explicit exchange/merge inventories.
3. Disagreement → evidence → consensus/memo navigation, plus reviewed-source
   status and preserved ICR runs.
4. Shared query/case scope for visualizations and exports; then case-based
   framework summaries and standard structured QDPX research objects.

These are separate reviewable changes; do not combine every new connection into
one release-sized refactor. The original audit was read-only; the subsequent accepted implementation changes application behavior as described above.

## Official references

- [NVivo coding comparison](https://help-nv.qsrinternational.com/20/mac/Content/queries/coding-comparison-query.htm)
- [NVivo framework matrices](https://help-nv.qsrinternational.com/20/win/Content/notes/framework-matrices.htm)
- [ATLAS.ti ICA measures](https://manuals.atlasti.com/Win/en/manual/ICA/ICAMethodsForTesting.html)
- [ATLAS.ti QDPX exchange](https://manuals.atlasti.com/Mac/en/manual/Export/ExportQDPXUniversalDataExchange.html)
- [MAXQDA intercoder agreement](https://www.maxqda.com/help/coding/problem-intercoder-agreement-qualitative-research?view=full)
- [MAXQDA summary tables](https://www.maxqda.com/en/support/help/maxqda-12/Documents/summarytables.htm) (older official manual; used as a workflow example)
- [Dedoose testing and reliability](https://helpdesk.dedoose.com/hc/en-us/articles/12905437600269-Testing-Center-IRR-using-Cohen-s-Kappa)
- [Dedoose survey import](https://helpdesk.dedoose.com/hc/en-us/articles/22443557570829-Survey-Importer-Tool-Prepare-and-Upload-Your-Data)
- [QualCoder comparison reports](https://qualcoder.org/doc/en/5.4.-Reports/)

Local evidence: `src/components/ResearchWorkspace.tsx`,
`src/components/IcrWorkspace.tsx`, `src/components/IcrComparisons.tsx`,
`src/components/IcrResultsTable.tsx`, `src/components/VisualizationSetup.tsx`,
`src/lib/icr.ts`, `src/lib/icrComparisons.ts`, `src/lib/icrSummary.ts`,
`src/lib/qdpxExport.ts`, `src/lib/qdpxImport.ts`, `src/lib/researchExport.ts`,
`src/lib/merge.ts`, `src/lib/researchMerge.ts`, and `src/lib/report.ts`.

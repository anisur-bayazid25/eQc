import { VisualizationKind } from '../domain';

// Keep every visualization covered when new families are added.
export const visualizationHelp: Record<VisualizationKind, readonly string[]> = {
  'cooccurrence-network': [
    'Choose overlapping coding-range pairs or shared text documents. Overlap counts each pair of different direct codes on intersecting ranges; touching boundaries do not overlap. Unique passages deduplicate identical code/document/ranges across coders; all coding decisions retain them. Shared documents count each code pair once per document. Image regions are not included.',
    'Connected groups separates disconnected components; Circle spreads nodes around a ring; Projected sphere offers a spherical arrangement. Spatial network calculates force positions in three dimensions and projects them at the horizontal/vertical angles selected in settings. Projected labels are spread to avoid collisions. Shaded balls, flat circles and text-only labels are independent display choices. Node/text sizes reflect coding frequency with extra label space; depth and colours are illustrative, not measured variables or significance.',
    'Chord diagram arranges codes around a circle and allocates ribbon widths by pair count at both endpoints. Each unordered pair appears once. Outer label totals sum all incident pair counts, so their combined total is twice the displayed pair count. These totals are not participants or coding frequencies. Codes with zero displayed links are omitted. Up to 40 connected codes are supported.',
    'Minimum count and link limit control clutter; the caption reports omitted links and isolated codes. Click a line to inspect its count and source evidence in the Inspector. Drag nodes, edit labels, save named drafts and export SVG/PNG/JPEG. Generate again to reflect later coding changes. The co-occurrence heat map and Sankey use the same count calculation.'
  ],
  'code-map': [
    'Code maps show code branches and shared-document links. Node size reflects coding frequency; shared-document links indicate codes used in the same documents, not necessarily the same passages.',
    'Use View to choose visible branches and Re-layout to reset positions. Drag code nodes to rearrange them. Codes adds hidden nodes back; removing a node from the map keeps it in the codebook. Link and Node control connections and appearance.'
  ],
  'mind-map': [
    'Mind maps arrange a study topic with branching codes and subcodes. Branches reflect the code hierarchy, not measured strength or similarity.',
    'Use the settings button to change the topic, selected codes and limits. Drag code nodes to adjust branches; Codes, Link and Node let you add or hide codes, draw connections and change node appearance. Hidden codes remain in the codebook.'
  ],
  hierarchy: [
    'Hierarchies show parent codes and their subcodes as a tree. Branches represent codebook relationships, not coding frequency or statistical similarity.',
    'Use the settings button to choose codes and top-down or left-to-right orientation. Drag nodes to adjust the layout; use Codes, Link and Node for visibility, connections and appearance. Hiding a node keeps it in the codebook.'
  ],
  'word-cloud': [
    'Word clouds summarize word frequency in selected documents or coded text. Word size follows the selected frequency scale unless Uniform size is chosen; word positions do not imply relationships.',
    'Use the settings button for language, minimum occurrences, word limits, shape or image mask, spacing and layout seed. In the Inspector, edit Word exclusions and click Apply Changes to rebuild word positions. Select a word for source links; changing its font size refits the cloud.'
  ],
  sankey: [
    'The Code co-occurrence preset uses the same pair counts as the network and co-occurrence heat map. Choose overlapping coding or shared documents. Each unordered pair is shown once, in codebook order; ribbons show associations rather than direction. Counts appear on ribbons and node labels; percentages describe displayed pair weight, not participants. Click a ribbon for evidence.',
    'Sankey diagrams show weighted ribbons between stages. Ribbon widths share a linear value scale. Project coding summarizes coding assignments, not movement or causation; multi-coded passages contribute to each code.',
    'Use the settings button to choose project coding, a link table or complete paths, and adjust stages, labels, ordering, bar gaps and ribbon colours. Pairwise links alone do not establish complete paths; imbalanced nodes are reported without inventing flows.',
    'Select a node label to set Node label placement and Distance from boundary in the Inspector. Anchored labels follow their bar; Free position allows manual placement. Resize the whole figure to preserve quantitative widths.'
  ],
  'heat-map': [
    'The Codes × codes: co-occurrence preset uses the same pair counts as the network and co-occurrence Sankey. Choose overlapping coding-range pairs or shared documents, with an explicit coder and counting unit. This symmetric matrix has a zero diagonal; the two halves repeat the same relationships, so do not sum both halves. Click a non-zero cell to inspect its evidence.',
    'Heat maps compare codes across documents or shared documents between codes. Read the caption and colour key for the selected counting unit; darker or lighter cells follow the chosen palette and its direction.',
    'Use the settings button to change codes, documents and counting options. In the Inspector, Heat map display can hide all-zero rows or columns and swap rows and columns. These display changes preserve counts and source coding. Select a cell for its source links.'
  ],
  'word-tree': [
    'Word trees show frequent contexts before or after a phrase in the selected sources. Matching is literal and case-insensitive; branch counts describe phrase occurrences, not participants.',
    'Use the settings button to change the phrase, preceding or following context, documents, and full-document or coded-text scope. Select a context for source links. Full-document text can include interview prompts; read the caption for scan limits.'
  ],
  process: [
    'Process maps arrange your stage labels as a sequence, cycle or branching process. Connections express your interpretation; they are not inferred from source coding.',
    'Use the settings button to change stage labels and layout. Drag blocks to rearrange stages; their connectors stay attached. Double-click a stage to edit its label and select a connector to format it.'
  ],
  journey: [
    'Journey maps show ordered stages with researcher-assigned experience ratings from 1 (low) to 5 (high). Stage spacing is ordinal, not elapsed time; ratings are not calculated from coding.',
    'Use the settings button to enter stage labels and one comma-separated rating per stage. Double-click labels to edit presentation text. To change rating values and their plotted positions together, update the settings and generate the diagram again.'
  ],
  pyramid: [
    'Pyramids arrange your labels from the top level to the base to express a hierarchy or priorities. Level widths are part of the layout, not measured quantities.',
    'Use the settings button to change the ordered level labels. Double-click a level to edit its text; select levels to adjust fills and borders or use Arrange to move and resize them together.'
  ],
  venn: [
    'Venn diagrams show two or three researcher-defined conceptual groups and a shared-concepts label. Circle sizes and overlaps are illustrative; they do not calculate set sizes or coding intersections.',
    'Use the settings button to change group labels and the overlap label. Move circles and labels to adjust the illustration; select a circle to change fill, border and opacity in the Inspector.'
  ],
  honeycomb: [
    'Honeycombs arrange related components as hexagons. Adjacency expresses your organization of the concepts, not a calculated relationship or frequency.',
    'Use the settings button to change component labels. Drag hexagons to rearrange them, double-click to edit text, and select components to change their appearance. Arrange can align, group and resize selected components.'
  ],
  ecology: [
    'Ecology maps place a focal issue among surrounding influences or nested system layers. Positions and layers express your interpretation, not measured effects or causal evidence.',
    'Use the settings button to choose surrounding influences or layers and enter their labels. Drag objects to adjust the layout and double-click labels to edit text. Select shapes to change colours and opacity.'
  ],
  histomap: [
    'Histomaps trace coded themes across explicit, ordered event periods. Read the caption for the counting unit and whether band widths show shares or counts. Missing-data gaps are not evidence of zero activity.',
    'Use the settings button to assign documents or passages to periods, choose codes and select the width measure. Hide codes with zero assignments can simplify the display while retaining periods and missing-data gaps. Period order alone does not establish causation.'
  ],
  dendrogram: [
    'Dendrograms cluster documents or codes by coding-presence similarity. Branch heights describe clustering distance, not chronology, significance or causation.',
    'Use the settings button to choose documents or codes and tree orientation. Empty items are excluded when generating. Select leaf labels for original document or code evidence, and interpret clusters alongside those sources.'
  ],
  manual: [
    'Blank canvas lets you build your own visualization with shapes, text and optional code nodes. Placement and connections express your interpretation; no analysis is generated automatically.',
    'Use Draw to add shapes, text boxes and arrows. Codes adds code nodes; Link and Node control their connections and appearance. Hiding a code node keeps it in the codebook. Arrange aligns, groups and resizes your selected objects.'
  ]
};

// Core data model for eQc project.
// The whole project is persisted as one JSON document per row in SQLite
// (table `projects`), matching the "single JSON blob, replace on save"
// approach already used by the desktop app's migration path.

export type ID = string;

export interface Folder {
  id: ID;
  name: string;
  parentId: ID | null;
}

export interface OriginalSource {
  name: string;
  format: 'docx' | 'pdf';
  base64: string;
  textHash: string; // SHA-256 of the coding text when this original was attached
  textChanged?: boolean; // Original remains unchanged when the coding text is edited
}

export interface AnalysisPeriod {id:ID;label:string;order:number;}

export interface SourceDoc {
  periodId?:ID;
  id: ID;
  folderId: ID | null;
  name: string;
  content: string;      // plain text content used for coding/search
  addedAt: number;
  sizeBytes: number;
  notes?: string;        // source-level memo (e.g. from REFI-QDA import)
  original?: OriginalSource; // optional original binary; older text-only projects need no migration
}

export interface MapTextOrientation {rotation?:number;writingMode?:'horizontal-tb'|'vertical-rl'|'vertical-lr';textDirection?:'ltr'|'rtl';}
export interface Code {
  createdAt: number;
  id: ID;
  name: string;
  color: string;
  parentId: ID | null;
  summary: string;       // memo / analytic note text
  definition?: string;   // coding definition: what counts as an instance of this code (codebook rule)
  mapPosition?: { x: number; y: number };  // cached node position for the Code Map view
  mapShape?: 'circle' | 'square' | 'diamond' | 'ellipse';
  mapLabel?: string;
  mapGroupId?:string; mapLayer?:number; mapScale?:number;
  mapAppearance?: { paletteKey?:string; fill: string; stroke: string; width: number; height: number; fontSize: number; fontFamily?:string; textColor?:string; bold?:boolean; italic?:boolean; underline?:boolean } & MapTextOrientation;
  sortIndex?: number;    // explicit sibling order within the same parent (Code Map tree reorder)
}

// Manual styling for a Code Map edge. Derived edges (hierarchy, co-occurrence)
// are rendered from data; an entry here overrides their appearance. Custom
// edges (kind: 'custom') exist only because the user drew them.
export interface MapEdgeStyle {
  id: ID;
  fromCodeId: ID;
  toCodeId: ID;
  kind: 'hierarchy' | 'cooccurrence' | 'custom'; // custom = user-drawn, not derived from data
  lineStyle: 'solid' | 'dashed' | 'dotted';
  curve: 'straight' | 'curved';
  arrow: 'none' | 'end' | 'both';
  paletteKey?:string;
  color?: string;      // overrides the default per-kind color if set
  width?: number;      // overrides the computed line width (1-8) if set
  label?: string;       // optional user-added text on the edge
  labelDx?: number;       // label offset from the edge midpoint, viewBox px (drag-to-move)
  labelDy?: number;       // label offset from the edge midpoint, viewBox px
  labelFontSize?: number; // label size — defaults to 12 if unset
  labelRotation?:number;labelWritingMode?:MapTextOrientation['writingMode'];labelTextDirection?:MapTextOrientation['textDirection'];
  labelColor?: string;    // label color — defaults to '#334155' if unset
  labelFontFamily?:string; labelBold?:boolean; labelItalic?:boolean; labelUnderline?:boolean; labelWidth?:number; labelHeight?:number;
}

// A free-standing diagram mark on the Code Map canvas — deliberately NOT tied
// to any code: annotation layer shapes (rect/circle bounding boxes, arrows,
// text notes) drawn by the user for interpretation notes, labels, callouts.
export interface MapAnnotation extends MapTextOrientation {
  paletteKey?:string;
  groupId?:string; layer?:number;
  id: ID;
  kind: 'rect' | 'circle' | 'arrow' | 'text';
  x: number; y: number;      // top-left or center depending on kind
  width?: number; height?: number; // for rect/circle
  x2?: number; y2?: number;  // for arrow (end point)
  text?: string;             // for text kind, or an optional label on any kind
  color: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
    fontSize?: number;   // text annotations only — defaults to 14 if unset
  bold?: boolean;      // defaults to true if unset
  italic?: boolean;    // defaults to false if unset
  fill?: string;
  shapeType?:string; cornerRadius?:number;
  flow?:{sourceId:string;targetId:string;sourceOffset:number;targetOffset:number;sourceShare:number;targetShare:number;circular?:boolean;lane?:number;value:number;unit:string;sourceLabel:string;targetLabel:string};
  gradientTo?:string; gradientKey?:string; flowNodeLabel?:boolean; flowLabelNodeId?:string; flowLabelPlacement?:'inside'|'outside-left'|'outside-right'|'above'|'below'|'free'; flowLabelDistance?:number; flowLabelOutsideSize?:{width:number;height:number};
  imageData?:string;

  fillOpacity?:number; polygonPoints?:number[];
  strokeWidth?:number;
  networkPoint?:{x:number;y:number;z:number};
  coocPair?:{codeIds:[ID,ID];value:number;unit:'overlap'|'documents';ranges:Array<{docId:ID;start:number;end:number}>};
  legendLabel?:string; sourceDocIds?:ID[]; sourceCodeIds?:ID[];
  fromAnnotationId?:ID; toAnnotationId?:ID; arrowHead?:boolean;
  labelInside?: boolean;
  fontFamily?:string; textColor?:string; underline?:boolean;
}

export type VisualizationKind = 'code-map'|'cooccurrence-network'|'mind-map'|'hierarchy'|'heat-map'|'word-tree'|'process'|'journey'|'pyramid'|'venn'|'honeycomb'|'ecology'|'manual'|'histomap'|'dendrogram'|'sankey'|'word-cloud';
export interface MapDesign {
  paletteId?:string; paletteInverted?:boolean;
  family?:VisualizationKind; generatedAt?:number; description?:string; options?:Record<string,unknown>;
  mode: 'simple' | 'detailed' | 'manual';
  width: number; height: number;
  maxLinks: number;
  hubId?: string;
  rootIds: ID[];
}

export interface MapLegendSettings extends MapTextOrientation {
  title?:string; width?:number; height?:number; columns?:number;
  fontFamily?:string; fontSize?:number; textColor?:string; bold?:boolean; italic?:boolean; underline?:boolean;
  hidden?:string[]; order?:string[]; labels?:Record<string,string>;
  styles?:Record<string,{fontFamily?:string;fontSize?:number;textColor?:string;bold?:boolean;italic?:boolean;underline?:boolean}&MapTextOrientation>;
}
export interface CodeMapView {
  cloudStopDraft?:string;
  width: number; height: number;
  viewMode: 'auto' | 'full' | 'custom';
  expandedRoots: ID[];
  childrenPerRoot: number | 'all';
  showCooc: boolean; minShared: number;
  showLegend: boolean; includeLegendInExport: boolean;
  legendPos: {x:number;y:number};
  exportScale?:number;
  publicationWidthMm?:number;
  legend?:MapLegendSettings;
  zoom?:number; fitToWindow?:boolean;
}
export interface CodeMapDraft {
  notes?: VisualizationNote[];
  id: ID; name: string; updatedAt: number;
  nodes: Array<Pick<Code,'id'|'mapPosition'|'mapShape'|'mapAppearance'|'mapLabel'|'mapGroupId'|'mapLayer'|'mapScale'>>;
  annotations: MapAnnotation[]; edges: MapEdgeStyle[]; hiddenIds: ID[];
  design?: MapDesign; view: CodeMapView;
}

export interface VisualizationNote {id:ID;title:string;text:string;x:number;y:number;updatedAt:number;}

export interface CodedSegment {
  periodId?:ID;
  id: ID;
  docId: ID;
  codeId: ID;
  start: number;         // character offset in doc.content
  end: number;
  text: string;
  createdAt: number;
  source: 'manual' | 'csv-import' | 'auto-code' | 'qdpx-import'| 'docx-comment-import';
  note?: string;          // segment-level memo (e.g. from REFI-QDA import)
  starred?: boolean;      // marked as a "key quote" for manuscript writing
  coder?: string;   // coder identity stamped when this segment was created/imported — never auto-rewritten
}

export interface ImageSource {
  id: ID;
  folderId: ID | null;
  name: string;
  dataUrl: string;        // base64 data URI, e.g. "data:image/jpeg;base64,..."
  addedAt: number;
  sizeBytes: number;
  notes?: string;          // whole-image memo, same idea as SourceDoc.notes
  pdfPage?: { docId: ID; page: number; originalHash: string }; // snapshot used for PDF region coding/export
}

export interface CodedRegion {
  id: ID;
  imageId: ID;
  codeId: ID;
  x: number;               // normalized 0–1, left edge — resolution-independent
  y: number;
  width: number;
  height: number;
  createdAt: number;
  note?: string;
  starred?: boolean;
  coder?: string;          // coder identity stamped when this region was created/imported — never auto-rewritten
}

export interface CodeRelationNote {
  id: ID;
  codeAId: ID;
  codeBId: ID;   // canonical: always the lexicographically smaller id first, so A×B and B×A share one note
  note: string;
  updatedAt: number;
}

export interface FrameworkCell {
  id: ID;
  docId: ID;
  codeId: ID;
  text: string;
  updatedAt: number;
}

export interface ResearchCase {
  id: ID; name: string; kind: 'person' | 'organisation' | 'place' | 'other';
  attributes: Record<string, string>;
  links: Array<{ docId: ID; start?: number; end?: number }>;
  notes?: string;
}
export interface ResearchGroup { id: ID; name: string; kind: 'documents' | 'codes'; memberIds: ID[] }
export interface PassageAnnotation { id: ID; docId: ID; start: number; end: number; text: string; note: string; createdAt: number; author?: string }
export interface ResearchMemo {
  id: ID; title: string; text: string; kind: 'analytic' | 'methodological' | 'journal';
  docIds: ID[]; codeIds: ID[]; caseIds: ID[]; segmentIds: ID[]; createdAt: number; updatedAt: number;
}
export interface ResearchQuery {
  id: ID; name: string;
  operator: 'any' | 'all' | 'without' | 'overlap' | 'near';
  codeIds: ID[]; excludeCodeIds: ID[]; codeGroupIds: ID[]; descendants: boolean;
  docIds: ID[]; documentGroupIds: ID[]; caseIds: ID[];
  attribute?: { name: string; operator: 'equals' | 'contains' | 'gt' | 'lt'; value: string };
  coder: string; text: string; distance: number; starredOnly: boolean;
  needsScopeReview?: boolean;
}
export interface ActivityEntry { id: number; at: number; actor: string; summary: string }
export interface ProjectSnapshot { id: number; at: number; label: string; automatic: boolean; sizeBytes: number }

export interface Project {
  icrComparison?: import('./lib/icrComparisons').IcrComparisonSettings;
  analysisPeriods?:AnalysisPeriod[];
  id: ID;
  name: string;
  createdAt: number;
  updatedAt?: number;   // last local/remote edit time — used to detect offline edits before a LAN join
  folders: Folder[];
  docs: SourceDoc[];
  codes: Code[];
  codedSegments: CodedSegment[];
  frameworkCells?: FrameworkCell[];   // case × theme summary matrix (framework analysis)
  relationNotes?: CodeRelationNote[]; // analytic memos on code-pair relationships (co-occurrence)
  images?: ImageSource[];
  codedRegions?: CodedRegion[];
  mapEdgeStyles?: MapEdgeStyle[]; // manual styling overrides / custom edges for the Code Map
  mapAnnotations?: MapAnnotation[]; // free-standing annotation shapes on the Code Map (not tied to codes)
  hiddenMapCodeIds?: ID[];  // codes deliberately removed from the Code Map canvas (still in the codebook)
  customMapPalettes?: Array<{id:string;name:string;note:string;colors:string[];scale:string;ramp?:string[]}>;
  mapDesign?: MapDesign;
  mapView?: CodeMapView;
  mapDrafts?: CodeMapDraft[];
  visualizationNotes?: VisualizationNote[];
  coderName?: string;   // this project's coder identity, stamped onto segments when merged into another project
  cases?: ResearchCase[];
  groups?: ResearchGroup[];
  annotations?: PassageAnnotation[];
  memos?: ResearchMemo[];
  queries?: ResearchQuery[];
}

export interface ProjectSummary {
  id: ID;
  name: string;
  createdAt: number;
}

export function uid(prefix = 'id'): ID {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

// Stable display label for segments/regions that have no coder stamp yet
// (e.g. data coded before attribution existed, or imported without one).
// This is a structural value, so the Workspace/Codebook coder filter treats
// "Unattributed" as a real group instead of hiding untagged items.
export const UNATTRIBUTED_CODER = 'Unattributed';
/** Compare legacy attribution consistently without rewriting stored stamps. */
export function normalizeCoderName(raw: string | undefined): string {
  return (raw || '').trim() || UNATTRIBUTED_CODER;
}

export function newProject(name: string): Project {
  return {
    id: uid('proj'),
    name,
    createdAt: Date.now(),
    folders: [],
    docs: [],
    codes: [],
    codedSegments: [],
    frameworkCells: [],
    relationNotes: [],
    mapEdgeStyles: []
  };
}

export const CODE_COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80',
  '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa',
  '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6'
];

export function randomColor(seedIndex: number): string {
  return CODE_COLORS[seedIndex % CODE_COLORS.length];
}

export function colorForNewCode(codes: Code[], parentId: ID | null, seedIndex: number): string {
  if (parentId) {
    const parent = codes.find(c => c.id === parentId);
    if (parent && parent.color) return parent.color;
  }
  return randomColor(seedIndex);
}

// Returns all descendant code ids (including the code itself)
export function descendantCodeIds(codes: Code[], rootId: ID): Set<ID> {
  const result = new Set<ID>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of codes) {
      if (c.parentId && result.has(c.parentId) && !result.has(c.id)) {
        result.add(c.id);
        added = true;
      }
    }
  }
  return result;
}

export function childCodes(codes: Code[], parentId: ID | null): Code[] {
  const kids = codes.filter(c => c.parentId === parentId);
  const hasSortIndex = kids.some(c => typeof c.sortIndex === 'number');
  if (!hasSortIndex) return kids; // legacy projects: keep insertion order
  return [...kids].sort((a, b) => (a.sortIndex ?? Infinity) - (b.sortIndex ?? Infinity));
}

// Names of every ancestor of `code`, root-first, not including `code` itself.
// Used to show a breadcrumb (e.g. "Infrastructure › Drainage") in search results.
export function codeAncestorPath(codes: Code[], code: Code): string[] {
  const path: string[] = [];
  let current = code;
  const byId = new Map(codes.map(c => [c.id, c]));
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    path.unshift(parent.name);
    current = parent;
  }
  return path;
}

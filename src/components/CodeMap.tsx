import {useMapLineEditing,LinePoints} from './useMapLineEditing';
import VisualizationNotes from './VisualizationNotes';
import CloudStopWords from './CloudStopWords';
import HeatmapDisplay from './HeatmapDisplay';
import {flowGeometry,flowLabelGeometry} from '../lib/sankey';
import DrawingShapes from './DrawingShapes';
import {drawingShapes,drawingAnnotation} from '../lib/mapShapes';
import MapPaletteGallery from './MapPaletteGallery';
import {useMapSelection} from './MapSelection';
import {MapObject,ObjectCommand} from '../lib/mapObjects';
import {mapPalettes,MapPalette,reversedPalette} from '../lib/mapPalettes';
import VisualizationSetup,{VisualizationIcon} from './VisualizationSetup';
import {visualizationTypes,VisualizationOptions} from '../lib/visualizations';
import CooccurrenceEvidence from './CooccurrenceEvidence';
import {visualizationHelp} from '../lib/visualizationHelp';
import MapLegend from './MapLegend';
import { fitMapText } from '../lib/mapTextFit';
import MapTextEditor from './MapTextEditor';
import MapColorPicker from './MapColorPicker';
import { useMapZoom } from '../lib/mapZoom';
import MapSuggestions, { MapLabel } from './MapSuggestions';
import { ellipseEndpoint, mapSharedDocuments, mapLabelLines, suggestedMapPairs, MapSuggestion } from '../lib/mapSuggestions';
import ToolMenu from './ToolMenu';
import React, { useEffect, useMemo, useRef, useState, useId } from 'react';
import { VisualizationNote, AnalysisPeriod, Code, SourceDoc, VisualizationKind, CodedSegment, ID, MapAnnotation, MapDesign, CodeMapDraft, CodeMapView, MapLegendSettings, MapEdgeStyle, childCodes, descendantCodeIds, uid } from '../domain';

interface Props {
  onResearchRequestHandled?:()=>void;
  researchProject?:import('../domain').Project;
  researchRequest?:{scope:import('../lib/researchScope').ResearchScopeSelection;family:VisualizationKind;nonce:number}|null;
  active?: boolean;
  visualizationNotes?:VisualizationNote[];
  onVisualizationNotes?:(notes:VisualizationNote[])=>void;
  noteTarget?:{id:string;nonce:number}|null;
  projectId: ID;
  projectName?: string;
  mapView?: CodeMapView;
  drafts?: CodeMapDraft[];
  onObjectCommand?: (keys:string[],command:ObjectCommand) => void;
  customMapPalettes?:MapPalette[];
  onSavePalette?:(palette:MapPalette)=>void;
  onApplyPalette?: (palette:MapPalette,invert?:boolean) => void;
  onRememberView?: (view:CodeMapView) => void;
  onSaveDraft?: (name:string,view:CodeMapView) => void;
  onRestoreDraft?: (id:string) => void;
  onDeleteDraft?: (id:string) => void;
  onLibrary?: () => void;
  onConfigure?:()=>void;
  mapDesign?: MapDesign;
  onResizeCanvas?: (width:number,height:number,updates:Array<{id:ID;patch:Partial<Code>}>) => void;
  onApplySuggestion?: (suggestion: MapSuggestion) => void;
  onOpenCode?: (id: string) => void;
  onOpenCodeMemo?: (id: string) => void;
  docs?:SourceDoc[];
  analysisPeriods?:AnalysisPeriod[];
  onOpenDocument?:(id:string)=>void;
  codes: Code[];
  codedSegments: CodedSegment[];
  mapEdgeStyles: MapEdgeStyle[];
  annotations: MapAnnotation[];
  hiddenMapCodeIds: ID[];
  onUpdateCode: (codeId: ID, patch: Partial<Code>) => void;
  onUpdateCodesBatch: (updates: Array<{ id: ID; patch: Partial<Code> }>) => void;
  onUpdateEdgeStyle: (edgeId: ID, patch: Partial<MapEdgeStyle>) => void;
  onAddEdgeStyle: (style: MapEdgeStyle) => void;
  onDeleteEdgeStyle: (edgeId: ID) => void;
  onUpdateAnnotations: (next: MapAnnotation[]) => void;
  onUpdateHiddenMapCodes: (next: ID[]) => void;
  onShowToast?: (msg: string, durationMs?: number) => void;
}

const SPACING_X = 240;
const SPACING_Y = 160;
const TOP_PAD = 90;
const MIN_R = 18;
const MAX_R = 40;
const MAX_LABEL = 26;

// Codebooks at or below this size are always fully rendered in Auto view;
// larger ones fold to roots with expandable + badges.
const LARGE_CODEBOOK_THRESHOLD = 20;
// Co-occurrence edge weight scale: continuous line width between these
// extremes, mapped over the max shared-document count in the project.
const MIN_EDGE_W = 1;
const MAX_EDGE_W = 8;

// Logical canvas sizes (CSS px). A graph's canvas matters: these define the
// fixed pixel dimensions of the SVG; zoom only scales it visually.
const CANVAS_PRESETS = [
  { label: 'Map (1600×1000)', w: 1600, h: 1000 },
  { label: 'A5 (559×794)', w: 559, h: 794 },
  { label: 'A4 (794×1123)', w: 794, h: 1123 },
  { label: 'Letter (816×1056)', w: 816, h: 1056 },
  { label: 'Legal (816×1344)', w: 816, h: 1344 }
];

const CANVAS_MIN = 200;
const CANVAS_MAX = 50000;

const DEFAULT_COLORS: Record<MapEdgeStyle['kind'], string> = {
  hierarchy: '#cbd5e1',
  cooccurrence: '#a78bfa',
  custom: '#64748b'
};

const SHAPES: Code['mapShape'][] = ['circle', 'square', 'diamond', 'ellipse'];

type EdgeRef = {
  key: string;
  kind: MapEdgeStyle['kind'];
  fromId: ID;
  toId: ID;
  style?: MapEdgeStyle;
};

function computeAutoLayout(codes: Code[], viewW: number, viewH: number): Map<ID, { x: number; y: number }> {
  const layout = new Map<ID, { x: number; y: number }>();
  let cursor = 0;
  function walk(parentId: ID | null, depth: number): number {
    const kids = childCodes(codes, parentId);
    if (kids.length === 0) {
      const x = cursor * SPACING_X + SPACING_X / 2;
      if (parentId) layout.set(parentId, { x, y: TOP_PAD + depth * SPACING_Y });
      cursor++;
      return x;
    }
    const xs = kids.map(k => walk(k.id, depth + 1));
    const x = xs.reduce((a, b) => a + b, 0) / xs.length;
    if (parentId) layout.set(parentId, { x, y: TOP_PAD + depth * SPACING_Y });
    return x;
  }
  walk(null, 0);
  // Fit the tree into the active canvas bounds (40px padding) so generated
  // positions can never land off-paper, even on small canvases.
  const points = Array.from(layout.values());
  if (points.length > 0) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spreadX = maxX - minX;
    const spreadY = maxY - minY;
    const PAD = 40;
    for (const [id, p] of layout) {
      layout.set(id, {
        x: spreadX === 0 ? Math.round(viewW / 2) : Math.round(PAD + ((p.x - minX) / spreadX) * (viewW - 2 * PAD)),
        y: spreadY === 0 ? Math.round(viewH / 2) : Math.round(PAD + ((p.y - minY) / spreadY) * (viewH - 2 * PAD))
      });
    }
  }
  // A few dozen iterations of cheap force relaxation over the freshly
  // computed tree positions: removes mechanical row-spread overlaps in wide
  // sibling groups and compacts the graph so it reads less like a printout.
  relaxLayout(layout, codes, viewW, viewH, 90);
  return layout;
}

// Minimal force-directed pass over an already-laid-out map. Pure heuristic,
// no simulation library: repulsion between any pair closer than SEPARATION,
// springs along hierarchy edges toward a rest length, and a gentle pull
// toward the canvas center. Every step is clamped inside the paper bounds.
// Runs only during initial auto-layout of unplaced codes (and the explicit
// "Re-layout" button) — never on user-dragged positions.
function relaxLayout(layout: Map<ID, { x: number; y: number }>, codes: Code[], viewW: number, viewH: number, iterations: number) {
  const ids = Array.from(layout.keys());
  if (ids.length < 2) return;
  const PAD = 40;
  const SEPARATION = MIN_R * 2 + 44;
  const SPRING_LEN = SPACING_Y;
  const springEdges: Array<[ID, ID]> = [];
  for (const c of codes) {
    if (c.parentId && layout.has(c.parentId) && layout.has(c.id)) springEdges.push([c.parentId, c.id]);
  }
  const cx = viewW / 2;
  const cy = viewH / 2;
  for (let iter = 0; iter < iterations; iter++) {
    const fx = new Map<ID, number>();
    const fy = new Map<ID, number>();
    for (const id of ids) { fx.set(id, 0); fy.set(id, 0); }
    for (let i = 0; i < ids.length; i++) {
      const a = layout.get(ids[i])!;
      for (let j = i + 1; j < ids.length; j++) {
        const b = layout.get(ids[j])!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        if (dist >= SEPARATION) continue;
        const mag = ((SEPARATION - dist) / SEPARATION) * 6;
        const ux = dx / dist;
        const uy = dy / dist;
        fx.set(ids[i], fx.get(ids[i])! - ux * mag);
        fy.set(ids[i], fy.get(ids[i])! - uy * mag);
        fx.set(ids[j], fx.get(ids[j])! + ux * mag);
        fy.set(ids[j], fy.get(ids[j])! + uy * mag);
      }
    }
    for (const [aid, bid] of springEdges) {
      const a = layout.get(aid)!;
      const b = layout.get(bid)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const diff = dist - SPRING_LEN;
      const mag = diff * 0.06;
      const ux = dx / dist;
      const uy = dy / dist;
      fx.set(aid, fx.get(aid)! + ux * mag);
      fy.set(aid, fy.get(aid)! + uy * mag);
      fx.set(bid, fx.get(bid)! - ux * mag);
      fy.set(bid, fy.get(bid)! - uy * mag);
    }
    for (const id of ids) {
      const p = layout.get(id)!;
      fx.set(id, fx.get(id)! + (cx - p.x) * 0.004);
      fy.set(id, fy.get(id)! + (cy - p.y) * 0.004);
      p.x = Math.max(PAD, Math.min(viewW - PAD, p.x + fx.get(id)!));
      p.y = Math.max(PAD, Math.min(viewH - PAD, p.y + fy.get(id)!));
    }
  }
}

function CodeMap({
  active = true,
  visualizationNotes=[],onVisualizationNotes,noteTarget,
  researchProject, projectId, projectName, mapView, drafts, customMapPalettes=[], onSavePalette, onObjectCommand, onApplyPalette, onRememberView, onSaveDraft, onRestoreDraft, onDeleteDraft, onLibrary, onConfigure, mapDesign, onApplySuggestion, onResizeCanvas, onOpenDocument, docs=[], onOpenCode, onOpenCodeMemo, codes, codedSegments, mapEdgeStyles, annotations:sourceAnnotations, hiddenMapCodeIds,
  onUpdateCode, onUpdateCodesBatch, onUpdateEdgeStyle, onAddEdgeStyle, onDeleteEdgeStyle,
  onUpdateAnnotations, onUpdateHiddenMapCodes,
  onShowToast
}: Props) {
  const ballPrefix='network-ball-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const [showNotes,setShowNotes]=useState(!!noteTarget);
  useEffect(()=>{if(noteTarget)setShowNotes(true);},[noteTarget]);
  const isCodeMap=!mapDesign?.family||mapDesign.family==='code-map';
  const hasCodeTools=isCodeMap||['mind-map','hierarchy','manual'].includes(mapDesign?.family||'');
  const annotations=useMemo(()=>sourceAnnotations.map(a=>a.flow&&!a.flowManual?{...a,...flowGeometry(a.flow,sourceAnnotations,Number(mapDesign?.options?.sankeyCurvature)||.5)}:a.flowNodeLabel?{...a,...flowLabelGeometry(a,sourceAnnotations)}:a),[sourceAnnotations,mapDesign?.options?.sankeyCurvature]);
  const basePalette=[...mapPalettes,...customMapPalettes].find(p=>p.id===mapDesign?.paletteId);
  const palette=basePalette?reversedPalette(basePalette,!!mapDesign?.paletteInverted):undefined;
  const mapColors=palette?{hierarchy:palette.colors[0],cooccurrence:palette.colors[1],custom:palette.colors[2]}:DEFAULT_COLORS;
  const [textEditorOpen,setTextEditorOpen]=useState(true);
  const [draftName,setDraftName] = useState('');
  const [draftMessage,setDraftMessage] = useState('');
  const [designOpen,setDesignOpen] = useState(false);
  const [inspectorOpen,setInspectorOpen]=useState(()=>window.matchMedia('(min-width:701px)').matches);
  useEffect(()=>{const query=window.matchMedia('(min-width:701px)'),hide=()=>{if(!query.matches)setInspectorOpen(false);};query.addEventListener('change',hide);return()=>query.removeEventListener('change',hide);},[]);
  const [findCode,setFindCode] = useState('');
  const [jumpCode,setJumpCode] = useState<string|null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const movedRef = useRef(false);
  const multiKeysRef=useRef<string[]>([]);

  // Codes deliberately removed from the canvas (still in the codebook) are
  // filtered out up front — every downstream map computation sees only the
  // on-canvas set, so hidden codes never influence layout, edges, badges or
  // counts. Re-adding a code just drops it from this set.
  const hiddenIds = useMemo(() => new Set<ID>(hiddenMapCodeIds), [hiddenMapCodeIds]);
  const shownCodes = useMemo(() => codes.filter(c => !hiddenIds.has(c.id)), [codes, hiddenIds]);

  const [positions, setPositions] = useState<Map<ID, { x: number; y: number }>>(() => {
    const map = new Map<ID, { x: number; y: number }>();
    for (const c of shownCodes) if (c.mapPosition) map.set(c.id, c.mapPosition);
    return map;
  });
  const [drag, setDrag] = useState<{ id: ID; startX: number; startY: number; origX: number; origY: number } | null>(null);
  // Co-occurrence edges are noisy by default: they only appear when toggled
  // on, and then only above a minimum shared-document threshold.
  const [showCooc, setShowCooc] = useState(false);
  const [minShared, setMinShared] = useState(2);
  // Large-codebook views: 'auto' folds codebooks over the threshold to root
  // nodes; 'full' shows everything; 'custom' always folds and lets the user
  // expand chosen roots.
  const [viewMode, setViewMode] = useState<'auto' | 'full' | 'custom'>('auto');
  const [expandedRoots, setExpandedRoots] = useState<Set<ID>>(new Set());
  const [childrenPerRoot, setChildrenPerRoot] = useState<number | 'all'>(5);
  // Fresh generated canvases start without an overlay; regeneration and saved views retain the user's choice.
  const [showLegend, setShowLegend] = useState(mapView?.showLegend??!mapDesign?.family);
  // Legend uses canvas coordinates so drafts and exports retain its layout.
  const [legendSettings,setLegendSettings]=useState<MapLegendSettings>({});
  const [selectedLegend,setSelectedLegend]=useState<string|null>(null);
  const [legendEditRequest,setLegendEditRequest]=useState(0);
  const [legendPos, setLegendPos] = useState({ x: 12, y: 12 });

  const [drawMode, setDrawMode] = useState(false);
  const [drawSource, setDrawSource] = useState<ID | null>(null);
  // Free-standing annotation layer (not tied to any code): shape picker
  // mode, the drag currently being drawn (viewBox units), its live preview,
  // the selected shape for the style bar, and the inline text-label prompt.
  const [annotateMode, setAnnotateMode] = useState(false);
  const [annotateShape, setAnnotateShape] = useState('rectangle');
  const [annoDrag, setAnnoDrag] = useState<{ x0: number; y0: number; shape:string } | null>(null);
  const [annoPreview, setAnnoPreview] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
    const [selectedAnnoId, setSelectedAnnoId] = useState<string | null>(null);
  // Drag-to-move for an already-placed annotation (separate from annoDrag,
  // which is only for drawing a brand-new shape).
  const [annoDragMove, setAnnoDragMove] = useState<{ id: string; startX: number; startY: number; orig: MapAnnotation } | null>(null);
  const [annoLiveOffset, setAnnoLiveOffset] = useState<({ id: string } & Partial<MapAnnotation>) | null>(null);
  const liveAnnoPatchRef = useRef<Partial<MapAnnotation> | null>(null);
  const annoMovedRef = useRef(false);
  // Editing an existing text annotation's content reuses the same textPrompt
  // UI used to create one — this tracks which mode we're in.
  // Edge label drag-to-move (offset from the edge midpoint). The in-progress
  // offset is held locally (labelLiveOffset) exactly like annoLiveOffset, so
  // the drag renders smoothly but persists ONCE on mouseup — never a
  // per-mousemove project write.
  const [labelDragMove, setLabelDragMove] = useState<{ key: string; edge: EdgeRef; startX: number; startY: number; origDx: number; origDy: number } | null>(null);
  const [labelLiveOffset, setLabelLiveOffset] = useState<{ key: string; dx: number; dy: number } | null>(null);
  const labelLiveOffsetRef = useRef<{ key: string; dx: number; dy: number } | null>(null);
  // On-canvas code selection (click a leaf node) + the add/remove-from-canvas
  // machinery: hidden ids live in the project (persisted), this local UI just
  // holds the chosen node and the add-codes popover flag.
  const [selectedMapCodeId, setSelectedMapCodeId] = useState<ID | null>(null);
  const [showAddCodes, setShowAddCodes] = useState(false);
  useEffect(()=>{setDrawMode(false);setDrawSource(null);setShowAddCodes(false);setFindCode('');},[mapDesign?.family]);
  // Whether the legend is baked into SVG/PNG/JPEG exports.
  const [includeLegendInExport, setIncludeLegendInExport] = useState(true);
  const [exportScale,setExportScale]=useState(3.125);
  const [publicationWidthMm,setPublicationWidthMm]=useState(180);
  const [printCheck,setPrintCheck]=useState('');
  const [resizeDrag,setResizeDrag]=useState<{kind:'code'|'annotation'|'edge';id:string;handle:string;startX:number;startY:number;box:{x:number;y:number;width:number;height:number}}|null>(null);
  const [resizeLive,setResizeLive]=useState<({kind:'code'|'annotation'|'edge';id:string;x:number;y:number;width:number;height:number})|null>(null);
  const resizeLiveRef=useRef<typeof resizeLive>(null);
  const [inlineEdit,setInlineEdit]=useState<{kind:'code'|'rename'|'annotation'|'edge';id:string;value:string;isNew?:boolean}|null>(null);
  const inlineEditRef=useRef<typeof inlineEdit>(null);
  const annoPreviewRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // A click always follows an annotation mousedown+mouseup, and would
  // otherwise clear the selection the drag just made — this guard skips the
  // clear for exactly that click (reset on every svg mousedown, consumed on
  // the svg click).
  const annoClickGuardRef = useRef(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(mapView?.zoom||1);
  const [fitToWindow, setFitToWindow] = useState(mapView?.fitToWindow!==false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [presetIdx, setPresetIdx] = useState(0);
  const [customMode, setCustomMode] = useState(false);
  const [customW, setCustomW] = useState(1200);
  const [customH, setCustomH] = useState(800);

  useEffect(()=>{if(!mapDesign){setCustomMode(false);setPresetIdx(0);setViewMode('auto');setShowCooc(false);setFitToWindow(true);return;}setCustomMode(true);setCustomW(mapDesign.width);setCustomH(mapDesign.height);setViewMode('full');setShowCooc(mapDesign.mode!=='manual'&&mapDesign.maxLinks>0);setMinShared(1);setFitToWindow(true);setSelectedMapCodeId(null);setSelectedAnnoId(null);setSelectedKey(null);},[mapDesign?.generatedAt,mapDesign?.width,mapDesign?.height,mapDesign?.mode,mapDesign?.maxLinks,mapDesign?.family,mapDesign?.hubId,mapDesign?.rootIds.join(",")]);

  useEffect(()=>{if(!mapView)return;setCustomMode(true);setCustomW(mapView.width);setCustomH(mapView.height);setViewMode(mapView.viewMode);setExpandedRoots(new Set(mapView.expandedRoots));setChildrenPerRoot(mapView.childrenPerRoot);setShowCooc(mapView.showCooc);setMinShared(mapView.minShared);setShowLegend(mapView.showLegend);setIncludeLegendInExport(mapView.includeLegendInExport);setLegendPos(mapView.legendPos);setLegendSettings(mapView.legend||{});setExportScale(mapView.exportScale||3.125);setPublicationWidthMm(mapView.publicationWidthMm||180);setFitToWindow(mapView.fitToWindow!==false);if(mapView.zoom)setZoom(mapView.zoom);},[mapView]);

  const canvas = customMode
    ? { w: Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, customW)), h: Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, customH)) }
    : CANVAS_PRESETS[presetIdx];

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !fitToWindow) return;
    const fit = () => {
      if (viewport.clientWidth <= 40 || viewport.clientHeight <= 40) return;
      const scale = Math.min(1, (viewport.clientWidth - 40) / canvas.w, (viewport.clientHeight - 40) / canvas.h);
      setZoom(Math.max(0.01, Math.floor(scale * 1000) / 1000));
      viewport.scrollTo(0, 0);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    fit();
    return () => observer.disconnect();
  }, [canvas.w, canvas.h, fitToWindow, isFullscreen]);

  function manualZoom(value: number) {
    setFitToWindow(false);
    setZoom(Math.max(0.1, Math.min(4, value)));
  }

  useMapZoom(viewportRef,svgRef,zoom,manualZoom,()=>setFitToWindow(true),active);

  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Save only small view settings on unmount; project records already contain all edits.
  const [cloudStopDraft,setCloudStopDraft]=useState(mapView?.cloudStopDraft??String(mapDesign?.options?.wordStops??''));
  useEffect(()=>{setCloudStopDraft(mapView?.cloudStopDraft??String(mapDesign?.options?.wordStops??''));},[mapDesign?.family,mapDesign?.options?.wordStops,mapView]);
  const rememberedView=useRef<{view:CodeMapView;save?:Props['onRememberView']}>();
  rememberedView.current={save:onRememberView,view:{cloudStopDraft,width:canvas.w,height:canvas.h,viewMode,expandedRoots:Array.from(expandedRoots),childrenPerRoot,showCooc,minShared,showLegend,includeLegendInExport,legendPos,exportScale,publicationWidthMm,legend:legendSettings,zoom,fitToWindow}};
  const editorMounted=useRef(false);
  useEffect(()=>{editorMounted.current=true;return()=>{editorMounted.current=false;queueMicrotask(()=>{if(!editorMounted.current){const snapshot=rememberedView.current;snapshot?.save?.(snapshot.view);}});};},[]);

  const canvasRef = useRef(canvas);
  useEffect(() => { canvasRef.current = canvas; });

  const positionsRef = useRef(positions);
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  // View-folding state (expanded roots, view mode, children/root) is
  // per-project: don't leak it across projects opened in the same session.
  const prevProjectRef = useRef(projectId);
  useEffect(() => {
    if (prevProjectRef.current !== projectId) {
      prevProjectRef.current = projectId;
      setFitToWindow(true);
      setExpandedRoots(new Set());
      setChildrenPerRoot(5);
      setViewMode('auto');
      setSelectedKey(null);
      setSelectedMapCodeId(null);
      setShowAddCodes(false);
      setDrawSource(null);
      setDrawMode(false);
      setSelectedAnnoId(null);
      setDrag(null);
    }
  }, [projectId]);

  // Keep local positions in sync with codes (which are authoritative).
  // Statistics nuance: we skip the code being dragged — its local position is
  // being edited and only commits on mouse-up — and we drop entries for codes
  // that fell out of the list, so stale nodes can't linger after an import
  // swap or code deletion while the list re-renders.
  useEffect(() => {
    setPositions(prev => {
      const next = new Map(prev);
      let changed = false;
      const ids = new Set(shownCodes.map(c => c.id));
      for (const c of shownCodes) {
        if (c.id === drag?.id) continue;
        const loaded = c.mapPosition;
        if (loaded) {
          const local = next.get(c.id);
          if (!local || local.x !== loaded.x || local.y !== loaded.y) {
            next.set(c.id, loaded);
            changed = true;
          }
        }
      }
      for (const id of next.keys()) {
        if (!ids.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [shownCodes, drag]);

  const counts = useMemo(() => {
    const m = new Map<ID, number>();
    for (const seg of codedSegments) m.set(seg.codeId, (m.get(seg.codeId) || 0) + 1);
    return m;
  }, [codedSegments]);
  const maxCount = useMemo(() => {
    let max = 0;
    for (const n of counts.values()) max = Math.max(max, n);
    return max;
  }, [counts]);

  // Rolled-up (whole-subtree) coding counts: a major code's "activity"
  // includes every coded segment anywhere under it, not just its own direct
  // hits. A root with zero direct codings but a busy grandchild must still
  // render as a significant node.
  const rolledUpCounts = useMemo(() => {
    const m = new Map<ID, number>();
    for (const c of shownCodes) {
      const ids = descendantCodeIds(shownCodes, c.id); // includes c.id itself
      let total = 0;
      for (const id of ids) total += counts.get(id) || 0;
      m.set(c.id, total);
    }
    return m;
  }, [codes, counts]);
  const maxRolledCount = useMemo(() => {
    let max = 0;
    for (const n of rolledUpCounts.values()) max = Math.max(max, n);
    return max;
  }, [rolledUpCounts]);

  // Root-level (folded) nodes are sized by their subtree's activity; nodes
  // shown as individuals (expanded view) use their direct coding count.
  const radiusFor = (codeId: ID, useRollup: boolean) => {
    const count = useRollup ? (rolledUpCounts.get(codeId) || 0) : (counts.get(codeId) || 0);
    const max = useRollup ? maxRolledCount : maxCount;
    const scale=codes.find(c=>c.id===codeId)?.mapScale||1;
    if (max === 0) return MIN_R*scale;
    return Math.round(MIN_R + (count / max) * (MAX_R - MIN_R))*scale;
  };

  // Document-level co-occurrence: how many docs each code pair shares.
  const sharedDocs = useMemo(() => {
    if(mapDesign&&mapDesign.mode!=='manual')return mapSharedDocuments(codes,codedSegments,new Set(shownCodes.map(c=>c.id)));
    const byDoc = new Map<ID, ID[]>();
    for (const seg of codedSegments) {
      const list = byDoc.get(seg.docId) || [];
      if (!list.includes(seg.codeId)) list.push(seg.codeId);
      byDoc.set(seg.docId, list);
    }
    const pairCount = new Map<string, number>();
    for (const list of byDoc.values()) {
      if (list.length < 2) continue;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const [a, b] = [list[i], list[j]].sort();
          pairCount.set(`${a}::${b}`, (pairCount.get(`${a}::${b}`) || 0) + 1);
        }
      }
    }
    return pairCount;
  }, [codedSegments, codes, shownCodes, mapDesign]);

  // Largest shared-document count across any pair — drives the continuous
  // co-occurrence edge weight scale.
  const maxShared = useMemo(() => {
    let max = 0;
    for (const n of sharedDocs.values()) max = Math.max(max, n);
    return max;
  }, [sharedDocs]);

  // Co-occurrence weight of each code's whole subtree: the sum of pair
  // weights that touch any node under it. Used to rank which children get
  // rendered when a parent is expanded (intersection-based ranking, rolled
  // up so busy grandchildren keep their ancestors prominent).
  const rolledUpScores = useMemo(() => {
    const m = new Map<ID, number>();
    for (const c of shownCodes) {
      const ids = descendantCodeIds(shownCodes, c.id);
      let total = 0;
      for (const [pairKey, shared] of sharedDocs) {
        const [a, b] = pairKey.split('::');
        if (ids.has(a) || ids.has(b)) total += shared;
      }
      m.set(c.id, total);
    }
    return m;
  }, [shownCodes, sharedDocs]);
  const rolledUpIntersection = (childId: ID) => rolledUpScores.get(childId) || 0;

  // How many pairs currently pass the min-shared filter (shown in the
  // toolbar label next to the co-occurrence checkbox).
  const coocCount = useMemo(() => {
    let n = 0;
    for (const v of sharedDocs.values()) if (v >= minShared) n++;
    return n;
  }, [sharedDocs, minShared]);

  // Folding is active in Custom view, or in Auto view once the codebook
  // grows past the threshold. Full view never folds.
  const foldMode = viewMode === 'custom' || (viewMode === 'auto' && shownCodes.length > LARGE_CODEBOOK_THRESHOLD);

  // Which codes actually get drawn. Folded layouts walk the tree from the
  // roots: truly empty roots (no coding anywhere in the subtree) are hidden,
  // a node's children are only visible while that node is expanded, and only
  // the top `childrenPerRoot` children (ranked by rolled-up intersection
  // weight, tie-broken by rolled-up coding count) are rendered at each
  // level. Grandchildren stay hidden until their own parent is expanded —
  // one level at a time. The children/root limit never applies to the root
  // level itself: all non-empty roots are always shown.
  const visibleCodes = useMemo(() => {
    if (!foldMode) return shownCodes;
    const byParent = new Map<ID | null, Code[]>();
    for (const c of shownCodes) {
      const list = byParent.get(c.parentId) || [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
    const visible = new Set<ID>();
    const walk = (parentId: ID | null) => {
      const kids = (byParent.get(parentId) || [])
        .filter(k => parentId !== null || (rolledUpCounts.get(k.id) || 0) > 0)
        .sort((a, b) => {
          const sa = rolledUpIntersection(a.id);
          const sb = rolledUpIntersection(b.id);
          if (sb !== sa) return sb - sa;
          return (rolledUpCounts.get(b.id) || 0) - (rolledUpCounts.get(a.id) || 0);
        });
      const shown = parentId === null || childrenPerRoot === 'all' ? kids : kids.slice(0, childrenPerRoot);
      for (const kid of shown) {
        visible.add(kid.id);
        if (expandedRoots.has(kid.id)) walk(kid.id);
      }
    };
    walk(null);
    return shownCodes.filter(c => visible.has(c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownCodes, foldMode, expandedRoots, childrenPerRoot, rolledUpScores, rolledUpCounts]);

  const visibleIds = useMemo(() => new Set(visibleCodes.map(c => c.id)), [visibleCodes]);

  // How many of each code's children are currently on screen (for the
  // "N total · M shown" fold badges).
  const visibleChildCount = useMemo(() => {
    const m = new Map<ID, number>();
    for (const c of visibleCodes) if (c.parentId) m.set(c.parentId, (m.get(c.parentId) || 0) + 1);
    return m;
  }, [visibleCodes]);

  useEffect(()=>{if(!jumpCode||!positions.has(jumpCode))return;const node=svgRef.current?.querySelector<SVGGElement>('[data-map-code="'+CSS.escape(jumpCode)+'"]');if(!node)return;node.scrollIntoView({block:'center',inline:'center'});setJumpCode(null);},[jumpCode,positions,visibleCodes]);

  // Auto-layout for visible codes with no cached mapPosition. Runs on import,
  // on canvas changes, and when folding reveals nodes that were never
  // arranged; hand-placed positions are never clobbered. Only the visible
  // node set is laid out, so spacing and physics reflect what is drawn.
  useEffect(() => {
    if(!active)return;
    const missing = visibleCodes.filter(c => !c.mapPosition);
    if (missing.length === 0) return;
    const auto = computeAutoLayout(visibleCodes, canvas.w, canvas.h);
    const updates = missing.flatMap(c => { const pos=auto.get(c.id); return pos ? [{id:c.id,patch:{mapPosition:pos}}] : []; });
    if(updates.length)onUpdateCodesBatch(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, visibleCodes, canvas.w, canvas.h]);

  const styles = mapEdgeStyles || [];
  const findStyle = (kind: MapEdgeStyle['kind'], a: ID, b: ID): MapEdgeStyle | undefined =>
    styles.find(s => s.kind === kind && (
      (s.fromCodeId === a && s.toCodeId === b) || (s.fromCodeId === b && s.toCodeId === a)
    ));

  // All renderable edges, with their override entry (if any) attached. Only
  // edges whose endpoints are currently visible are drawn, so folded
  // subtrees drop out (and re-appear) with the nodes.
  const edges = useMemo<EdgeRef[]>(() => {
    const refs: EdgeRef[] = [];
    if(mapDesign?.hubId)for(const id of mapDesign.rootIds)if(visibleIds.has(id))refs.push({key:`topic:${mapDesign.hubId}:${id}`,kind:'hierarchy',fromId:mapDesign.hubId,toId:id});
    for (const c of visibleCodes) {
      if (!c.parentId || !visibleIds.has(c.parentId)) continue;
      refs.push({ key: `hierarchy:${c.parentId}:${c.id}`, kind: 'hierarchy', fromId: c.parentId, toId: c.id });
    }
    if (showCooc) {
      for (const [pair, shared] of (mapDesign&&mapDesign.mode!=='manual'?suggestedMapPairs(codes,sharedDocs,mapDesign.maxLinks):Array.from(sharedDocs))) {
        if (shared < minShared) continue;
        const [a, b] = pair.split('::');
        if (!visibleIds.has(a) || !visibleIds.has(b)) continue;
        const ca = visibleCodes.find(x => x.id === a);
        const cb = visibleCodes.find(x => x.id === b);
        if (!ca || !cb) continue;
        if (ca.parentId === b || cb.parentId === a) continue; // already drawn as hierarchy
        refs.push({ key: `cooccurrence:${pair}`, kind: 'cooccurrence', fromId: a, toId: b });
      }
    }
    for (const s of styles) {
      if (s.kind !== 'custom') continue;
      if (!visibleIds.has(s.fromCodeId) || !visibleIds.has(s.toCodeId)) continue;
      refs.push({ key: `custom:${s.id}`, kind: 'custom', fromId: s.fromCodeId, toId: s.toCodeId, style: s });
    }
    for (const ref of refs) {
      if (!ref.style && ref.kind !== 'custom') ref.style = findStyle(ref.kind, ref.fromId, ref.toId);
    }
    return refs;
  }, [visibleCodes, visibleIds, sharedDocs, styles, showCooc, minShared, mapDesign, codes]);

  // Edge kinds actually drawn right now — the legend only shows rows for
  // kinds present (plus the strength scale only when co-occurrence edges
  // are on screen).
  const presentKinds = useMemo(() => {
    const s = new Set<string>();
    for (const e of edges) s.add(e.kind);
    return s;
  }, [edges]);

  const legendNodes=useMemo(()=>{const grouped=new Map<string,{key:string;shape:string;fill:string;stroke:string;label:string;count:number}>();for(const code of visibleCodes){const shape=code.mapShape||'circle',fill=code.mapAppearance?.fill||code.color,stroke=code.mapAppearance?.stroke||code.color,key=shape+'|'+fill+'|'+stroke;const item=grouped.get(key);if(item)item.count++;else grouped.set(key,{key:'node:'+code.id,shape,fill,stroke,label:code.mapLabel??code.name,count:1});}return Array.from(grouped.values());},[visibleCodes]);
  const legendLines=useMemo(()=>(['hierarchy','cooccurrence','custom'] as const).flatMap(kind=>{const drawn=edges.filter(e=>e.kind===kind);if(!drawn.length)return [];const sample=drawn[0];return [{key:'relation:'+kind,label:kind==='hierarchy'?'Hierarchy':kind==='cooccurrence'?(mapDesign&&mapDesign.mode!=='manual'?'Shared documents':'Co-occurrence'):'Custom',color:sample.style?.color||mapColors[kind],dashed:(sample.style?.lineStyle||'solid')!=='solid'}];}),[edges,mapDesign]);
  const annotationLegend=Array.from(new Map(annotations.filter(a=>a.legendLabel).map(a=>[a.legendLabel,{key:'annotation:'+a.id,label:a.legendLabel!,shape:a.kind==='circle'?'ellipse':mapDesign?.family==='histomap'?'square':a.polygonPoints?.length===12?'hexagon':a.polygonPoints?.[0]===.5?'triangle':a.polygonPoints?'trapezoid':'square',fill:a.fill||'none',stroke:a.color}])).values());
  const legendEntries=[...annotationLegend,...legendLines,...(mapDesign?.hubId?[{key:'topic',label:'Topic grouping',color:annotations.find(a=>a.id===mapDesign.hubId)?.color||'#6f4d89',dashed:false}]:[]),...legendNodes.map(n=>({...n,label:n.label+(n.count>1?' +'+(n.count-1):'')}))];
  const selectedEdge = useMemo(
    () => edges.find(e => e.key === selectedKey) || null,
    [edges, selectedKey]
  );

  const lineEdit=useMapLineEditing(zoom,canvas.w,canvas.h,(key,points)=>{
    if(key.startsWith('annotation:')){const id=key.slice(11);onUpdateAnnotations(annotations.map(a=>a.id===id?{...a,x:points.start.x,y:points.start.y,x2:points.end.x,y2:points.end.y,fromAnnotationId:undefined,toAnnotationId:undefined}:a));}
    else {const edge=edges.find(e=>e.key===key);if(edge)commitStyle(edge,{...derivedEdgeDefaults(edge),lineStart:points.start,lineEnd:points.end});}
  });
  function edgePosition(id:string){const annotation=annotations.find(a=>a.id===id);if(annotation){const live=annoLiveOffset?.id===id?annoLiveOffset:null;return{x:(live?.x??annotation.x)+(annotation.width||0)/2,y:(live?.y??annotation.y)+(annotation.height||0)/2};}return positions.get(id);}
  function edgeEndpoints(edge:EdgeRef):LinePoints|null{
    const from=edgePosition(edge.fromId),to=edgePosition(edge.toId);if(!from||!to)return null;
    const live=lineEdit.live?.key===edge.key?lineEdit.live:null,fromCode=codes.find(c=>c.id===edge.fromId),toCode=codes.find(c=>c.id===edge.toId);
    return {start:live?.start||edge.style?.lineStart||ellipseEndpoint(from,to,annotations.find(a=>a.id===edge.fromId)?.width||fromCode?.mapAppearance?.width||radiusFor(edge.fromId,false)*2,annotations.find(a=>a.id===edge.fromId)?.height||fromCode?.mapAppearance?.height||radiusFor(edge.fromId,false)*2),end:live?.end||edge.style?.lineEnd||ellipseEndpoint(to,from,toCode?.mapAppearance?.width||radiusFor(edge.toId,false)*2,toCode?.mapAppearance?.height||radiusFor(edge.toId,false)*2)};
  }
  function annotationEndpoints(a:MapAnnotation):LinePoints{
    if(lineEdit.live?.key==='annotation:'+a.id)return lineEdit.live;
    const from=annotations.find(n=>n.id===a.fromAnnotationId),to=annotations.find(n=>n.id===a.toAnnotationId);
    const endpoint=(node:MapAnnotation,other:MapAnnotation)=>{const center={x:node.x+(node.width||0)/2,y:node.y+(node.height||0)/2},target={x:other.x+(other.width||0)/2,y:other.y+(other.height||0)/2};if(node.shapeType==='network-text')return center;if(node.kind==='circle')return ellipseEndpoint(center,target,node.width||100,node.height||100);const dx=target.x-center.x,dy=target.y-center.y,ratio=Math.max(Math.abs(dx)/((node.width||100)/2),Math.abs(dy)/((node.height||100)/2));return ratio>1?{x:center.x+dx/ratio,y:center.y+dy/ratio}:center;};
    return from&&to?{start:endpoint(from,to),end:endpoint(to,from)}:{start:{x:a.x,y:a.y},end:{x:a.x2??a.x,y:a.y2??a.y}};
  }
  function lineHandles(key:string,points:LinePoints){return <g data-map-edit-outline>{(['start','end'] as const).map(part=><circle key={part} data-map-line-handle={part} cx={points[part].x} cy={points[part].y} r={6/zoom} fill="white" stroke="#2563eb" strokeWidth={1.5/zoom} style={{cursor:'move'}} onMouseDown={event=>lineEdit.begin(event,key,points,part)} onClick={event=>event.stopPropagation()}/>)}</g>;}
  function edgePath(from: { x: number; y: number }, to: { x: number; y: number }, curved: boolean): string {
    if (!curved) {
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    }
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const cx = mx - (dy / len) * 45;
    const cy = my + (dx / len) * 45;
    return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  }

  // Instantly rescale every placed node into the new canvas bounds (40px
  // padding) and persist in one batch, BEFORE the canvas state flips — so no
  // render ever shows a shrunk paper with cropped nodes.
  function rescalePositionsFor(newW: number, newH: number) {
    const placed = codes.filter(c => !!c.mapPosition);
    if (placed.length === 0) {onResizeCanvas?.(newW,newH,[]);return;}
    const PAD = 40;
    const xs = placed.map(c => c.mapPosition!.x);
    const ys = placed.map(c => c.mapPosition!.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spreadX = maxX - minX;
    const spreadY = maxY - minY;
    const updates = placed.map(c => {
      const nx = PAD + (spreadX === 0 ? 0 : ((c.mapPosition!.x - minX) / spreadX) * (newW - 2 * PAD));
      const ny = PAD + (spreadY === 0 ? 0 : ((c.mapPosition!.y - minY) / spreadY) * (newH - 2 * PAD));
      return { id: c.id, patch: { mapPosition: { x: Math.round(nx), y: Math.round(ny) } } };
    });
    if(onResizeCanvas)onResizeCanvas(newW,newH,updates);else onUpdateCodesBatch(updates);
  }

  const selectCanvasPreset = (value: string) => {
    if (value === 'custom') {
      setCustomMode(true);
      return;
    }
    const preset = CANVAS_PRESETS[Number(value)];
    rescalePositionsFor(preset.w, preset.h);
    setCustomMode(false);
    setPresetIdx(Number(value));
  };

  // Rotate the canvas 90°, always through the standard canvas-change path
  // (rescale then flip) so no render ever shows cropped nodes.
  function rotateCanvas() {
    const newW = canvas.h;
    const newH = canvas.w;
    rescalePositionsFor(newW, newH);
    setCustomMode(true);
    setCustomW(newW);
    setCustomH(newH);
  }

  // The style values an edge is currently RENDERING with, i.e. its derived
  // defaults where no override exists. Used when a styling action has to create
  // the style row: seeding it with the derived values keeps the edge looking
  // exactly as it did instead of freezing it to hardcoded fallbacks. Mirrors the
  // fallback chain used at render time.
  function derivedEdgeDefaults(edge: EdgeRef): Partial<MapEdgeStyle> {
    if (edge.style) return {};
    const isCooc = edge.kind === 'cooccurrence';
    return {
      lineStyle: 'solid',
      curve: edge.fromId===mapDesign?.hubId?'curved':'straight',
      color:edge.fromId===mapDesign?.hubId?codes.find(c=>c.id===edge.toId)?.mapAppearance?.stroke||codes.find(c=>c.id===edge.toId)?.color:undefined,
      arrow: 'none',
      width: edge.fromId===mapDesign?.hubId?4:isCooc ? weightFor(`${edge.fromId}::${edge.toId}`) : edge.kind === 'custom' ? 2.5 : 2
    };
  }

  function commitStyle(edge: EdgeRef, patch: Partial<MapEdgeStyle>) {
    if (edge.style) {
      onUpdateEdgeStyle(edge.style.id, patch);
    } else {
      onAddEdgeStyle({
        id: uid('edge'),
        fromCodeId: edge.fromId,
        toCodeId: edge.toId,
        kind: edge.kind,
        lineStyle: 'solid',
        curve: 'straight',
        arrow: 'none',
        ...patch
      });
    }
  }

  function handleNodeMouseDown(e: React.MouseEvent, code: Code) {
    if (e.button !== 0) return;
    e.stopPropagation();
    movedRef.current = false;
    const pos = positions.get(code.id) || { x: 0, y: 0 };
    setDrag({ id: code.id, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y });
  }

  function handleNodeClick(e: React.MouseEvent, code: Code) {
    e.stopPropagation();
    if (movedRef.current) { movedRef.current = false; return; }
    if (drawMode) {
      if (!drawSource) {
        setDrawSource(code.id);
        return;
      }
      if (drawSource !== code.id) {
        onAddEdgeStyle({
          id: uid('edge'),
          fromCodeId: drawSource,
          toCodeId: code.id,
          kind: 'custom',
          lineStyle: 'solid',
          curve: 'curved',
          arrow: 'end'
        });
        if (onShowToast) onShowToast(`Custom edge: ${shownCodes.find(c => c.id === drawSource)?.name || ''} → ${code.name}`);
      }
      setDrawSource(null);
      setDrawMode(false);
      return;
    }
    // Folded node with hidden descendants: click toggles expand/collapse
    // (adds/removes its id from `expandedRoots`). Anything else: the node is
    // selected on the canvas — selecting never navigates to the Codebook;
    // use ✕ Remove from map (toolbar) to hide it, ➕ Add codes do the reverse.
    if (foldMode && (descendantsCache.get(code.id) || 0) > 0) toggleExpand(code.id, e);
    setSelectedKey(null);
    setSelectedAnnoId(null);
    setSelectedLegend(null);setSelectedMapCodeId(code.id);
  }

  function cycleShape(e: React.MouseEvent, code: Code) {
    e.preventDefault();
    e.stopPropagation();
    const idx = SHAPES.indexOf(code.mapShape || 'circle');
    const next = SHAPES[(idx + 1) % SHAPES.length];
    onUpdateCode(code.id, { mapShape: next });
    if (onShowToast) onShowToast(`Shape: ${next}`);
  }

  // Expand/collapse a folded node (click on the node or its + badge).
  // Deliberately separate from the click-to-navigate handler above.
  function toggleExpand(codeId: ID, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedRoots(prev => {
      const next = new Set(prev);
      if (next.has(codeId)) next.delete(codeId); else next.add(codeId);
      return next;
    });
  }

  // Explicit "re-run auto layout": recompute positions for every visible code
  // (clobbering drags — that's the point) and persist in one batch.
  function reAutoLayout() {
    const auto = computeAutoLayout(visibleCodes, canvas.w, canvas.h);
    const updates = visibleCodes
      .filter(c => auto.has(c.id))
      .map(c => ({ id: c.id, patch: { mapPosition: auto.get(c.id)! } }));
    if (updates.length) onUpdateCodesBatch(updates);
    if (onShowToast) onShowToast(`Auto-layout re-run for ${updates.length} visible code${updates.length === 1 ? '' : 's'}`);
  }

  function handleViewModeChange(v: 'auto' | 'full' | 'custom') {
    setViewMode(v);
    if (v === 'full' && codes.length > 60 && onShowToast) {
      onShowToast(`${codes.length} codes on one map — that's a lot. Auto/Custom views keep it readable.`);
    }
  }

  useEffect(() => {
    if (!drag) return;
    const active = drag;
    function onMove(e: MouseEvent) {
      if (Math.abs(e.clientX - active.startX) + Math.abs(e.clientY - active.startY) > 3) movedRef.current = true;
      // Divide by zoom: pointer deltas are screen pixels, positions are viewBox units.
      const z = zoomRef.current;
      const rawX = active.origX + (e.clientX - active.startX) / z;
      const rawY = active.origY + (e.clientY - active.startY) / z;
      // Rigid clamp so a node can never leave the white paper.
      const { w, h } = canvasRef.current;
      const appearance=codes.find(c=>c.id===active.id)?.mapAppearance;
      const px=Math.max(40,(appearance?.width||0)/2+12),py=Math.max(40,(appearance?.height||0)/2+12);
      const x = Math.round(Math.max(px, Math.min(rawX, w - px)));
      const y = Math.round(Math.max(py, Math.min(rawY, h - py)));
      setPositions(prev => new Map(prev).set(active.id, { x, y }));
    }
    function onUp() {
      const pos = positionsRef.current.get(active.id);
      if (pos) onUpdateCode(active.id, { mapPosition: pos });
      setDrag(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, onUpdateCode]);

  // ViewBox coords for a pointer event: the svg sits inside the zoom-scaled
  // wrapper, so divide the screen delta by the zoom factor.
  const toViewBox = (e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const z = zoomRef.current;
    return { x: (e.clientX - rect.left) / z, y: (e.clientY - rect.top) / z };
  };

  useEffect(()=>{if(!active)return;const stop=(e:KeyboardEvent)=>{if(e.key==='Escape'){setAnnotateMode(false);setAnnoDrag(null);annoPreviewRef.current=null;setAnnoPreview(null);}};window.addEventListener('keydown',stop);return()=>window.removeEventListener('keydown',stop);},[active]);

  // Annotation drawing drag: window listeners while active (same pattern as
  // node drag). Releasing persists the new shape with ONE onUpdateAnnotations
  // call — per user action, never a loop.
  useEffect(() => {
    if (!annoDrag) return;
    const active = annoDrag;
    function onMove(e: MouseEvent) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const z = zoomRef.current;
      const x = (e.clientX - rect.left) / z;
      const y = (e.clientY - rect.top) / z;
      const side=Math.max(Math.abs(x-active.x0),Math.abs(y-active.y0));const constrain=e.shiftKey&&drawingShapes.find(s=>s.id===active.shape)?.kind!=='arrow';
      const next = { x0: active.x0, y0: active.y0, x1:constrain?active.x0+(x>=active.x0?side:-side):x, y1:constrain?active.y0+(y>=active.y0?side:-side):y };
      annoPreviewRef.current = next;
      setAnnoPreview(next);
    }
    function onUp() {
      const p = annoPreviewRef.current;
      if (p && Math.abs(p.x1 - p.x0) + Math.abs(p.y1 - p.y0) > 5 && (drawingShapes.find(s=>s.id===active.shape)?.kind==='arrow'||Math.abs(p.x1-p.x0)>5&&Math.abs(p.y1-p.y0)>5)) {
        const shape=drawingShapes.find(s=>s.id===active.shape)||drawingShapes[0];
        const anno=drawingAnnotation(shape,p,uid('anno'),mapColors.custom);
        onUpdateAnnotations([...annotations, anno]);
        setSelectedAnnoId(anno.id);
        if(anno.kind==='text'){const edit={kind:'annotation' as const,id:anno.id,value:'',isNew:true};inlineEditRef.current=edit;setInlineEdit(edit);setAnnotateMode(false);setTextEditorOpen(true);}
      }
      annoPreviewRef.current = null;
      setAnnoPreview(null);
      setAnnoDrag(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [annoDrag, onUpdateAnnotations, annotations]);

  // Drag an already-placed annotation. Live position is tracked locally
  // (annoLiveOffset) so nothing persists until mouseup — one
  // onUpdateAnnotations call per drag, same as everywhere else in this file.
  useEffect(() => {
    if (!annoDragMove) return;
    const active = annoDragMove;
    function onMove(e: MouseEvent) {
      const dx = (e.clientX - active.startX) / zoomRef.current;
      const dy = (e.clientY - active.startY) / zoomRef.current;
      if (Math.abs(dx) + Math.abs(dy) > 3) annoMovedRef.current = true;
      const { w, h } = canvasRef.current;
      const clampX = (v: number) => Math.max(0, Math.min(w, v));
      const clampY = (v: number) => Math.max(0, Math.min(h, v));
      let patch: Partial<MapAnnotation>;
      if (active.orig.kind === 'arrow') {
        patch = {
          x: clampX(active.orig.x + dx),
          y: clampY(active.orig.y + dy),
          x2: clampX((active.orig.x2 ?? active.orig.x) + dx),
          y2: clampY((active.orig.y2 ?? active.orig.y) + dy)
        };
      } else {
        patch = { x: clampX(active.orig.x + dx), y: clampY(active.orig.y + dy) };
      }
      liveAnnoPatchRef.current = patch;
      setAnnoLiveOffset({ id: active.id, ...patch });
    }
    function onUp() {
      const patch = liveAnnoPatchRef.current;
      if (patch) {
        onUpdateAnnotations(annotations.map(a => (a.id === active.id ? { ...a, ...patch, ...(active.orig.flow?{flowManual:true}:{}), ...(active.orig.flowNodeLabel?{flowLabelPlacement:'free' as const}:{}) } : a)));
      }
      liveAnnoPatchRef.current = null;
      setAnnoLiveOffset(null);
      setAnnoDragMove(null);
      // Clear the drag flag on mouseup. Otherwise a drag that ends anywhere
      // other than its own annotation (on empty canvas, or over a different
      // shape) leaves the flag set, and the NEXT plain click on any
      // annotation is swallowed as if it were a drag.
      annoMovedRef.current = false;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [annoDragMove, onUpdateAnnotations, annotations]);

  useEffect(() => {
    if (!labelDragMove) return;
    const active = labelDragMove;
    function onMove(e: MouseEvent) {
      const dx = (e.clientX - active.startX) / zoomRef.current;
      const dy = (e.clientY - active.startY) / zoomRef.current;
      const next = { key: active.key, dx: active.origDx + dx, dy: active.origDy + dy };
      labelLiveOffsetRef.current = next;
      setLabelLiveOffset(next);
    }
    function onUp() {
      // ONE persist for the whole drag. commitStyle creates the style row on
      // demand, so seed it with the edge's currently-rendered defaults —
      // otherwise the first drag of an unstyled edge would write a row holding
      // only labelDx/labelDy and silently freeze lineStyle/curve/arrow to the
      // hardcoded fallbacks instead of the derived rendering.
      const live = labelLiveOffsetRef.current;
      if (live && live.key === active.key) {
        commitStyle(active.edge, {
          ...derivedEdgeDefaults(active.edge),
          labelDx: live.dx,
          labelDy: live.dy
        });
      }
      labelLiveOffsetRef.current = null;
      setLabelLiveOffset(null);
      setLabelDragMove(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // commitStyle/derivedEdgeDefaults close over current props; the drag is
    // re-created from scratch on every mousedown, so these are stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelDragMove]);

  function textBox(kind:'code'|'annotation'|'edge',id:string){
    if(kind==='code'){const code=codes.find(c=>c.id===id),pos=positions.get(id);if(!code||!pos)return null;const width=code.mapAppearance?.width||180,height=code.mapAppearance?.height||80;return {x:pos.x-width/2,y:code.mapShape==='ellipse'?pos.y-height/2:pos.y+radiusFor(id,false)+2,width,height};}
    if(kind==='annotation'){const anno=annotations.find(a=>a.id===id);if(!anno)return null;return {x:anno.x,y:anno.width?anno.y:anno.y-(anno.fontSize||14),width:anno.width||250,height:anno.height||90};}
    const edge=edges.find(e=>e.key===id);if(!edge)return null;const points=edgeEndpoints(edge);if(!points)return null;const from=points.start,to=points.end;const width=edge.style?.labelWidth||250,height=edge.style?.labelHeight||70;return {x:(from.x+to.x)/2+(edge.style?.labelDx||0)-width/2,y:(from.y+to.y)/2-6+(edge.style?.labelDy||0)-height/2,width,height};
  }
  useEffect(()=>{
    if(!resizeDrag)return;const drag=resizeDrag;
    const move=(event:MouseEvent)=>{const dx=(event.clientX-drag.startX)/zoomRef.current,dy=(event.clientY-drag.startY)/zoomRef.current;let left=drag.box.x,top=drag.box.y,right=left+drag.box.width,bottom=top+drag.box.height;
      if(drag.handle.includes('e'))right+=dx;if(drag.handle.includes('w'))left+=dx;if(drag.handle.includes('s'))bottom+=dy;if(drag.handle.includes('n'))top+=dy;
      left=Math.max(0,Math.min(left,right-50));top=Math.max(0,Math.min(top,bottom-30));right=Math.min(canvasRef.current.w,Math.max(right,left+50));bottom=Math.min(canvasRef.current.h,Math.max(bottom,top+30));
      const live={kind:drag.kind,id:drag.id,x:left,y:top,width:right-left,height:bottom-top};resizeLiveRef.current=live;setResizeLive(live);};
    const up=()=>{const box=resizeLiveRef.current;if(box){
      if(box.kind==='code'){const code=codes.find(c=>c.id===box.id);if(code){const appearance=code.mapAppearance||{fill:code.color,stroke:code.color,width:180,height:80,fontSize:16};onUpdateCode(box.id,{mapAppearance:{...appearance,width:box.width,height:box.height},mapPosition:{x:box.x+box.width/2,y:code.mapShape==='ellipse'?box.y+box.height/2:box.y-radiusFor(code.id,false)-2}});}}
      else if(box.kind==='annotation')onUpdateAnnotations(annotations.map(a=>a.id===box.id?{...a,x:box.x,y:box.y,width:box.width,height:box.height,...(a.flow?{flowManual:true}:{}),...(a.flowNodeLabel?{flowLabelPlacement:'free' as const}:{})}:a));
      else {const edge=edges.find(e=>e.key===box.id);if(edge){const points=edgeEndpoints(edge);const from=points?.start,to=points?.end;if(from&&to)commitStyle(edge,{labelWidth:box.width,labelHeight:box.height,labelDx:box.x+box.width/2-(from.x+to.x)/2,labelDy:box.y+box.height/2-((from.y+to.y)/2-6)});}}
    }resizeLiveRef.current=null;setResizeLive(null);setResizeDrag(null);};
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);};
  },[resizeDrag]);
  function beginInline(kind: 'code'|'rename'|'annotation'|'edge',id:string) {
    setSelectedLegend(null);const code=codes.find(c=>c.id===id),annotation=annotations.find(a=>a.id===id),edge=edges.find(e=>e.key===id);
    const value=kind==='rename'?code?.name:kind==='code'?code?.mapLabel??code?.name:kind==='annotation'?annotation?.text:edge?.style?.label;
    const edit={kind,id,value:value||''};inlineEditRef.current=edit;setInlineEdit(edit);setTextEditorOpen(true);setAnnotateMode(false);setDrawMode(false);
  }
  function endInline(save:boolean) {
    const edit=inlineEditRef.current;if(!edit)return;inlineEditRef.current=null;setInlineEdit(null);
    if(!save){if(edit.isNew)onUpdateAnnotations(annotations.filter(a=>a.id!==edit.id));return;}
    if(edit.kind==='code')onUpdateCode(edit.id,{mapLabel:edit.value});
    else if(edit.kind==='rename'){
      const code=codes.find(c=>c.id===edit.id),name=edit.value.trim();if(!code||!name)return;
      if(codes.some(c=>c.id!==code.id&&c.parentId===code.parentId&&c.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase())){onShowToast?.('A sibling code already has that name.');return;}
      onUpdateCode(edit.id,{name,mapLabel:undefined});
    }else if(edit.kind==='annotation')onUpdateAnnotations(edit.isNew&&!edit.value.trim()?annotations.filter(a=>a.id!==edit.id):annotations.map(a=>a.id===edit.id?{...a,text:edit.value}:a));
    else {const edge=edges.find(e=>e.key===edit.id);if(edge)commitStyle(edge,{label:edit.value});}
  }
  useEffect(()=>{if(!active)return;const remove=(event:KeyboardEvent)=>{if(multiKeysRef.current.length>1)return;if(event.key!=='Delete'||event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||!selectedAnnoId)return;const target=event.target;if(target instanceof Element&&target.closest('input,textarea,select,[contenteditable="true"]'))return;if(document.querySelector('[role="dialog"]'))return;event.preventDefault();onUpdateAnnotations(annotations.filter(a=>a.id!==selectedAnnoId&&a.fromAnnotationId!==selectedAnnoId&&a.toAnnotationId!==selectedAnnoId));setSelectedAnnoId(null);};window.addEventListener('keydown',remove);return()=>window.removeEventListener('keydown',remove);},[active,selectedAnnoId,annotations,onUpdateAnnotations]);

  const selectedAnno = selectedAnnoId ? (annotations.find(a => a.id === selectedAnnoId) || null) : null;

  const cloudReflowVersion=useRef(0),cloudReflowTimer=useRef<ReturnType<typeof setTimeout>>();
  const cloudContext=useRef({projectId,mapDesign,sourceAnnotations,docs,codes,codedSegments,active,selectedAnnoId});cloudContext.current={projectId,mapDesign,sourceAnnotations,docs,codes,codedSegments,active,selectedAnnoId};
  const [cloudSizing,setCloudSizing]=useState<{id:string;size:number}>();
  useEffect(()=>()=>{cloudReflowVersion.current++;clearTimeout(cloudReflowTimer.current);},[]);
  function updateSelectedAnno(patch: Partial<MapAnnotation>) {
    if (!selectedAnnoId) return;
    const currentLabel=sourceAnnotations.find(a=>a.id===selectedAnnoId);
    if(currentLabel?.flowNodeLabel&&patch.flowLabelPlacement){
      if(patch.flowLabelPlacement==='inside'&&currentLabel.flowLabelPlacement!=='inside')patch={...patch,flowLabelOutsideSize:{width:currentLabel.width||360,height:currentLabel.height||70}};
      else if(patch.flowLabelPlacement!=='inside'&&currentLabel.flowLabelPlacement==='inside')patch={...patch,...currentLabel.flowLabelOutsideSize,flowLabelOutsideSize:undefined};
    }
    const cloudOptions=mapDesign?.family==='word-cloud'?mapDesign.options as unknown as VisualizationOptions:undefined;
    const wordIndex=cloudOptions?.cloudWords?.findIndex((_,i)=>'suggested:cloud:word:'+i===selectedAnnoId)??-1;
    if(cloudOptions&&wordIndex>=0&&patch.fontSize!==undefined&&onApplySuggestion){
      const version=++cloudReflowVersion.current,word=cloudOptions.cloudWords![wordIndex].word;
      setCloudSizing({id:selectedAnnoId,size:patch.fontSize});clearTimeout(cloudReflowTimer.current);
      cloudReflowTimer.current=setTimeout(async()=>{try{
        const styles={...cloudOptions.cloudWordStyles};for(const [i,w] of cloudOptions.cloudWords!.entries()){const a=sourceAnnotations.find(a=>a.id==='suggested:cloud:word:'+i);if(a)styles[w.word]={...styles[w.word],fontFamily:a.fontFamily,bold:a.bold,italic:a.italic,rotation:a.rotation,text:a.text};}
        styles[word]={...styles[word],fontSize:patch.fontSize};
        const {prepareWordCloud,buildWordCloud,preserveCloudDecorations}=await import('../lib/wordCloud'),data={...researchProject,id:projectId,name:projectName||'Word cloud',codes,docs,codedSegments};
        const ready=await prepareWordCloud(data,{...cloudOptions,cloudWordStyles:styles});if(version!==cloudReflowVersion.current)return;
        const current=cloudContext.current;if(current.active===false||current.projectId!==projectId||current.mapDesign!==mapDesign||current.sourceAnnotations!==sourceAnnotations||current.docs!==docs||current.codes!==codes||current.codedSegments!==codedSegments){onShowToast?.('The canvas changed while refitting. Change the font size again to use your latest edits.');return;}
        const result=buildWordCloud(data,ready),oldWords=new Map(cloudOptions.cloudWords!.map((w,i)=>[w.word,sourceAnnotations.find(a=>a.id==='suggested:cloud:word:'+i)]));
        result.annotations=result.annotations.map(a=>{const i=Number(a.id.replace('suggested:cloud:word:','')),w=ready.cloudWords?.[i],old=w?oldWords.get(w.word):undefined;return old?{...old,...a,color:old.color,textColor:old.textColor}:a;});
        result.annotations=preserveCloudDecorations(result,sourceAnnotations,mapDesign?.description,cloudOptions.cloudWords).annotations;
        result.design={...result.design,generatedAt:mapDesign?.generatedAt,paletteId:mapDesign?.paletteId,paletteInverted:mapDesign?.paletteInverted};onApplySuggestion(result);
        const selectedIndex=cloudOptions.cloudWords!.findIndex((_,i)=>'suggested:cloud:word:'+i===current.selectedAnnoId),selectedWord=cloudOptions.cloudWords![selectedIndex]?.word,nextIndex=ready.cloudWords!.findIndex(w=>w.word===selectedWord);setSelectedAnnoId(selectedIndex<0?current.selectedAnnoId:nextIndex<0?null:'suggested:cloud:word:'+nextIndex);onShowToast?.('Word cloud refitted.'+(ready.cloudOmitted?' '+ready.cloudOmitted+' words could not fit.':''));
      }catch(error){if(version===cloudReflowVersion.current)onShowToast?.(error instanceof Error?error.message:String(error),6000);}finally{if(version===cloudReflowVersion.current)setCloudSizing(undefined);}},250);
      return;
    }
    onUpdateAnnotations(sourceAnnotations.map(a => (a.id === selectedAnnoId ? { ...a, ...patch } : a)));
  }

  // Pure-CSS fullscreen overlay (no native Fullscreen API — consistent
  // inside Electron): Escape exits, and the listener exists only while the
  // overlay is active.
  useEffect(() => {
    if (!isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsFullscreen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  function serializeSvg(scale = 1,physical = false): { xml: string | null; width: number; height: number } {
    const el = svgRef.current;
    if (!el) return { xml: null, width: canvas.w, height: canvas.h };
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('[data-map-editor],[data-map-edit-outline],[data-map-hit-target],[data-visualization-notes]').forEach(el=>el.remove());
    const w = Math.max(1, Math.round(canvas.w * scale));
    const h = Math.max(1, Math.round(canvas.h * scale));
    clone.setAttribute('width', physical?publicationWidthMm+'mm':String(w));
    clone.setAttribute('height', physical?(publicationWidthMm*canvas.h/canvas.w)+'mm':String(h));
    clone.style.backgroundColor='#ffffff';clone.style.removeProperty('box-shadow');clone.style.removeProperty('cursor');clone.querySelector('[data-map-paper]')?.setAttribute('fill','#ffffff');
    const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=String(mapDesign?.options?.title||projectName||'Research visualization');clone.prepend(title);
    const desc=document.createElementNS('http://www.w3.org/2000/svg','desc');const selectedDocs=Array.isArray(mapDesign?.options?.docIds)?new Set(mapDesign!.options!.docIds as string[]):new Set<string>();desc.textContent=(mapDesign?.description||'Editable '+(mapDesign?.family||'code map')+' diagram.')+(selectedDocs.size?' Source documents: '+docs.filter(d=>selectedDocs.has(d.id)).slice(0,Number(mapDesign?.options?.docLimit)||24).map(d=>d.name).join('; '):'');clone.prepend(desc);
    for(const name of ['font-size','stroke','stroke-width','opacity'])clone.querySelectorAll('[data-export-'+name+']').forEach(el=>{el.setAttribute(name,el.getAttribute('data-export-'+name)!);el.removeAttribute('data-export-'+name);});
    if (!includeLegendInExport) clone.querySelectorAll('[data-map-legend]').forEach(el=>el.remove());
    return {
      xml: `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`,
      width: w,
      height: h
    };
  }

  async function exportSvg() {
    const { xml } = serializeSvg(1,true);
    if (!xml) return;
    const path = await window.qv.exportText({
      title: 'Export Visualization (SVG)',
      defaultName: (mapDesign?.family||'visualization').replace(/-/g,'_')+'.svg',
      content: xml,
      extension: 'svg',
      filterName: 'SVG file'
    });
    if (path && onShowToast) onShowToast(`Visualization exported to ${path}`);
  }

  async function exportRaster(kind: 'png' | 'jpeg') {
    // Render at the requested pixel resolution. Physical DPI depends on print width.
    const scale = Math.min(exportScale,8192/Math.max(canvas.w,canvas.h),Math.sqrt(40000000/(canvas.w*canvas.h)));
    const { xml, width, height } = serializeSvg(scale);
    if (!xml) return;
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('failed to rasterize SVG'));
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
      });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL(kind === 'png' ? 'image/png' : 'image/jpeg', 0.92);
      const path = await window.qv.exportImage({
        title: `Export Visualization (${kind.toUpperCase()})`,
        defaultName: (mapDesign?.family||'visualization').replace(/-/g,'_')+(kind==='png'?'.png':'.jpg'),
        base64: dataUrl.split(',')[1]
      });
      if (path && onShowToast) onShowToast(`Visualization exported to ${path}`);
    } catch (e: any) {
      if (onShowToast) onShowToast(e.message || String(e));
    }
  }

  const truncated = (name: string) => (name.length > MAX_LABEL ? `${name.slice(0, MAX_LABEL - 1)}…` : name);

  // Continuous weight scale for co-occurrence edges: shared-doc count mapped
  // over [MIN_EDGE_W, MAX_EDGE_W]. A manual width set in the edge panel
  // overrides it. Opacity follows the same ramp so weak ties stay subtle.
  const weightFor = (pairKey: string) => {
    if (maxShared === 0) return MIN_EDGE_W;
    const shared = sharedDocs.get(pairKey) || 0;
    return MIN_EDGE_W + (shared / maxShared) * (MAX_EDGE_W - MIN_EDGE_W);
  };
  const opacityFor = (pairKey: string) => {
    if (maxShared === 0) return 0.45;
    const shared = sharedDocs.get(pairKey) || 0;
    return 0.45 + (shared / maxShared) * 0.5;
  };

  // Descendant counts (excluding self) for every code — powers the fold
  // badges (+N on folded nodes). Cached: fold badges re-read this map.
  const descendantsCache = useMemo(() => {
    const m = new Map<ID, number>();
    for (const c of shownCodes) m.set(c.id, descendantCodeIds(shownCodes, c.id).size - 1);
    return m;
  }, [shownCodes]);

  // Very cheap label collision avoidance: labels sit beneath their node, so
  // we track each placed label's box and, on overlap with an earlier one,
  // shift the new label up/down in alternating steps until it clears. A rough
  // heuristic — not a full collision solver.
  const screenLabelSize = Math.max(12, 11 / zoom);
  const labelDeltas = useMemo(() => {
    const deltas = new Map<ID, number>();
    const placed: Array<{ x: number; y: number; w: number }> = [];
    const steps = [0, 1, 2, 3, 4, 5, 6].map(n => n * Math.max(16, 14 / zoom));
    for (const c of visibleCodes) {
      const pos = positions.get(c.id);
      if (!pos) continue;
      const w = truncated(c.name).length * screenLabelSize * 0.55;
      const baseY = pos.y + radiusFor(c.id, foldMode && c.parentId === null) + 14;
      let dy = 0;
      for (let attempt = 0; attempt < steps.length; attempt++) {
        dy = steps[attempt];
        const y = baseY + dy;
        const clash = placed.some(p => Math.abs(p.x - pos.x) < (p.w + w) / 2 + 6 && Math.abs(p.y - y) < screenLabelSize + 3);
        if (!clash) {
          placed.push({ x: pos.x, y, w });
          deltas.set(c.id, dy);
          break;
        }
      }
    }
    return deltas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCodes, positions, screenLabelSize, zoom, counts, rolledUpCounts, foldMode]);

  const COLOR_PALETTE = ['#0f172a', '#ef4444', '#f59e0b', '#22c55e', '#0ea5e9', '#a78bfa', '#ec4899'];

  const objects:MapObject[]=[...annotations.map((a,i)=>({key:'annotation:'+a.id,id:a.id,kind:'annotation' as const,shape:a.kind==='rect'||a.kind==='circle',group:a.groupId,layer:a.layer??i,box:{x:Math.min(a.x,a.x2??a.x),y:Math.min(a.y,a.y2??a.y),width:a.kind==='arrow'?Math.abs((a.x2??a.x)-a.x):a.width||250,height:a.kind==='arrow'?Math.abs((a.y2??a.y)-a.y):a.height||90}})),...visibleCodes.map((c,i)=>{const p=positions.get(c.id)||{x:0,y:0},r=radiusFor(c.id,false),w=c.mapAppearance?.width||180,h=c.mapAppearance?.height||80;return {key:'code:'+c.id,id:c.id,kind:'code' as const,anchor:p,shape:true,group:c.mapGroupId,layer:c.mapLayer??annotations.length+i,box:c.mapShape==='ellipse'?{x:p.x-w/2,y:p.y-h/2,width:w,height:h}:{x:p.x-Math.max(r,w/2),y:p.y-r,width:Math.max(r*2,w),height:r*2+2+h}};})];
  const selection=useMapSelection({items:objects,zoom,width:canvas.w,height:canvas.h,active,onApply:(keys,command)=>onObjectCommand?.(keys,command.type==='transform'?{...command,positions:Object.fromEntries(positions)}:command)});
  multiKeysRef.current=selection.keys;
  const annotationElements=annotations.map(saved => {
            const box=resizeLive?.kind==='annotation'&&resizeLive.id===saved.id?resizeLive:null;
            const a=box?{...saved,x:box.x,y:box.y,width:box.width,height:box.height}:saved;
            const selected = selectedAnnoId === a.id;
            const dash = a.lineStyle === 'dashed' ? '8 5' : a.lineStyle === 'dotted' ? '2 5' : undefined;
            const baseStroke = a.strokeWidth ?? (a.labelInside ? 3.5 : 2);
            const sw = selected ? Math.max(4,baseStroke) : baseStroke;
            // Apply the in-progress drag offset (if this is the annotation
            // currently being dragged) so it visually follows the pointer;
            // nothing persists until mouseup.
            const live = annoLiveOffset?.id === a.id ? annoLiveOffset : null;
            const attached=(id:string)=>{const node=annotations.find(n=>n.id===id);if(!node)return null;const resize=resizeLive?.id===id?resizeLive:null,offset=annoLiveOffset?.id===id?annoLiveOffset:null;return {...node,...offset,...resize,kind:node.kind};};
            const from=a.fromAnnotationId?attached(a.fromAnnotationId):null,to=a.toAnnotationId?attached(a.toAnnotationId):null;
            const center=(node:MapAnnotation)=>({x:node.x+(node.width||0)/2,y:node.y+(node.height||0)/2});
            const endpoint=(node:MapAnnotation,other:MapAnnotation)=>{const a=center(node),b=center(other);if(node.shapeType==='network-text')return a;if(node.kind==='circle')return ellipseEndpoint(a,b,node.width||100,node.height||100);const dx=b.x-a.x,dy=b.y-a.y,ratio=Math.max(Math.abs(dx)/((node.width||100)/2),Math.abs(dy)/((node.height||100)/2));return ratio>1?{x:a.x+dx/ratio,y:a.y+dy/ratio}:a;};
            const start=from&&to?endpoint(from,to):null,end=from&&to?endpoint(to,from):null;
            const liveLine=lineEdit.live?.key==='annotation:'+a.id?lineEdit.live:null;
            const ax = liveLine?.start.x ?? start?.x ?? live?.x ?? a.x;
            const ay = liveLine?.start.y ?? start?.y ?? live?.y ?? a.y;
            const ax2 = liveLine?.end.x ?? end?.x ?? live?.x2 ?? a.x2;
            const ay2 = liveLine?.end.y ?? end?.y ?? live?.y2 ?? a.y2;
            const curved=a.shapeType==='network-link-curved',midX=(ax+(ax2??ax))/2,midY=(ay+(ay2??ay))/2;
            const curveX=midX-((ay2??ay)-ay)*.16,curveY=midY+((ax2??ax)-ax)*.16;
            const arrowPath=curved?`M ${ax} ${ay} Q ${curveX} ${curveY} ${ax2??ax} ${ay2??ay}`:`M ${ax} ${ay} L ${ax2??ax} ${ay2??ay}`;
            const select = (ev: React.MouseEvent) => {
              ev.stopPropagation();
              if (annoMovedRef.current) { annoMovedRef.current = false; return; }
              setSelectedKey(null);
              setSelectedMapCodeId(null);
              setSelectedLegend(null);setSelectedAnnoId(a.id);
            };
            const startMove = (ev: React.MouseEvent) => {
              if (ev.button !== 0 || annotateMode) return;
              ev.stopPropagation();
              annoMovedRef.current = false;
              labelLiveOffsetRef.current = null;
              setAnnoDragMove({ id: a.id, startX: ev.clientX, startY: ev.clientY, orig: a });
            };
            return (
              <g
                key={"annotation:"+a.id} transform={selection.transformFor("annotation:"+a.id)} data-map-annotation={a.id} onDoubleClick={event=>{event.stopPropagation();setSelectedMapCodeId(null);setSelectedKey(null);setSelectedLegend(null);setSelectedAnnoId(a.id);beginInline('annotation',a.id);}}
                stroke={a.shapeType==='network-text'?'white':undefined} strokeWidth={a.shapeType==='network-text'?5:undefined} paintOrder="stroke"
                onMouseDown={event=>{if(a.kind==='arrow'){setSelectedAnnoId(a.id);setSelectedKey(null);setSelectedMapCodeId(null);lineEdit.begin(event,'annotation:'+a.id,{start:{x:ax,y:ay},end:{x:ax2??ax,y:ay2??ay}},'line');}else startMove(event);}}
                onClick={select}
                style={{ cursor: annoDragMove?.id === a.id ? 'grabbing' : 'grab' }}
              >
                {a.flow&&<title>{a.flow.sourceLabel+" → "+a.flow.targetLabel+": "+a.flow.value+" "+a.flow.unit}</title>}
                {a.coocPair&&!a.flow&&<title>{a.coocPair.codeIds.map(id=>codes.find(c=>c.id===id)?.name||id).join(' × ')+': '+a.coocPair.value+' '+(a.coocPair.unit==='documents'?'shared documents':'overlapping range pairs')}</title>}
                {a.imageData&&<image href={a.imageData} x={ax} y={ay} width={a.width} height={a.height} opacity={a.fillOpacity??1} preserveAspectRatio="none"/>}
                {a.kind === 'rect' && !a.polygonPoints && (
                  <rect
                    x={ax} y={ay} width={a.width || 0} height={a.height || 0} rx={a.cornerRadius?Math.min(a.width||0,a.height||0)*a.cornerRadius:undefined}
                    fill={a.fill || "none"} fillOpacity={a.fillOpacity} stroke={a.color} data-export-stroke-width={a.labelInside?3.5:2} strokeWidth={sw} strokeDasharray={dash}
                  />
                )}
                {a.kind==='rect'&&a.polygonPoints&&<polygon points={Array.from({length:a.polygonPoints.length/2},(_,i)=>`${ax+a.polygonPoints![i*2]*(a.width||0)},${ay+a.polygonPoints![i*2+1]*(a.height||0)}`).join(' ')} fill={a.gradientTo?`url(#map-gradient-${a.id.replace(/[^a-zA-Z0-9_-]/g,'-')})`:a.fill||'none'} fillOpacity={a.fillOpacity} stroke={a.color} data-export-stroke-width={a.labelInside?3.5:2} strokeWidth={sw} strokeDasharray={dash}/>}
                {a.kind === 'circle' && (
                  <>
                  {a.shapeType==='network-ball'&&<defs><radialGradient id={ballPrefix+'-'+a.id.replace(/[^a-zA-Z0-9_-]/g,'-')} cx="32%" cy="25%" r="75%"><stop offset="0%" stopColor="#ffffff"/><stop offset="32%" stopColor={a.fill||a.color}/><stop offset="100%" stopColor={a.color}/></radialGradient></defs>}
                  <ellipse
                    cx={ax + (a.width || 0) / 2} cy={ay + (a.height || 0) / 2}
                    rx={(a.width || 0) / 2} ry={(a.height || 0) / 2}
                    fill={a.shapeType==='network-ball'?`url(#${ballPrefix}-${a.id.replace(/[^a-zA-Z0-9_-]/g,'-')})`:a.fill||'none'} fillOpacity={a.fillOpacity} stroke={a.color} data-export-stroke-width={baseStroke} strokeWidth={sw} strokeDasharray={dash}
                  />
                  </>
                )}
                {a.kind === 'arrow' && (
                  <>
                  {<path d={arrowPath} fill="none" stroke="transparent" strokeWidth={Math.max(12/zoom,sw)} pointerEvents="stroke"/>}
                  <path
                    d={arrowPath}
                    fill={a.kind==='arrow'?'none':a.fill||'none'} stroke={a.color} opacity={a.fillOpacity??1} data-export-stroke-width={baseStroke} strokeWidth={sw} strokeDasharray={dash}
                    markerEnd={a.arrowHead===false?undefined:'url(#arrow-end)'}
                  />
                  </>
                )}
                {a.kind==='text'&&<>{!a.id.startsWith('suggested:cloud:word:')&&<rect data-map-hit-target x={ax} y={ay} width={a.width||250} height={a.height||70} fill="transparent" pointerEvents="all"/>}{(a.fill||((a.flowNodeLabel||a.shapeType==='cooc-value')&&a.flowLabelPlacement!=='inside'))&&<rect data-map-label-background x={ax-5} y={ay-3} width={(a.width||250)+10} height={(a.height||70)+6} fill={a.fill||'white'} fillOpacity={a.fillOpacity??(a.fill?1:.88)} pointerEvents="all"/>}
                  {(selected||!a.text)&&<rect x={ax-4} y={a.width?ay-4:ay-(a.fontSize||14)} width={a.width||250} height={a.height||60} fill="transparent" stroke={selected?'#2563eb':'#94a3b8'} strokeDasharray="5 3" data-map-edit-outline/>}
                  {(a.flowNodeLabel||a.shapeType==='network-text'||a.shapeType==='cooc-value')?<MapLabel text={a.text||''} x={ax+(a.width||360)/2} y={ay+(a.height||70)/2} width={Math.abs(Math.sin((a.rotation||0)*Math.PI/180))>.7?(a.height||70):(a.width||360)} height={Math.abs(Math.sin((a.rotation||0)*Math.PI/180))>.7?(a.width||360):(a.height||70)} fontSize={a.fontSize||24} color={a.textColor||a.color} fontFamily={a.fontFamily} bold={a.bold!==false} italic={a.italic} underline={a.underline} rotation={a.rotation} writingMode={a.writingMode} textDirection={a.textDirection}/>: (()=>{const fitted=fitMapText(a.text||'',Math.max(20,(a.width||250)-8),Math.max(20,(a.height||90)-8),a.fontSize||14,a.fontFamily,a.bold!==false,a.italic);const chordLabel=a.shapeType?.startsWith('chord-label-'),textX=a.shapeType==='chord-label-left'?ax+(a.width||250):ax,textY=chordLabel?ay+(a.height||90)/2-(fitted.lines.length-1)*fitted.fontSize*.58:undefined;return <text textAnchor={a.shapeType==='chord-label-left'?'end':undefined} dominantBaseline={chordLabel?'middle':undefined} transform={a.rotation?`rotate(${a.rotation} ${ax+(a.width||250)/2} ${ay+(a.height||90)/2})`:undefined} style={{writingMode:a.writingMode,direction:a.textDirection,unicodeBidi:'plaintext'}} x={textX} y={textY??(a.width?ay+fitted.fontSize:ay)} fontFamily={a.fontFamily} fontSize={fitted.fontSize} fontWeight={a.bold===false?400:600} fontStyle={a.italic?'italic':undefined} textDecoration={a.underline?'underline':undefined} fill={a.textColor||a.color}>{fitted.lines.map((line,i)=><tspan key={i} x={textX} dy={i?fitted.fontSize*1.16:0}>{line}</tspan>)}</text>;})()}
                </>}
                {a.text && a.labelInside && <MapLabel text={a.text} x={ax+(a.width||0)/2} y={ay+(a.height||0)*(a.polygonPoints?.length===6&&a.polygonPoints[0]===.5?.72:.5)} fontSize={a.fontSize||20} max={21} width={(a.width||250)*(a.polygonPoints?.[0]===.5?.5:.78)} height={(a.height||120)*(a.polygonPoints?.length===6&&a.polygonPoints[0]===.5?.35:.72)} color={a.textColor||a.color} fontFamily={a.fontFamily} bold={a.bold!==false} italic={a.italic} underline={a.underline} rotation={a.rotation} writingMode={a.writingMode} textDirection={a.textDirection}/>}
                {a.text && !a.labelInside && a.kind !== 'text' && (
                  <text
                    x={a.kind === 'arrow' ? curved?(midX+curveX)/2:midX : ax + (a.width || 0) / 2}
                    y={a.kind === 'arrow' ? (curved?(midY+curveY)/2:midY) - 6 : ay - 6}
                    stroke={a.coocPair?'#ffffff':undefined} strokeWidth={a.coocPair?5:undefined} paintOrder="stroke"
                    transform={a.rotation?`rotate(${a.rotation} ${ax+(a.width||0)/2} ${ay-6})`:undefined} style={{writingMode:a.writingMode,direction:a.textDirection,unicodeBidi:'plaintext'}} textAnchor="middle" fontSize={a.fontSize||14} fontFamily={a.fontFamily} fontWeight={a.bold===false?400:600} fontStyle={a.italic?'italic':undefined} textDecoration={a.underline?'underline':undefined} fill={a.textColor||a.color}
                  >
                    {a.text}
                  </text>
                )}
              </g>
            );
          });
  const codeElements=visibleCodes.map(c => {
            const sourcePosition = positions.get(c.id);
            if (!sourcePosition) return null;
            const liveBox=resizeLive?.kind==='code'&&resizeLive.id===c.id?resizeLive:null;
            const pos=liveBox?{x:liveBox.x+liveBox.width/2,y:c.mapShape==='ellipse'?liveBox.y+liveBox.height/2:liveBox.y-radiusFor(c.id,false)-2}:sourcePosition;
            const r = radiusFor(c.id, foldMode && c.parentId === null);
            const isDragging = drag?.id === c.id;
            const isSelectedNode = selectedMapCodeId === c.id;
            const shape = c.mapShape || 'circle';
            const appearance = liveBox?{...(c.mapAppearance||{fill:c.color,stroke:c.color,fontSize:16}),width:liveBox.width,height:liveBox.height}:c.mapAppearance;
            const nodeFill = appearance?.fill || c.color;
            const isDrawSource = drawSource === c.id;
            // Fold badges: folded nodes show their subtree's structure AND activity
            // ("+12 subcodes · 47 coded"), expanded ones show what's on screen
            // ("− 12 total · 5 shown"). The badge caption doubles as the
            // expand/collapse affordance (distinct from selection + drag);
            // clicking the folded node itself toggles too.
            const totalDesc = foldMode ? (descendantsCache.get(c.id) || 0) : 0;
            const rolledUp = foldMode ? (rolledUpCounts.get(c.id) || 0) : 0;
            const shownKids = visibleChildCount.get(c.id) || 0;
            const isExpanded = foldMode && expandedRoots.has(c.id);
            const badgeOn = foldMode && ((totalDesc > 0 && !isExpanded) || (isExpanded && shownKids > 0));
            return (
              <g
                key={"code:"+c.id} transform={selection.transformFor("code:"+c.id)} data-map-code={c.id} onDoubleClick={event=>{event.stopPropagation();beginInline('code',c.id);}}
                onMouseDown={e => handleNodeMouseDown(e, c)}
                onClick={e => handleNodeClick(e, c)}
                onContextMenu={e => cycleShape(e, c)}
                style={{ cursor: 'grab' }}
              >
                <title>{c.name}</title>
                {shape === 'ellipse' && <ellipse cx={pos.x} cy={pos.y} rx={(appearance?.width||180)/2} ry={(appearance?.height||80)/2} fill={nodeFill} data-export-stroke={appearance?.stroke||c.color} data-export-stroke-width={2.5} stroke={isSelectedNode?'#2563eb':appearance?.stroke||c.color} strokeWidth={isSelectedNode?4:2.5}/>}
                {shape === 'circle' && (
                  <circle
                    cx={pos.x} cy={pos.y} r={r}
                    fill={nodeFill}
                    data-export-stroke={appearance?.stroke||'rgba(15,23,42,0.25)'} data-export-stroke-width={1.5} stroke={isDragging || isDrawSource ? '#0f172a' : isSelectedNode ? '#3b82f6' : appearance?.stroke || 'rgba(15,23,42,0.25)'}
                    strokeWidth={(isDragging || isDrawSource || isSelectedNode) ? 3 : 1.5}
                  />
                )}
                {shape === 'square' && (
                  <rect
                    x={pos.x - r} y={pos.y - r} width={r * 2} height={r * 2}
                    rx={3}
                    fill={nodeFill}
                    data-export-stroke={appearance?.stroke||'rgba(15,23,42,0.25)'} data-export-stroke-width={1.5} stroke={isDragging || isDrawSource ? '#0f172a' : isSelectedNode ? '#3b82f6' : appearance?.stroke || 'rgba(15,23,42,0.25)'}
                    strokeWidth={(isDragging || isDrawSource || isSelectedNode) ? 3 : 1.5}
                  />
                )}
                {shape === 'diamond' && (
                  <polygon
                    points={`${pos.x},${pos.y - r} ${pos.x + r},${pos.y} ${pos.x},${pos.y + r} ${pos.x - r},${pos.y}`}
                    fill={nodeFill}
                    data-export-stroke={appearance?.stroke||'rgba(15,23,42,0.25)'} data-export-stroke-width={1.5} stroke={isDragging || isDrawSource ? '#0f172a' : isSelectedNode ? '#3b82f6' : appearance?.stroke || 'rgba(15,23,42,0.25)'}
                    strokeWidth={(isDragging || isDrawSource || isSelectedNode) ? 3 : 1.5}
                  />
                )}
                {isDrawSource && (
                  <circle data-map-edit-outline cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" />
                )}
                {shape === 'ellipse' ? <MapLabel text={c.mapLabel??c.name} x={pos.x} y={pos.y} fontSize={appearance?.fontSize||16} max={Math.max(4,Math.floor(((appearance?.width||180)-20)/((appearance?.fontSize||16)*.56)))} color={appearance?.textColor} fontFamily={appearance?.fontFamily||undefined} bold={appearance?.bold!==false} italic={appearance?.italic} underline={appearance?.underline} rotation={appearance?.rotation} writingMode={appearance?.writingMode} textDirection={appearance?.textDirection} width={(appearance?.width||180)*.78} height={(appearance?.height||80)*.72}/> : <MapLabel text={c.mapLabel??truncated(c.name)} x={pos.x} y={pos.y+r+2+(appearance?.height||60)/2} fontSize={appearance?.fontSize||12} width={appearance?.width||180} height={appearance?.height||60} color={appearance?.textColor||'#0f172a'} fontFamily={appearance?.fontFamily} bold={appearance?.bold!==false} italic={appearance?.italic} underline={appearance?.underline} rotation={appearance?.rotation} writingMode={appearance?.writingMode} textDirection={appearance?.textDirection}/>}
                {badgeOn && (
                  <g
                    transform={`translate(${pos.x}, ${pos.y + r + 14 + (labelDeltas.get(c.id) || 0) + 14})`}
                    onMouseDown={e => e.stopPropagation()}
                    onContextMenu={e => e.stopPropagation()}
                    onClick={e => toggleExpand(c.id, e)}
                    style={{ cursor: 'pointer' }}
                  >
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      data-export-font-size="9"
                      fontSize={Math.max(9, 10 / zoom)}
                      fontWeight={600}
                      fill={isExpanded ? '#475569' : '#0f172a'}
                      stroke="#f8fafc"
                      strokeWidth={2.5}
                      paintOrder="stroke"
                      pointerEvents="none"
                    >
                      {isExpanded
                        ? `− ${totalDesc} total · ${shownKids} shown`
                        : `+${totalDesc} subcodes · ${rolledUp} coded`}
                    </text>
                  </g>
                )}
                <title>{c.name}{counts.get(c.id) ? ` (${counts.get(c.id)} coded)` : ''}</title>
              </g>
            );
          });
  const objectOrder=new Map(objects.map(o=>[o.key,o.layer]));
  const objectElements=[...annotationElements,...codeElements].filter(Boolean).sort((a,b)=>(objectOrder.get(String(a!.key))||0)-(objectOrder.get(String(b!.key))||0));
  return (
    <div className={'visualization-editor'+(inspectorOpen?'':' inspector-collapsed')} style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      height: '100%',
      ...(isFullscreen ? {
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--bg)',
        padding: '12px',
        boxSizing: 'border-box'
      } : { position: 'relative' })
    }}>
      {designOpen&&onApplySuggestion&&<MapSuggestions projectId={projectId} name={annotations.find(a=>a.id===mapDesign?.hubId)?.text||projectName||'Research themes'} codes={codes} segments={codedSegments} initialDesign={mapDesign} onApply={s=>onApplySuggestion({...s,design:{...s.design,family:'code-map'}})} onClose={()=>setDesignOpen(false)}/>}
      <div className="map-toolbar" aria-label="Visualization tools">
        <div className="map-header-actions"><strong className="map-title">{visualizationTypes.find(t=>t.id===mapDesign?.family)?.name||'Code map'}</strong><button className="mini-btn" title="All visualization types" aria-label="All visualization types" onClick={onLibrary}>▦</button><button className="mini-btn" title="Edit visualization settings" aria-label={'Edit '+(visualizationTypes.find(t=>t.id===mapDesign?.family)?.name||'Code map')+' settings'} onClick={()=>mapDesign?.family&&mapDesign.family!=='code-map'?onConfigure?.():setDesignOpen(true)} disabled={!onApplySuggestion}>⚙</button>
        </div><aside className="map-tools-rail" aria-label="Drawing tools"><ToolMenu label="Colours"><MapPaletteGallery custom={customMapPalettes} selected={mapDesign?.paletteId} inverted={mapDesign?.paletteInverted} onApply={onApplyPalette} onSave={onSavePalette}/></ToolMenu><button className="mini-btn map-text-tool" title="Text formatting" aria-pressed={textEditorOpen&&inspectorOpen} onClick={()=>{const open=!textEditorOpen||!inspectorOpen;setTextEditorOpen(open);if(open)setInspectorOpen(true);}}><span aria-hidden="true">T</span>Text</button><ToolMenu label="Canvas">
        <select
          value={customMode ? 'custom' : String(presetIdx)}
          onChange={e => selectCanvasPreset(e.target.value)}
          style={{ fontSize: '12px', padding: '2px 4px' }}
          title="Canvas size — the fixed drawing area of the map"
        >
          {CANVAS_PRESETS.map((p, i) => (
            <option key={p.label} value={i}>{p.label}</option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {customMode && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            W
            <input
              type="number"
              min={CANVAS_MIN}
              max={CANVAS_MAX}
              value={customW}
              onChange={e => {
                const v = Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, Number(e.target.value) || CANVAS_MIN));
                setCustomW(v);
                rescalePositionsFor(v, customH);
              }}
              style={{ width: '64px', fontSize: '12px', padding: '2px 4px' }}
            />
            × H
            <input
              type="number"
              min={CANVAS_MIN}
              max={CANVAS_MAX}
              value={customH}
              onChange={e => {
                const v = Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, Number(e.target.value) || CANVAS_MIN));
                setCustomH(v);
                rescalePositionsFor(customW, v);
              }}
              style={{ width: '64px', fontSize: '12px', padding: '2px 4px' }}
            />
          </span>
        )}
        <button
          className="mini-btn"
          onClick={rotateCanvas}
          title="Rotate the canvas 90° — swaps width and height and rescales all placed nodes"
        >
          {canvas.w > canvas.h ? '⬜ Landscape' : '▯ Portrait'}
        </button>
        </ToolMenu><ToolMenu label="Arrange">{selection.toolbar}</ToolMenu><ToolMenu label="Draw"><strong>Shapes</strong><DrawingShapes selected={annotateShape} onSelect={shape=>{setAnnotateShape(shape.id);setAnnotateMode(true);setDrawMode(false);setSelectedKey(null);setSelectedAnnoId(null);}}/>{annotateMode&&<button onClick={()=>setAnnotateMode(false)}>Cancel shape drawing</button>}</ToolMenu><ToolMenu label="Legend"><button onClick={()=>setShowLegend(v=>!v)}>{showLegend?'Hide legend':'Show legend'}</button><label>Columns<select aria-label="Legend columns" value={legendSettings.columns||1} onChange={e=>setLegendSettings(v=>({...v,columns:Number(e.target.value)}))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label><button onClick={()=>setLegendSettings({})}>Reset legend</button><small>Double-click labels to edit. Drag the background to move; drag the corner to resize. Save a draft to keep your changes.</small>{[...legendEntries].sort((a,b)=>(legendSettings.order?.indexOf(a.key)??-1)-(legendSettings.order?.indexOf(b.key)??-1)).map((entry,i,rows)=><div key={entry.key} className="map-draft-row"><label><input type="checkbox" aria-label={'Show legend entry '+entry.label} checked={!legendSettings.hidden?.includes(entry.key)} onChange={e=>setLegendSettings(v=>({...v,hidden:e.target.checked?(v.hidden||[]).filter(k=>k!==entry.key):[...(v.hidden||[]),entry.key]}))}/>{legendSettings.labels?.[entry.key]??entry.label}</label>{[-1,1].map(d=><button key={d} aria-label={(d<0?'Move legend entry up ':'Move legend entry down ')+entry.label} disabled={i+d<0||i+d>=rows.length} onClick={()=>{const order=rows.map(r=>r.key);[order[i],order[i+d]]=[order[i+d],order[i]];setLegendSettings(v=>({...v,order}));}}>{d<0?'↑':'↓'}</button>)}</div>)}</ToolMenu><ToolMenu label="Drafts"><label>Draft name<input aria-label="Map draft name" value={draftName} onChange={e=>setDraftName(e.target.value)} placeholder="e.g. Findings — first draft"/></label><button disabled={!draftName.trim()||!onSaveDraft} onClick={()=>{onSaveDraft?.(draftName,{cloudStopDraft,width:canvas.w,height:canvas.h,viewMode,expandedRoots:Array.from(expandedRoots),childrenPerRoot,showCooc,minShared,showLegend,includeLegendInExport,legendPos,exportScale,publicationWidthMm,legend:legendSettings});setDraftMessage('Draft stored in this project.');}}>Save map draft</button>{draftMessage&&<small role="status">{draftMessage}</small>}<small>Using an existing name replaces that draft. Layouts store links to codes, not copies of transcripts.</small>{drafts?.map(d=><div className="map-draft-row" key={d.id}><span>{d.name}</span><button onClick={()=>{onRestoreDraft?.(d.id);setDraftName(d.name);setDraftMessage('Draft loaded.');}}>Load</button><button aria-label={'Delete map draft '+d.name} onClick={()=>onDeleteDraft?.(d.id)}>Delete</button></div>)}</ToolMenu><ToolMenu label="Export"><label>Image resolution<select aria-label="Map export resolution" value={exportScale} onChange={e=>setExportScale(Number(e.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={3.125}>High resolution (3.125×)</option></select></label><small>SVG retains vector text/shapes; PNG/JPEG use the selected pixel resolution.</small><label>Printed width (mm)<input aria-label="Figure print width" type="number" min={60} max={500} value={publicationWidthMm} onChange={e=>{const value=Number(e.target.value);if(value>=60&&value<=500){setPublicationWidthMm(value);setPrintCheck('');}}}/></label><button onClick={()=>{const sizes=Array.from(svgRef.current?.querySelectorAll('text')||[]).filter(el=>includeLegendInExport||!el.closest('[data-map-legend]')).map(el=>Number(el.getAttribute('data-export-font-size')||el.getAttribute('font-size'))).filter(n=>n>0),pt=sizes.length?Math.min(...sizes)*publicationWidthMm/canvas.w*72/25.4:0,scale=Math.min(exportScale,8192/Math.max(canvas.w,canvas.h),Math.sqrt(40000000/(canvas.w*canvas.h)));setPrintCheck((pt?'Smallest text ≈ '+pt.toFixed(1)+' pt. ':'No figure text. ')+Math.round(canvas.w*scale)+' × '+Math.round(canvas.h*scale)+' pixels; ≈ '+Math.round(canvas.w*scale/publicationWidthMm*25.4)+' dpi at this width. '+(pt&&pt<8?'For small text, reduce items, enlarge fonts or use a wider figure.':''));}}>Check print readability</button>{printCheck&&<small role="status">{printCheck}</small>}
        <label className="mini-label" style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Bake the legend into exported SVG / PNG / JPEG">
          <input
            type="checkbox"
            checked={includeLegendInExport}
            onChange={e => setIncludeLegendInExport(e.target.checked)}
          />
          Export legend
        </label>
        <button className="mini-btn" onClick={exportSvg}>⬇️ SVG</button>
        <button className="mini-btn" onClick={() => exportRaster('png')}>⬇️ PNG</button>
        <button className="mini-btn" onClick={() => exportRaster('jpeg')}>⬇️ JPEG</button>
        </ToolMenu>{hasCodeTools&&<div className="map-graph-tools" role="group" aria-label="Code node tools"><small>Code nodes</small>{isCodeMap&&<ToolMenu label="View"><label>Find a code<input aria-label="Find code on map" value={findCode} onChange={e=>setFindCode(e.target.value)}/></label>{findCode.trim()&&<div className="map-code-results">{codes.filter(c=>c.name.toLocaleLowerCase().includes(findCode.toLocaleLowerCase())).slice(0,20).map(c=><button key={c.id} onClick={()=>{if(hiddenIds.has(c.id))onUpdateHiddenMapCodes(hiddenMapCodeIds.filter(id=>id!==c.id));setViewMode('full');setSelectedLegend(null);setSelectedMapCodeId(c.id);setJumpCode(c.id);setFindCode('');}}>{c.name}</button>)}</div>}
        <select
          value={viewMode}
          onChange={e => handleViewModeChange(e.target.value as 'auto' | 'full' | 'custom')}
          style={{ fontSize: '12px', padding: '2px 4px' }}
          title="Which codes to show on the map"
        >
          <option value="auto">View: Auto</option>
          <option value="full">View: Show everything</option>
          <option value="custom">View: Custom (pick expanded roots)</option>
        </select>
        {foldMode && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="How many children of each expanded node to render (ranked by co-occurrence weight)">
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Children/root</span>
            {[3, 5, 10].map(n => (
              <button
                key={n}
                className="mini-btn"
                style={{ padding: '1px 5px', fontSize: '11px', ...(childrenPerRoot === n ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
                onClick={() => setChildrenPerRoot(n)}
              >
                {n}
              </button>
            ))}
            <button
              className="mini-btn"
              style={{ padding: '1px 5px', fontSize: '11px', ...(childrenPerRoot === 'all' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
              onClick={() => setChildrenPerRoot('all')}
            >
              All
            </button>
          </span>
        )}
        <button className="mini-btn" onClick={reAutoLayout} title="Re-run auto layout for the visible codes">↻ Re-layout</button>
        <label className="mini-label" style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="checkbox"
            checked={showCooc}
            onChange={e => setShowCooc(e.target.checked)}
          />
          {mapDesign&&mapDesign.mode!=='manual'?`Shared-document links (${edges.filter(e=>e.kind==='cooccurrence').length} of ${coocCount})`:`Co-occurrence (${coocCount})`}
        </label>
        {showCooc && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>min</span>
            {[1, 2, 3, 5, 8].map(n => (
              <button
                key={n}
                className="mini-btn"
                style={{ padding: '1px 5px', fontSize: '11px', ...(minShared === n ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
                onClick={() => setMinShared(n)}
                title={`Only draw co-occurrence edges sharing at least ${n} document${n === 1 ? '' : 's'}`}
              >
                {n}
              </button>
            ))}
          </span>
        )}
        </ToolMenu>}<ToolMenu label="Codes">
        {selectedMapCodeId && shownCodes.some(c => c.id === selectedMapCodeId) && (
          <button
            className="mini-btn"
            style={{ color: '#ef4444' }}
            onClick={() => {
              const name = shownCodes.find(c => c.id === selectedMapCodeId)?.name || '';
              onUpdateHiddenMapCodes([...hiddenMapCodeIds, selectedMapCodeId]);
              setSelectedMapCodeId(null);
              if (onShowToast) onShowToast(`Removed "${name}" from the canvas.`);
            }}
            title="Remove the selected node from the canvas (it stays in the codebook)"
          >
            ✕ Remove from map
          </button>
        )}
        <button
          className="mini-btn"
          style={showAddCodes ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
          onClick={() => {
            if (hiddenMapCodeIds.length === 0) {
              // Nothing to add — show a transient toast instead of opening a
              // panel that would otherwise stay on screen permanently.
              setShowAddCodes(false);
              if (onShowToast) onShowToast('All codes are on the canvas.', 2500);
              return;
            }
            setShowAddCodes(v => !v);
          }}
          title="Add codes that were removed from the canvas"
        >
          ➕ Add codes
        </button>
        </ToolMenu><ToolMenu label="Link">        <button
          className="mini-btn"
          style={drawMode ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
          onClick={() => { setSelectedKey(null); setDrawMode(m => !m); setDrawSource(null); }}
        >
          {drawMode ? 'Cancel draw' : 'Draw code connection'}
        </button>
{selectedEdge && (<>{(selectedEdge.style?.lineStart||selectedEdge.style?.lineEnd)&&<button onClick={()=>commitStyle(selectedEdge,{lineStart:undefined,lineEnd:undefined})}>Reset line position</button>}<label>Line colour<MapColorPicker label="Map relationship colour" value={selectedEdge.style?.color||derivedEdgeDefaults(selectedEdge).color||mapColors[selectedEdge.kind]} onChange={color=>commitStyle(selectedEdge,{color})}/></label>
        <div className="sort-row" style={{ gap: '8px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>
            {selectedEdge.kind === 'custom'
              ? 'Custom edge'
              : selectedEdge.kind === 'hierarchy' ? 'Hierarchy edge' : 'Co-occurrence edge'}
            {selectedEdge.style ? ' (styled)' : ' (default)'}
          </span>

          <select
            value={selectedEdge.style?.lineStyle || 'solid'}
            onChange={e => commitStyle(selectedEdge, { lineStyle: e.target.value as any })}
            style={{ fontSize: '12px', padding: '2px 4px' }}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>

          <select
            value={selectedEdge.style?.curve || derivedEdgeDefaults(selectedEdge).curve || 'straight'}
            onChange={e => commitStyle(selectedEdge, { curve: e.target.value as any })}
            style={{ fontSize: '12px', padding: '2px 4px' }}
          >
            <option value="straight">Straight</option>
            <option value="curved">Curved</option>
          </select>

          <select
            value={selectedEdge.style?.arrow || 'none'}
            onChange={e => commitStyle(selectedEdge, { arrow: e.target.value as any })}
            style={{ fontSize: '12px', padding: '2px 4px' }}
          >
            <option value="none">No arrow</option>
            <option value="end">Arrow at end</option>
            <option value="both">Arrows both ends</option>
          </select>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px' }}>Width</span>
            <input
              type="range"
              min={MIN_EDGE_W}
              max={MAX_EDGE_W}
              step={0.5}
              value={selectedEdge.style?.width ?? (selectedEdge.fromId===mapDesign?.hubId?4:selectedEdge.kind === 'cooccurrence' ? weightFor(`${selectedEdge.fromId}::${selectedEdge.toId}`) : selectedEdge.kind === 'custom' ? 2.5 : 2)}
              onChange={e => commitStyle(selectedEdge, { width: Number(e.target.value) })}
              style={{ width: '70px', verticalAlign: 'middle' }}
              title="Line width — set manually to override the automatic co-occurrence weight scale"
            />
            {selectedEdge.style?.width != null && (
              <button
                className="mini-btn"
                style={{ padding: '1px 5px', fontSize: '11px' }}
                onClick={() => commitStyle(selectedEdge, { width: undefined })}
                title="Back to automatic width"
              >
                Auto
              </button>
            )}
          </span>

          {selectedEdge.style && selectedEdge.kind === 'custom' && (
            <button
              className="mini-btn"
              onClick={() => { onDeleteEdgeStyle(selectedEdge.style!.id); setSelectedKey(null); }}
              style={{ color: '#ef4444' }}
            >
              🗑 Delete
            </button>
          )}
          {selectedEdge.style && selectedEdge.kind !== 'custom' && (
            <button
              className="mini-btn"
              onClick={() => { onDeleteEdgeStyle(selectedEdge.style!.id); }}
              title="Remove custom styling, back to default"
            >
              ↺ Reset style
            </button>
          )}
        </div></>
      )}{!selectedEdge&&<small>Select a relationship to change its line, arrow or colour.</small>}</ToolMenu><ToolMenu label="Node">
        {(()=>{const code=codes.find(c=>c.id===selectedMapCodeId);if(!code)return <p>Select a node to edit its style or open its research records.</p>;const appearance=code.mapAppearance||{fill:code.color,stroke:code.color,width:180,height:80,fontSize:16};return <><strong>{code.name}</strong><small>{counts.get(code.id)||0} directly coded passages</small>{onOpenCode&&<button onClick={()=>onOpenCode(code.id)}>Open code details</button>}{onOpenCodeMemo&&<button disabled={!code.summary.trim()} onClick={()=>onOpenCodeMemo(code.id)}>Open code memo</button>}<label>Node shape<select aria-label="Node shape" value={code.mapShape||'circle'} onChange={e=>onUpdateCode(code.id,{mapShape:e.target.value as Code['mapShape']})}>{SHAPES.map(shape=><option key={shape}>{shape}</option>)}</select></label><label>Map fill<MapColorPicker label="Map node fill" value={appearance.fill} onChange={fill=>onUpdateCode(code.id,{mapAppearance:{...appearance,fill}})}/></label><label>Map border<MapColorPicker label="Map node border" value={appearance.stroke} onChange={stroke=>onUpdateCode(code.id,{mapAppearance:{...appearance,stroke}})}/></label><button onClick={()=>onUpdateCode(code.id,{mapAppearance:undefined,mapShape:'circle'})}>Reset node style</button></>;})()}
        </ToolMenu></div>}</aside><div className="map-header-view"><button className="mini-btn" aria-label="Toggle inspector" title="Show/hide inspector" aria-pressed={inspectorOpen} onClick={()=>setInspectorOpen(v=>!v)}>☷</button><div className="map-zoom">
          <button title="Zoom out" aria-label="Zoom out" onClick={() => manualZoom(zoom - 0.1)}>−</button>
          <input aria-label="Map zoom" type="range" min={10} max={400} step={10} value={Math.max(10, Math.round(zoom * 100))} onChange={e => manualZoom(Number(e.target.value) / 100)} />
          <span>{Math.round(zoom * 100)}%</span>
          <button title="Zoom in" aria-label="Zoom in" onClick={() => manualZoom(zoom + 0.1)}>+</button>
          <button aria-pressed={fitToWindow} onClick={() => setFitToWindow(true)}>Fit</button>
          <button title="Reset to actual size" onClick={() => manualZoom(1)}>100%</button>
        </div>
        <button
          className="mini-btn"
          onClick={() => setIsFullscreen(v => !v)}
          title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Expand the whole map panel to fill the window'}
        >
          {isFullscreen ? '✕ Exit fullscreen' : '⛶ Fullscreen'}
        </button>
        <ToolMenu label="Notes"><button onClick={()=>setShowNotes(value=>!value)}>{showNotes?'Hide visualization notes':'Show visualization notes'}</button><button disabled={!onVisualizationNotes} onClick={()=>{onVisualizationNotes?.([...visualizationNotes,{id:uid('viznote'),title:'Visualization note',text:'',x:Math.min(80,canvas.w/4),y:Math.min(160,canvas.h/4),updatedAt:Date.now()}]);setShowNotes(true);}}>Add visualization note</button><small>Drag notes anywhere on this canvas. Notes are saved with the working visualization and named drafts, and listed in Memo-Book. They are excluded from figure images and the manuscript skeleton.</small></ToolMenu>
        <ToolMenu label="Help">
          <strong>{visualizationTypes.find(t=>t.id===mapDesign?.family)?.name||'Code map'} help</strong>
          {visualizationHelp[mapDesign?.family||'code-map'].map((text,index)=><p key={index}>{text}</p>)}
          <p>Double-click text or a number label to edit it. The Inspector controls text and label background colour/opacity. Select a line and drag it to move it, or drag either endpoint to change its length and direction. Use Link for relationship styles, Draw for shapes and text boxes, and Arrange for alignment and grouping. Manual edits change the figure, not calculated counts or source coding.</p>
          <p>Fit shows the whole canvas and follows window resizing. Zoom in for detail; canvas size and export resolution are independent of screen zoom.</p>
        </ToolMenu>
        {drawMode && <span className="map-mode">Drawing edge</span>}
        {annotateMode && <span className="map-mode">Drawing · {drawingShapes.find(s=>s.id===annotateShape)?.name}</span>}
      </div>
      </div>

      <aside className="map-inspector" aria-label="Text and appearance inspector" hidden={!inspectorOpen}><h3>Inspector</h3>{cloudSizing&&<p role="status">Refitting words…</p>}
      {mapDesign?.family==='heat-map'&&mapDesign.options&&onApplySuggestion&&<HeatmapDisplay data={{id:projectId,name:projectName||'Heat map',codes,docs,codedSegments}} options={mapDesign.options} palette={basePalette} inverted={mapDesign.paletteInverted} annotations={sourceAnnotations} onApply={onApplySuggestion}/>}


      <div className="map-format-strip">{textEditorOpen&&(()=>{const node=codes.find(c=>c.id===selectedMapCodeId);if(selectedLegend&&showLegend)return <MapTextEditor label={selectedLegend==='title'?'Legend title':'Legend entry'} style={{fontSize:14,...legendSettings,...legendSettings.styles?.[selectedLegend]}} onEdit={()=>setLegendEditRequest(n=>n+1)} onStyle={patch=>setLegendSettings(v=>selectedLegend==='title'?{...v,...patch}:{...v,styles:{...v.styles,[selectedLegend]:{...v.styles?.[selectedLegend],...patch}}})} onDelete={()=>{if(selectedLegend==='title')setShowLegend(false);else setLegendSettings(v=>({...v,hidden:[...(v.hidden||[]),selectedLegend]}));setSelectedLegend(null);}}/>;if(selectedAnno)return <MapTextEditor key={'annotation:'+selectedAnno.id} label="Annotation / topic text" text={selectedAnno.text||''} style={{...selectedAnno,fontSize:(cloudSizing?.id===selectedAnno.id?cloudSizing.size:selectedAnno.fontSize)||(selectedAnno.labelInside?20:14),textColor:selectedAnno.textColor||selectedAnno.color}} onEdit={()=>beginInline('annotation',selectedAnno.id)} onStyle={patch=>updateSelectedAnno(selectedAnno.kind==='text'&&patch.textColor?{...patch,color:patch.textColor}:patch)} onDelete={()=>{onUpdateAnnotations(annotations.filter(a=>a.id!==selectedAnno.id&&a.fromAnnotationId!==selectedAnno.id&&a.toAnnotationId!==selectedAnno.id));setSelectedAnnoId(null);}}/>;if(selectedEdge)return <MapTextEditor key={'edge:'+selectedEdge.key} label="Relationship label" text={selectedEdge.style?.label||''} style={{fontFamily:selectedEdge.style?.labelFontFamily,fontSize:selectedEdge.style?.labelFontSize||12,rotation:selectedEdge.style?.labelRotation,writingMode:selectedEdge.style?.labelWritingMode,textDirection:selectedEdge.style?.labelTextDirection,textColor:selectedEdge.style?.labelColor||'#334155',bold:selectedEdge.style?.labelBold,italic:selectedEdge.style?.labelItalic,underline:selectedEdge.style?.labelUnderline}} onEdit={()=>beginInline('edge',selectedEdge.key)} onStyle={patch=>commitStyle(selectedEdge,{...(patch.rotation!==undefined?{labelRotation:patch.rotation}:{}),...(patch.writingMode!==undefined?{labelWritingMode:patch.writingMode}:{}),...(patch.textDirection!==undefined?{labelTextDirection:patch.textDirection}:{}),...(patch.fontFamily!==undefined?{labelFontFamily:patch.fontFamily}:{}),...(patch.fontSize!==undefined?{labelFontSize:patch.fontSize}:{}),...(patch.textColor!==undefined?{labelColor:patch.textColor}:{}),...(patch.bold!==undefined?{labelBold:patch.bold}:{}),...(patch.italic!==undefined?{labelItalic:patch.italic}:{}),...(patch.underline!==undefined?{labelUnderline:patch.underline}:{})})}/>;if(node){const appearance=node.mapAppearance||{fill:node.color,stroke:node.color,width:180,height:80,fontSize:16};return <MapTextEditor key={'code:'+node.id} label={'Code label — '+node.name} text={node.mapLabel??node.name} style={appearance} onEdit={()=>beginInline('code',node.id)} onStyle={patch=>onUpdateCode(node.id,{mapAppearance:{...appearance,...patch}})} onRename={()=>beginInline('rename',node.id)}/>;}return <p className="map-text-hint">Double-click a label to edit it in place. Select an item for formatting.</p>;})()}
      </div>
      <div className="visualization-detail-strip">{selectedAnno?.flowNodeLabel&&<section aria-label="Sankey label placement"><strong>Node label placement</strong><label>Position<select aria-label="Sankey label position" value={selectedAnno.flowLabelPlacement||'free'} onChange={e=>updateSelectedAnno({flowLabelPlacement:e.target.value as MapAnnotation['flowLabelPlacement'],...(e.target.value==='inside'?{flowLabelDistance:2}:{})})}><option value="free">Free position</option><option value="inside">Inside bar</option><option value="outside-right">Outside right</option><option value="outside-left">Outside left</option><option value="above">Above bar</option><option value="below">Below bar</option></select></label><label>{selectedAnno.flowLabelPlacement==='inside'?'Inner padding':'Distance from boundary'}<input aria-label="Sankey label boundary distance" type="number" min={0} max={300} value={selectedAnno.flowLabelDistance??14} onChange={e=>updateSelectedAnno({flowLabelDistance:Math.max(0,Math.min(300,Number(e.target.value)||0))})}/></label><small>Anchored labels follow their bar. Text fits the available box; use Free position for manual placement.</small></section>}
      {selectedAnno&&selectedAnno.kind!=='text'&&<div className="visualization-source-links">{selectedAnno.kind!=='arrow'&&<MapColorPicker label="Shape fill" value={selectedAnno.fill||'#ffffff'} onChange={fill=>updateSelectedAnno({fill})}/>}<MapColorPicker label={selectedAnno.kind==='arrow'?'Line colour':'Shape border'} value={selectedAnno.color} onChange={color=>updateSelectedAnno({color})}/><label>Opacity <input aria-label="Shape opacity" type="range" min={.1} max={1} step={.05} value={selectedAnno.fillOpacity??1} onChange={e=>updateSelectedAnno({fillOpacity:Number(e.target.value)})}/></label></div>}
      {selectedAnno?.kind==='arrow'&&<section className="visualization-source-links" aria-label="Line appearance"><label>Line width <input aria-label="Graph line width" type="number" min={.5} max={30} step={.5} value={selectedAnno.strokeWidth??2} onChange={e=>updateSelectedAnno({strokeWidth:Math.max(.5,Math.min(30,Number(e.target.value)||2))})}/></label><label>Line style <select aria-label="Graph line style" value={selectedAnno.lineStyle} onChange={e=>updateSelectedAnno({lineStyle:e.target.value as MapAnnotation['lineStyle']})}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label><label>Curve <select aria-label="Graph line curve" value={selectedAnno.shapeType==='network-link-curved'?'curved':'straight'} onChange={e=>updateSelectedAnno({shapeType:e.target.value==='curved'?'network-link-curved':'line'})}><option value="straight">Straight</option><option value="curved">Curved</option></select></label><label><input type="checkbox" aria-label="Graph line arrowhead" checked={selectedAnno.arrowHead!==false} onChange={e=>updateSelectedAnno({arrowHead:e.target.checked})}/>Arrowhead</label><small>Drag the line to move it, or drag either endpoint to change its length and direction.</small></section>}
      {selectedAnno?.kind==='text'&&<section className="visualization-source-links" aria-label="Label background"><strong>Label background</strong><MapColorPicker label="Label background colour" value={selectedAnno.fill||'#ffffff'} onChange={fill=>updateSelectedAnno({fill,fillOpacity:selectedAnno.fillOpacity??((selectedAnno.flowNodeLabel||selectedAnno.shapeType==='cooc-value')?.88:1)})}/><label>Opacity <input aria-label="Label background opacity" type="range" min={0} max={1} step={.05} value={selectedAnno.fillOpacity??(selectedAnno.fill?1:(selectedAnno.flowNodeLabel||selectedAnno.shapeType==='cooc-value')?.88:0)} onChange={e=>updateSelectedAnno({fill:selectedAnno.fill||'#ffffff',fillOpacity:Number(e.target.value)})}/></label></section>}
      {selectedEdge&&<section className="visualization-source-links" aria-label="Relationship label background"><strong>Label background</strong><MapColorPicker label="Relationship label background colour" value={selectedEdge.style?.labelFill||'#ffffff'} onChange={labelFill=>commitStyle(selectedEdge,{labelFill})}/><label>Opacity <input aria-label="Relationship label background opacity" type="range" min={0} max={1} step={.05} value={selectedEdge.style?.labelFillOpacity??(selectedEdge.style?.labelFill?1:0)} onChange={e=>commitStyle(selectedEdge,{labelFill:selectedEdge.style?.labelFill||'#ffffff',labelFillOpacity:Number(e.target.value)})}/></label></section>}
      {selectedAnno?.coocPair&&<CooccurrenceEvidence annotation={selectedAnno} docs={docs} onOpenDocument={onOpenDocument}/>}
      {selectedAnno&&(selectedAnno.sourceDocIds?.length||selectedAnno.sourceCodeIds?.length)?<div className="visualization-source-links map-inspector-evidence"><strong>Sources:</strong>{selectedAnno.sourceDocIds?.map(id=>{const doc=docs.find(d=>d.id===id);return doc?<button key={id} onClick={()=>onOpenDocument?.(id)}>{doc.name}</button>:null;})}{selectedAnno.sourceCodeIds?.map(id=>{const code=codes.find(c=>c.id===id);return code?<button key={'code:'+id} onClick={()=>onOpenCode?.(id)}>{code.name}</button>:null;})}</div>:null}
      </div>
      {mapDesign?.family==='word-cloud'&&onApplySuggestion&&<CloudStopWords value={cloudStopDraft} onChange={setCloudStopDraft} options={mapDesign.options} data={{id:projectId,name:projectName||'Word cloud',codes,docs,codedSegments}} palette={basePalette} inverted={mapDesign.paletteInverted} annotations={sourceAnnotations} description={mapDesign.description} onApply={onApplySuggestion}/>}
      {mapDesign?.family&&<div className="visualization-snapshot">Editable snapshot · {visualizationTypes.find(t=>t.id===mapDesign.family)?.name} · Use ⚙ for this graph’s settings; ▦ for all types. Your working canvas is kept when you leave. Save a named draft to keep another version.</div>}
      </aside>
      {hasCodeTools && showAddCodes && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 12,
            zIndex: 20,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '8px',
            maxHeight: 260,
            overflowY: 'auto',
            minWidth: 220
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Add codes to canvas</div>
          {hiddenMapCodeIds.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>All codes are on the canvas.</div>
          )}
          {hiddenMapCodeIds.map(id => {
            const c = codes.find(x => x.id === id);
            if (!c) return null;
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '2px 0' }}>
                <span className="code-swatch" style={{ background: c.color, width: 10, height: 10, borderRadius: 2, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>{c.name}</span>
                <button
                  className="mini-btn"
                  style={{ fontSize: 10, padding: '1px 5px' }}
                  onClick={() => {
                    onUpdateHiddenMapCodes(hiddenMapCodeIds.filter(x => x !== id));
                    if (onShowToast) onShowToast(`Added "${c.name}" to the canvas.`);
                  }}
                >
                  Add
                </button>
              </div>
            );
          })}
        </div>
      )}

      {drawMode && (
        <div className="section-hint" style={{ marginBottom: 6 }}>
          {drawSource
            ? <>Click a <strong>second</strong> node to connect it to <strong>{shownCodes.find(c => c.id === drawSource)?.name || '…'}</strong>.</>
            : <>Click the <strong>source</strong> node to start a custom edge.</>}
        </div>
      )}

      <div className="map-canvas-frame" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div ref={viewportRef} className="map-viewport">
        <div className="map-stage" style={{width:canvas.w*zoom+40,height:canvas.h*zoom+40}}>
        <svg
          ref={svgRef}
          onMouseDownCapture={selection.capture} onClickCapture={selection.onClickCapture}
          viewBox={`0 0 ${canvas.w} ${canvas.h}`}
          width={canvas.w * zoom}
          height={canvas.h * zoom}
          style={{
            display: 'block',
            backgroundColor: mapDesign&&mapDesign.mode!=='manual'?'#fffcf6':'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            cursor: annotateMode ? 'crosshair' : (drag ? 'grabbing' : 'grab')
          }}
          onMouseDown={e => {
            annoClickGuardRef.current = false;
            if (!annotateMode || e.button !== 0) return;
            // Only start drawing on the bare canvas — never over a node,
            // edge, or annotation (those stopPropagation or differ in target).
            if (e.target !== e.currentTarget) return;
            annoClickGuardRef.current = true;
            const pt = toViewBox(e);
            setAnnoDrag({ x0: pt.x, y0: pt.y, shape: annotateShape });
            const start = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
            annoPreviewRef.current = start;
            setAnnoPreview(start);
          }}
          onClick={() => {
            setSelectedLegend(null);setSelectedKey(null);
            setSelectedMapCodeId(null);
            setDrawMode(false);
            setDrawSource(null);
            if (!annoClickGuardRef.current) setSelectedAnnoId(null);
            annoClickGuardRef.current = false;
          }}
        >
          <rect data-map-paper width={canvas.w} height={canvas.h} fill={mapDesign&&mapDesign.mode!=='manual'?'#fffcf6':'#ffffff'} pointerEvents="none"/>
          <defs>{annotations.filter(a=>a.gradientTo).map(a=><linearGradient key={a.id} id={'map-gradient-'+a.id.replace(/[^a-zA-Z0-9_-]/g,'-')}><stop offset="0%" stopColor={a.fill}/><stop offset="100%" stopColor={a.gradientTo}/></linearGradient>)}
            {mapDesign?.hubId&&(()=>{const hub=annotations.find(a=>a.id===mapDesign.hubId);if(!hub)return null;const live=annoLiveOffset?.id===hub.id?annoLiveOffset:null;return <mask id="map-topic-mask"><rect width={canvas.w} height={canvas.h} fill="white"/><ellipse cx={(live?.x??hub.x)+(hub.width||0)/2} cy={(live?.y??hub.y)+(hub.height||0)/2} rx={(hub.width||0)/2+3} ry={(hub.height||0)/2+3} fill="black"/></mask>;})()}
            <marker id="arrow-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
            </marker>
            <marker id="arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 10 0 L 0 5 L 10 10 z" fill="context-stroke" />
            </marker>
          </defs>

          {/* Annotations — free-standing shapes, drawn below edges and nodes
              in z-order so they read as marks on the paper, not competing
              code nodes. */}
          {annoPreview&&(()=>{const shape=drawingShapes.find(s=>s.id===annoDrag?.shape)||drawingShapes[0],a=drawingAnnotation(shape,annoPreview,'preview',mapColors.custom);return <g pointerEvents="none" opacity={.6}>{a.kind==='arrow'?<path d={`M ${a.x} ${a.y} L ${a.x2} ${a.y2}`} fill="none" stroke={a.color} strokeWidth={2} markerEnd={a.arrowHead?'url(#arrow-end)':undefined}/>:a.kind==='circle'?<ellipse cx={a.x+(a.width||0)/2} cy={a.y+(a.height||0)/2} rx={(a.width||0)/2} ry={(a.height||0)/2} fill={a.fill} stroke={a.color}/>:a.polygonPoints?<polygon points={Array.from({length:a.polygonPoints.length/2},(_,i)=>`${a.x+a.polygonPoints![i*2]*(a.width||0)},${a.y+a.polygonPoints![i*2+1]*(a.height||0)}`).join(' ')} fill={a.fill} stroke={a.color}/>:<rect x={a.x} y={a.y} width={a.width} height={a.height} rx={a.cornerRadius?Math.min(a.width||0,a.height||0)*a.cornerRadius:undefined} fill={a.fill||'none'} stroke={a.color}/>}</g>;})()}


          {/* Edges */}
          {edges.map(e => {
            const endpoints=edgeEndpoints(e);if(!endpoints)return null;const a=endpoints.start,b=endpoints.end;
            const liveEdge=resizeLive?.kind==='edge'&&resizeLive.id===e.key?resizeLive:null;
            const style=liveEdge?{...e.style,labelWidth:liveEdge.width,labelHeight:liveEdge.height,labelDx:liveEdge.x+liveEdge.width/2-(a.x+b.x)/2,labelDy:liveEdge.y+liveEdge.height/2-((a.y+b.y)/2-6)}:e.style;
            const isSelected = selectedKey === e.key;
            const color = style?.color || (e.fromId===mapDesign?.hubId?(codes.find(c=>c.id===e.toId)?.mapAppearance?.stroke||codes.find(c=>c.id===e.toId)?.color):undefined) || mapColors[e.kind];
            const d = edgePath(a, b, (style?.curve || (e.fromId===mapDesign?.hubId?'curved':'straight')) === 'curved');
            const dash =
              (style?.lineStyle || 'solid') === 'dashed' ? '8 5'
                : (style?.lineStyle || 'solid') === 'dotted' ? '2 5' : undefined;
            const markerEnd = style?.arrow === 'end' || style?.arrow === 'both' ? 'url(#arrow-end)' : undefined;
            const markerStart = style?.arrow === 'both' ? 'url(#arrow-start)' : undefined;
            // Continuous weight scale for co-occurrence edges; a manual width
            // set in the edge panel overrides it, and weak ties render more
            // transparent so strong relationships stand out.
            const pairKey = `${e.fromId}::${e.toId}`;
            const isCooc = e.kind === 'cooccurrence';
            const width = style?.width != null
              ? style.width
              : e.fromId===mapDesign?.hubId?4:isCooc ? weightFor(pairKey) : e.kind === 'custom' ? 2.5 : 2;
            const opacity = isSelected ? 1 : (isCooc && style?.width == null ? opacityFor(pairKey) : 0.9);
            // While a label drag is in flight the live local offset wins over the
            // persisted one, so the label tracks the pointer without writing.
            const liveLabel = labelLiveOffset?.key === e.key ? labelLiveOffset : null;
            const labelPos = {
              x: (a.x + b.x) / 2 + (liveLabel ? liveLabel.dx : (style?.labelDx || 0)),
              y: (a.y + b.y) / 2 - 6 + (liveLabel ? liveLabel.dy : (style?.labelDy || 0))
            };
            return (
              <g key={e.key} onDoubleClick={event=>{event.stopPropagation();setSelectedLegend(null);setSelectedKey(e.key);beginInline('edge',e.key);}} data-map-edge={e.key} data-topic-link={e.fromId===mapDesign?.hubId?e.toId:undefined} mask={e.kind==='cooccurrence'&&annotations.some(a=>a.id===mapDesign?.hubId)?'url(#map-topic-mask)':undefined}>
                {isCooc && (
                  <title>{(sharedDocs.get(pairKey) || 1)} shared document{(sharedDocs.get(pairKey) || 1) === 1 ? '' : 's'}</title>
                )}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12/zoom}
                  pointerEvents="stroke"
                  style={{ cursor: 'move' }}
                  onMouseDown={event=>{setSelectedKey(e.key);setSelectedAnnoId(null);setSelectedMapCodeId(null);lineEdit.begin(event,e.key,endpoints,'line');}}
                  onClick={ev => { ev.stopPropagation(); setSelectedLegend(null);setSelectedKey(e.key); setSelectedAnnoId(null); }}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  data-export-stroke-width={width} data-export-opacity={isCooc && style?.width==null?opacityFor(pairKey):.9} strokeWidth={isSelected ? width + 2 : width}
                  strokeDasharray={dash}
                  markerEnd={markerEnd}
                  markerStart={markerStart}
                  pointerEvents="none"
                  opacity={opacity}
                />
                {style?.label && (
                  <g style={{cursor:'move'}} onMouseDown={ev => {
                      if (ev.button !== 0) return;
                      ev.stopPropagation();
                      labelLiveOffsetRef.current = null;
                      setLabelDragMove({
                        key: e.key, edge: e,
                        startX: ev.clientX, startY: ev.clientY,
                        origDx: style?.labelDx || 0, origDy: style?.labelDy || 0
                      });
                    }}>{style.labelFill&&<rect x={labelPos.x-(style.labelWidth||250)/2} y={labelPos.y-(style.labelHeight||70)/2} width={style.labelWidth||250} height={style.labelHeight||70} fill={style.labelFill} fillOpacity={style.labelFillOpacity??1}/>}<MapLabel text={style.label} x={labelPos.x} y={labelPos.y} fontSize={style.labelFontSize||12} width={style.labelWidth||250} height={style.labelHeight||70} color={style.labelColor||'#334155'} fontFamily={style.labelFontFamily} bold={style.labelBold!==false} italic={style.labelItalic} underline={style.labelUnderline} rotation={style.labelRotation} writingMode={style.labelWritingMode} textDirection={style.labelTextDirection}/></g>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {objectElements}
          {showLegend&&<MapLegend entries={legendEntries} settings={legendSettings} position={legendPos} zoom={zoom} selected={selectedLegend} editRequest={legendEditRequest} onSelect={key=>{setSelectedLegend(key);setSelectedAnnoId(null);setSelectedKey(null);setSelectedMapCodeId(null);setTextEditorOpen(true);}} onSettings={setLegendSettings} onPosition={setLegendPos}/> }
          {showNotes&&onVisualizationNotes&&<VisualizationNotes notes={visualizationNotes} onChange={onVisualizationNotes} width={canvas.w} height={canvas.h}/>}
          {selection.overlay}
          {selection.keys.length<2&&!inlineEdit&&(selectedAnno?.kind==='arrow'?lineHandles('annotation:'+selectedAnno.id,annotationEndpoints(selectedAnno)):selectedEdge?lineHandles(selectedEdge.key,edgeEndpoints(selectedEdge)!):null)}
          {selection.keys.length<2&&selectedAnno?.kind!=='arrow'&&(!selectedEdge||!!selectedEdge.style?.label)&&!inlineEdit&&(()=>{const kind=selectedAnno?'annotation':selectedEdge?'edge':selectedMapCodeId?'code':null,id=selectedAnno?.id||selectedEdge?.key||selectedMapCodeId;if(!kind||!id)return null;const box=resizeLive?.id===id?resizeLive:textBox(kind,id);if(!box)return null;const size=8/zoom;return <g data-map-edit-outline><rect x={box.x} y={box.y} width={box.width} height={box.height} fill="none" stroke="#2563eb" strokeWidth={1/zoom} strokeDasharray={4/zoom+' '+3/zoom} pointerEvents="none"/>{[['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5]].map(([handle,px,py])=><rect key={handle} data-map-resize={handle} x={box.x+Number(px)*box.width-size/2} y={box.y+Number(py)*box.height-size/2} width={size} height={size} fill="white" stroke="#2563eb" strokeWidth={1/zoom} style={{cursor:handle+'-resize'}} onMouseDown={event=>{event.preventDefault();event.stopPropagation();resizeLiveRef.current=null;setResizeDrag({kind,id,handle:String(handle),startX:event.clientX,startY:event.clientY,box});}} onClick={event=>event.stopPropagation()}/>)}</g>;})()}
          {inlineEdit&&(()=>{
            const code=codes.find(c=>c.id===inlineEdit.id),anno=annotations.find(a=>a.id===inlineEdit.id),edge=edges.find(e=>e.key===inlineEdit.id);
            let x=0,y=0,width=250,height=90,style:React.CSSProperties={},align:'left'|'center'='left';
            if(inlineEdit.kind==='code'||inlineEdit.kind==='rename'){if(!code)return null;const pos=positions.get(code.id);if(!pos)return null;const a=code.mapAppearance;const ellipse=code.mapShape==='ellipse';width=a?.width||200;height=ellipse?a?.height||90:80;x=pos.x-width/2;y=ellipse?pos.y-height/2:pos.y+radiusFor(code.id,false)+2;align='center';style={fontFamily:a?.fontFamily,fontSize:a?.fontSize||16,color:a?.textColor||'#253047',fontWeight:a?.bold===false?400:600,fontStyle:a?.italic?'italic':undefined,textDecoration:a?.underline?'underline':undefined};}
            else if(inlineEdit.kind==='annotation'){if(!anno)return null;const inside=anno.labelInside;const font=anno.fontSize||(inside?20:14);width=anno.width||250;height=anno.height||90;x=anno.x;y=anno.width?anno.y:anno.y-font;if(inside)align='center';else if(anno.kind!=='text'){align='center';y=anno.kind==='arrow'?(anno.y+(anno.y2??anno.y))/2-6-height/2:anno.y-6-height/2;if(anno.kind==='arrow')x=(anno.x+(anno.x2??anno.x))/2-width/2;}style={fontFamily:anno.fontFamily,fontSize:font,color:anno.textColor||anno.color,fontWeight:anno.bold===false?400:600,fontStyle:anno.italic?'italic':undefined,textDecoration:anno.underline?'underline':undefined};}
            else {if(!edge)return null;const points=edgeEndpoints(edge);if(!points)return null;const from=points.start,to=points.end;x=(from.x+to.x)/2+(edge.style?.labelDx||0)-125;y=(from.y+to.y)/2+(edge.style?.labelDy||0)-30;align='center';style={fontFamily:edge.style?.labelFontFamily,fontSize:edge.style?.labelFontSize||12,color:edge.style?.labelColor||'#334155',fontWeight:edge.style?.labelBold===false?400:600,fontStyle:edge.style?.labelItalic?'italic':undefined,textDecoration:edge.style?.labelUnderline?'underline':undefined};}
            return <foreignObject data-map-editor x={x} y={y} width={width} height={Math.max(50,height)} onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}><textarea autoFocus aria-label="Edit map text in place" value={inlineEdit.value} placeholder="Type here…" style={{...style,textAlign:align,width:'100%',height:'100%',boxSizing:'border-box',resize:'none',padding:8,lineHeight:1.16,background:'rgba(255,255,255,.96)',border:'2px solid #2563eb',borderRadius:4}} onChange={event=>{const next={...inlineEdit,value:event.target.value};inlineEditRef.current=next;setInlineEdit(next);}} onBlur={()=>endInline(true)} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();endInline(false);}else if((event.ctrlKey||event.metaKey)&&(event.key==='Enter'||event.key.toLowerCase()==='s')){event.preventDefault();endInline(true);}}}/></foreignObject>;
          })()}
        </svg>
        </div>
      </div>
      </div>
    </div>
  );
}

// Keep map navigation state, but refresh its graph only when it is visible.
const CachedCodeMap = React.memo(CodeMap, (previous, next) => previous.active === false && next.active === false && previous.projectId === next.projectId);


// The report uses the same canvas renderer in an isolated, read-only mount.
export { CodeMap as ReportCodeMap };

export default function DeferredCodeMap(props: Props) {
  const [enabledProject,setEnabledProject] = useState<string|null>(null);
  const [family,setFamily]=useState<VisualizationKind|null>(null);
  const workingView=useRef<CodeMapView>();

  useEffect(()=>{setEnabledProject(null);setFamily(null);workingView.current=undefined;},[props.projectId]);
  useEffect(()=>{if(props.noteTarget){workingView.current=undefined;setEnabledProject(props.projectId);setFamily(null);}},[props.noteTarget]);
  useEffect(()=>{if(props.researchRequest){setFamily(props.researchRequest.family);setEnabledProject(null);}},[props.researchRequest]);
  if(props.active===false)return null;
  const data={...props.researchProject,id:props.projectId,name:props.projectName||'Research themes',codes:props.codes,analysisPeriods:props.analysisPeriods,docs:props.docs||[],codedSegments:props.codedSegments};
  const apply=(suggestion:MapSuggestion)=>{props.onResearchRequestHandled?.();workingView.current=undefined;props.onApplySuggestion?.(suggestion);setFamily(null);setEnabledProject(props.projectId);};
  if(enabledProject!==props.projectId){
    if(family&&family!=='code-map')return <VisualizationSetup key={family+props.projectId} family={family} initialScope={props.researchRequest?.family===family?props.researchRequest.scope:undefined} data={data} previous={props.mapDesign} onApply={apply} onBack={()=>setFamily(null)}/>;
    return <section className="visualization-library" aria-label="Visualization library">
      <header><div><h2>Visualization</h2><p>Choose a type, choose a preset, then generate. Nothing is compiled until you ask.</p></div><button onClick={()=>setEnabledProject(props.projectId)}>Open current canvas</button></header>
      <div className="visualization-grid">{visualizationTypes.map(type=><button key={type.id} className="visualization-card" onClick={()=>setFamily(type.id)} aria-label={'Create '+type.name}><VisualizationIcon type={type.icon}/><strong>{type.name}</strong><span>{type.description}</span></button>)}</div>
      {(props.drafts||[]).length>0&&<div className="map-draft-list"><h3>Saved drafts</h3>{props.drafts!.map(d=><div className="map-draft-row" key={d.id}><span>{d.name} · {visualizationTypes.find(t=>t.id===d.design?.family)?.name||'Code map'}</span><button onClick={()=>{workingView.current=undefined;props.onRestoreDraft?.(d.id);setEnabledProject(props.projectId);}}>Open draft</button></div>)}</div>}
      {family==='code-map'&&<MapSuggestions projectId={props.projectId} name={data.name} codes={props.codes} segments={props.codedSegments} onApply={s=>apply({...s,replaceCanvas:true,design:{...s.design,family:'code-map'}})} onClose={()=>setFamily(null)}/>}
    </section>;
  }
  return <>
    {family&&family!=='code-map'&&<VisualizationSetup key={family+props.projectId} family={family} initialScope={props.researchRequest?.family===family?props.researchRequest.scope:undefined} data={data} previous={props.mapDesign} onApply={apply} onBack={()=>setFamily(null)} returnToCanvas/>}
    <div style={{display:family?'none':'flex',flex:1,minHeight:0,flexDirection:'column'}}><CachedCodeMap {...props} onApplySuggestion={apply} mapView={workingView.current||props.mapView} onRestoreDraft={id=>{workingView.current=undefined;props.onRestoreDraft?.(id);}} onRememberView={view=>{workingView.current=view;props.onRememberView?.(view);}} active={!family} onConfigure={()=>setFamily(props.mapDesign?.family||'code-map')} onLibrary={()=>{setEnabledProject(null);setFamily(null);}} /></div>
  </>;
}

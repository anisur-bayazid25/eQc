import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Code, CodedSegment, ID, MapAnnotation, MapEdgeStyle, childCodes, descendantCodeIds, uid } from '../domain';

interface Props {
  projectId: ID;
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
const CANVAS_MAX = 5000;

const DEFAULT_COLORS: Record<MapEdgeStyle['kind'], string> = {
  hierarchy: '#cbd5e1',
  cooccurrence: '#a78bfa',
  custom: '#64748b'
};

const SHAPES: Code['mapShape'][] = ['circle', 'square', 'diamond'];

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

export default function CodeMap({
  projectId, codes, codedSegments, mapEdgeStyles, annotations, hiddenMapCodeIds,
  onUpdateCode, onUpdateCodesBatch, onUpdateEdgeStyle, onAddEdgeStyle, onDeleteEdgeStyle,
  onUpdateAnnotations, onUpdateHiddenMapCodes,
  onShowToast
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const movedRef = useRef(false);

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
  const [showLegend, setShowLegend] = useState(true);
  // Legend floats over the outer wrapper (sibling of the scroll container);
  // its top-left corner is tracked here so dragging can reposition it.
  const [legendPos, setLegendPos] = useState({ x: 12, y: 12 });
  const [legendDrag, setLegendDrag] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawSource, setDrawSource] = useState<ID | null>(null);
  // Free-standing annotation layer (not tied to any code): shape picker
  // mode, the drag currently being drawn (viewBox units), its live preview,
  // the selected shape for the style bar, and the inline text-label prompt.
  const [annotateMode, setAnnotateMode] = useState(false);
  const [annotateShape, setAnnotateShape] = useState<'rect' | 'circle' | 'arrow' | 'text'>('rect');
  const [annoDrag, setAnnoDrag] = useState<{ x0: number; y0: number; shape: 'rect' | 'circle' | 'arrow' } | null>(null);
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
  const [editingAnnoId, setEditingAnnoId] = useState<string | null>(null);
  // Edge label drag-to-move (offset from the edge midpoint).
  const [labelDragMove, setLabelDragMove] = useState<{ key: string; edge: EdgeRef; startX: number; startY: number; origDx: number; origDy: number } | null>(null);
  // On-canvas code selection (click a leaf node) + the add/remove-from-canvas
  // machinery: hidden ids live in the project (persisted), this local UI just
  // holds the chosen node and the add-codes popover flag.
  const [selectedMapCodeId, setSelectedMapCodeId] = useState<ID | null>(null);
  const [showAddCodes, setShowAddCodes] = useState(false);
  // Whether the legend is baked into SVG/PNG/JPEG exports.
  const [includeLegendInExport, setIncludeLegendInExport] = useState(true);
  const [textPrompt, setTextPrompt] = useState<{ sx: number; sy: number; tx: number; ty: number } | null>(null);
  const annoPreviewRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const textPromptRef = useRef<{ sx: number; sy: number; tx: number; ty: number } | null>(null);
  const annoTextRef = useRef<HTMLInputElement>(null);
  // A click always follows an annotation mousedown+mouseup, and would
  // otherwise clear the selection the drag just made — this guard skips the
  // clear for exactly that click (reset on every svg mousedown, consumed on
  // the svg click).
  const annoClickGuardRef = useRef(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [presetIdx, setPresetIdx] = useState(0);
  const [customMode, setCustomMode] = useState(false);
  const [customW, setCustomW] = useState(1200);
  const [customH, setCustomH] = useState(800);

  const canvas = customMode
    ? { w: Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, customW)), h: Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, customH)) }
    : CANVAS_PRESETS[presetIdx];

  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

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
      setExpandedRoots(new Set());
      setChildrenPerRoot(5);
      setViewMode('auto');
      setSelectedKey(null);
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
    if (max === 0) return MIN_R;
    return Math.round(MIN_R + (count / max) * (MAX_R - MIN_R));
  };

  // Document-level co-occurrence: how many docs each code pair shares.
  const sharedDocs = useMemo(() => {
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
  }, [codedSegments]);

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

  // Auto-layout for visible codes with no cached mapPosition. Runs on import,
  // on canvas changes, and when folding reveals nodes that were never
  // arranged; hand-placed positions are never clobbered. Only the visible
  // node set is laid out, so spacing and physics reflect what is drawn.
  useEffect(() => {
    const missing = visibleCodes.filter(c => !c.mapPosition);
    if (missing.length === 0) return;
    const auto = computeAutoLayout(visibleCodes, canvas.w, canvas.h);
    for (const c of missing) {
      const pos = auto.get(c.id);
      if (pos) onUpdateCode(c.id, { mapPosition: pos });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCodes, canvas.w, canvas.h]);

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
    for (const c of visibleCodes) {
      if (!c.parentId || !visibleIds.has(c.parentId)) continue;
      refs.push({ key: `hierarchy:${c.parentId}:${c.id}`, kind: 'hierarchy', fromId: c.parentId, toId: c.id });
    }
    if (showCooc) {
      for (const [pair, shared] of sharedDocs) {
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
  }, [visibleCodes, visibleIds, sharedDocs, styles, showCooc, minShared]);

  // Edge kinds actually drawn right now — the legend only shows rows for
  // kinds present (plus the strength scale only when co-occurrence edges
  // are on screen).
  const presentKinds = useMemo(() => {
    const s = new Set<string>();
    for (const e of edges) s.add(e.kind);
    return s;
  }, [edges]);

  const selectedEdge = useMemo(
    () => edges.find(e => e.key === selectedKey) || null,
    [edges, selectedKey]
  );

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
    if (placed.length === 0) return;
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
    onUpdateCodesBatch(updates);
  }

  const selectCanvasPreset = (value: string) => {
    setShowLegend(false); // simple: legend nudges off whenever the canvas changes
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
    if (foldMode && (descendantsCache.get(code.id) || 0) > 0) {
      toggleExpand(code.id, e);
      return;
    }
    setSelectedAnnoId(null);
    setSelectedMapCodeId(code.id);
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
      const padding = 40;
      const x = Math.round(Math.max(padding, Math.min(rawX, w - padding)));
      const y = Math.round(Math.max(padding, Math.min(rawY, h - padding)));
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

  // Drag-to-reposition the legend (same window-listener pattern as node
  // dragging, but purely local — no persistence).
  useEffect(() => {
    if (!legendDrag) return;
    const active = legendDrag;
    function onMove(e: MouseEvent) {
      setLegendPos({
        x: Math.max(0, active.origX + (e.clientX - active.startX)),
        y: Math.max(0, active.origY + (e.clientY - active.startY))
      });
    }
    function onUp() {
      setLegendDrag(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [legendDrag]);

  // ViewBox coords for a pointer event: the svg sits inside the zoom-scaled
  // wrapper, so divide the screen delta by the zoom factor.
  const toViewBox = (e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const z = zoomRef.current;
    return { x: (e.clientX - rect.left) / z, y: (e.clientY - rect.top) / z };
  };

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
      const next = { x0: active.x0, y0: active.y0, x1: x, y1: y };
      annoPreviewRef.current = next;
      setAnnoPreview(next);
    }
    function onUp() {
      const p = annoPreviewRef.current;
      if (p && Math.abs(p.x1 - p.x0) + Math.abs(p.y1 - p.y0) > 5) {
        const base = { id: uid('anno'), color: DEFAULT_COLORS.custom, lineStyle: 'solid' as const };
        let anno: MapAnnotation;
        if (active.shape === 'arrow') {
          anno = { ...base, kind: 'arrow', x: p.x0, y: p.y0, x2: p.x1, y2: p.y1 };
        } else {
          anno = {
            ...base,
            kind: active.shape,
            x: Math.min(p.x0, p.x1),
            y: Math.min(p.y0, p.y1),
            width: Math.abs(p.x1 - p.x0),
            height: Math.abs(p.y1 - p.y0)
          };
        }
        onUpdateAnnotations([...annotations, anno]);
        setSelectedAnnoId(anno.id);
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
        onUpdateAnnotations(annotations.map(a => (a.id === active.id ? { ...a, ...patch } : a)));
      }
      liveAnnoPatchRef.current = null;
      setAnnoLiveOffset(null);
      setAnnoDragMove(null);
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
      commitStyle(active.edge, { labelDx: active.origDx + dx, labelDy: active.origDy + dy });
    }
    function onUp() {
      setLabelDragMove(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [labelDragMove]);

  function openTextPrompt(sx: number, sy: number, tx: number, ty: number) {
    textPromptRef.current = { sx, sy, tx, ty };
    setTextPrompt({ sx, sy, tx, ty });
  }
  function closeTextPrompt() {
    textPromptRef.current = null;
    setTextPrompt(null);
    setEditingAnnoId(null);
  }
  // Enter/blur commits the label, Escape cancels. Ref-guarded so a blur
  // racing the Enter-commit can never double-persist. When editingAnnoId is
  // set, this updates that annotation's text instead of creating a new one.
  function commitTextPrompt() {
    const t = textPromptRef.current;
    if (!t) return;
    const text = (annoTextRef.current?.value || '').trim();
    const editId = editingAnnoId;
    textPromptRef.current = null;
    setTextPrompt(null);
    setEditingAnnoId(null);
    if (!text) return;
    if (editId) {
      onUpdateAnnotations(annotations.map(a => (a.id === editId ? { ...a, text } : a)));
      return;
    }
    onUpdateAnnotations([
      ...annotations,
      { id: uid('anno'), kind: 'text', x: t.sx, y: t.sy, text, color: DEFAULT_COLORS.custom, lineStyle: 'solid' }
    ]);
  }

  const selectedAnno = selectedAnnoId ? (annotations.find(a => a.id === selectedAnnoId) || null) : null;

  function updateSelectedAnno(patch: Partial<MapAnnotation>) {
    if (!selectedAnnoId) return;
    onUpdateAnnotations(annotations.map(a => (a.id === selectedAnnoId ? { ...a, ...patch } : a)));
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

  function serializeSvg(scale = 1): { xml: string | null; width: number; height: number } {
    const el = svgRef.current;
    if (!el) return { xml: null, width: canvas.w, height: canvas.h };
    const clone = el.cloneNode(true) as SVGSVGElement;
    const w = Math.max(1, Math.round(canvas.w * scale));
    const h = Math.max(1, Math.round(canvas.h * scale));
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    if (includeLegendInExport) {
      // Bake the floating legend in as plain SVG elements (no CSS classes,
      // no foreignObject) so it rasterizes identically in every export path.
      const ns = 'http://www.w3.org/2000/svg';
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('transform', 'translate(16, 16)');
      const box = document.createElementNS(ns, 'rect');
      box.setAttribute('x', '0');
      box.setAttribute('y', '0');
      box.setAttribute('width', '170');
      box.setAttribute('rx', '6');
      box.setAttribute('fill', 'rgba(255,255,255,0.95)');
      box.setAttribute('stroke', '#cbd5e1');
      box.setAttribute('stroke-width', '1');
      g.appendChild(box);
      const title = document.createElementNS(ns, 'text');
      title.setAttribute('x', '8');
      title.setAttribute('y', '15');
      title.setAttribute('font-size', '11');
      title.setAttribute('font-weight', '700');
      title.setAttribute('fill', '#1e293b');
      title.textContent = 'Legend';
      g.appendChild(title);
      const rows: Array<[string, string, boolean]> = [];
      if (presentKinds.has('hierarchy')) rows.push(['#cbd5e1', 'Hierarchy', false]);
      if (presentKinds.has('cooccurrence')) rows.push(['#a78bfa', 'Co-occurrence', false]);
      if (presentKinds.has('custom')) rows.push(['#64748b', 'Custom', true]);
      let y = 15 + 12;
      for (const [color, label, dashed] of rows) {
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', '8');
        line.setAttribute('y1', String(y + 6));
        line.setAttribute('x2', '26');
        line.setAttribute('y2', String(y + 6));
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '2');
        if (dashed) line.setAttribute('stroke-dasharray', '6 4');
        g.appendChild(line);
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', '32');
        t.setAttribute('y', String(y + 10));
        t.setAttribute('font-size', '11');
        t.setAttribute('fill', '#334155');
        t.textContent = label;
        g.appendChild(t);
        y += 16;
      }
      if (presentKinds.has('cooccurrence')) {
        for (const [x1, x2, lw] of [[8, 14, 2], [16, 22, 4], [24, 30, 6]] as Array<[number, number, number]>) {
          const line = document.createElementNS(ns, 'line');
          line.setAttribute('x1', String(x1));
          line.setAttribute('y1', String(y + 6));
          line.setAttribute('x2', String(x2));
          line.setAttribute('y2', String(y + 6));
          line.setAttribute('stroke', '#a78bfa');
          line.setAttribute('stroke-width', String(lw));
          g.appendChild(line);
        }
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', '36');
        t.setAttribute('y', String(y + 10));
        t.setAttribute('font-size', '11');
        t.setAttribute('fill', '#334155');
        t.textContent = 'weak → strong';
        g.appendChild(t);
        y += 16;
      }
      box.setAttribute('height', String(y + 4));
      clone.appendChild(g);
    }
    return {
      xml: `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`,
      width: w,
      height: h
    };
  }

  async function exportSvg() {
    const { xml } = serializeSvg();
    if (!xml) return;
    const path = await window.qv.exportText({
      title: 'Export Code Map (SVG)',
      defaultName: 'code_map.svg',
      content: xml,
      extension: 'svg',
      filterName: 'SVG file'
    });
    if (path && onShowToast) onShowToast(`Code map exported to ${path}`);
  }

  async function exportRaster(kind: 'png' | 'jpeg') {
    // Rasterize at ≥300 DPI: CSS DPI is 96, so scale the SVG target size up
    // so the pixel grid is dense enough for print; the clone re-renders at
    // the larger size instead of being stretch-blurred.
    const scale = 300 / 96;
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
        title: `Export Code Map (${kind.toUpperCase()})`,
        defaultName: kind === 'png' ? 'code_map.png' : 'code_map.jpg',
        base64: dataUrl.split(',')[1]
      });
      if (path && onShowToast) onShowToast(`Code map exported to ${path}`);
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
  const labelDeltas = useMemo(() => {
    const deltas = new Map<ID, number>();
    const placed: Array<{ x: number; y: number; w: number }> = [];
    const steps = [0, -16, 16, -32, 32, -48, 48];
    for (const c of visibleCodes) {
      const pos = positions.get(c.id);
      if (!pos) continue;
      const w = truncated(c.name).length * 6.6;
      const baseY = pos.y + 14;
      let dy = 0;
      for (let attempt = 0; attempt < steps.length; attempt++) {
        dy = steps[attempt];
        const y = baseY + dy;
        const clash = placed.some(p => Math.abs(p.x - pos.x) < (p.w + w) / 2 + 6 && Math.abs(p.y - y) < 15);
        if (!clash) {
          placed.push({ x: pos.x, y, w });
          deltas.set(c.id, dy);
          break;
        }
      }
    }
    return deltas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCodes, positions]);

  const COLOR_PALETTE = ['#0f172a', '#ef4444', '#f59e0b', '#22c55e', '#0ea5e9', '#a78bfa', '#ec4899'];

  return (
    <div style={{
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
      <div className="sort-row" style={{ gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-dim)', flex: 1, minWidth: '260px' }}>
          Drag nodes to rearrange · right-click a node to change its shape · node size = coding frequency · click a leaf node to select it (✕ Remove from map hides it, ➕ Add codes brings it back) · click a folded node (or its + badge) to expand/collapse it
        </span>
        <label className="mini-label" style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="checkbox"
            checked={showCooc}
            onChange={e => setShowCooc(e.target.checked)}
          />
          Co-occurrence ({coocCount})
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
        <button
          className="mini-btn"
          style={drawMode ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
          onClick={() => { setSelectedKey(null); setDrawMode(m => !m); setDrawSource(null); }}
        >
          {drawMode ? 'Cancel draw' : '✏️ Draw edge'}
        </button>
        <button
          className="mini-btn"
          style={annotateMode ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
          onClick={() => { setAnnotateMode(m => !m); setSelectedKey(null); setSelectedAnnoId(null); }}
          title="Draw free-standing annotation shapes — not tied to any code"
        >
          ✏️ Annotate
        </button>
        {annotateMode && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="Annotation shape — drag on empty canvas to draw; text places a labeled note">
            {(['rect', 'circle', 'arrow', 'text'] as const).map(s => (
              <button
                key={s}
                className="mini-btn"
                style={{ padding: '1px 5px', fontSize: '11px', ...(annotateShape === s ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
                onClick={() => setAnnotateShape(s)}
              >
                {s}
              </button>
            ))}
          </span>
        )}
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
        <button
          className="mini-btn"
          style={showLegend ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
          onClick={() => setShowLegend(v => !v)}
          title="Toggle the legend overlay"
        >
          ◆ Legend
        </button>
        <button className="mini-btn" onClick={() => setZoom(z => Math.max(0.1, +(z - 0.1).toFixed(2)))}>−</button>
        <input
          type="range"
          min={10}
          max={400}
          step={10}
          value={Math.round(zoom * 100)}
          onChange={e => setZoom(Number(e.target.value) / 100)}
          style={{ width: '140px', verticalAlign: 'middle' }}
        />
        <span style={{ fontSize: 12, minWidth: 40, textAlign: 'center', display: 'inline-block' }}>{Math.round(zoom * 100)}%</span>
        <button className="mini-btn" onClick={() => setZoom(z => Math.min(4, +(z + 0.1).toFixed(2)))}>+</button>
        <button className="mini-btn" onClick={() => setZoom(1)}>Reset</button>
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
        <button
          className="mini-btn"
          onClick={() => setIsFullscreen(v => !v)}
          title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Expand the whole map panel to fill the window'}
        >
          {isFullscreen ? '✕ Exit fullscreen' : '⛶ Fullscreen'}
        </button>
        {selectedMapCodeId && (
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
      </div>

      {showAddCodes && (
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

      {selectedEdge && (
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
            value={selectedEdge.style?.curve || 'straight'}
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
              value={selectedEdge.style?.width ?? (selectedEdge.kind === 'cooccurrence' ? weightFor(`${selectedEdge.fromId}::${selectedEdge.toId}`) : selectedEdge.kind === 'custom' ? 2.5 : 2)}
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

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <button
              className="mini-btn"
              style={{ padding: '1px 6px', fontSize: '11px' }}
              onClick={() => commitStyle(selectedEdge, { color: undefined })}
              title="Reset to default color"
            >
              ⬤
            </button>
            {COLOR_PALETTE.map(col => (
              <button
                key={col}
                className="mini-btn"
                style={{
                  width: '16px', height: '16px', padding: 0, borderRadius: '50%',
                  backgroundColor: col,
                  border: selectedEdge.style?.color === col ? '2px solid var(--accent)' : '1px solid var(--border)'
                }}
                onClick={() => commitStyle(selectedEdge, { color: col })}
                title={col}
              />
            ))}
          </span>

          <input
            type="text"
            placeholder="Edge label…"
            defaultValue={selectedEdge.style?.label || ''}
            onBlur={e => {
              const v = e.target.value.trim();
              if (v !== (selectedEdge.style?.label || '')) commitStyle(selectedEdge, { label: v || undefined });
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            style={{ fontSize: '12px', padding: '2px 6px', width: '130px' }}
          />

          {selectedEdge.style?.label && (
            <>
              <select
                value={selectedEdge.style?.labelFontSize || 12}
                onChange={e => commitStyle(selectedEdge, { labelFontSize: Number(e.target.value) })}
                style={{ fontSize: '12px', padding: '2px 4px' }}
                title="Label font size"
              >
                {[10, 12, 14, 16, 20, 24].map(sz => (
                  <option key={sz} value={sz}>{sz}px</option>
                ))}
              </select>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                {COLOR_PALETTE.map(col => (
                  <button
                    key={col}
                    className="mini-btn"
                    style={{
                      width: '14px', height: '14px', padding: 0, borderRadius: '50%',
                      backgroundColor: col,
                      border: selectedEdge.style?.labelColor === col ? '2px solid var(--accent)' : '1px solid var(--border)'
                    }}
                    onClick={() => commitStyle(selectedEdge, { labelColor: col })}
                    title={`Label color: ${col}`}
                  />
                ))}
              </span>
            </>
          )}

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
        </div>
      )}

      {selectedAnno && (
        <div className="sort-row" style={{ gap: '8px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>
            Annotation · {selectedAnno.kind}
          </span>

          {selectedAnno.kind !== 'text' && (
            <select
              value={selectedAnno.lineStyle}
              onChange={e => updateSelectedAnno({ lineStyle: e.target.value as MapAnnotation['lineStyle'] })}
              style={{ fontSize: '12px', padding: '2px 4px' }}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          )}

          {selectedAnno.kind === 'text' && (
            <>
              <button
                className="mini-btn"
                onClick={() => {
                  setEditingAnnoId(selectedAnno.id);
                  openTextPrompt(selectedAnno.x, selectedAnno.y, window.innerWidth / 2 - 90, 140);
                }}
              >
                ✏️ Edit text
              </button>
              <select
                value={selectedAnno.fontSize ?? 14}
                onChange={e => updateSelectedAnno({ fontSize: Number(e.target.value) })}
                style={{ fontSize: '12px', padding: '2px 4px' }}
                title="Font size"
              >
                {[10, 12, 14, 16, 20, 24, 32].map(sz => (
                  <option key={sz} value={sz}>{sz}px</option>
                ))}
              </select>
              <button
                className="mini-btn"
                style={{ fontWeight: 700, ...(selectedAnno.bold !== false ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
                onClick={() => updateSelectedAnno({ bold: selectedAnno.bold === false })}
                title="Bold"
              >
                B
              </button>
              <button
                className="mini-btn"
                style={{ fontStyle: 'italic', ...(selectedAnno.italic ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
                onClick={() => updateSelectedAnno({ italic: !selectedAnno.italic })}
                title="Italic"
              >
                I
              </button>
            </>
          )}

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            {COLOR_PALETTE.map(col => (
              <button
                key={col}
                className="mini-btn"
                style={{
                  width: '16px', height: '16px', padding: 0, borderRadius: '50%',
                  backgroundColor: col,
                  border: selectedAnno.color === col ? '2px solid var(--accent)' : '1px solid var(--border)'
                }}
                onClick={() => updateSelectedAnno({ color: col })}
                title={col}
              />
            ))}
          </span>

          <button
            className="mini-btn"
            style={{ color: '#ef4444' }}
            onClick={() => {
              onUpdateAnnotations(annotations.filter(a => a.id !== selectedAnno.id));
              setSelectedAnnoId(null);
            }}
          >
            🗑 Delete
          </button>
        </div>
      )}

      {textPrompt && (
        <input
          ref={annoTextRef}
          autoFocus
          defaultValue={editingAnnoId ? (annotations.find(a => a.id === editingAnnoId)?.text || '') : ''}
          placeholder="Annotation label…"
          style={{
            position: 'fixed',
            top: textPrompt.ty + 14,
            left: textPrompt.tx,
            zIndex: 30,
            fontSize: '12px',
            padding: '2px 6px',
            width: '180px',
            border: '1px solid var(--accent)',
            borderRadius: '4px'
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') commitTextPrompt();
            if (e.key === 'Escape') closeTextPrompt();
          }}
          onBlur={commitTextPrompt}
        />
      )}

      {/* The legend must NEVER live inside the zoomed/scrolling inner div:
          absolute positioning inside a scroller anchors to its scrollable
          content (content-bottom etc.), so the legend scrolled off — or
          vanished at any non-default zoom. It is a sibling of the scroll
          container here, pinned to the outer wrapper: fixed regardless of
          zoom level or scroll position. Outer wrapper also gives the
          scroll container its (absolute) bounds. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {showLegend && (
          <div
            style={{
              position: 'absolute', top: legendPos.y, left: legendPos.x, zIndex: 10,
              background: 'rgba(255,255,255,0.95)', border: '1px solid var(--border)',
              borderRadius: '6px', padding: '6px 10px', fontSize: '11px',
              color: 'var(--text-dim)', boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              cursor: 'grab', userSelect: 'none'
            }}
            onMouseDown={e => {
              if (e.button !== 0) return;
              e.stopPropagation();
              setLegendDrag({ startX: e.clientX, startY: e.clientY, origX: legendPos.x, origY: legendPos.y });
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>Legend</div>
            {presentKinds.has('hierarchy') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', borderTop: '2px solid #cbd5e1', width: 14 }} />
                Hierarchy
              </div>
            )}
            {presentKinds.has('cooccurrence') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', borderTop: '2px solid #a78bfa', width: 14 }} />
                Co-occurrence
              </div>
            )}
            {presentKinds.has('custom') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', borderTop: '2px dashed #64748b', width: 14 }} />
                Custom
              </div>
            )}
            {presentKinds.has('cooccurrence') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ display: 'inline-block', borderTop: '3px solid #a78bfa', width: 8 }} />
                <span style={{ display: 'inline-block', borderTop: '5px solid #a78bfa', width: 8 }} />
                <span style={{ display: 'inline-block', borderTop: '8px solid #a78bfa', width: 8 }} />
                <span style={{ color: 'var(--text)' }}>weak → strong</span>
              </div>
            )}
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, border: '1px solid var(--border)', borderRadius: '6px', overflow: 'auto', backgroundColor: '#f0f0f0' }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${canvas.w}px`, height: `${canvas.h}px`, margin: '20px' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${canvas.w} ${canvas.h}`}
          width={canvas.w}
          height={canvas.h}
          style={{
            display: 'block',
            backgroundColor: 'white',
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
            if (annotateShape === 'text') {
              setEditingAnnoId(null); // always a fresh create here, never an edit
              openTextPrompt(pt.x, pt.y, e.clientX, e.clientY);
              return;
            }
            setAnnoDrag({ x0: pt.x, y0: pt.y, shape: annotateShape });
            const start = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
            annoPreviewRef.current = start;
            setAnnoPreview(start);
          }}
          onClick={() => {
            setSelectedKey(null);
            setSelectedMapCodeId(null);
            setDrawMode(false);
            setDrawSource(null);
            if (!annoClickGuardRef.current) setSelectedAnnoId(null);
            annoClickGuardRef.current = false;
          }}
        >
          <defs>
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
          {annotations.map(a => {
            const selected = selectedAnnoId === a.id;
            const dash = a.lineStyle === 'dashed' ? '8 5' : a.lineStyle === 'dotted' ? '2 5' : undefined;
            const sw = selected ? 3 : 2;
            // Apply the in-progress drag offset (if this is the annotation
            // currently being dragged) so it visually follows the pointer;
            // nothing persists until mouseup.
            const live = annoLiveOffset?.id === a.id ? annoLiveOffset : null;
            const ax = live?.x ?? a.x;
            const ay = live?.y ?? a.y;
            const ax2 = live?.x2 ?? a.x2;
            const ay2 = live?.y2 ?? a.y2;
            const select = (ev: React.MouseEvent) => {
              ev.stopPropagation();
              if (annoMovedRef.current) { annoMovedRef.current = false; return; }
              setSelectedKey(null);
              setSelectedAnnoId(a.id);
            };
            const startMove = (ev: React.MouseEvent) => {
              if (ev.button !== 0 || annotateMode) return;
              ev.stopPropagation();
              annoMovedRef.current = false;
              setAnnoDragMove({ id: a.id, startX: ev.clientX, startY: ev.clientY, orig: a });
            };
            return (
              <g
                key={a.id}
                onMouseDown={startMove}
                onClick={select}
                style={{ cursor: annoDragMove?.id === a.id ? 'grabbing' : 'grab' }}
              >
                {a.kind === 'rect' && (
                  <rect
                    x={ax} y={ay} width={a.width || 0} height={a.height || 0}
                    fill="none" stroke={a.color} strokeWidth={sw} strokeDasharray={dash}
                  />
                )}
                {a.kind === 'circle' && (
                  <ellipse
                    cx={ax + (a.width || 0) / 2} cy={ay + (a.height || 0) / 2}
                    rx={(a.width || 0) / 2} ry={(a.height || 0) / 2}
                    fill="none" stroke={a.color} strokeWidth={sw} strokeDasharray={dash}
                  />
                )}
                {a.kind === 'arrow' && (
                  <path
                    d={`M ${ax} ${ay} L ${ax2 ?? ax} ${ay2 ?? ay}`}
                    fill="none" stroke={a.color} strokeWidth={sw} strokeDasharray={dash}
                    markerEnd="url(#arrow-end)"
                  />
                )}
                {a.kind === 'text' && (
                  <text
                    x={ax} y={ay}
                    fontSize={a.fontSize ?? 14}
                    fontWeight={a.bold === false ? 400 : 600}
                    fontStyle={a.italic ? 'italic' : 'normal'}
                    fill={a.color}
                  >
                    {a.text || ''}
                  </text>
                )}
                {a.text && a.kind !== 'text' && (
                  <text
                    x={a.kind === 'arrow' ? (ax + (ax2 ?? ax)) / 2 : ax + (a.width || 0) / 2}
                    y={a.kind === 'arrow' ? (ay + (ay2 ?? ay)) / 2 - 6 : ay - 6}
                    textAnchor="middle" fontSize={12} fontWeight={600} fill={a.color}
                  >
                    {a.text}
                  </text>
                )}
              </g>
            );
          })}
          {annoPreview && (
            <g pointerEvents="none" opacity={0.5}>
              {annoDrag?.shape === 'arrow' ? (
                <path d={`M ${annoPreview.x0} ${annoPreview.y0} L ${annoPreview.x1} ${annoPreview.y1}`} fill="none" stroke={DEFAULT_COLORS.custom} strokeWidth={2} markerEnd="url(#arrow-end)" />
              ) : annoDrag?.shape === 'circle' ? (
                <ellipse
                  cx={(annoPreview.x0 + annoPreview.x1) / 2} cy={(annoPreview.y0 + annoPreview.y1) / 2}
                  rx={Math.abs(annoPreview.x1 - annoPreview.x0) / 2} ry={Math.abs(annoPreview.y1 - annoPreview.y0) / 2}
                  fill="none" stroke={DEFAULT_COLORS.custom} strokeWidth={2}
                />
              ) : (
                <rect
                  x={Math.min(annoPreview.x0, annoPreview.x1)} y={Math.min(annoPreview.y0, annoPreview.y1)}
                  width={Math.abs(annoPreview.x1 - annoPreview.x0)} height={Math.abs(annoPreview.y1 - annoPreview.y0)}
                  fill="none" stroke={DEFAULT_COLORS.custom} strokeWidth={2}
                />
              )}
            </g>
          )}

          {/* Edges */}
          {edges.map(e => {
            const from = positions.get(e.fromId);
            const to = positions.get(e.toId);
            if (!from || !to) return null;
            const style = e.style;
            const isSelected = selectedKey === e.key;
            const color = style?.color || DEFAULT_COLORS[e.kind];
            const d = edgePath(from, to, (style?.curve || 'straight') === 'curved');
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
              : isCooc ? weightFor(pairKey) : e.kind === 'custom' ? 2.5 : 2;
            const opacity = isSelected ? 1 : (isCooc && style?.width == null ? opacityFor(pairKey) : 0.9);
            const labelPos = {
              x: (from.x + to.x) / 2 + (style?.labelDx || 0),
              y: (from.y + to.y) / 2 - 6 + (style?.labelDy || 0)
            };
            return (
              <g key={e.key}>
                {isCooc && (
                  <title>{(sharedDocs.get(pairKey) || 1)} shared document{(sharedDocs.get(pairKey) || 1) === 1 ? '' : 's'}</title>
                )}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  pointerEvents="stroke"
                  style={{ cursor: 'pointer' }}
                  onClick={ev => { ev.stopPropagation(); setSelectedKey(e.key); setSelectedAnnoId(null); }}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={isSelected ? width + 2 : width}
                  strokeDasharray={dash}
                  markerEnd={markerEnd}
                  markerStart={markerStart}
                  pointerEvents="none"
                  opacity={opacity}
                />
                {style?.label && (
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    fontSize={style?.labelFontSize || 12}
                    fontWeight={600}
                    fill={style?.labelColor || '#334155'}
                    stroke="#f8fafc"
                    strokeWidth={3}
                    paintOrder="stroke"
                    cursor="move"
                    onMouseDown={ev => {
                      if (ev.button !== 0) return;
                      ev.stopPropagation();
                      setLabelDragMove({
                        key: e.key, edge: e,
                        startX: ev.clientX, startY: ev.clientY,
                        origDx: style?.labelDx || 0, origDy: style?.labelDy || 0
                      });
                    }}
                  >
                    {style.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {visibleCodes.map(c => {
            const pos = positions.get(c.id);
            if (!pos) return null;
            const r = radiusFor(c.id, foldMode && c.parentId === null);
            const isDragging = drag?.id === c.id;
            const isSelectedNode = selectedMapCodeId === c.id;
            const shape = c.mapShape || 'circle';
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
                key={c.id}
                onMouseDown={e => handleNodeMouseDown(e, c)}
                onClick={e => handleNodeClick(e, c)}
                onContextMenu={e => cycleShape(e, c)}
                style={{ cursor: 'grab' }}
              >
                {shape === 'circle' && (
                  <circle
                    cx={pos.x} cy={pos.y} r={r}
                    fill={c.color}
                    stroke={isDragging || isDrawSource ? '#0f172a' : isSelectedNode ? '#3b82f6' : 'rgba(15,23,42,0.25)'}
                    strokeWidth={(isDragging || isDrawSource || isSelectedNode) ? 3 : 1.5}
                  />
                )}
                {shape === 'square' && (
                  <rect
                    x={pos.x - r} y={pos.y - r} width={r * 2} height={r * 2}
                    rx={3}
                    fill={c.color}
                    stroke={isDragging || isDrawSource ? '#0f172a' : isSelectedNode ? '#3b82f6' : 'rgba(15,23,42,0.25)'}
                    strokeWidth={(isDragging || isDrawSource || isSelectedNode) ? 3 : 1.5}
                  />
                )}
                {shape === 'diamond' && (
                  <polygon
                    points={`${pos.x},${pos.y - r} ${pos.x + r},${pos.y} ${pos.x},${pos.y + r} ${pos.x - r},${pos.y}`}
                    fill={c.color}
                    stroke={isDragging || isDrawSource ? '#0f172a' : isSelectedNode ? '#3b82f6' : 'rgba(15,23,42,0.25)'}
                    strokeWidth={(isDragging || isDrawSource || isSelectedNode) ? 3 : 1.5}
                  />
                )}
                {isDrawSource && (
                  <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" />
                )}
                <text
                  x={pos.x}
                  y={pos.y + r + 14 + (labelDeltas.get(c.id) || 0)}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#0f172a"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {truncated(c.name)}
                </text>
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
                      fontSize={9}
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
          })}
        </svg>
        </div>
      </div>
      </div>
    </div>
  );
}

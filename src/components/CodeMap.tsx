import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Code, CodedSegment, ID, MapEdgeStyle, childCodes, uid } from '../domain';

interface Props {
  codes: Code[];
  codedSegments: CodedSegment[];
  mapEdgeStyles: MapEdgeStyle[];
  onUpdateCode: (codeId: ID, patch: Partial<Code>) => void;
  onUpdateCodesBatch: (updates: Array<{ id: ID; patch: Partial<Code> }>) => void;
  onUpdateEdgeStyle: (edgeId: ID, patch: Partial<MapEdgeStyle>) => void;
  onAddEdgeStyle: (style: MapEdgeStyle) => void;
  onDeleteEdgeStyle: (edgeId: ID) => void;
  onSelectCode?: (code: Code) => void;
  onShowToast?: (msg: string) => void;
}

const SPACING_X = 200;
const SPACING_Y = 130;
const TOP_PAD = 90;
const MIN_R = 18;
const MAX_R = 40;
const MAX_LABEL = 26;

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
  return layout;
}

export default function CodeMap({
  codes, codedSegments, mapEdgeStyles,
  onUpdateCode, onUpdateCodesBatch, onUpdateEdgeStyle, onAddEdgeStyle, onDeleteEdgeStyle,
  onSelectCode, onShowToast
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const movedRef = useRef(false);

  const [positions, setPositions] = useState<Map<ID, { x: number; y: number }>>(() => {
    const map = new Map<ID, { x: number; y: number }>();
    for (const c of codes) if (c.mapPosition) map.set(c.id, c.mapPosition);
    return map;
  });
  const [drag, setDrag] = useState<{ id: ID; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [showCooc, setShowCooc] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [drawSource, setDrawSource] = useState<ID | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
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

  // Auto-layout for codes with no cached mapPosition. Runs on import (new
  // codes) and whenever the canvas size changes so unplaced codes fit the
  // current canvas; hand-placed positions are never clobbered.
  useEffect(() => {
    const missing = codes.filter(c => !c.mapPosition);
    if (missing.length === 0) return;
    const auto = computeAutoLayout(codes, canvas.w, canvas.h);
    for (const c of missing) {
      const pos = auto.get(c.id);
      if (pos) onUpdateCode(c.id, { mapPosition: pos });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes, canvas.w, canvas.h]);

  // Auto-fit: whenever the active canvas changes (or loaded positions fall
  // outside it), proportionately scale every placed node into the new
  // bounds with FIT_PAD margin, persisting all updates in one batch.
  const FIT_PAD = 40;
  useEffect(() => {
    const placed = codes.filter(c => !!c.mapPosition);
    if (placed.length === 0) return;
    const xs = placed.map(c => c.mapPosition!.x);
    const ys = placed.map(c => c.mapPosition!.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const overflows = maxX > canvas.w || maxY > canvas.h || minX < 0 || minY < 0;
    if (!overflows) return;
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const fit = (v: number, min: number, span: number, size: number) =>
      span === 0 ? Math.round(size / 2) : Math.round(FIT_PAD + ((v - min) / span) * (size - FIT_PAD * 2));
    const updates = placed.map(c => ({
      id: c.id,
      patch: { mapPosition: { x: fit(c.mapPosition!.x, minX, spanX, canvas.w), y: fit(c.mapPosition!.y, minY, spanY, canvas.h) } }
    }));
    onUpdateCodesBatch(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.w, canvas.h]);

  // Keep local positions in sync with newly loaded code lists (e.g. an
  // import added codes) while never clobbering drag-in-progress edits.
  useEffect(() => {
    setPositions(prev => {
      const next = new Map(prev);
      let changed = false;
      for (const c of codes) {
        if (c.mapPosition && !prev.has(c.id)) { next.set(c.id, c.mapPosition); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [codes]);

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
  const radiusFor = (codeId: ID) => {
    const count = counts.get(codeId) || 0;
    if (maxCount === 0) return MIN_R;
    return Math.round(MIN_R + (count / maxCount) * (MAX_R - MIN_R));
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

  const styles = mapEdgeStyles || [];
  const findStyle = (kind: MapEdgeStyle['kind'], a: ID, b: ID): MapEdgeStyle | undefined =>
    styles.find(s => s.kind === kind && (
      (s.fromCodeId === a && s.toCodeId === b) || (s.fromCodeId === b && s.toCodeId === a)
    ));

  // All renderable edges, with their override entry (if any) attached.
  const edges = useMemo<EdgeRef[]>(() => {
    const refs: EdgeRef[] = [];
    for (const c of codes) {
      if (!c.parentId) continue;
      refs.push({ key: `hierarchy:${c.parentId}:${c.id}`, kind: 'hierarchy', fromId: c.parentId, toId: c.id });
    }
    if (showCooc) {
      for (const [pair, shared] of sharedDocs) {
        const [a, b] = pair.split('::');
        const ca = codes.find(x => x.id === a);
        const cb = codes.find(x => x.id === b);
        if (!ca || !cb) continue;
        if (ca.parentId === b || cb.parentId === a) continue; // already drawn as hierarchy
        refs.push({ key: `cooccurrence:${pair}`, kind: 'cooccurrence', fromId: a, toId: b });
      }
    }
    for (const s of styles) {
      if (s.kind !== 'custom') continue;
      if (!codes.find(c => c.id === s.fromCodeId) || !codes.find(c => c.id === s.toCodeId)) continue;
      refs.push({ key: `custom:${s.id}`, kind: 'custom', fromId: s.fromCodeId, toId: s.toCodeId, style: s });
    }
    for (const ref of refs) {
      if (!ref.style && ref.kind !== 'custom') ref.style = findStyle(ref.kind, ref.fromId, ref.toId);
    }
    return refs;
  }, [codes, sharedDocs, styles, showCooc]);

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
    if (value === 'custom') {
      setCustomMode(true);
      return;
    }
    const preset = CANVAS_PRESETS[Number(value)];
    rescalePositionsFor(preset.w, preset.h);
    setCustomMode(false);
    setPresetIdx(Number(value));
  };

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
        if (onShowToast) onShowToast(`Custom edge: ${codes.find(c => c.id === drawSource)?.name || ''} → ${code.name}`);
      }
      setDrawSource(null);
      setDrawMode(false);
      return;
    }
    if (onSelectCode) onSelectCode(code);
  }

  function cycleShape(e: React.MouseEvent, code: Code) {
    e.preventDefault();
    e.stopPropagation();
    const idx = SHAPES.indexOf(code.mapShape || 'circle');
    const next = SHAPES[(idx + 1) % SHAPES.length];
    onUpdateCode(code.id, { mapShape: next });
    if (onShowToast) onShowToast(`Shape: ${next}`);
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

  function serializeSvg(): { xml: string | null; width: number; height: number } {
    const el = svgRef.current;
    if (!el) return { xml: null, width: canvas.w, height: canvas.h };
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(canvas.w));
    clone.setAttribute('height', String(canvas.h));
    return {
      xml: `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`,
      width: canvas.w,
      height: canvas.h
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
    const { xml, width, height } = serializeSvg();
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

  const COLOR_PALETTE = ['#0f172a', '#ef4444', '#f59e0b', '#22c55e', '#0ea5e9', '#a78bfa', '#ec4899'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      <div className="sort-row" style={{ gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-dim)', flex: 1, minWidth: '260px' }}>
          Drag nodes to rearrange · right-click a node to change its shape · node size = coding frequency · click a node to open it in the Codebook
        </span>
        <label className="mini-label" style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="checkbox"
            checked={showCooc}
            onChange={e => setShowCooc(e.target.checked)}
          />
          Co-occurrence
        </label>
        <button
          className="mini-btn"
          style={drawMode ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
          onClick={() => { setSelectedKey(null); setDrawMode(m => !m); setDrawSource(null); }}
        >
          {drawMode ? 'Cancel draw' : '✏️ Draw edge'}
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
              onChange={e => setCustomW(Number(e.target.value) || CANVAS_MIN)}
              style={{ width: '64px', fontSize: '12px', padding: '2px 4px' }}
            />
            × H
            <input
              type="number"
              min={CANVAS_MIN}
              max={CANVAS_MAX}
              value={customH}
              onChange={e => setCustomH(Number(e.target.value) || CANVAS_MIN)}
              style={{ width: '64px', fontSize: '12px', padding: '2px 4px' }}
            />
          </span>
        )}
        <button className="mini-btn" onClick={exportSvg}>⬇️ SVG</button>
        <button className="mini-btn" onClick={() => exportRaster('png')}>⬇️ PNG</button>
        <button className="mini-btn" onClick={() => exportRaster('jpeg')}>⬇️ JPEG</button>
      </div>

      {drawMode && (
        <div className="section-hint" style={{ marginBottom: 6 }}>
          {drawSource
            ? <>Click a <strong>second</strong> node to connect it to <strong>{codes.find(c => c.id === drawSource)?.name || '…'}</strong>.</>
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

      {/* Outer container handles scrolling; the inner wrapper carries the
          zoom transform so the paper keeps its true size and scrollbars
          appear when zoomed past the viewport. */}
      <div style={{ flex: 1, minHeight: 0, border: '1px solid var(--border)', borderRadius: '6px', overflow: 'auto', backgroundColor: '#f0f0f0' }}>
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
            cursor: drag ? 'grabbing' : 'grab'
          }}
          onClick={() => { setSelectedKey(null); setDrawMode(false); setDrawSource(null); }}
        >
          <defs>
            <marker id="arrow-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
            </marker>
            <marker id="arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 10 0 L 0 5 L 10 10 z" fill="context-stroke" />
            </marker>
          </defs>

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
            const width =
              e.kind === 'cooccurrence'
                ? Math.min(1.5 + (sharedDocs.get(`${e.fromId}::${e.toId}`) || 1), 4.5)
                : e.kind === 'custom' ? 2.5 : 2;
            const labelPos = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 6 };
            return (
              <g key={e.key}>
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  pointerEvents="stroke"
                  style={{ cursor: 'pointer' }}
                  onClick={ev => { ev.stopPropagation(); setSelectedKey(e.key); }}
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
                  opacity={isSelected ? 1 : 0.9}
                />
                {style?.label && (
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill="#334155"
                    stroke="#f8fafc"
                    strokeWidth={3}
                    paintOrder="stroke"
                    pointerEvents="none"
                  >
                    {style.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {codes.map(c => {
            const pos = positions.get(c.id);
            if (!pos) return null;
            const r = radiusFor(c.id);
            const isDragging = drag?.id === c.id;
            const shape = c.mapShape || 'circle';
            const isDrawSource = drawSource === c.id;
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
                    stroke={isDragging || isDrawSource ? '#0f172a' : 'rgba(15,23,42,0.25)'}
                    strokeWidth={(isDragging || isDrawSource) ? 3 : 1.5}
                  />
                )}
                {shape === 'square' && (
                  <rect
                    x={pos.x - r} y={pos.y - r} width={r * 2} height={r * 2}
                    rx={3}
                    fill={c.color}
                    stroke={isDragging || isDrawSource ? '#0f172a' : 'rgba(15,23,42,0.25)'}
                    strokeWidth={(isDragging || isDrawSource) ? 3 : 1.5}
                  />
                )}
                {shape === 'diamond' && (
                  <polygon
                    points={`${pos.x},${pos.y - r} ${pos.x + r},${pos.y} ${pos.x},${pos.y + r} ${pos.x - r},${pos.y}`}
                    fill={c.color}
                    stroke={isDragging || isDrawSource ? '#0f172a' : 'rgba(15,23,42,0.25)'}
                    strokeWidth={(isDragging || isDrawSource) ? 3 : 1.5}
                  />
                )}
                {isDrawSource && (
                  <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" />
                )}
                <text
                  x={pos.x}
                  y={pos.y + r + 14}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#0f172a"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {truncated(c.name)}
                </text>
                <title>{c.name}{counts.get(c.id) ? ` (${counts.get(c.id)} coded)` : ''}</title>
              </g>
            );
          })}
        </svg>
        </div>
      </div>
    </div>
  );
}

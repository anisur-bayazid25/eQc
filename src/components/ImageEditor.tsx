import React, { useEffect, useRef, useState } from 'react';
import { CodedRegion, Code, ImageSource, ID } from '../domain';

interface Props {
  image: ImageSource;
  regions: CodedRegion[];
  codesById: Map<string, Code>;
  pendingRegion: { x: number; y: number; width: number; height: number } | null;
  onPendingRegionChange: (r: { x: number; y: number; width: number; height: number } | null) => void;
  onClickRegions: (regions: CodedRegion[], clientX: number, clientY: number) => void;
  onRenameImage?: (id: ID, newName: string) => void;
  requestDeleteImage: (id: ID) => void;
  zoom?: number;
  resizingRegionId?: ID | null;
  onFinishResize?: () => void;
  onResizeRegion?: (id: ID, box: Pick<CodedRegion, 'x' | 'y' | 'width' | 'height'>) => void;
}

export default function ImageEditor({ image, regions, codesById, pendingRegion, onPendingRegionChange, onClickRegions, requestDeleteImage, zoom = 1, resizingRegionId, onFinishResize, onResizeRegion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);
  const justDrewRef = useRef(false);
  type Box = Pick<CodedRegion, 'x' | 'y' | 'width' | 'height'>;
  const selected = regions.find(r => r.id === resizingRegionId);
  const [resizeBox, setResizeBox] = useState<Box | null>(null);
  const resizeDrag = useRef<{ handle: string; box: Box; startX: number; startY: number } | null>(null);
  useEffect(() => {
    setResizeBox(null);
    resizeDrag.current = null;
    setDrawing(null);
  }, [image.id, resizingRegionId]);
  useEffect(() => {
    if (!selected) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onFinishResize?.(); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [selected?.id, onFinishResize]);
  const preview = selected ? resizeBox || selected : null;

  function resizeAt(event: React.PointerEvent) {
    const drag = resizeDrag.current;
    if (!drag) return;
    const point = toNormalized(event.clientX, event.clientY);
    const dx = point.x - drag.startX, dy = point.y - drag.startY;
    let left = drag.box.x, right = left + drag.box.width;
    let top = drag.box.y, bottom = top + drag.box.height;
    if (drag.handle.includes('w')) left = Math.max(0, Math.min(left + dx, right - .01));
    if (drag.handle.includes('e')) right = Math.min(1, Math.max(right + dx, left + .01));
    if (drag.handle.includes('n')) top = Math.max(0, Math.min(top + dy, bottom - .01));
    if (drag.handle.includes('s')) bottom = Math.min(1, Math.max(bottom + dy, top + .01));
    setResizeBox({ x: left, y: top, width: right - left, height: bottom - top });
  }

  function toNormalized(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
    };
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 || selected) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setDrawing({ startX: x, startY: y, curX: x, curY: y });
    onPendingRegionChange(null);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!drawing) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setDrawing(prev => (prev ? { ...prev, curX: x, curY: y } : prev));
  }

  function handleMouseUp() {
    if (!drawing) return;
    const x = Math.min(drawing.startX, drawing.curX);
    const y = Math.min(drawing.startY, drawing.curY);
    const width = Math.abs(drawing.curX - drawing.startX);
    const height = Math.abs(drawing.curY - drawing.startY);
    setDrawing(null);
    if (width < 0.01 || height < 0.01) return; // ignore accidental clicks/tiny drags
    justDrewRef.current = true;
    onPendingRegionChange({ x, y, width, height });
  }

  function handleClick(e: React.MouseEvent) {
    if (selected) return;
    if (justDrewRef.current) { justDrewRef.current = false; return; }
    const { x, y } = toNormalized(e.clientX, e.clientY);
    const hits = regions.filter(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
    if (hits.length > 0) onClickRegions(hits, e.clientX, e.clientY);
  }

  const liveBox = drawing
    ? {
        left: `${Math.min(drawing.startX, drawing.curX) * 100}%`,
        top: `${Math.min(drawing.startY, drawing.curY) * 100}%`,
        width: `${Math.abs(drawing.curX - drawing.startX) * 100}%`,
        height: `${Math.abs(drawing.curY - drawing.startY) * 100}%`
      }
    : null;

  return (
    <>
    {selected && <div className="image-resize-toolbar" role="group" aria-label="Resize coded region">
      <span>Resize {codesById.get(selected.codeId)?.name || 'coded region'}: drag a corner or edge.</span>
      <button onClick={() => {
        if (resizeBox && ['x', 'y', 'width', 'height'].some(key => resizeBox[key as keyof Box] !== selected[key as keyof Box])) onResizeRegion?.(selected.id, resizeBox);
        onFinishResize?.();
      }}>Save region size</button>
      <button onClick={() => onFinishResize?.()}>Cancel resize</button>
    </div>}
    <div
      className="image-editor"
      ref={containerRef}
      style={{ width: `${zoom * 100}%`, maxWidth: zoom > 1 ? 'none' : '100%' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      <img src={image.dataUrl} alt={image.name} draggable={false} />

      {regions.map(r => {
        const code = codesById.get(r.codeId);
        const box = r.id === selected?.id && preview ? preview : r;
        return (
          <div
            key={r.id}
            className="coded-region"
            style={{
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`,
              borderColor: code?.color || '#cbd5e1',
              background: (code?.color || '#cbd5e1') + '33'
            }}
            title={code?.name || '?'}
          />
        );
      })}

      {preview && <div className="image-region-resize" style={{ left: `${preview.x * 100}%`, top: `${preview.y * 100}%`, width: `${preview.width * 100}%`, height: `${preview.height * 100}%` }}>
        {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map(handle => <button
          key={handle} className="image-region-handle" aria-label={`Resize region ${handle}`} data-handle={handle}
          style={{ left: handle.includes('w') ? '0%' : handle.includes('e') ? '100%' : '50%', top: handle.includes('n') ? '0%' : handle.includes('s') ? '100%' : '50%', cursor: `${handle}-resize` }}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); const point = toNormalized(e.clientX, e.clientY); resizeDrag.current = { handle, box: { x: preview.x, y: preview.y, width: preview.width, height: preview.height }, startX: point.x, startY: point.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={resizeAt}
          onPointerUp={e => { if (!resizeDrag.current) return; resizeAt(e); resizeDrag.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}
          onPointerCancel={() => { resizeDrag.current = null; setResizeBox(null); }}
        />)}
      </div>}

      {liveBox && <div className="drawing-region" style={liveBox} />}
      {pendingRegion && !liveBox && (
        <div
          className="pending-region"
          style={{
            left: `${pendingRegion.x * 100}%`,
            top: `${pendingRegion.y * 100}%`,
            width: `${pendingRegion.width * 100}%`,
            height: `${pendingRegion.height * 100}%`
          }}
        />
      )}
    </div>
    </>
  );
}

import React, { useRef, useState } from 'react';
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
}

export default function ImageEditor({ image, regions, codesById, pendingRegion, onPendingRegionChange, onClickRegions, requestDeleteImage, zoom = 1 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);
  const justDrewRef = useRef(false);

  function toNormalized(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
    };
  }

  function handleMouseDown(e: React.MouseEvent) {
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
        return (
          <div
            key={r.id}
            className="coded-region"
            style={{
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.width * 100}%`,
              height: `${r.height * 100}%`,
              borderColor: code?.color || '#cbd5e1',
              background: (code?.color || '#cbd5e1') + '33'
            }}
            title={code?.name || '?'}
          />
        );
      })}

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
  );
}
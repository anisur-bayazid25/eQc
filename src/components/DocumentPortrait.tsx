import React, { useState } from 'react';
import { CodedSegment, Code, SourceDoc } from '../domain';

interface Props {
  doc: SourceDoc;
  segments: CodedSegment[];            // already filtered to this doc by the caller
  codesById: Map<string, Code>;
  onJumpToSegment: (segment: CodedSegment) => void;
}

const VIEW_W = 20;
const VIEW_H = 1000;
const MAX_TOOLTIP = 90;

// A single coded passage can be 1px tall in the strip — too thin to hit.
// minH guarantees a usable click/hover target, and hoverH widens the visual
// while hovering so the current line is easy to see and grab.
const MIN_H = 3;
const HOVER_H = 9;

export default function DocumentPortrait({ doc, segments, codesById, onJumpToSegment }: Props) {
  const total = doc.content.length;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  if (total === 0 || segments.length === 0) return null;

  const hoveredSeg = hoveredId ? segments.find(s => s.id === hoveredId) : null;

  const rectProps = (seg: CodedSegment, widen: boolean) => {
    const code = codesById.get(seg.codeId);
    const center = ((seg.start + seg.end) / 2 / total) * VIEW_H;
    const baseH = Math.max(MIN_H, ((seg.end - seg.start) / total) * VIEW_H);
    const height = widen ? Math.max(HOVER_H, baseH) : baseH;
    return {
      y: Math.max(0, Math.min(center - height / 2, VIEW_H - height)),
      height,
      fill: code?.color || '#94a3b8'
    };
  };

  const excerptOf = (seg: CodedSegment) => (seg.text || '').replace(/\s+/g, ' ').trim();

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      style={{ width: '20px', height: '100%', minHeight: 400, display: 'block', cursor: 'pointer' }}
    >
      {/* Single-lane minimap: each segment draws at its proportional text position.
          Opacity lets overlapping passages blend instead of hiding each other. */}
      {segments.map(seg => {
        const { y, height, fill } = rectProps(seg, hoveredId === seg.id);
        const excerpt = excerptOf(seg);
        const code = codesById.get(seg.codeId);
        return (
          <rect
            key={seg.id}
            x={0}
            y={y}
            width={VIEW_W}
            height={height}
            fill={fill}
            opacity={0.6}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredId(seg.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onJumpToSegment(seg)}
          >
            <title>
              {code?.name || 'Unknown code'}
              {excerpt ? `: ${excerpt.length > MAX_TOOLTIP ? excerpt.slice(0, MAX_TOOLTIP) + '…' : excerpt}` : ''}
            </title>
          </rect>
        );
      })}
      {/* The hovered passage redrawn on top so it always widens visibly even
          when buried under overlapping segments, and its enlarged area stays
          clickable. */}
      {hoveredSeg && (
        <rect
          key={`${hoveredSeg.id}-hover`}
          x={0}
          y={rectProps(hoveredSeg, true).y}
          width={VIEW_W}
          height={rectProps(hoveredSeg, true).height}
          fill={rectProps(hoveredSeg, true).fill}
          opacity={0.85}
          stroke="#0f172a"
          strokeWidth={0.75}
          style={{ cursor: 'pointer' }}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => onJumpToSegment(hoveredSeg)}
        >
          <title>{codesById.get(hoveredSeg.codeId)?.name || 'Unknown code'}</title>
        </rect>
      )}
    </svg>
  );
}
import React, { useMemo, useRef } from 'react';
import { CodedSegment, Code, SourceDoc } from '../domain';
import { getSelectionOffsets, SelectionOffsets } from '../lib/textOffsets';

interface Props {
  doc: SourceDoc;
  segments: CodedSegment[];
  codesById: Map<string, Code>;
  onSelectionChange: (sel: SelectionOffsets | null) => void;
  onClickSegment: (segments: CodedSegment[], x: number, y: number) => void;
}

interface Chunk {
  text: string;
  segIds: string[];
}

// Builds non-overlapping render chunks from (possibly overlapping) coded
// segments so the plain content string can be rendered with highlighted
// spans. Overlaps are supported by splitting at every boundary point and
// tinting a chunk covered by more than one segment slightly darker.
function buildChunks(content: string, segments: CodedSegment[]): Chunk[] {
  if (segments.length === 0) return [{ text: content, segIds: [] }];

  const points = new Set<number>([0, content.length]);
  for (const s of segments) {
    points.add(Math.max(0, Math.min(s.start, content.length)));
    points.add(Math.max(0, Math.min(s.end, content.length)));
  }
  const sorted = Array.from(points).sort((a, b) => a - b);

  const chunks: Chunk[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    const covering = segments.filter(s => s.start <= start && s.end >= end);
    chunks.push({ text: content.slice(start, end), segIds: covering.map(s => s.id) });
  }
  return chunks;
}

export default function DocEditor({ doc, segments, codesById, onSelectionChange, onClickSegment }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chunks = useMemo(() => buildChunks(doc.content, segments), [doc.content, segments]);

  const handleMouseUp = () => {
    if (!containerRef.current) return;
    const sel = getSelectionOffsets(containerRef.current);
    onSelectionChange(sel);
  };

  return (
    <div className="doc-editor" ref={containerRef} onMouseUp={handleMouseUp}>
      {chunks.map((chunk, i) => {
        if (chunk.segIds.length === 0) {
          return <span key={i}>{chunk.text}</span>;
        }
        const segsHere = segments.filter(s => chunk.segIds.includes(s.id));
        const primaryCode = codesById.get(segsHere[0].codeId);
        const multi = segsHere.length > 1;
        return (
          <span
            key={i}
            className={`coded-segment${multi ? ' multi-coded' : ''}`}
            style={{ background: primaryCode ? primaryCode.color + '55' : '#cbd5e155' }}
            title={segsHere.map(s => codesById.get(s.codeId)?.name || '?').join(', ')}
            onClick={e => {
              e.stopPropagation();
              onClickSegment(segsHere, e.clientX, e.clientY);
            }}
          >
            {chunk.text}
          </span>
        );
      })}
    </div>
  );
}

import React, { useMemo, useRef, useEffect } from 'react';
import { CodedSegment, Code, SourceDoc } from '../domain';
import { getSelectionOffsets, SelectionOffsets } from '../lib/textOffsets';

interface Props {
  doc: SourceDoc;
  segments: CodedSegment[];
  codesById: Map<string, Code>;
  fontSize?: number;
  fontFamily?: string;
  onSelectionChange: (sel: SelectionOffsets | null) => void;
  onClickSegment: (segments: CodedSegment[], x: number, y: number) => void;
  scrollToSegmentId?: string | null;
  scrollNonce?: number;
  highlightRange?: { start: number; end: number } | null;
  highlightNonce?: number;
}

interface Chunk {
  text: string;
  segIds: string[];
  isSearchMatch?: boolean;
}

// Builds non-overlapping render chunks from (possibly overlapping) coded
// segments so the plain content string can be rendered with highlighted
// spans. Overlaps are supported by splitting at every boundary point and
// tinting a chunk covered by more than one segment slightly darker. An
// optional highlightRange (from a text search match) is treated the same
// way — its boundaries get their own split points, independent of any
// coded segment, so an arbitrary uncoded passage can still be precisely
// targeted and scrolled to.
function buildChunks(content: string, segments: CodedSegment[], highlightRange?: { start: number; end: number } | null): Chunk[] {
  if (segments.length === 0 && !highlightRange) return [{ text: content, segIds: [] }];

  const points = new Set<number>([0, content.length]);
  for (const s of segments) {
    points.add(Math.max(0, Math.min(s.start, content.length)));
    points.add(Math.max(0, Math.min(s.end, content.length)));
  }
  if (highlightRange) {
    points.add(Math.max(0, Math.min(highlightRange.start, content.length)));
    points.add(Math.max(0, Math.min(highlightRange.end, content.length)));
  }
  const sorted = Array.from(points).sort((a, b) => a - b);

  const chunks: Chunk[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    const covering = segments.filter(s => s.start <= start && s.end >= end);
    const isSearchMatch = !!highlightRange && highlightRange.start <= start && highlightRange.end >= end;
    chunks.push({ text: content.slice(start, end), segIds: covering.map(s => s.id), isSearchMatch });
  }
  return chunks;
}

export default function DocEditor({
  doc, segments, codesById, fontSize, fontFamily, onSelectionChange, onClickSegment,
  scrollToSegmentId, scrollNonce, highlightRange, highlightNonce
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chunks = useMemo(() => buildChunks(doc.content, segments, highlightRange), [doc.content, segments, highlightRange]);
  const segById = useMemo(() => new Map(segments.map(s => [s.id, s])), [segments]);

  const handleMouseUp = () => {
    if (!containerRef.current) return;
    const sel = getSelectionOffsets(containerRef.current);
    onSelectionChange(sel);
  };

  // Jump to a specific coded segment (e.g. "Go to Document" from the
  // Codebook tab). Temporary flash — fades after 2s since the segment's
  // own highlight color is the permanent marker.
  useEffect(() => {
    if (!scrollToSegmentId || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-seg-ids~="${scrollToSegmentId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('segment-flash');
    const t = setTimeout(() => el.classList.remove('segment-flash'), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToSegmentId, scrollNonce, chunks]);

  // Jump to a specific text-search match. Persistent highlight (not a
  // fade) — it's driven by chunks[].isSearchMatch, which naturally clears
  // itself once highlightRange changes or is cleared.
  useEffect(() => {
    if (!highlightRange || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>('[data-search-match="true"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightRange, highlightNonce, chunks]);

  return (
    <div
      className="doc-editor"
      ref={containerRef}
      onMouseUp={handleMouseUp}
      style={{
        fontSize: fontSize ? `${fontSize}px` : undefined,
        fontFamily: fontFamily || undefined
      }}
    >
      {chunks.map((chunk, i) => {
        if (chunk.segIds.length === 0) {
          return (
            <span
              key={i}
              className={chunk.isSearchMatch ? 'search-match-highlight' : undefined}
              data-search-match={chunk.isSearchMatch ? 'true' : undefined}
            >
              {chunk.text}
            </span>
          );
        }
        const segsHere = chunk.segIds.map(id => segById.get(id)!);
        const primaryCode = codesById.get(segsHere[0].codeId);
        const multi = segsHere.length > 1;
        return (
          <span
            key={i}
            className={`coded-segment${multi ? ' multi-coded' : ''}${chunk.isSearchMatch ? ' search-match-highlight' : ''}`}
            style={{ background: primaryCode ? primaryCode.color + '55' : '#cbd5e155' }}
            title={segsHere.map(s => codesById.get(s.codeId)?.name || '?').join(', ')}
            data-seg-ids={chunk.segIds.join(' ')}
            data-search-match={chunk.isSearchMatch ? 'true' : undefined}
            onClick={e => {
              e.stopPropagation();
              const selectedText = window.getSelection()?.toString() || '';
              if (selectedText.length > 0) return;
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
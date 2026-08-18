import React, { useMemo, useRef, useEffect, useLayoutEffect, useState } from 'react';
import { CodedSegment, Code, ID, SourceDoc } from '../domain';
import { getSelectionOffsets, SelectionOffsets } from '../lib/textOffsets';

interface Props {
  doc: SourceDoc;
  segments: CodedSegment[];
  codesById: Map<string, Code>;
  fontSize?: number;
  fontFamily?: string;
  onSelectionChange: (sel: SelectionOffsets | null) => void;
  onClickSegment: (segments: CodedSegment[], x: number, y: number) => void;
  onDropCode?: (codeId: ID) => void;
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

// Persistent gutter column width: room for one clipped code-name label per
// line, sitting next to the 3px marker bar.
const GUTTER_W = 168;

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
  doc, segments, codesById, fontSize, fontFamily, onSelectionChange, onClickSegment, onDropCode,
  scrollToSegmentId, scrollNonce, highlightRange, highlightNonce
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chunks = useMemo(() => buildChunks(doc.content, segments, highlightRange), [doc.content, segments, highlightRange]);
  const segById = useMemo(() => new Map(segments.map(s => [s.id, s])), [segments]);

  // Line structure of the plain content: each code line's char offset, plus
  // the marker set for that line (one marker per code present on the line,
  // deduped). Drives the persistent gutter — a rendered static strip next
  // to the text, implemented like the search-match highlight: purely
  // derived, scrolls with the content, no interaction state.
  const lineInfo = useMemo(() => {
    const starts = [0];
    let idx = doc.content.indexOf('\n');
    while (idx !== -1) {
      starts.push(idx + 1);
      idx = doc.content.indexOf('\n', idx + 1);
    }
    const lineOf = (offset: number) => {
      let lo = 0;
      let hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= offset) lo = mid;
        else hi = mid - 1;
      }
      return lo;
    };
    const perLine = new Map<number, { codeId: ID; name: string; color: string }[]>();
    for (const s of segments) {
      if (doc.content.length === 0) break;
      const line = lineOf(Math.min(s.start, doc.content.length - 1));
      const code = codesById.get(s.codeId);
      const marks = perLine.get(line) || [];
      if (!marks.some(m => m.codeId === s.codeId)) {
        marks.push({ codeId: s.codeId, name: code?.name || '?', color: code?.color || '#94a3b8' });
        perLine.set(line, marks);
      }
    }
    return { starts, perLine };
  }, [doc.content, segments, codesById]);

  const gutterOn = segments.length > 0;
  const [lineH, setLineH] = useState(0);
  // Average visual line height: measured from the rendered block so wrapped
  // lines and font changes stay aligned. Runs before paint — no flicker.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !gutterOn) return;
    setLineH(el.scrollHeight / lineInfo.starts.length);
  }, [gutterOn, lineInfo, fontSize, fontFamily]);

  // Track the selection via `selectionchange` rather than mouseup inside the
  // container: a drag that ends over the code search box still counted —
  // the input's focus collapses the browser selection before mouseup fires,
  // but selectionchange observed the live (non-collapsed) range during the
  // drag. Sticky rule: if the selection collapses because focus moved
  // *outside* the document (e.g. the search box), keep the last good
  // selection so the user can search and apply codes afterwards.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        if (container.contains(range.commonAncestorContainer)) {
          onSelectionChange(null); // clicked inside the doc without selecting
        }
        return; // collapsed outside (e.g. search box focus) → keep sticky selection
      }
      if (container.contains(range.commonAncestorContainer)) {
        const offsets = getSelectionOffsets(container);
        if (offsets) onSelectionChange(offsets);
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [onSelectionChange]);

  // Drop a code (legend or search results) onto the text: applies to the
  // sticky selection, or falls back to the same unified code action as a click.
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('text/plain')) e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    const codeId = e.dataTransfer.getData('text/plain');
    if (!codeId) return;
    e.preventDefault();
    onDropCode?.(codeId);
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
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        paddingLeft: gutterOn ? GUTTER_W : undefined,
        fontSize: fontSize ? `${fontSize}px` : undefined,
        fontFamily: fontFamily || undefined
      }}
    >
      {gutterOn && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: GUTTER_W,
            overflow: 'hidden',
            borderRight: '1px solid #e2e8f0',
            pointerEvents: 'none'
          }}
        >
          {Array.from(lineInfo.perLine.entries()).map(([line, marks]) => (
            <div
              key={line}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: line * (lineH || (fontSize || 14) * 1.7),
                height: lineH || (fontSize || 14) * 1.7,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 8px 0 0',
                boxSizing: 'border-box'
              }}
            >
              <span
                style={{ width: 3, flexShrink: 0, alignSelf: 'stretch', backgroundColor: marks[0].color, borderRadius: 2 }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1e293b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0
                }}
              >
                {marks.map(m => m.name).join(' · ')}
              </span>
            </div>
          ))}
        </div>
      )}
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
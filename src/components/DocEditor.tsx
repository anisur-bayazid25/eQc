import React, { useMemo, useRef, useEffect } from 'react';
import { CodedSegment, Code, ID, SourceDoc, PassageAnnotation } from '../domain';
import { getSelectionOffsets, SelectionOffsets } from '../lib/textOffsets';
import { useReaderKeyboardSelection } from '../lib/readerKeyboardSelection';
import { sourceLines } from '../lib/sourceLines';

interface Props {
  doc: SourceDoc;
  segments: CodedSegment[];
  annotations?: PassageAnnotation[];
  onClickAnnotation?: (ids: string[]) => void;
  codesById: Map<string, Code>;
  fontSize?: number;
  fontFamily?: string;
  showLineNumbers?: boolean;
  onSelectionChange: (sel: SelectionOffsets | null) => void;
  onClickSegment: (segments: CodedSegment[], x: number, y: number) => void;
  onDropCode?: (codeId: ID) => void;
  scrollToSegmentId?: string | null;
  scrollNonce?: number;
  highlightRange?: { start: number; end: number } | null;
  highlightNonce?: number;
}

interface Chunk {
  start: number;
  end: number;
  text: string;
  segIds: string[];
  annotationIds: string[];
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
function buildChunks(content: string, segments: CodedSegment[], highlightRange?: { start: number; end: number } | null, annotations: PassageAnnotation[] = []): Chunk[] {
  const points = new Set<number>([0, content.length]);
  for (const line of sourceLines(content)) { points.add(line.start); points.add(line.end); }
  for (const s of [...segments,...annotations]) {
    points.add(Math.max(0, Math.min(s.start, content.length)));
    points.add(Math.max(0, Math.min(s.end, content.length)));
  }
  if (highlightRange) {
    points.add(Math.max(0, Math.min(highlightRange.start, content.length)));
    points.add(Math.max(0, Math.min(highlightRange.end, content.length)));
  }
  const sorted = Array.from(points).sort((a, b) => a - b);

  // Sweep interval boundaries once. Scanning every segment at every line and
  // boundary made long, densely coded transcripts increasingly expensive.
  function intervalIndex<T extends {start:number;end:number}>(items:T[]) {
    const starts=new Map<number,number[]>(),ends=new Map<number,number[]>();
    items.forEach((item,index)=>{
      const start=Math.max(0,item.start),end=Math.min(content.length,item.end);
      if(end<=start)return;
      starts.set(start,[...(starts.get(start)||[]),index]);ends.set(end,[...(ends.get(end)||[]),index]);
    });
    const active=new Set<number>();
    return (point:number)=>{
      for(const index of ends.get(point)||[])active.delete(index);
      for(const index of starts.get(point)||[])active.add(index);
      return [...active].sort((a,b)=>a-b).map(index=>items[index]);
    };
  }
  const coveringSegments=intervalIndex(segments),coveringAnnotations=intervalIndex(annotations);

  const chunks: Chunk[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    const covering = coveringSegments(start);
    const isSearchMatch = !!highlightRange && highlightRange.start <= start && highlightRange.end >= end;
    chunks.push({ start, end, text: content.slice(start, end), segIds: covering.map(s => s.id), annotationIds:coveringAnnotations(start).map(a=>a.id), isSearchMatch });
  }
  return chunks;
}

function DocEditorView({
  doc, segments, annotations, onClickAnnotation, codesById, fontSize, fontFamily, showLineNumbers = false, onSelectionChange, onClickSegment, onDropCode,
  scrollToSegmentId, scrollNonce, highlightRange, highlightNonce
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  useReaderKeyboardSelection(containerRef);
  const chunks = useMemo(() => buildChunks(doc.content, segments, highlightRange, annotations), [doc.content, segments, highlightRange, annotations]);
  const lines = useMemo(() => sourceLines(doc.content), [doc.content]);
  const chunksByLine = useMemo(() => {
    const grouped: Chunk[][] = lines.map(() => []);
    let index = 0;
    for (const chunk of chunks) {
      while (index + 1 < lines.length && chunk.start >= lines[index + 1].start) index++;
      grouped[index].push(chunk);
    }
    return grouped;
  }, [lines, chunks]);
  const segById = useMemo(() => new Map(segments.map(s => [s.id, s])), [segments]);

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

  const renderChunk = (chunk: Chunk) => {
        if (chunk.segIds.length === 0) {
          return (
            <span
              key={chunk.start}
              className={`${chunk.isSearchMatch ? 'search-match-highlight' : ''}${chunk.annotationIds.length ? ' passage-annotation' : ''}`}
              title={chunk.annotationIds.length ? annotations?.filter(a=>chunk.annotationIds.includes(a.id)).map(a=>a.note).join('\n') : undefined}
              onClick={chunk.annotationIds.length ? () => { if(!window.getSelection()?.toString())onClickAnnotation?.(chunk.annotationIds); } : undefined}
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
            key={chunk.start}
            className={`coded-segment${multi ? ' multi-coded' : ''}${chunk.isSearchMatch ? ' search-match-highlight' : ''}${chunk.annotationIds.length ? ' passage-annotation' : ''}`}
            style={{ background: primaryCode ? primaryCode.color + '55' : '#cbd5e155' }}
            title={segsHere.map(s => codesById.get(s.codeId)?.name || '?').join(', ')}
            data-seg-ids={chunk.segIds.join(' ')}
            data-search-match={chunk.isSearchMatch ? 'true' : undefined}
            onClick={e => {
              e.stopPropagation();
              const selectedText = window.getSelection()?.toString() || '';
              if (selectedText.length > 0) return;
              if (chunk.annotationIds.length) { onClickAnnotation?.(chunk.annotationIds); return; }
              onClickSegment(segsHere, e.clientX, e.clientY);
            }}
          >
            {chunk.text}
          </span>
        );

  };

  return (
    <div
      className={`doc-editor${showLineNumbers ? ' with-source-lines' : ''}`}
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        fontSize: fontSize ? `${fontSize}px` : undefined,
        fontFamily: fontFamily || undefined
      }}
    >
      {showLineNumbers ? lines.map((line, index) => (
        <span className="doc-source-line" data-line-number={line.number} key={line.start}>
          {chunksByLine[index].map(renderChunk)}
        </span>
      )) : chunks.map(renderChunk)}
    </div>
  );
}

const MemoDocEditor = React.memo(DocEditorView);
// The reader's text can be large. Parent UI updates (search, menus, autosave)
// must not recreate every span or reattach the selection listener.
export default function DocEditor(props: Props) {
  const latest = useRef(props); latest.current = props;
  const callbacks = useMemo(() => ({
    onSelectionChange: (selection: SelectionOffsets | null) => latest.current.onSelectionChange(selection),
    onClickSegment: (segments: CodedSegment[], x: number, y: number) => latest.current.onClickSegment(segments, x, y),
    onClickAnnotation: (ids: string[]) => latest.current.onClickAnnotation?.(ids),
    onDropCode: (id: ID) => latest.current.onDropCode?.(id)
  }), []);
  const highlightRange = useMemo(() => props.highlightRange ? {...props.highlightRange} : null, [props.highlightRange?.start, props.highlightRange?.end]);
  return <MemoDocEditor {...props} {...callbacks} highlightRange={highlightRange} />;
}

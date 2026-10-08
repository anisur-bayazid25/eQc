import React, { useEffect, useRef } from 'react';
import { Code, CodedRegion, CodedSegment, ImageSource, SourceDoc, PassageAnnotation } from '../domain';
import { SelectionOffsets } from '../lib/textOffsets';
import { MappedNode, readMappedSelection, TextMapping } from '../lib/formattedMapping';

export interface PdfRegionSelection {
  docId: string; page: number; originalHash: string; dataUrl: string;
  x: number; y: number; width: number; height: number;
}

export interface FormattedProps {
  doc: SourceDoc; segments: CodedSegment[]; codesById: Map<string, Code>;
  annotations?: PassageAnnotation[]; onClickAnnotation?: () => void;
  onSelectionChange: (selection: SelectionOffsets | null) => void;
  onClickSegment: (segments: CodedSegment[], x: number, y: number) => void;
  onDropCode?: (id: string) => void;
  scrollToSegmentId?: string | null; scrollNonce?: number;
  highlightRange?: { start: number; end: number } | null; highlightNonce?: number;
  images?: ImageSource[]; regions?: CodedRegion[];
  onPdfRegion?: (region: PdfRegionSelection | null) => void;
  onClickRegions?: (regions: CodedRegion[], x: number, y: number) => void;
}

// Split text nodes only; paragraph/table layout and PDF text positioning survive.
export function decorateMappedText(root: HTMLElement, nodes: MappedNode[], mapping: TextMapping, props: FormattedProps) {
  const events = props.segments.flatMap(s => [{ offset: s.start, segment: s, add: true }, { offset: s.end, segment: s, add: false }]).sort((a, b) => a.offset - b.offset);
  const activeSegments = new Map<string, CodedSegment>();
  const annotationEvents=(props.annotations||[]).flatMap(a=>[{offset:a.start,annotation:a,add:true},{offset:a.end,annotation:a,add:false}]).sort((a,b)=>a.offset-b.offset);
  const activeAnnotations=new Map<string,PassageAnnotation>();let annotationCursor=0;
  let cursor = 0;
  const signatures = Array.from(mapping.offsets, offset => {
    if (offset >= 0) while (cursor < events.length && events[cursor].offset <= offset) {
      const event = events[cursor++];
      if (event.add) activeSegments.set(event.segment.id, event.segment); else activeSegments.delete(event.segment.id);
    }
    const hits = offset < 0 ? [] : Array.from(activeSegments.values());
    const search = offset >= 0 && !!props.highlightRange && offset >= props.highlightRange.start && offset < props.highlightRange.end;
    if(offset>=0)while(annotationCursor<annotationEvents.length&&annotationEvents[annotationCursor].offset<=offset){const e=annotationEvents[annotationCursor++];if(e.add)activeAnnotations.set(e.annotation.id,e.annotation);else activeAnnotations.delete(e.annotation.id);}
    const annotations = offset<0 ? [] : Array.from(activeAnnotations.values());
    return { hits, search, annotations, key: `${hits.map(s => s.id).join(' ')}|${search}|${annotations.map(a=>a.id).join(' ')}` };
  });
  for (const item of nodes) {
    const text = item.node.data;
    const fragment = document.createDocumentFragment();
    let start = 0;
    while (start < text.length) {
      const active = signatures[item.start + start];
      let end = start + 1;
      while (end < text.length && signatures[item.start + end].key === active.key) end++;
      if (!active.hits.length && !active.search && !active.annotations.length) fragment.append(document.createTextNode(text.slice(start, end)));
      else {
        const span = document.createElement('span'); span.className = 'formatted-mark';
        span.textContent = text.slice(start, end);
        if(active.annotations.length) { span.classList.add('passage-annotation');span.dataset.annotationIds=active.annotations.map(a=>a.id).join(' ');span.title=active.annotations.map(a=>a.note).join('\n'); }
        if (active.hits.length) {
          span.dataset.segIds = active.hits.map(s => s.id).join(' ');
          span.style.backgroundColor = (props.codesById.get(active.hits[0].codeId)?.color || '#facc15') + '55';
          span.title = active.hits.map(s => props.codesById.get(s.codeId)?.name || 'Code').join(', ');
        }
        if (active.search) { span.dataset.searchMatch = 'true'; span.classList.add('search-match-highlight'); }
        fragment.append(span);
      }
      start = end;
    }
    item.node.replaceWith(fragment);
  }
}

export function useMappedInteractions(rootRef: React.RefObject<HTMLDivElement>, mappingRef: React.MutableRefObject<{ nodes: MappedNode[]; mapping: TextMapping } | null>, props: FormattedProps, ready: number, setWarning: (text: string) => void) {
  const latest = useRef(props); latest.current = props;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const changed = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      if (range.collapsed) { latest.current.onSelectionChange(null); return; }
      const indexed = mappingRef.current;
      if (!indexed) return;
      if (latest.current.doc.original?.textChanged) {
        latest.current.onSelectionChange(null);
        setWarning('The coding text has changed. Use Plain text to code it; this view shows the retained original.'); return;
      }
      const result = readMappedSelection(root, indexed.nodes, indexed.mapping);
      latest.current.onSelectionChange(result);
      setWarning(result ? '' : 'This selection cannot be matched safely to the coding text. Use Plain text for this passage.');
    };
    const clicked = (event: MouseEvent) => {
      if (window.getSelection()?.toString().trim()) return;
      const target = (event.target as Element).closest<HTMLElement>('[data-seg-ids]');
      if (!target) { if((event.target as Element).closest('[data-annotation-ids]'))latest.current.onClickAnnotation?.(); return; }
      const ids = new Set(target.dataset.segIds?.split(' '));
      latest.current.onClickSegment(latest.current.segments.filter(s => ids.has(s.id)), event.clientX, event.clientY);
    };
    root.addEventListener('click', clicked); document.addEventListener('selectionchange', changed);
    return () => { root.removeEventListener('click', clicked); document.removeEventListener('selectionchange', changed); };
  }, [ready]);
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const target = props.scrollToSegmentId
      ? Array.from(root.querySelectorAll<HTMLElement>('[data-seg-ids]')).find(el => el.dataset.segIds?.split(' ').includes(props.scrollToSegmentId!))
      : root.querySelector<HTMLElement>('[data-search-match]');
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [ready, props.scrollToSegmentId, props.scrollNonce, props.highlightNonce]);
}

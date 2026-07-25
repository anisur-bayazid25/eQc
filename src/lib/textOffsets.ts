// Walks all text nodes under `container` in document order and returns the
// combined plain-text offset of a given (node, nodeOffset) pair. This lets
// us translate a live window.getSelection() range — which is expressed in
// terms of DOM nodes — into the plain character offsets we store in
// CodedSegment.start / CodedSegment.end (which index into doc.content).
function textOffsetOf(container: Node, targetNode: Node, targetOffset: number): number {
  let offset = 0;
  let found = -1;

  function walk(node: Node): boolean {
    if (node === targetNode) {
      offset += targetOffset;
      found = offset;
      return true;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += (node.textContent || '').length;
      return false;
    }
    for (const child of Array.from(node.childNodes)) {
      if (walk(child)) return true;
    }
    return false;
  }

  walk(container);
  return found === -1 ? offset : found;
}

export interface SelectionOffsets {
  start: number;
  end: number;
  text: string;
}

export function getSelectionOffsets(container: HTMLElement): SelectionOffsets | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const startOffset = textOffsetOf(container, range.startContainer, range.startOffset);
  const endOffset = textOffsetOf(container, range.endContainer, range.endOffset);
  const start = Math.min(startOffset, endOffset);
  const end = Math.max(startOffset, endOffset);
  const text = range.toString();
  if (!text.trim()) return null;
  return { start, end, text };
}

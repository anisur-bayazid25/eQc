import { diffChars } from 'diff';
import { SelectionOffsets } from './textOffsets';

// Rendering may change whitespace, or the casing of headings (html-to-text).
// Never use quote lookup: repeated passages must keep their own positions.
function compact(text: string) {
  let value = '';
  const offsets: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue;
    const lower = text[i].toLowerCase();
    value += lower;
    for (let j = 0; j < lower.length; j++) offsets.push(i);
  }
  return { value, offsets };
}

export interface TextMapping { rendered: string; canonical: string; offsets: Int32Array; matched: number; normalizedCanonical: string; normalizedRendered: string }

export function mapFormattedText(canonical: string, rendered: string): TextMapping {
  const left = compact(canonical), right = compact(rendered);
  const offsets = new Int32Array(rendered.length).fill(-1);
  // Bound the cost for unrelated attachments instead of freezing the reader.
  const changes = diffChars(left.value, right.value, { maxEditLength: 2000 }) || [];
  let a = 0, b = 0, matched = 0;
  for (const change of changes) {
    if (change.added) b += change.value.length;
    else if (change.removed) a += change.value.length;
    else {
      for (let i = 0; i < change.value.length; i++) {
        offsets[right.offsets[b + i]] = left.offsets[a + i];
        matched++;
      }
      a += change.value.length; b += change.value.length;
    }
  }
  return { canonical, rendered, offsets, matched, normalizedCanonical: left.value, normalizedRendered: right.value };
}

export function mappedSelection(mapping: TextMapping, start: number, end: number): SelectionOffsets | null {
  const selected = mapping.rendered.slice(start, end);
  if (!selected.trim()) return null;
  let first = -1, last = -1;
  for (let i = start; i < end; i++) {
    if (/\s/.test(mapping.rendered[i])) continue;
    const offset = mapping.offsets[i];
    if (offset < 0 || (last >= 0 && offset < last)) return null;
    if (first < 0) first = offset;
    last = offset;
  }
  if (first < 0) return null;
  const text = mapping.canonical.slice(first, last + 1);
  const normalized = compact(selected).value;
  if (compact(text).value !== normalized) return null;
  // If an attachment omits/adds a repeated passage, alignment alone cannot
  // establish which occurrence it represents. Require equal multiplicity.
  if (mapping.normalizedCanonical !== mapping.normalizedRendered) {
    const count = (haystack: string) => {
      let total = 0, at = 0;
      while ((at = haystack.indexOf(normalized, at)) >= 0) { total++; at += normalized.length; }
      return total;
    };
    if (count(mapping.normalizedCanonical) !== count(mapping.normalizedRendered)) return null;
  }
  return { start: first, end: last + 1, text };
}

export interface MappedNode { node: Text; start: number; end: number }

export function collectMappedNodes(root: HTMLElement, accepts: (node: Text) => boolean): { nodes: MappedNode[]; text: string } {
  const nodes: MappedNode[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = '', node: Node | null;
  while ((node = walker.nextNode())) {
    if (!accepts(node as Text)) continue;
    const start = text.length;
    text += node.textContent || '';
    nodes.push({ node: node as Text, start, end: text.length });
  }
  return { nodes, text };
}

export function readMappedSelection(root: HTMLElement, nodes: MappedNode[], mapping: TextMapping): SelectionOffsets | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  function position(target: Node, offset: number) {
    const prefix = document.createRange(); prefix.selectNodeContents(root); prefix.setEnd(target, offset);
    let total = 0;
    for (const item of nodes) {
      if (item.node === target) { total += offset; break; }
      if (prefix.comparePoint(item.node, item.node.length) <= 0) total += item.node.length;
      else break;
    }
    return total;
  }
  const start = position(range.startContainer, range.startOffset), end = position(range.endContainer, range.endOffset);
  // Headers/footers and generated footnote numbers may be visible but absent
  // from the canonical source. Do not silently discard them from a selection.
  if (compact(range.toString()).value !== compact(mapping.rendered.slice(start, end)).value) return null;
  return mappedSelection(mapping, start, end);
}

export function originalBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

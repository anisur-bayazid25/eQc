import { diffChars } from 'diff';
import { CodedSegment } from '../domain';

export interface RelocateResult {
  segments: CodedSegment[];
  keptCount: number;
  droppedCount: number;
}

// When a document's plain-text content changes, every CodedSegment's
// start/end offsets (which index into the OLD content string) become
// stale. Rather than re-searching for each segment's quoted text (fragile
// when the same phrase appears more than once, or when a large edit
// happens to shift things unpredictably), we compute a character-level
// diff between the old and new content and build an exact old->new
// position mapping through every UNCHANGED run of characters.
//
// A coded segment survives the edit, at its correctly shifted position,
// as long as its entire [start, end) range falls inside unchanged text —
// no matter what else was added, removed, or rearranged elsewhere in the
// document. A segment is only dropped if the edit actually touched
// (added into, or removed from) that exact span.
export function relocateSegmentsAfterEdit(
  oldContent: string,
  newContent: string,
  segments: CodedSegment[]
): RelocateResult {
  if (oldContent === newContent) {
    return { segments, keptCount: segments.length, droppedCount: 0 };
  }

  const changes = diffChars(oldContent, newContent);

  // oldToNew[i] = the corresponding index in newContent for old index i,
  // defined only for characters that are part of an unchanged run.
  const oldToNew = new Array<number>(oldContent.length + 1).fill(-1);
  const removedRanges: Array<[number, number]> = [];

  let oldIdx = 0;
  let newIdx = 0;
  for (const part of changes) {
    const len = part.value.length;
    if (part.added) {
      newIdx += len;
    } else if (part.removed) {
      removedRanges.push([oldIdx, oldIdx + len]);
      oldIdx += len;
    } else {
      for (let k = 0; k < len; k++) {
        oldToNew[oldIdx + k] = newIdx + k;
      }
      oldIdx += len;
      newIdx += len;
    }
  }
  // End-of-content marker, so a segment ending exactly at the end of the
  // document (end === oldContent.length) can still resolve a new end.
  oldToNew[oldContent.length] = newIdx;

  function touchesRemoved(start: number, end: number): boolean {
    return removedRanges.some(([rs, re]) => start < re && rs < end);
  }

  const kept: CodedSegment[] = [];
  let dropped = 0;

  for (const seg of segments) {
    if (seg.start >= seg.end || touchesRemoved(seg.start, seg.end)) {
      dropped++;
      continue;
    }
    const newStart = oldToNew[seg.start];
    // end may land on a boundary not itself marked in oldToNew if the very
    // next old character was removed; fall back to (last kept char + 1).
    let newEnd = oldToNew[seg.end];
    if (newEnd === -1) {
      newEnd = oldToNew[seg.end - 1] !== -1 ? oldToNew[seg.end - 1] + 1 : -1;
    }
    if (newStart === -1 || newEnd === -1 || newEnd <= newStart) {
      dropped++;
      continue;
    }
    kept.push({ ...seg, start: newStart, end: newEnd, text: newContent.slice(newStart, newEnd) });
  }

  return { segments: kept, keptCount: kept.length, droppedCount: dropped };
}

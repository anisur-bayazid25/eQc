import { diffChars } from 'diff';
import { CodedSegment } from '../domain';

export interface RelocateResult {
  segments: CodedSegment[];
  keptCount: number;
  droppedCount: number;
}

// Line endings are normalised before diffing, then translated back, so that a
// Windows CRLF source can be edited in an HTML <textarea> (which always hands
// back LF) without every line break reading as "deleted". Without this, one
// keystroke turned every coded passage that spans a line break into a
// "could not be found" drop.
function normalizeNewlines(text: string): { normalized: string; toOriginal: number[] } {
  const toOriginal: number[] = [];
  let normalized = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\r') {
      toOriginal.push(i);
      if (text[i + 1] === '\n') i += 1; // CRLF collapses to one LF
      normalized += '\n';
    } else {
      toOriginal.push(i);
      normalized += ch;
    }
  }
  toOriginal.push(text.length); // end boundary
  return { normalized, toOriginal };
}

// Index in normalised text for an offset in the original text. `toOriginal` is
// non-decreasing, so the boundary is the count of normalised characters that
// start strictly before `originalIndex`.
function toNormalizedIndex(toOriginal: number[], originalIndex: number): number {
  let lo = 0;
  let hi = toOriginal.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (toOriginal[mid] < originalIndex) lo = mid + 1;
    else hi = mid;
  }
  return lo;
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

  const oldSide = normalizeNewlines(oldContent);
  const newSide = normalizeNewlines(newContent);
  const oldText = oldSide.normalized;
  const newText = newSide.normalized;

  const changes = diffChars(oldText, newText);

  // oldToNew[i] = the corresponding index in newText for old index i,
  // defined only for characters that are part of an unchanged run.
  const oldToNew = new Array<number>(oldText.length + 1).fill(-1);
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
  // End-of-content boundary, so a segment ending exactly at the end of the
  // document can still resolve a new end.
  oldToNew[oldText.length] = newIdx;

  function touchesRemoved(start: number, end: number): boolean {
    return removedRanges.some(([rs, re]) => start < re && rs < end);
  }

  const kept: CodedSegment[] = [];
  let dropped = 0;

  for (const seg of segments) {
    if (!Number.isInteger(seg.start) || !Number.isInteger(seg.end) || seg.start < 0 || seg.end > oldContent.length) {
      dropped++;
      continue;
    }
    if (seg.start >= seg.end) {
      dropped++;
      continue;
    }
    const segStart = toNormalizedIndex(oldSide.toOriginal, seg.start);
    const segEnd = toNormalizedIndex(oldSide.toOriginal, seg.end);
    if (segStart >= segEnd || touchesRemoved(segStart, segEnd)) {
      dropped++;
      continue;
    }
    const newStartNorm = oldToNew[segStart];
    if (newStartNorm === -1) {
      dropped++;
      continue;
    }
    // The range is [start, end): the last character is end-1, so the new end is
    // one past where that character landed. Using the boundary at `end` would
    // pull anything inserted immediately after the quote into the quote itself
    // (appending at the end of a document did exactly that).
    const lastChar = oldToNew[segEnd - 1];
    if (lastChar === -1) {
      dropped++;
      continue;
    }
    const newEndNorm = lastChar + 1;
    if (newEndNorm <= newStartNorm) {
      dropped++;
      continue;
    }
    const newStart = newSide.toOriginal[newStartNorm];
    const newEnd = newSide.toOriginal[newEndNorm];
    if (!Number.isInteger(newStart) || !Number.isInteger(newEnd) || newEnd <= newStart) {
      dropped++;
      continue;
    }
    kept.push({ ...seg, start: newStart, end: newEnd, text: newContent.slice(newStart, newEnd) });
  }

  return { segments: kept, keptCount: kept.length, droppedCount: dropped };
}

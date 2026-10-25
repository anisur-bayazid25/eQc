import { Project, Code } from '../domain';

export interface FrequencyRow {
  code: Code;
  count: number;
}

export function codingFrequency(project: Project): FrequencyRow[] {
  const counts = new Map<string, number>();
  for (const seg of project.codedSegments) {
    counts.set(seg.codeId, (counts.get(seg.codeId) || 0) + 1);
  }
  return project.codes
    .map(code => ({ code, count: counts.get(code.id) || 0 }))
    .sort((a, b) => b.count - a.count);
}

// codes x documents: number of coded segments for each code within each document.
export function codeDocumentMatrix(project: Project): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();
  for (const code of project.codes) {
    matrix.set(code.id, new Map());
  }
  for (const seg of project.codedSegments) {
    const row = matrix.get(seg.codeId);
    if (!row) continue;
    row.set(seg.docId, (row.get(seg.docId) || 0) + 1);
  }
  return matrix;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// codes x codes: number of times two different codes are applied to
// overlapping (or identical) text spans within the same document.
//
// Identical ranges are deduplicated per code first. Pooled multi-coder projects
// repeat the same range once per coder; counting each row made this matrix
// disagree with the heat map, network and Sankey views (which dedupe): three
// coders coding one passage gave 9 here and 1 there. It also matches the
// wording used across the app ("identical code/document/ranges deduplicated
// across coders").
export function codeCooccurrenceMatrix(project: Project): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();
  for (const code of project.codes) {
    matrix.set(code.id, new Map());
  }

  // docId -> codeId -> unique ranges in that document
  const byDoc = new Map<string, Map<string, Array<{ start: number; end: number }>>>();
  const seen = new Set<string>();
  for (const seg of project.codedSegments) {
    if (!matrix.has(seg.codeId)) continue;
    if (!Number.isInteger(seg.start) || !Number.isInteger(seg.end) || seg.start < 0 || seg.end <= seg.start) continue;
    const key = `${seg.docId}\u0000${seg.codeId}\u0000${seg.start}\u0000${seg.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!byDoc.has(seg.docId)) byDoc.set(seg.docId, new Map());
    const perCode = byDoc.get(seg.docId)!;
    if (!perCode.has(seg.codeId)) perCode.set(seg.codeId, []);
    perCode.get(seg.codeId)!.push({ start: seg.start, end: seg.end });
  }

  for (const perCode of byDoc.values()) {
    const codeIds = Array.from(perCode.keys());
    for (let i = 0; i < codeIds.length; i++) {
      for (let j = i + 1; j < codeIds.length; j++) {
        const aId = codeIds[i];
        const bId = codeIds[j];
        let count = 0;
        for (const a of perCode.get(aId)!) {
          for (const b of perCode.get(bId)!) {
            if (rangesOverlap(a.start, a.end, b.start, b.end)) count++;
          }
        }
        if (!count) continue;
        const rowA = matrix.get(aId)!;
        const rowB = matrix.get(bId)!;
        rowA.set(bId, (rowA.get(bId) || 0) + count);
        rowB.set(aId, (rowB.get(aId) || 0) + count);
      }
    }
  }

  return matrix;
}

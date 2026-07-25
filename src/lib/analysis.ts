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
export function codeCooccurrenceMatrix(project: Project): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();
  for (const code of project.codes) {
    matrix.set(code.id, new Map());
  }

  const byDoc = new Map<string, typeof project.codedSegments>();
  for (const seg of project.codedSegments) {
    if (!byDoc.has(seg.docId)) byDoc.set(seg.docId, []);
    byDoc.get(seg.docId)!.push(seg);
  }

  for (const segments of byDoc.values()) {
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i];
        const b = segments[j];
        if (a.codeId === b.codeId) continue;
        if (!rangesOverlap(a.start, a.end, b.start, b.end)) continue;
        const rowA = matrix.get(a.codeId)!;
        const rowB = matrix.get(b.codeId)!;
        rowA.set(b.codeId, (rowA.get(b.codeId) || 0) + 1);
        rowB.set(a.codeId, (rowB.get(a.codeId) || 0) + 1);
      }
    }
  }

  return matrix;
}

import { Project, Code, codeAncestorPath, childCodes, UNATTRIBUTED_CODER } from '../domain';

export type ExportScope = 'codesOnly' | 'codesExcerpts' | 'codesExcerptsSummaries' | 'full';

export const SCOPE_LABELS: Record<ExportScope, string> = {
  codesOnly: 'Codes only (codebook)',
  codesExcerpts: 'Codes + excerpts',
  codesExcerptsSummaries: 'Codes + excerpts + summaries',
  full: 'Document + codes + excerpts + summaries'
};

function csvEscape(v: string | undefined): string {
  const s = v ?? '';
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function rowsToCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');
}

// Breaks a code's hierarchy into up to 3 columns (Parent / Child 1 / Child 2)
// — deliberately matching the same header names your CSV importer already
// recognizes, so codesExcerpts/Summaries/full exports can be re-imported
// into another project via "Import Dataset (CSV)" if you ever want to.
function codeLevelColumns(codes: Code[], code: Code): [string, string, string] {
  const path = [...codeAncestorPath(codes, code), code.name];
  return [
    path[0] || '',
    path[1] || '',
    path.length > 3 ? path.slice(2).join(' > ') : (path[2] || '')
  ];
}

// Same 3-column shape for coding definitions: each level's own definition.
// Deeper than 3 levels, the Child 2 slot carries the deepest code's
// definition. Header names mirror the importer's definition routing, so a
// codebook export re-imports its definitions losslessly.
function codeLevelDefinitions(codes: Code[], code: Code): [string, string, string] {
  const pathNames = [...codeAncestorPath(codes, code), code.name];
  let parentId: string | null = null;
  const pathCodes: (Code | undefined)[] = pathNames.map(name => {
    const found = codes.find(c => c.parentId === parentId && c.name === name);
    parentId = found ? found.id : null;
    return found;
  });
  return [
    pathCodes[0]?.definition || '',
    pathCodes[1]?.definition || '',
    pathCodes.length > 3
      ? pathCodes[pathCodes.length - 1]?.definition || ''
      : (pathCodes[2]?.definition || '')
  ];
}

export interface ScopedExport {
  headers: string[];
  rows: string[][];
  csv: string;
}

export function buildScopedExport(project: Project, scope: ExportScope): ScopedExport {
  const docsById = new Map(project.docs.map(d => [d.id, d]));

  if (scope === 'codesOnly') {
    const headers = ['Parent Node', 'Child Node 1', 'Child Node 2', 'Definition of Parent', 'Definition of Child 1', 'Definition of Child 2'];
    const rows = project.codes.map(c => [...codeLevelColumns(project.codes, c), ...codeLevelDefinitions(project.codes, c)]);
    return { headers, rows, csv: rowsToCsv(headers, rows) };
  }

  const includeSummary = scope === 'codesExcerptsSummaries' || scope === 'full';
  const includeDocument = scope === 'full';
  const headers = [
    ...(includeDocument ? ['Document'] : []),
    'Parent Node', 'Child Node 1', 'Child Node 2', 'Quote', 'Coder',
    ...(includeSummary ? ['Code Summary', 'Code Definition'] : [])
  ];

  let segs = [...project.codedSegments];
  if (includeDocument) {
    segs.sort((a, b) => {
      const da = docsById.get(a.docId)?.name || '';
      const db = docsById.get(b.docId)?.name || '';
      return da !== db ? da.localeCompare(db) : a.start - b.start;
    });
  }

  const rows: string[][] = [];
  for (const seg of segs) {
    const code = project.codes.find(c => c.id === seg.codeId);
    if (!code) continue;
    const [parent, child1, child2] = codeLevelColumns(project.codes, code);
    const row: string[] = [];
    if (includeDocument) row.push(docsById.get(seg.docId)?.name || 'Unknown source');
    row.push(parent, child1, child2, seg.text, seg.coder || UNATTRIBUTED_CODER);
    if (includeSummary) row.push(code.summary || '', code.definition || '');
    rows.push(row);
  }
  return { headers, rows, csv: rowsToCsv(headers, rows) };
}

// For the "codesOnly" DOCX export — an indented outline instead of a flat
// table, since that reads much better for a codebook's hierarchy.
export function buildCodebookOutline(project: Project): { depth: number; name: string; summary?: string }[] {
  const out: { depth: number; name: string; summary?: string }[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const c of childCodes(project.codes, parentId)) {
      out.push({ depth, name: c.name, summary: c.summary || undefined });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}
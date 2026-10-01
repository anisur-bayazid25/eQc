import { Project, Code, ID, codeAncestorPath, childCodes, UNATTRIBUTED_CODER } from '../domain';

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
// Resolved by walking the real parentId chain upward from the code (root-first)
// rather than re-matching the path by name — two sibling codes may share a
// name, and name matching would then pick the wrong one. The `seen` guard
// stops a corrupted cyclic parentId from spinning forever.
// Depth limit: only 3 columns exist, so for paths deeper than 3 levels the
// deepest code's definition lands in the "Child 2" slot and intermediate
// levels' definitions are not carried (the same 3-level ceiling the name
// columns have always had).
function codeLevelDefinitions(codes: Code[], code: Code): [string, string, string] {
  const chain: Code[] = [];
  const seen = new Set<string>();
  let cur: Code | undefined = code;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    const parentId: ID | null = cur.parentId;
    cur = parentId ? codes.find(c => c.id === parentId) : undefined;
  }
  return [
    chain[0]?.definition || '',
    chain[1]?.definition || '',
    chain.length > 3
      ? chain[chain.length - 1]?.definition || ''
      : (chain[2]?.definition || '')
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
// Carries both the summary/memo and the coding definition, so a codebook
// exported to Word is self-contained.
export function buildCodebookOutline(project: Project): { depth: number; name: string; summary?: string; definition?: string }[] {
  const out: { depth: number; name: string; summary?: string; definition?: string }[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const c of childCodes(project.codes, parentId)) {
      out.push({
        depth,
        name: c.name,
        summary: c.summary || undefined,
        definition: c.definition || undefined
      });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}
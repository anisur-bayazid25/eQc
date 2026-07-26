import { Project } from '../domain';
import { codingFrequency, codeDocumentMatrix, codeCooccurrenceMatrix } from './analysis';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function buildReportHtml(project: Project): string {
  const freq = codingFrequency(project);
  const matrix = codeDocumentMatrix(project);
  const maxCount = Math.max(1, ...freq.map(f => f.count));

  const codeRows = freq
    .map(
      f => `<tr>
        <td><span class="swatch" style="background:${esc(f.code.color)}"></span>${esc(f.code.name)}</td>
        <td>${f.count}</td>
        <td><div class="bar" style="width:${(f.count / maxCount) * 100}%; background:${esc(f.code.color)}"></div></td>
      </tr>`
    )
    .join('\n');

  const docHeader = project.docs.map(d => `<th>${esc(d.name)}</th>`).join('');
  const matrixRows = project.codes
    .map(code => {
      const row = matrix.get(code.id);
      const cells = project.docs.map(d => `<td>${row?.get(d.id) || 0}</td>`).join('');
      return `<tr><td>${esc(code.name)}</td>${cells}</tr>`;
    })
    .join('\n');

  // Co-occurrence: only codes that actually overlap with at least one other
  // code on the same excerpt are shown — same filtering as the in-app
  // matrix, so a large codebook doesn't turn this into a mostly-empty grid.
  const coMatrix = codeCooccurrenceMatrix(project);
  const activeCoocCodes = project.codes.filter(code =>
    project.codes.some(other => other.id !== code.id && (coMatrix.get(code.id)?.get(other.id) || 0) > 0)
  );
  const coocHeader = activeCoocCodes.map(c => `<th>${esc(c.name)}</th>`).join('');
  const coocRows = activeCoocCodes
    .map(rowCode => {
      const cells = activeCoocCodes
        .map(colCode => {
          if (rowCode.id === colCode.id) return `<td class="diag">—</td>`;
          const count = coMatrix.get(rowCode.id)?.get(colCode.id) || 0;
          return `<td>${count}</td>`;
        })
        .join('');
      return `<tr><td>${esc(rowCode.name)}</td>${cells}</tr>`;
    })
    .join('\n');

  const codesById = new Map(project.codes.map(c => [c.id, c]));
  const relationRows = (project.relationNotes || [])
    .filter(n => n.note.trim())
    .map(n => {
      const a = codesById.get(n.codeAId)?.name || 'Unknown';
      const b = codesById.get(n.codeBId)?.name || 'Unknown';
      const count = coMatrix.get(n.codeAId)?.get(n.codeBId) || coMatrix.get(n.codeBId)?.get(n.codeAId) || 0;
      return `<tr><td>${esc(a)} × ${esc(b)}</td><td>${count}</td><td>${esc(n.note).replace(/\n/g, '<br/>')}</td></tr>`;
    })
    .join('\n');

  const memoBlocks = project.codes
    .filter(c => c.summary.trim())
    .map(c => `<div class="memo"><h4>${esc(c.name)}</h4><p>${esc(c.summary).replace(/\n/g, '<br/>')}</p></div>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${esc(project.name)} — eQc Analysis Report</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 960px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
  h1 { border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
  h2 { margin-top: 40px; color: #1e3a8a; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-size: 14px; }
  th { background: #f1f5f9; }
  .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
  .bar { height: 14px; border-radius: 3px; }
  .diag { color: #94a3b8; }
  .stats { display: flex; gap: 24px; margin-top: 12px; }
  .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 18px; }
  .stat .num { font-size: 24px; font-weight: 700; }
  .memo { margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; }
  .memo h4 { margin: 0 0 6px 0; }
  footer { margin-top: 60px; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
  <h1>${esc(project.name)}</h1>
  <p>eQc local analysis report — generated ${new Date().toLocaleString()}. No source text or project data leaves this machine.</p>

  <div class="stats">
    <div class="stat"><div class="num">${project.docs.length}</div>Documents</div>
    <div class="stat"><div class="num">${project.codes.length}</div>Codes</div>
    <div class="stat"><div class="num">${project.codedSegments.length}</div>Coded passages</div>
  </div>

  <h2>Coding Frequency</h2>
  <table>
    <thead><tr><th>Code</th><th>Segments</th><th></th></tr></thead>
    <tbody>${codeRows}</tbody>
  </table>

  <h2>Code x Document Matrix</h2>
  <table>
    <thead><tr><th>Code</th>${docHeader}</tr></thead>
    <tbody>${matrixRows}</tbody>
  </table>

  <h2>Code Co-occurrence Matrix</h2>
  ${activeCoocCodes.length > 0
    ? `<table>
    <thead><tr><th></th>${coocHeader}</tr></thead>
    <tbody>${coocRows}</tbody>
  </table>`
    : '<p>No codes currently overlap on the same excerpt.</p>'}

  <h2>Code Relationship Notes</h2>
  ${relationRows
    ? `<table>
    <thead><tr><th>Code Pair</th><th>Co-occurrence Count</th><th>Memo</th></tr></thead>
    <tbody>${relationRows}</tbody>
  </table>`
    : '<p>No relationship memos written yet.</p>'}

  <h2>Code Summaries / Memos</h2>
  ${memoBlocks || '<p>No code summaries have been written yet.</p>'}

  <footer>Generated by eQc Desktop — local-first qualitative data analysis.</footer>
</body>
</html>`;
}

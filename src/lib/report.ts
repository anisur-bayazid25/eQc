import {comparisonTableHeaders,comparisonTableRows} from './icrTable';
import {icrFingerprint} from './icrRuns';
import {statisticName} from './icrStatistics';
import { Project, childCodes } from '../domain';
import {comparisonCoefficient,computeComparison} from './icrComparisons';
import { collectIcrCoders, computePairwiseIcr, computeFleissIcr, computeBinaryAlpha, computeCuAlpha, buildCodingUnits, formatIcrValue, IcrScope } from './icr';
import { codingFrequency, codeDocumentMatrix, codeCooccurrenceMatrix } from './analysis';
import { presentReport, reportStyles, reportScript } from './reportPresentation';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// Live analysis state held by the Analysis tab: the word-frequency list the
// user last generated and the KWIC search they last ran. Passed straight into
// the report so it mirrors exactly what is on screen.
export interface ReportExtras {
  icrRunId?:string;
  draftFigures?: Array<{ id: string; name: string; family: string; updatedAt: number; svg?: string; error?: string; notes?: Array<{title:string;text:string}> }>;
  imageExcerpts?: Array<{ regionId: string; base64: string }>;
  icr?: { coders: string[]; scope: IcrScope; coderA: string; coderB: string };
  wordFrequencies?: Array<{ word: string; count: number }> | null;
  stopWordsText?: string; wordLanguage?:string;wordMinLetters?:number;
  kwicKeyword?: string;
  kwicWindow?: number;
  kwicResults?: Array<{ docName: string; before: string[]; keyword: string; after: string[] }>;
}

export function buildReportHtml(project: Project, extras?: ReportExtras): string {
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

  // Codebook memos and coding definitions. A code contributes a block if it has
// either — the definition (when present) leads, since it is the operational
// rule for applying the code.
  const memoBlocks = project.codes
    .filter(c => c.summary.trim() || (c.definition || '').trim())
    .map(c => {
      const parts: string[] = [];
      if ((c.definition || '').trim()) {
        parts.push(`<p><strong>Definition:</strong> ${esc(c.definition!.trim()).replace(/\n/g, '<br/>')}</p>`);
      }
      if (c.summary.trim()) {
        parts.push(`<p>${esc(c.summary).replace(/\n/g, '<br/>')}</p>`);
      }
      const sources = [...new Set([
        ...project.codedSegments.filter(s => s.codeId === c.id).map(s => project.docs.find(d => d.id === s.docId)?.name || 'Unknown source'),
        ...(project.codedRegions || []).filter(r => r.codeId === c.id).map(r => project.images?.find(i => i.id === r.imageId)?.name || 'Unknown source')
      ])];
      return `<details class="memo"><summary>${esc(c.name)}</summary><div><p>Documents: ${esc(sources.join('; ') || 'No coded sources')}</p>${parts.join('')}</div></details>`;
    })
    .join('\n');

  // Framework matrix — top-level (theme) codes as rows, documents as columns.
  const fwCells = new Map((project.frameworkCells || []).map(c => [`${c.docId}::${c.codeId}`, c.text] as const));
  const fwRows = childCodes(project.codes, null);
  const fwCols = project.docs;
  const fwHeader = fwCols.map(d => `<th>${esc(d.name)}</th>`).join('');
  const fwRowsHtml = fwRows
    .map(code => {
      const cells = fwCols
        .map(d => `<td>${esc(fwCells.get(`${d.id}::${code.id}`) || '') || '<span class="muted">—</span>'}</td>`)
        .join('');
      return `<tr><td>${esc(code.name)}</td>${cells}</tr>`;
    })
    .join('\n');

  // Word frequencies — the list last generated in the Analysis tab.
  const wordRows = (extras?.wordFrequencies || [])
    .map((w, i) => `<tr><td class="muted">${i + 1}</td><td>${esc(w.word)}</td><td>${w.count}</td></tr>`)
    .join('\n');

  // KWIC — the search last run in the Analysis tab.
  const kwicRows = (extras?.kwicResults || [])
    .map(r => `<tr>
      <td>${esc(r.docName)}</td>
      <td class="kwic-context">&hellip; ${esc(r.before.join(' '))}</td>
      <td class="kwic-keyword">${esc(r.keyword)}</td>
      <td class="kwic-context">${esc(r.after.join(' '))} &hellip;</td>
    </tr>`)
    .join('\n');

  const imageExcerptById = new Map((extras?.imageExcerpts || []).map(i => [i.regionId, i.base64]));
  const imageRows = (project.codedRegions || []).map(r => {
    const image = (project.images || []).find(i => i.id === r.imageId);
    const crop = imageExcerptById.get(r.id);
    return `<tr><td>${esc(image?.name || 'Unknown image')}</td><td>${esc(codesById.get(r.codeId)?.name || 'Unknown code')}</td><td>${esc(r.coder || 'Unattributed')}</td><td>${crop ? `<img alt="Coded image region" style="max-width:180px;max-height:180px" src="data:image/png;base64,${esc(crop)}"/><br/>` : ''}x=${r.x}, y=${r.y}, width=${r.width}, height=${r.height}</td><td>${esc(r.note || '')}</td></tr>`;
  }).join('');

  const inventory = collectIcrCoders(project);
  const allCoders = inventory.attributed.map(c => c.name);
  const icrCoders = Array.from(new Set(extras?.icr?.coders ?? allCoders)).filter(c => allCoders.includes(c));
  const scope = extras?.icr?.scope ?? { docIds: project.docs.map(d => d.id), includeImages: true };
  const a = extras?.icr?.coderA ?? icrCoders[0];
  const b = extras?.icr?.coderB ?? icrCoders[1];
  const pair = a && b && a !== b && icrCoders.includes(a) && icrCoders.includes(b) ? computePairwiseIcr(project, a, b, scope) : null;
  const pairs = icrCoders.flatMap((coder, index) => icrCoders.slice(index + 1).map(other => computePairwiseIcr(project, coder, other, scope)));
  const fleiss = icrCoders.length >= 3 ? computeFleissIcr(project, icrCoders, scope) : null;
  const binary = icrCoders.length >= 2 ? computeBinaryAlpha(project, icrCoders, scope) : null;
  const cu = icrCoders.length >= 2 && scope.docIds.length ? computeCuAlpha(project, icrCoders, scope.docIds) : null;
  const units = icrCoders.length >= 2 ? buildCodingUnits(project, icrCoders, scope.docIds) : [];
  const reviewUnits = units.filter(u => u.distinctCoders >= 2);
  const agreements = reviewUnits.filter(u => u.agreed).length;
  const table = (headers: string[], rows: (string | number)[][]) => `<table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${esc(String(v)).replace(/\n/g, '<br/>')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  let comparisonHtml='';
  if(project.icrComparison)try{
    const settings=project.icrComparison,names=settings.method==='training'?settings.trainingCoders??Array.from(new Set(settings.training.map(row=>row.coder))):icrCoders;
    const comparison=computeComparison(project,names,scope,settings);
    const comparisonCodes=project.codes.filter(code=>settings.codeIds.includes(code.id));
    comparisonHtml=`<h3>Additional ICR comparison: ${esc(comparison.title)}</h3>
      <p>${esc(comparison.description)}</p>
      <p class="scope-note">Comparison coders: ${esc(names.join(', '))}. ${settings.method==='training'?'Uses the loaded fixed-excerpt test, independently of project document and code selections.':`Direct codes (${comparisonCodes.length}): ${esc(comparisonCodes.map(code=>code.name).join('; ') || 'None')}. Text documents: ${scope.docIds.filter(id=>project.docs.some(doc=>doc.id===id)).length}. Images excluded.`}</p>
      ${settings.method==='domains'?`<p>Semantic domains: ${settings.domains.map(domain=>esc(domain.name)+': '+esc(project.codes.filter(code=>domain.codeIds.includes(code.id)&&settings.codeIds.includes(code.id)).map(code=>code.name).join(', '))).join('; ')}.</p>`:''}
      ${comparison.warnings.map(warning=>`<p class="scope-note">${esc(warning)}</p>`).join('')}
      ${table(comparisonTableHeaders,comparisonTableRows(comparison.rows))}`;
  }catch(error){comparisonHtml='<p>Additional ICR comparison unavailable: '+esc(error instanceof Error?error.message:String(error))+'</p>';}
  else comparisonHtml='<p>No additional comparison has been saved. Calculate a comparison in Analysis → ICR to include its results, settings and scope here.</p>';
  let icrHtml = `
    <h2>Inter-Coder Reliability (ICR)</h2>
    <p>Coders: ${esc(icrCoders.join(', ') || 'None')}. Documents: ${esc(project.docs.filter(d => scope.docIds.includes(d.id)).map(d => d.name).join(', ') || 'None')}.${(project.images||[]).length ? ` Images: ${scope.includeImages ? (project.images||[]).length+' included' : 'excluded from ICR'}.` : ''}</p>
    <p>${inventory.unattributed ? `${inventory.unattributed.segments + inventory.unattributed.regions} unattributed project items excluded; unattributed items are not treated as a coder. ` : ''}Undefined coefficients are shown as —.</p>
    <p>Occurrence metrics use one source × code item (present/absent). Holsti is an uncorrected ratio; κ and α are chance-corrected. Text-unit nominal alpha uses the dominant code on overlapping passage groups, with uncoded ratings included; it is not semantic-domain Cu-alpha.</p>
    <p class="scope-note">An absent code is treated as a negative decision. Confirm that every selected coder reviewed the selected sources; missing coding cannot establish whether a source was reviewed.</p>
    <h3>All selected coder pairs</h3>
    ${pairs.length ? table(['Coder A','Coder B','Source × code items','Agreement (%)',statisticName('cohen'),statisticName('holsti')],pairs.map(result=>[result.coderA,result.coderB,result.items,result.percent.toFixed(1),formatIcrValue(result.kappa),formatIcrValue(result.holsti)])) : '<p>Requires at least two attributed coders in scope.</p>'}
    <h3>Pairwise agreement, Cohen's κ and Holsti index</h3>
    ${pair ? `<p>${esc(pair.coderA)} vs ${esc(pair.coderB)}: ${pair.items} items (${pair.sources} sources × ${pair.codes} codes), ${pair.percent.toFixed(1)}% agreement; Cohen's κ = ${formatIcrValue(pair.kappa)}; Holsti = ${formatIcrValue(pair.holsti)}.</p>
      ${table(['Contingency', 'Both coded', 'A only', 'B only', 'Neither'], [['Overall', pair.contingency.bothYes, pair.contingency.aOnly, pair.contingency.bOnly, pair.contingency.bothNo]])}
      ${table(['Code', 'Both coded', 'A only', 'B only', 'Neither', '% agreement', statisticName('cohen'), statisticName('holsti')], pair.perCode.map(r => [r.codeName, r.bothYes, r.aOnly, r.bOnly, r.bothNo, r.percent.toFixed(1), formatIcrValue(r.kappa), formatIcrValue(r.holsti)]))}` : '<p>Select two different attributed coders for pairwise reliability.</p>'}
    <h3>${statisticName('fleiss')}</h3>
    ${fleiss ? `<p>${fleiss.items} items; ${fleiss.percentFull.toFixed(1)}% full agreement; κ = ${formatIcrValue(fleiss.kappa)}.</p>${table(['Code', 'Items', 'Full agreements', '% full agreement', 'κ'], fleiss.perCode.map(r => [r.codeName, r.items, r.fullAgreement, r.percentFull.toFixed(1), formatIcrValue(r.kappa)]))}` : '<p>Requires at least three attributed coders in scope.</p>'}
    <h3>${statisticName('binary')} (source × code)</h3>
    ${binary ? `<p>${binary.items} items; α = ${formatIcrValue(binary.alpha)}.</p>${table(['Code', 'Items', 'α'], binary.perCode.map(r => [r.codeName, r.items, formatIcrValue(r.alpha)]))}` : '<p>Requires at least two attributed coders in scope.</p>'}
    <h3>Text-unit nominal alpha (dominant code)</h3>
    ${cu ? `<p>${cu.units} text units; ${cu.fullAgreement} full agreements (${cu.percentFull.toFixed(1)}%); α = ${formatIcrValue(cu.alpha)}.</p>` : '<p>Requires at least two attributed coders and one document in scope.</p>'}
    ${comparisonHtml}
    <details class="calculation-help"><summary>ICR calculation details and interpretation</summary>
      <p>Source-level agreement = (both coded + neither coded) / all source × code items. Cohen’s κ = (observed agreement − expected agreement) / (1 − expected agreement), using each coder’s marginal proportions. Holsti = 2 × both coded / (2 × both coded + A only + B only); it excludes joint absences.</p>
      <p>Fleiss’ κ compares observed within-item agreement with agreement expected from pooled category proportions. Nominal α = 1 − observed disagreement / expected disagreement; character comparisons weight each interval by its length. Sentence and paragraph comparisons weight each unit equally. Text-unit dominant-code α uses overlapping passage groups and differs from character-based semantic-domain α.</p>
      <p>Code-presence RK κ uses chance = 0.5 raised to the number of selected codes. Frequency equality has no chance-corrected coefficient. Segment overlap requires intersection / outer span to meet the saved threshold and checks both coder directions; Brennan–Prediger correction uses chance = 1 / active codes, with the binary correction using 0.5.</p>
      <p>Semantic-domain calculations require mutually exclusive codes within each domain; exploratory global Cu-style results are labelled in the comparison. Fixed-excerpt tests use paired recorded decisions, omit missing decisions and report Pearson r only for paired numeric ratings with variation. Undefined coefficients indicate insufficient information or variation and are never replaced with zero. No universal acceptability threshold is applied.</p>
    </details>
    <h2>Consensus Summary</h2>
    <p>${reviewUnits.length} review passages: ${agreements} agreements, ${reviewUnits.length - agreements} disagreements. ${units.length - reviewUnits.length} single-coder passages excluded.</p>
    <p>Agreement means that the coders who actually coded a passage assigned the same single code. Consensus covers text only and includes both statuses regardless of the current review filter. This is the current coding state, rather than an adjudication history.</p>
    ${reviewUnits.length ? table(['Document', 'Start', 'End', 'Quote', 'Status', 'Coder assignments'], reviewUnits.map(u => [u.docName, u.start, u.end, u.text, u.agreed ? 'Agreement' : 'Disagreement', u.perCoder.filter(c => c.segmentIds.length).map(c => `${c.coder}: ${c.codeIds.map(id => codesById.get(id)?.name || 'Unknown code').join(', ')}`).join('\n')])) : '<p>No jointly coded text passages in scope.</p>'}
  `;
  const consensusSection=icrHtml.slice(icrHtml.indexOf('<h2>Consensus Summary</h2>'));
  if(extras?.icrRunId){const run=project.icrRuns?.find(r=>r.id===extras.icrRunId);if(!run)throw Error('The selected ICR run is unavailable.');icrHtml=`<h2>Intercoder agreement — saved run</h2><h3>${esc(run.name)}</h3><p>${esc(new Date(run.createdAt).toISOString())}. ${run.fingerprint===icrFingerprint(project)?'Current coding matches.':'Historical snapshot; later coding changes are not included.'}</p><p>${esc(run.result.text)}</p>${table(comparisonTableHeaders,comparisonTableRows(run.result.rows))}<p>Coders: ${esc(run.coders.join(', '))}. Scope and settings: ${esc(JSON.stringify({scope:run.scope,settings:run.settings,reviewed:run.reviewed}))}</p>${run.result.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}${consensusSection}`;}


  const figuresHtml = extras?.draftFigures?.length ? `<h2>Saved visualization drafts</h2><p class="scope-note">Saved draft canvases captured at export. Figures remain available offline. Regenerate a draft in eQc to update its analysis after coding changes.</p>${extras.draftFigures.map((figure,index)=>`<figure class="report-figure">${figure.svg?`<img alt="${esc(figure.name)}" src="data:image/svg+xml;charset=utf-8,${esc(encodeURIComponent(figure.svg))}" />`:`<p>Figure unavailable: ${esc(figure.error || 'Could not render this draft')}.</p>`}<figcaption><strong>Figure ${index+1}. ${esc(figure.name)}</strong> · ${esc(figure.family)} · Saved ${esc(new Date(figure.updatedAt).toLocaleString())}</figcaption>${figure.notes?.length?`<details><summary>Visualization notes (${figure.notes.length})</summary>${figure.notes.map(note=>`<p class="visualization-note"><strong>${esc(note.title)}</strong><br/>${esc(note.text)}</p>`).join('')}</details>`:''}</figure>`).join('')}` : '';

  return presentReport(`<!DOCTYPE html>
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
  .note { color: #64748b; font-size: 13px; margin-top: 8px; }
  .muted { color: #94a3b8; }
  .kwic-context { font-style: italic; color: #64748b; }
  .kwic-keyword { text-align: center; font-weight: 700; color: #1d4ed8; }
  footer { margin-top: 60px; font-size: 12px; color: #94a3b8; }
  ${reportStyles}
</style>
</head>
<body>
  <h1>${esc(project.name)}</h1>
  <p>eQc analysis report — generated ${new Date().toLocaleString()}. This self-contained report opens offline.</p>

  <div class="stats">
    <div class="stat"><div class="num">${project.docs.length}</div>Documents</div>
    <div class="stat"><div class="num">${project.codes.length}</div>Codes</div>
    <div class="stat"><div class="num">${project.codedSegments.length}</div>Coding entries<br><small>overlaps and separate coders each count</small></div>
  </div>
  <!-- REPORT_CONTENTS -->

  <h2>Code Summaries / Memos</h2>
  ${memoBlocks || '<p>No code summaries have been written yet.</p>'}

  ${figuresHtml}

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

  <h2>Framework Matrix</h2>
  ${fwRows.length > 0
    ? `<table>
    <thead><tr><th>Theme</th>${fwHeader}</tr></thead>
    <tbody>${fwRowsHtml}</tbody>
  </table>`
    : '<p>No top-level (theme) codes yet — add a root code to use the framework matrix.</p>'}

  <h2>Word Frequencies</h2>
  ${extras?.wordFrequencies && extras.wordFrequencies.length > 0
    ? `<p class="note">${extras.wordLanguage?'Language: '+esc(extras.wordLanguage)+'; more than '+(extras.wordMinLetters??0)+' Unicode base letters. ':''}Last generated with stop words: ${esc(extras.stopWordsText || '')}</p>
    <table>
    <thead><tr><th>#</th><th>Word</th><th>Count</th></tr></thead>
    <tbody>${wordRows}</tbody>
  </table>`
    : '<p>No word-frequency list generated yet. Open the Word Frequencies tab and click "Generate List", then export the report again.</p>'}

  <h2>KWIC (Keyword in Context)</h2>
  ${extras?.kwicResults && extras.kwicResults.length > 0
    ? `<p class="note">Keyword "${esc(extras.kwicKeyword || '')}" with a context window of ${extras.kwicWindow ?? 5} word(s) on either side.</p>
    <table>
    <thead><tr><th>Document Name</th><th>Pre-Context</th><th>Keyword</th><th>Post-Context</th></tr></thead>
    <tbody>${kwicRows}</tbody>
  </table>`
    : extras?.kwicKeyword ? `<p>Keyword &quot;${esc(extras.kwicKeyword)}&quot;: no matches (context window ${extras.kwicWindow ?? 5}).</p>` : '<p>No KWIC search run yet. Open the KWIC tab and run a search, then export the report again.</p>'}

  <h2>Image Coding</h2>
  ${imageRows ? `<table><thead><tr><th>Document</th><th>Code</th><th>Coder</th><th>Region</th><th>Memo</th></tr></thead><tbody>${imageRows}</tbody></table>` : '<p>No coded image regions.</p>'}

  ${icrHtml}

  ${researchHtml(project, true)}
  <footer>Generated by eQc Desktop — local-first qualitative data analysis.</footer>
  ${reportScript}
</body>
</html>`);
}
import { researchHtml } from './researchExport';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CsvParseResult, ImportTablePayload } from '../global';
import { importCsvDataset } from '../lib/csvImport';
import type { Project } from '../domain';

// A code tree has no depth limit, so the importer does not impose one either:
// each level row maps a code column and, optionally, its own definition and
// summary columns.
interface LevelMapping {
  code: string;
  definition: string;
  summary: string;
}

interface CodingRoles {
  source: string;
  quote: string;
  coder: string;
}

const EMPTY_LEVEL: LevelMapping = { code: '', definition: '', summary: '' };

// Guidance columns explain a code without adding one; they are copied into the
// deepest code's memo when present.
const GUIDANCE = ['include when', 'exclusion / coding note', 'study objective', 'relevant data sources'];

function isDefinitionHeader(header: string) {
  return /defin|\brule\b|\binclude when\b|\binclusion\b/i.test(header);
}
function isSummaryHeader(header: string) {
  return /summar|\bmemo\b|\bnote\b|\bdescription\b|\bmeaning\b/i.test(header);
}
function isSourceHeader(header: string) {
  return /document|\bsource\b|\bparticipant\b|\binterview\b|\btranscript\b|\bcase\b|\bfile\b/i.test(header) && !isDefinitionHeader(header);
}
function isQuoteHeader(header: string) {
  return /quote|excerpt|\bpassage\b|\bverbatim\b|\bresponse\b|\btext\b/i.test(header) && !isDefinitionHeader(header) && !isSummaryHeader(header);
}
function isCoderHeader(header: string) {
  return /coder|\bresearcher\b|\banalyst\b|\bauthor\b|\binterviewer\b/i.test(header) && !isDefinitionHeader(header);
}
function looksLikeCodeHeader(header: string) {
  return /\bparent\b|\btheme\b|\bcategory\b|\bdomain\b|\bchild\b|sub[\s_-]?code|\bcode\b|\blevel\b|\bnode\b/i.test(header)
    && !isDefinitionHeader(header) && !isSummaryHeader(header) && !isSourceHeader(header) && !isQuoteHeader(header) && !isCoderHeader(header);
}

// 0-based level implied by a header name, or null when it names no level.
// "Parent"/"Theme" are level 1; "Child 1"/"Code 1" and "Level 2" are level 2.
function hintedLevel(header: string): number | null {
  const text = header.toLowerCase();
  const levelWord = /level[\s_-]*(\d+)/.exec(text);
  if (levelWord) return Math.max(0, Number(levelWord[1]) - 1);
  const childWord = /(?:child|sub[\s_-]?code|code|node)[\s_-]*(?:code|node)?[\s_-]*(\d+)/.exec(text);
  if (childWord) return Math.max(1, Number(childWord[1]));
  if (/\bparent\b|\btheme\b|\bcategory\b|\bdomain\b/.test(text)) return 0;
  return null;
}

export function detectLevels(fields: string[]): LevelMapping[] {
  const used = new Set<string>();
  const levels: LevelMapping[] = [];

  // 1. Code columns, grouped by the level their header implies.
  let highest = 0;
  const codeByLevel = new Map<number, string>();
  for (const field of fields) {
    if (!looksLikeCodeHeader(field)) continue;
    const hint = hintedLevel(field) ?? 0;
    if (codeByLevel.has(hint)) continue;
    codeByLevel.set(hint, field);
    used.add(field);
    highest = Math.max(highest, hint);
  }
  for (let level = 0; level <= highest; level++) {
    levels.push({ ...EMPTY_LEVEL, code: codeByLevel.get(level) || '' });
  }
  if (!levels.length) levels.push({ ...EMPTY_LEVEL });

  // 2. Definition and summary columns: routed by their own header hint, or to
  // the deepest level when the header is generic ("Definition", "Summary").
  for (const field of fields) {
    const isDefinition = isDefinitionHeader(field);
    const isSummary = !isDefinition && isSummaryHeader(field);
    if ((!isDefinition && !isSummary) || used.has(field)) continue;
    const level = hintedLevel(field) ?? highest;
    const row = levels[level];
    if (!row) continue;
    if (isDefinition && !row.definition) { row.definition = field; used.add(field); }
    else if (isSummary && !row.summary) { row.summary = field; used.add(field); }
  }

  return levels;
}

export function detectCodingRoles(fields: string[], used: Iterable<string>): CodingRoles {
  const taken = new Set(used);
  const pick = (test: (header: string) => boolean) => {
    const hit = fields.find(field => !taken.has(field) && test(field));
    if (hit) taken.add(hit);
    return hit || '';
  };
  const source = pick(isSourceHeader);
  const quote = pick(isQuoteHeader);
  const coder = pick(isCoderHeader);
  return { source, quote, coder };
}

function guidanceFields(fields: string[]): string[] {
  return fields.filter(field => GUIDANCE.includes(field.trim().toLowerCase()));
}

export default function TableImportDialog({
  project, onImport, onClose, showToast
}: {
  project: Project;
  onImport: (parsed: CsvParseResult) => void;
  onClose: () => void;
  showToast: (message: string) => void;
}) {
  const [payload, setPayload] = useState<ImportTablePayload | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [levels, setLevels] = useState<LevelMapping[]>([{ ...EMPTY_LEVEL }]);
  const [coding, setCoding] = useState<CodingRoles>({ source: '', quote: '', coder: '' });
  const [busy, setBusy] = useState(false);
  const [copyGuidance, setCopyGuidance] = useState(true);
  const dialogRef = useRef<HTMLElement>(null);

  const sheet = payload?.kind === 'xlsx' ? payload.sheets[sheetIndex] : payload;
  const fields = sheet?.fields || [];
  const rows = sheet?.rows || [];

  useEffect(() => {
    if (!sheet) {
      setLevels([{ ...EMPTY_LEVEL }]);
      setCoding({ source: '', quote: '', coder: '' });
      return;
    }
    const detected = detectLevels(sheet.fields);
    const used = detected.flatMap(level => [level.code, level.definition, level.summary]).filter(Boolean);
    setLevels(detected);
    setCoding(detectCodingRoles(sheet.fields, used));
    setCopyGuidance(true);
  }, [payload, sheetIndex]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus();
  }, []);

  async function chooseFile() {
    setBusy(true);
    try {
      const picked = await window.qv.pickImportTable();
      if (!picked) return;
      setPayload(picked);
      setSheetIndex(0);
      if (picked.kind === 'xlsx' && picked.sheets.length === 0) showToast('That workbook has no readable sheets.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const codeLevels = levels.filter(level => level.code);
  const hasCodingRoles = Boolean(coding.source && coding.quote);
  const valid = codeLevels.length > 0 || hasCodingRoles;

  function buildParsed(): CsvParseResult {
    const levelColumns = levels.map(level => level.code || null);
    return {
      fileName: payload?.fileName || 'Import',
      fields,
      columns: {
        source: coding.source || null,
        quote: coding.quote || null,
        // Kept for compatibility with older callers; `levels` is authoritative.
        parent: levels[0]?.code || null,
        child1: levels[1]?.code || null,
        child2: levels[2]?.code || null,
        coder: coding.coder || null,
        levels: levelColumns,
      },
      summaryFields: [],
      definitionFields: [],
      summaryColumns: levels.flatMap((level, index) => level.summary ? [{ field: level.summary, level: index }] : []),
      definitionColumns: levels.flatMap((level, index) => level.definition ? [{ field: level.definition, level: index }] : []),
      metadataFields: copyGuidance ? guidanceFields(fields) : [],
      rows,
      errors: [],
    };
  }

  // Dry run on a shallow copy: shows exactly what Import will do before it
  // touches the project.
  const preview = useMemo(() => {
    if (!sheet || !valid) return null;
    try {
      const scratch: Project = {
        ...project,
        codes: project.codes.map(code => ({ ...code })),
        docs: project.docs.map(doc => ({ ...doc })),
        codedSegments: [...project.codedSegments],
        images: (project.images || []).map(image => ({ ...image })),
        codedRegions: (project.codedRegions || []).map(region => ({ ...region })),
      };
      return { summary: importCsvDataset(scratch, buildParsed()), error: '' };
    } catch (error) {
      return { summary: null, error: error instanceof Error ? error.message : String(error) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, levels, coding, copyGuidance, valid, project]);

  const setLevel = (index: number, key: keyof LevelMapping, value: string) =>
    setLevels(current => current.map((level, position) => position === index ? { ...level, [key]: value } : level));

  const usedFields = new Set([
    ...levels.flatMap(level => [level.code, level.definition, level.summary]),
    coding.source, coding.quote, coding.coder,
  ].filter(Boolean));

  const previewRows = rows.slice(0, 5);
  const previewColumns: Array<{ label: string; field: string }> = [];
  levels.forEach((level, index) => {
    if (level.code) previewColumns.push({ label: index === 0 ? 'Theme' : `Level ${index + 1}`, field: level.code });
    if (level.summary) previewColumns.push({ label: `L${index + 1} summary`, field: level.summary });
    if (level.definition) previewColumns.push({ label: `L${index + 1} definition`, field: level.definition });
  });
  if (coding.source) previewColumns.push({ label: 'Document', field: coding.source });
  if (coding.quote) previewColumns.push({ label: 'Quote', field: coding.quote });
  if (coding.coder) previewColumns.push({ label: 'Coder', field: coding.coder });

  const levelName = (index: number) => index === 0 ? 'Theme / parent code' : `Child code ${index}`;

  return (
    <div
      className="research-overlay"
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled)') || []);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
    >
      <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-table-title" ref={dialogRef}>
        <header className="import-dialog-head">
          <div>
            <h2 id="import-table-title">Import codebook or coded data</h2>
            <p className="section-hint">
              CSV, tab-separated, Excel workbook or Excel “Unicode text”. Add a level for each step of your code
              tree — there is no depth limit — and match the columns for it. Header names can be anything.
            </p>
          </div>
          <button className="mini-btn" onClick={onClose} disabled={busy} aria-label="Close import">Close</button>
        </header>

        <div className="import-source-row">
          <button className="primary-btn" onClick={chooseFile} disabled={busy}>
            {busy ? 'Reading…' : payload ? 'Choose another file…' : 'Choose file…'}
          </button>
          {payload && (
            <span className="import-file-name" title={payload.fileName}>
              📄 {payload.fileName}
              {payload.kind === 'xlsx' ? ` · ${payload.sheets.length} sheet(s)` : ` · ${rows.length} data row(s)`}
            </span>
          )}
          {payload?.kind === 'xlsx' && payload.sheets.length > 1 && (
            <label className="import-sheet-pick">
              Sheet
              <select aria-label="Workbook sheet" value={sheetIndex} onChange={event => setSheetIndex(Number(event.target.value))}>
                {payload.sheets.map((option, index) => (
                  <option key={`${option.name}-${index}`} value={index}>
                    {option.name}{option.totalRows !== undefined ? ` — ${option.totalRows} row(s)` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {payload && (
          <>
            <div className="import-columns">
              <div className="import-levels">
                <div className="import-level-head">
                  <span>Code tree</span>
                  <span className="import-level-count">{levels.filter(level => level.code).length} level(s) mapped</span>
                </div>
                {levels.map((level, index) => (
                  <div className="import-level" key={index}>
                    <div className="import-level-index" aria-hidden="true">{index + 1}</div>
                    <div className="import-level-fields">
                      <label className="import-role">
                        <span className="import-role-label">{levelName(index)}</span>
                        <select
                          aria-label={`${levelName(index)} column`}
                          value={level.code}
                          onChange={event => setLevel(index, 'code', event.target.value)}
                        >
                          <option value="">— not in this file —</option>
                          {fields.map(field => (
                            <option key={field} value={field}>
                              {field}{usedFields.has(field) && level.code !== field ? ' (used)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="import-role">
                        <span className="import-role-label">Definition</span>
                        <select
                          aria-label={`${levelName(index)} definition column`}
                          value={level.definition}
                          onChange={event => setLevel(index, 'definition', event.target.value)}
                        >
                          <option value="">— none —</option>
                          {fields.map(field => (
                            <option key={field} value={field}>
                              {field}{usedFields.has(field) && level.definition !== field ? ' (used)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="import-role">
                        <span className="import-role-label">Summary / memo</span>
                        <select
                          aria-label={`${levelName(index)} summary column`}
                          value={level.summary}
                          onChange={event => setLevel(index, 'summary', event.target.value)}
                        >
                          <option value="">— none —</option>
                          {fields.map(field => (
                            <option key={field} value={field}>
                              {field}{usedFields.has(field) && level.summary !== field ? ' (used)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {levels.length > 1 && (
                      <button
                        className="mini-btn import-level-remove"
                        title={`Remove level ${index + 1}`}
                        aria-label={`Remove level ${index + 1}`}
                        onClick={() => setLevels(current => current.filter((_, position) => position !== index))}
                      >✕</button>
                    )}
                  </div>
                ))}
                <button className="mini-btn import-add-level" onClick={() => setLevels(current => [...current, { ...EMPTY_LEVEL }])}>
                  + Add level
                </button>
              </div>

              <aside className="import-side">
                <fieldset className="import-role-group">
                  <legend>Coded text (optional)</legend>
                  <label className="import-role">
                    <span className="import-role-label">Document / source</span>
                    <select aria-label="Document column" value={coding.source} onChange={event => setCoding(current => ({ ...current, source: event.target.value }))}>
                      <option value="">— not in this file —</option>
                      {fields.map(field => <option key={field} value={field}>{field}</option>)}
                    </select>
                  </label>
                  <label className="import-role">
                    <span className="import-role-label">Quote / excerpt</span>
                    <select aria-label="Quote column" value={coding.quote} onChange={event => setCoding(current => ({ ...current, quote: event.target.value }))}>
                      <option value="">— not in this file —</option>
                      {fields.map(field => <option key={field} value={field}>{field}</option>)}
                    </select>
                  </label>
                  <label className="import-role">
                    <span className="import-role-label">Coder</span>
                    <select aria-label="Coder column" value={coding.coder} onChange={event => setCoding(current => ({ ...current, coder: event.target.value }))}>
                      <option value="">— none —</option>
                      {fields.map(field => <option key={field} value={field}>{field}</option>)}
                    </select>
                  </label>
                </fieldset>
                <label className="import-toggle">
                  <input type="checkbox" checked={copyGuidance} onChange={event => setCopyGuidance(event.target.checked)} />
                  Copy extra guidance columns into code memos
                </label>
                {guidanceFields(fields).length > 0 && copyGuidance && (
                  <p className="import-side-note">Found: {guidanceFields(fields).join(', ')}</p>
                )}
                <p className="import-side-note">
                  Quotes must match the source text exactly. Repeated quotes attach to their first occurrence, in row order.
                </p>
              </aside>
            </div>

            {!valid && (
              <p className="import-warning" role="status">
                Choose at least one code column, or both a document and a quote column.
              </p>
            )}
            {preview?.error && <p className="import-warning" role="alert">{preview.error}</p>}

            {previewColumns.length > 0 && previewRows.length > 0 && (
              <div className="import-preview">
                <h3>Preview · first {previewRows.length} of {rows.length} row(s)</h3>
                <div className="import-preview-scroll">
                  <table>
                    <thead>
                      <tr>{previewColumns.map(column => <th key={column.field}>{column.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {previewColumns.map(column => (
                            <td key={column.field} title={row[column.field] || ''}>
                              {row[column.field] || <span className="import-empty">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview?.summary && (
              <p className="import-summary" role="status">
                Will add <strong>{preview.summary.codesCreated}</strong> code(s),{' '}
                <strong>{preview.summary.docsCreated}</strong> document(s),{' '}
                <strong>{preview.summary.segmentsCreated}</strong> coded passage(s)
                {preview.summary.docsAppended ? `, extend ${preview.summary.docsAppended} document(s)` : ''}
                {preview.summary.segmentsNotFound ? `, ${preview.summary.segmentsNotFound} quote(s) not found in the text` : ''}
                {preview.summary.definitionsSkipped ? `, ${preview.summary.definitionsSkipped} definition(s) skipped (already set)` : ''}.
              </p>
            )}
          </>
        )}

        <footer className="import-dialog-foot">
          <button className="secondary-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="primary-btn"
            disabled={!valid || busy || !preview?.summary}
            onClick={() => {
              if (!preview?.summary) return;
              onImport(buildParsed());
              onClose();
            }}
          >
            Import
          </button>
        </footer>
      </section>
    </div>
  );
}

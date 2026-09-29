import { Project, UNATTRIBUTED_CODER } from '../domain';

// Inter-coder reliability (ICR) / inter-coder agreement.
//
// Unit of analysis (standard "code occurrence" agreement, as used by major
// QDA tools): one item = one (source × code) pair, where a source is a text
// document or an image. A coder "marks" an item present when they applied
// that code at least once to that source (a coded segment for documents, a
// coded region for images). Agreement is then measured over all items.
//
// Metrics provided:
// - Percent agreement (observed agreement Po).
// - Cohen's kappa for a pair of coders (chance-corrected).
// - Fleiss' kappa for 3+ coders (chance-corrected, same binary
//   present/absent categories).
//
// Everything here is pure (no React, no persistence) so it can be unit
// tested and reused by exports.

export interface IcrCoder {
  name: string;
  segments: number;
  regions: number;
}

export interface IcrContingency {
  bothYes: number;
  aOnly: number;
  bOnly: number;
  bothNo: number;
  n: number;
}

export interface IcrPairCodeRow extends IcrContingency {
  codeId: string;
  codeName: string;
  percent: number;
  kappa: number | null;
}

export interface IcrPairResult {
  coderA: string;
  coderB: string;
  items: number;
  sources: number;
  codes: number;
  contingency: IcrContingency;
  percent: number;
  kappa: number | null;
  perCode: IcrPairCodeRow[];
}

export interface IcrFleissCodeRow {
  codeId: string;
  codeName: string;
  items: number;
  fullAgreement: number;
  percentFull: number;
  kappa: number | null;
}

export interface IcrFleissResult {
  coders: string[];
  items: number;
  sources: number;
  codes: number;
  fullAgreement: number;
  percentFull: number;
  kappa: number | null;
  perCode: IcrFleissCodeRow[];
}

// Distinct coders that have coded anything, with their segment/region
// counts. Unstamped items count toward "Unattributed" so nothing is hidden.
export function listIcrCoders(project: Project): IcrCoder[] {
  const map = new Map<string, IcrCoder>();
  const bump = (name: string | undefined, seg: boolean) => {
    const key = (name || '').trim() || UNATTRIBUTED_CODER;
    let row = map.get(key);
    if (!row) {
      row = { name: key, segments: 0, regions: 0 };
      map.set(key, row);
    }
    if (seg) row.segments += 1;
    else row.regions += 1;
  };
  for (const s of project.codedSegments) bump(s.coder, true);
  for (const r of project.codedRegions || []) bump(r.coder, false);
  return Array.from(map.values()).sort(
    (a, b) => b.segments + b.regions - (a.segments + a.regions) || a.name.localeCompare(b.name)
  );
}

interface IcrSource {
  id: string;
  name: string;
}

function icrSources(project: Project): IcrSource[] {
  const docs = project.docs.map(d => ({ id: d.id, name: d.name }));
  const images = (project.images || []).map(m => ({ id: m.id, name: m.name }));
  return [...docs, ...images];
}

// coder -> set of "sourceId::codeId" the coder marked present.
function buildPresence(project: Project): Map<string, Set<string>> {
  const presence = new Map<string, Set<string>>();
  const mark = (coderRaw: string | undefined, sourceId: string, codeId: string) => {
    const coder = (coderRaw || '').trim() || UNATTRIBUTED_CODER;
    let set = presence.get(coder);
    if (!set) {
      set = new Set();
      presence.set(coder, set);
    }
    set.add(`${sourceId}::${codeId}`);
  };
  for (const s of project.codedSegments) mark(s.coder, s.docId, s.codeId);
  for (const r of project.codedRegions || []) mark(r.coder, r.imageId, r.codeId);
  return presence;
}

export function percentAgreement(t: IcrContingency): number {
  if (t.n === 0) return 0;
  return ((t.bothYes + t.bothNo) / t.n) * 100;
}

// Chance-corrected agreement for a 2x2 table. Returns null when undefined
// (no items, or expected agreement is exactly 1).
export function cohenKappa(t: IcrContingency): number | null {
  if (t.n === 0) return null;
  const po = (t.bothYes + t.bothNo) / t.n;
  const pYesA = (t.bothYes + t.aOnly) / t.n;
  const pYesB = (t.bothYes + t.bOnly) / t.n;
  const pNoA = 1 - pYesA;
  const pNoB = 1 - pYesB;
  const pe = pYesA * pYesB + pNoA * pNoB;
  if (1 - pe === 0) return null;
  return (po - pe) / (1 - pe);
}

// Landis & Koch (1977) benchmark labels for kappa values.
export function kappaInterpretation(kappa: number | null): string {
  if (kappa === null || Number.isNaN(kappa)) return '—';
  if (kappa < 0) return 'Poor (below chance)';
  if (kappa <= 0.2) return 'Slight';
  if (kappa <= 0.4) return 'Fair';
  if (kappa <= 0.6) return 'Moderate';
  if (kappa <= 0.8) return 'Substantial';
  return 'Almost perfect';
}

export function formatKappa(kappa: number | null): string {
  if (kappa === null || Number.isNaN(kappa)) return '—';
  return kappa.toFixed(3);
}

function emptyContingency(): IcrContingency {
  return { bothYes: 0, aOnly: 0, bOnly: 0, bothNo: 0, n: 0 };
}

// Pairwise ICR between two coders over every (source × code) item.
export function computePairwiseIcr(project: Project, coderA: string, coderB: string): IcrPairResult {
  const sources = icrSources(project);
  const codes = project.codes;
  const presence = buildPresence(project);
  const setA = presence.get(coderA) || new Set<string>();
  const setB = presence.get(coderB) || new Set<string>();

  const overall = emptyContingency();
  const perCode: IcrPairCodeRow[] = codes.map(code => {
    const t = emptyContingency();
    for (const src of sources) {
      const key = `${src.id}::${code.id}`;
      const aPresent = setA.has(key);
      const bPresent = setB.has(key);
      t.n += 1;
      if (aPresent && bPresent) t.bothYes += 1;
      else if (aPresent) t.aOnly += 1;
      else if (bPresent) t.bOnly += 1;
      else t.bothNo += 1;
    }
    overall.bothYes += t.bothYes;
    overall.aOnly += t.aOnly;
    overall.bOnly += t.bOnly;
    overall.bothNo += t.bothNo;
    overall.n += t.n;
    return {
      codeId: code.id,
      codeName: code.name,
      ...t,
      percent: percentAgreement(t),
      kappa: cohenKappa(t)
    };
  });

  // Most-disagreed first, then most-coded — the rows worth reconciling float up.
  perCode.sort(
    (x, y) =>
      x.percent - y.percent ||
      y.bothYes + y.aOnly + y.bOnly - (x.bothYes + x.aOnly + x.bOnly) ||
      x.codeName.localeCompare(y.codeName)
  );

  return {
    coderA,
    coderB,
    items: overall.n,
    sources: sources.length,
    codes: codes.length,
    contingency: overall,
    percent: percentAgreement(overall),
    kappa: cohenKappa(overall),
    perCode
  };
}

// Fleiss' kappa over the same (source × code) items for 3+ coders, with the
// two binary categories present/absent. Every coder rates every item (an
// absent code counts as an "absent" rating), so the rater count is constant.
export function computeFleissIcr(project: Project, coders: string[]): IcrFleissResult {
  const sources = icrSources(project);
  const codes = project.codes;
  const presence = buildPresence(project);
  const m = coders.length;

  const perCode: IcrFleissCodeRow[] = codes.map(code => {
    let full = 0;
    let sumP = 0;
    let totalPresent = 0;
    const items = sources.length;
    for (const src of sources) {
      const key = `${src.id}::${code.id}`;
      let present = 0;
      for (const c of coders) {
        if ((presence.get(c) || new Set<string>()).has(key)) present += 1;
      }
      const absent = m - present;
      totalPresent += present;
      if (present === 0 || present === m) full += 1;
      if (m > 1) sumP += (present * (present - 1) + absent * (absent - 1)) / (m * (m - 1));
    }
    const pBar = items > 0 ? sumP / items : 0;
    const pYes = items > 0 && m > 0 ? totalPresent / (items * m) : 0;
    const pe = pYes * pYes + (1 - pYes) * (1 - pYes);
    const kappa = items === 0 || m < 2 || 1 - pe === 0 ? null : (pBar - pe) / (1 - pe);
    return {
      codeId: code.id,
      codeName: code.name,
      items,
      fullAgreement: full,
      percentFull: items > 0 ? (full / items) * 100 : 0,
      kappa
    };
  });

  let full = 0;
  let sumP = 0;
  let totalPresent = 0;
  const items = sources.length * codes.length;
  for (const code of codes) {
    for (const src of sources) {
      const key = `${src.id}::${code.id}`;
      let present = 0;
      for (const c of coders) {
        if ((presence.get(c) || new Set<string>()).has(key)) present += 1;
      }
      const absent = m - present;
      totalPresent += present;
      if (present === 0 || present === m) full += 1;
      if (m > 1) sumP += (present * (present - 1) + absent * (absent - 1)) / (m * (m - 1));
    }
  }
  const pBar = items > 0 ? sumP / items : 0;
  const pYes = items > 0 && m > 0 ? totalPresent / (items * m) : 0;
  const pe = pYes * pYes + (1 - pYes) * (1 - pYes);
  const kappa = items === 0 || m < 2 || 1 - pe === 0 ? null : (pBar - pe) / (1 - pe);

  perCode.sort(
    (x, y) =>
      x.percentFull - y.percentFull || x.codeName.localeCompare(y.codeName)
  );

  return {
    coders: [...coders],
    items,
    sources: sources.length,
    codes: codes.length,
    fullAgreement: full,
    percentFull: items > 0 ? (full / items) * 100 : 0,
    kappa,
    perCode
  };
}

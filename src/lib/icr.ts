import { Project, CodedSegment, UNATTRIBUTED_CODER } from '../domain';

// Inter-coder reliability (ICR) / inter-coder agreement.
//
// Two standard families, sharing one idea of "code occurrence":
// one item = one (source × code) pair, where a source is a text document
// or an image. A coder "marks" an item present when they applied that code
// at least once to that source (a coded segment for documents, a coded
// region for images).
//
// Metrics provided:
// - Percent agreement (observed agreement Po).
// - Holsti's index 2M/(N1+N2): agreement over positive coding decisions
//   only (joint "not coded" items do NOT count) — M = items both coders
//   coded, N1/N2 = items each coder coded.
// - Cohen's kappa for a pair of coders (chance-corrected).
// - Fleiss' kappa for 3+ coders (chance-corrected, same binary
//   present/absent categories).
// - Krippendorff's c-Alpha-binary: nominal alpha per code
//   over present/absent ratings.
// - Krippendorff's Cu-Alpha: nominal alpha over *which*
//   code was assigned to each jointly-considered quote (overlap units coded
//   by at least one coder; "uncoded" is an explicit category).
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
  holsti: number | null;
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
  holsti: number | null;
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

export interface IcrBinaryAlphaRow {
  codeId: string;
  codeName: string;
  items: number;
  alpha: number | null;
}

export interface IcrBinaryAlphaResult {
  coders: string[];
  items: number;
  sources: number;
  codes: number;
  alpha: number | null;
  perCode: IcrBinaryAlphaRow[];
}

// One jointly-considered quote: the maximal run of overlapping segments
// (same document) across the scoped coders. The shared unit behind both
// Cu-Alpha and the consensus/adjudication review.
export interface CodingUnitCoder {
  coder: string;
  codeIds: string[];
  segmentIds: string[];
}

export interface CodingUnit {
  key: string;
  docId: string;
  docName: string;
  start: number;
  end: number;
  text: string;
  segmentIds: string[];
  perCoder: CodingUnitCoder[];
  // How many distinct coders actually coded this quote. 1 means the quote was
  // coded by a single coder and is therefore NOT a consensus item.
  distinctCoders: number;
  // True when the coders who coded this quote ALL assigned it the same single
  // code. Judged only over the coders who touched the quote — a third coder
  // who never coded it must not turn an agreement into a disagreement.
  agreed: boolean;
}

export interface IcrCuResult {
  coders: string[];
  units: number;
  alpha: number | null;
  fullAgreement: number;
  percentFull: number;
}

// Scope for every metric: which documents count, and whether image sources
// count. The default (everything) preserves the original all-project stats.
export interface IcrScope {
  docIds: string[];
  includeImages: boolean;
}

export function defaultIcrScope(project: Project): IcrScope {
  return { docIds: project.docs.map(d => d.id), includeImages: true };
}

// Explicit "not coded" category for Cu-Alpha (a coder who left a jointly
// considered quote uncoded disagrees with whoever coded it).
export const ICR_UNCODED = '∅ uncoded';

export function icrCoderName(raw: string | undefined): string {
  return (raw || '').trim() || UNATTRIBUTED_CODER;
}

// Distinct coders that have coded anything, with their segment/region
// counts.
//
// "Unattributed" is reported SEPARATELY, not as a coder row: unstamped items
// are legacy/imported data with no human behind them, and scoring them as a
// rater produces a number that looks like agreement but is really
// "legacy data vs. person" — and, worse, makes `CodingUnit.agreed` unsatisfiable
// for every quote unless a second real coder overlaps it. The UI discloses the
// excluded count so nothing is silently dropped from the picture; the user can
// still attribute them (Project Settings → "Assign N Unattributed item(s)").
export function listIcrCoders(project: Project): IcrCoder[] {
  return [...collectIcrCoders(project).attributed];
}

export interface IcrCoderInventory {
  attributed: IcrCoder[];
  unattributed: IcrCoder | null;
}

export function collectIcrCoders(project: Project): IcrCoderInventory {
  const map = new Map<string, IcrCoder>();
  const bump = (name: string | undefined, seg: boolean) => {
    const key = icrCoderName(name);
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
  const byVolume = (a: IcrCoder, b: IcrCoder) =>
    b.segments + b.regions - (a.segments + a.regions) || a.name.localeCompare(b.name);
  return {
    attributed: Array.from(map.values()).filter(c => c.name !== UNATTRIBUTED_CODER).sort(byVolume),
    unattributed: map.get(UNATTRIBUTED_CODER) || null
  };
}

interface IcrSource {
  id: string;
  name: string;
  kind: 'doc' | 'image';
}

function icrSources(project: Project, scope: IcrScope): IcrSource[] {
  const wanted = new Set(scope.docIds);
  const docs = project.docs
    .filter(d => wanted.has(d.id))
    .map(d => ({ id: d.id, name: d.name, kind: 'doc' as const }));
  if (!scope.includeImages) return docs;
  const images = (project.images || []).map(m => ({ id: m.id, name: m.name, kind: 'image' as const }));
  return [...docs, ...images];
}

// coder -> set of "sourceId::codeId" the coder marked present.
function buildPresence(project: Project): Map<string, Set<string>> {
  const presence = new Map<string, Set<string>>();
  const mark = (coderRaw: string | undefined, sourceId: string, codeId: string) => {
    const coder = icrCoderName(coderRaw);
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

// Holsti's reliability index 2M/(N1+N2): M = items both coders coded,
// N1/N2 = items each coder coded. Joint absences deliberately do NOT
// count, so this answers "of everything anyone coded, how much did both
// code?" rather than "of every possible item, how often did we match?".
// Returns null when neither coder coded anything.
export function holstiIndex(t: IcrContingency): number | null {
  const denom = 2 * t.bothYes + t.aOnly + t.bOnly;
  if (denom === 0) return null;
  return (2 * t.bothYes) / denom;
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

// Krippendorff's alpha for nominal data, general coincidence-matrix form
// (Krippendorff 2004/2018): α = 1 − Do/De. Each item carries one rating
// per rater; null = missing (skipped, and items with fewer than 2 ratings
// contribute nothing). Returns null when undefined (fewer than 2 observed
// categories, no pairable values, or zero expected disagreement).
export function krippendorffAlphaNominal(items: Array<Array<string | null>>): number | null {
  const pairCounts = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  let total = 0;
  const bump = (c: string, k: string, v: number) => {
    let row = pairCounts.get(c);
    if (!row) {
      row = new Map();
      pairCounts.set(c, row);
    }
    row.set(k, (row.get(k) || 0) + v);
  };

  for (const ratings of items) {
    const vals = ratings.filter((r): r is string => r !== null);
    const m = vals.length;
    if (m < 2) continue;
    const counts = new Map<string, number>();
    for (const v of vals) counts.set(v, (counts.get(v) || 0) + 1);
    for (const [c, nc] of counts) {
      totals.set(c, (totals.get(c) || 0) + nc);
      total += nc;
      for (const [k, nk] of counts) {
        bump(c, k, c === k ? (nc * (nc - 1)) / (m - 1) : (nc * nk) / (m - 1));
      }
    }
  }

  if (total === 0 || totals.size < 2) return null;
  let disagree = 0;
  for (const [c, row] of pairCounts) {
    for (const [k, v] of row) {
      if (c !== k) disagree += v; // nominal metric: different = 1
    }
  }
  const Do = disagree / total;
  let expected = 0;
  for (const [c, nc] of totals) {
    for (const [k, nk] of totals) {
      if (c !== k) expected += nc * nk;
    }
  }
  const De = expected / (total * (total - 1));
  if (De === 0) return null;
  return 1 - Do / De;
}

// Landis & Koch (1977) benchmark labels. Only meaningful for CHANCE-CORRECTED
// coefficients (Cohen's κ, Fleiss' κ, Krippendorff's α). It must NOT be applied
// to uncorrected ratios such as Holsti's index — see the caller in App.tsx.
export function kappaInterpretation(kappa: number | null): string {
  if (kappa === null || Number.isNaN(kappa)) return '—';
  if (kappa < 0) return 'Poor (below chance)';
  if (kappa <= 0.2) return 'Slight';
  if (kappa <= 0.4) return 'Fair';
  if (kappa <= 0.6) return 'Moderate';
  if (kappa <= 0.8) return 'Substantial';
  return 'Almost perfect';
}

// One formatter for every numeric agreement figure — κ, α and Holsti alike.
// Deliberately NOT called "formatKappa": a kappa-specific name invited the
// mistake of labelling Holsti's index (an uncorrected ratio) as if it were a
// chance-corrected coefficient.
export function formatIcrValue(v: number | null): string {
  if (v === null || Number.isNaN(v)) return '—';
  return v.toFixed(3);
}

function emptyContingency(): IcrContingency {
  return { bothYes: 0, aOnly: 0, bOnly: 0, bothNo: 0, n: 0 };
}

// Pairwise ICR between two coders over every in-scope (source × code) item.
export function computePairwiseIcr(
  project: Project,
  coderA: string,
  coderB: string,
  scope: IcrScope = defaultIcrScope(project)
): IcrPairResult {
  const sources = icrSources(project, scope);
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
      kappa: cohenKappa(t),
      holsti: holstiIndex(t)
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
    holsti: holstiIndex(overall),
    perCode
  };
}

// Fleiss' kappa over the same (source × code) items for the given coders,
// with the two binary categories present/absent. Every coder rates every
// item (an absent code counts as an "absent" rating), so the rater count
// is constant.
export function computeFleissIcr(
  project: Project,
  coders: string[],
  scope: IcrScope = defaultIcrScope(project)
): IcrFleissResult {
  const sources = icrSources(project, scope);
  const codes = project.codes;
  const presence = buildPresence(project);
  const m = coders.length;
  const perCodeItems = sources.length;
  const items = perCodeItems * codes.length;

  // One pass over every (source × code) item feeds both the per-code rows and
  // the overall figure — the two are the same sum at different granularity, so
  // recomputing the overall in a second loop only doubled the work.
  let full = 0;
  let sumP = 0;
  let totalPresent = 0;
  const perCode: IcrFleissCodeRow[] = codes.map(code => {
    let codeFull = 0;
    let codeSumP = 0;
    let codePresentTotal = 0;
    for (const src of sources) {
      const key = `${src.id}::${code.id}`;
      let present = 0;
      for (const c of coders) {
        if ((presence.get(c) || new Set<string>()).has(key)) present += 1;
      }
      const absent = m - present;
      const isFull = present === 0 || present === m;
      let agreeTerm = 0;
      if (m > 1) agreeTerm = (present * (present - 1) + absent * (absent - 1)) / (m * (m - 1));
      codePresentTotal += present;
      if (isFull) codeFull += 1;
      codeSumP += agreeTerm;
      totalPresent += present;
      if (isFull) full += 1;
      sumP += agreeTerm;
    }
    const pBar = perCodeItems > 0 ? codeSumP / perCodeItems : 0;
    const pYes = perCodeItems > 0 && m > 0 ? codePresentTotal / (perCodeItems * m) : 0;
    const pe = pYes * pYes + (1 - pYes) * (1 - pYes);
    const kappa = perCodeItems === 0 || m < 2 || 1 - pe === 0 ? null : (pBar - pe) / (1 - pe);
    return {
      codeId: code.id,
      codeName: code.name,
      items: perCodeItems,
      fullAgreement: codeFull,
      percentFull: perCodeItems > 0 ? (codeFull / perCodeItems) * 100 : 0,
      kappa
    };
  });

  const pBar = items > 0 ? sumP / items : 0;
  const pYes = items > 0 && m > 0 ? totalPresent / (items * m) : 0;
  const pe = pYes * pYes + (1 - pYes) * (1 - pYes);
  const kappa = items === 0 || m < 2 || 1 - pe === 0 ? null : (pBar - pe) / (1 - pe);

  perCode.sort((x, y) => x.percentFull - y.percentFull || x.codeName.localeCompare(y.codeName));

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

// Krippendorff's c-Alpha-binary: nominal alpha per code
// over present/absent ratings, plus an overall binary alpha flattened over
// every (source × code) item.
export function computeBinaryAlpha(
  project: Project,
  coders: string[],
  scope: IcrScope = defaultIcrScope(project)
): IcrBinaryAlphaResult {
  const sources = icrSources(project, scope);
  const codes = project.codes;
  const presence = buildPresence(project);

  // Build each (source × code) item's ratings once and reuse the same arrays
  // for the per-code alpha and the flattened overall alpha.
  const ratingsByCode: Array<Array<string[]>> = codes.map(code =>
    sources.map(src => {
      const key = `${src.id}::${code.id}`;
      return coders.map(c => ((presence.get(c) || new Set<string>()).has(key) ? 'present' : 'absent'));
    })
  );

  const perCode: IcrBinaryAlphaRow[] = codes.map((code, i) => ({
    codeId: code.id,
    codeName: code.name,
    items: sources.length,
    alpha: krippendorffAlphaNominal(ratingsByCode[i])
  }));

  const allRatings: Array<Array<string | null>> = ([] as Array<Array<string | null>>).concat(...ratingsByCode);

  perCode.sort((x, y) => {
    const ax = x.alpha === null ? 2 : x.alpha;
    const ay = y.alpha === null ? 2 : y.alpha;
    return ax - ay || x.codeName.localeCompare(y.codeName);
  });

  return {
    coders: [...coders],
    items: allRatings.length,
    sources: sources.length,
    codes: codes.length,
    alpha: krippendorffAlphaNominal(allRatings),
    perCode
  };
}

// Maximal runs of overlapping segments (same document) across the given
// coders — the jointly-considered quotes behind Cu-Alpha and consensus
// review. Touching boundaries (end == start) do NOT merge; only genuine
// overlap does, matching the co-occurrence rule used elsewhere.
export function buildCodingUnits(project: Project, coders: string[], docIds: string[]): CodingUnit[] {
  // Never treat the "Unattributed" bucket as a rater — it would poison the
  // agreed/disagreed verdict (see makeCodingUnit).
  const coderSet = new Set(coders.filter(c => c !== UNATTRIBUTED_CODER));
  const docSet = new Set(docIds);
  const docsById = new Map(project.docs.map(d => [d.id, d]));
  const segs = project.codedSegments
    .filter(s => coderSet.has(icrCoderName(s.coder)) && docSet.has(s.docId))
    .sort((a, b) => (a.docId < b.docId ? -1 : a.docId > b.docId ? 1 : a.start - b.start || a.end - b.end));

  const units: CodingUnit[] = [];
  let cur: CodedSegment[] = [];
  let curEnd = 0;
  const flush = () => {
    if (cur.length > 0) units.push(makeCodingUnit(cur, docsById, coders));
    cur = [];
    curEnd = 0;
  };
  for (const s of segs) {
    if (cur.length > 0 && cur[0].docId === s.docId && s.start < curEnd) {
      cur.push(s);
      if (s.end > curEnd) curEnd = s.end;
    } else {
      flush();
      cur = [s];
      curEnd = s.end;
    }
  }
  flush();
  return units;
}

function makeCodingUnit(
  segs: CodedSegment[],
  docsById: Map<string, { name: string; content: string }>,
  coderOrder: string[]
): CodingUnit {
  const docId = segs[0].docId;
  const start = Math.min(...segs.map(s => s.start));
  const end = Math.max(...segs.map(s => s.end));
  const doc = docsById.get(docId);
  const text = doc ? doc.content.slice(Math.max(0, start), Math.min(doc.content.length, end)) : '';
  const byCoder = new Map<string, CodedSegment[]>();
  for (const s of segs) {
    const name = icrCoderName(s.coder);
    const list = byCoder.get(name) || [];
    list.push(s);
    byCoder.set(name, list);
  }
  const perCoder: CodingUnitCoder[] = coderOrder
    .filter(c => byCoder.has(c))
    .map(c => ({
      coder: c,
      codeIds: Array.from(new Set(byCoder.get(c)!.map(s => s.codeId))),
      segmentIds: byCoder.get(c)!.map(s => s.id)
    }));
  // Only coders who actually coded this quote get a vote. The "Unattributed"
  // bucket is never a valid voter (see buildCodingUnits).
  //
  // Agreement is judged over those voters ALONE. Requiring unanimity across
  // every coder in the scope was wrong: with three coders, two agreeing on a
  // quote the third never touched was reported as a disagreement, which left
  // the Agreements list permanently empty.
  const voters = perCoder.filter(p => p.coder !== UNATTRIBUTED_CODER && p.segmentIds.length > 0);
  const agreed =
    voters.length >= 2 &&
    voters.every(p => p.codeIds.length === 1) &&
    new Set(voters.map(p => p.codeIds[0])).size === 1;
  return {
    key: `${docId}:${start}-${end}`,
    docId,
    docName: doc ? doc.name : 'Unknown document',
    start,
    end,
    text,
    segmentIds: segs.map(s => s.id),
    perCoder,
    distinctCoders: voters.length,
    agreed
  };
}

// Consensus/adjudication units: only quotes that AT LEAST TWO scoped coders
// coded. A passage a single coder marked on their own is not a disagreement —
// there is nobody to disagree with — so it is not an adjudication item.
//
// buildCodingUnits deliberately still returns every unit, because Cu-Alpha
// treats a quote a coder left uncoded as a disagreement and therefore needs the
// solo-coded ones in its unit pool.
export function buildConsensusUnits(project: Project, coders: string[], docIds: string[]): CodingUnit[] {
  return buildCodingUnits(project, coders, docIds).filter(u => u.distinctCoders >= 2);
}

// Krippendorff's Cu-Alpha: nominal alpha over *which* code
// was assigned to each jointly-considered quote (overlap units coded by at
// least one coder). A coder who left a unit uncoded gets the explicit
// "uncoded" category, so partial coverage counts as disagreement. When a
// coder put several codes on one unit, the primary value is the code with
// the largest overlap (ties: earliest start, then code id) — deterministic
// and documented.
export function computeCuAlpha(project: Project, coders: string[], docIds: string[]): IcrCuResult {
  const units = buildCodingUnits(project, coders, docIds);
  const byId = new Map(project.codedSegments.map(s => [s.id, s]));
  const ratings = units.map(u =>
    coders.map(coder => {
      const pc = u.perCoder.find(p => p.coder === coder);
      if (!pc || pc.segmentIds.length === 0) return ICR_UNCODED;
      let best = '';
      let bestOv = -1;
      let bestStart = Infinity;
      for (const id of pc.segmentIds) {
        const s = byId.get(id);
        if (!s) continue;
        const ov = Math.min(s.end, u.end) - Math.max(s.start, u.start);
        if (ov > bestOv || (ov === bestOv && (s.start < bestStart || (s.start === bestStart && s.codeId < best)))) {
          best = s.codeId;
          bestOv = ov;
          bestStart = s.start;
        }
      }
      return best || ICR_UNCODED;
    })
  );
  const alpha = krippendorffAlphaNominal(ratings);
  let full = 0;
  for (const r of ratings) {
    if (r.length > 0 && r.every(v => v === r[0])) full += 1;
  }
  return {
    coders: [...coders],
    units: units.length,
    alpha,
    fullAgreement: full,
    percentFull: units.length > 0 ? (full / units.length) * 100 : 0
  };
}

export type CaptureBoundary = 'exact' | 'sentence';
export type AutoCodeMatchMode = 'literal' | 'root';

export interface LanguageOption {
  code: string;
  label: string;
  terminators: string[]; // sentence-ending punctuation for this language
}

export const AUTO_CODE_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', terminators: ['.', '!', '?'] },
  { code: 'bn', label: 'Bangla', terminators: ['।', '.', '!', '?'] },
  { code: 'es', label: 'Spanish', terminators: ['.', '!', '?'] },
  { code: 'fr', label: 'French', terminators: ['.', '!', '?'] },
  { code: 'de', label: 'German', terminators: ['.', '!', '?'] },
  { code: 'hi', label: 'Hindi', terminators: ['।', '.', '!', '?'] },
  { code: 'other', label: 'Other / generic', terminators: ['.', '!', '?'] }
];

export interface AutoCodeMatch {
  start: number;
  end: number;
  text: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findExactMatches(content: string, keyword: string): AutoCodeMatch[] {
  if (!keyword.trim()) return [];
  const re = new RegExp(escapeRegExp(keyword), 'gi');
  const matches: AutoCodeMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    if (m[0].length === 0) re.lastIndex++; // guard against zero-length matches
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Word-root (stem) matching — lets "tree" catch "trees"/"Trees", "green" catch
// "greens"/"Greeneries", etc. Not a full dictionary stemmer, just a light
// English inflection normalizer. Non-ASCII words (e.g. Bangla) are returned
// unchanged so they fall back to whole-word literal matching.
// ---------------------------------------------------------------------------

function roughStem(word: string): string {
  const s = word.toLowerCase();
  if (!/[a-z]/.test(s) || s.length <= 3) return s;

  // -ies → -y, -ied → -y  ("greeneries" → "greenery", "applied" → "apply")
  if (s.endsWith('ies') && s.length > 4) return s.slice(0, -3) + 'y';
  if (s.endsWith('ied') && s.length > 4) return s.slice(0, -3) + 'y';

  const collapseDouble = (t: string) =>
    t.length >= 3 && /([a-z])\1$/.test(t) ? t.slice(0, -1) : t;

  // -ing / -ing-ly / -ed / -er / -est (+ double-consonant collapse:
  // "running" → "runn" → "run", "bigger" → "bigg" → "big")
  if (s.endsWith('ingly') && s.length > 6) return collapseDouble(s.slice(0, -5));
  if (s.endsWith('ing') && s.length > 5) return collapseDouble(s.slice(0, -3));
  if (s.endsWith('ers') && s.length > 4) return collapseDouble(s.slice(0, -3));
  if (s.endsWith('est') && s.length > 4) return collapseDouble(s.slice(0, -3));
  if (s.endsWith('ed') && s.length > 3) return collapseDouble(s.slice(0, -2));
  if (s.endsWith('er') && s.length > 3) return collapseDouble(s.slice(0, -2));

  // Sibilant plurals need "-es": classes→class, boxes→box, churches→church
  if (/sses|xes|ches|shes$/.test(s) && s.length > 4) return s.slice(0, -2);

  // Plain plural: trees→tree, greens→green
  if (s.endsWith('s') && s.length > 3) return s.slice(0, -1);

  return s;
}

// A word that clearly carries an English-ish inflectional ending (plural,
// past tense, participle, comparative, adverbial, or a long -y form like
// "greenery"). Helps avoid prefix false-positives such as "tree" in
// "treehouse" while still catching "Green" → "Greeneries".
function isInflected(w: string): boolean {
  const s = w.toLowerCase();
  if (s.length >= 5 && s.endsWith('y')) return true;
  const SUFFIXES = ['ingly', 'ies', 'ied', 'ing', 'ers', 'est', 'es', 'ed', 'er', 's'];
  return SUFFIXES.some(sfx => s.endsWith(sfx) && s.length - sfx.length >= 3);
}

function wordMatches(queryWord: string, contentWord: string): boolean {
  const q = queryWord.toLowerCase();
  const c = contentWord.toLowerCase();
  if (q === c) return true;

  const sq = roughStem(q);
  const sc = roughStem(c);
  if (sq === sc && sq.length >= 3) return true;

  // Allow derived forms sharing a long common root, but only when one side is
  // clearly inflected and the other is the base form (e.g. green ↔ greenery).
  const short = sq.length <= sc.length ? sq : sc;
  const long = sq.length <= sc.length ? sc : sq;
  if (short.length >= 3 && long.startsWith(short)) {
    const longWord = long === sq ? q : c;
    const shortWord = long === sq ? c : q;
    if (isInflected(longWord) && !isInflected(shortWord)) return true;
  }
  return false;
}

// Whole-word, order-preserving phrase matching where each query word may match
// its stem variants in the content. Because it is word-boundary based, it also
// avoids literal-mode false positives like "tree" inside "street".
function findRootMatches(content: string, query: string): AutoCodeMatch[] {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const occ: Array<{ start: number; end: number; word: string }> = [];
  const re = /[\p{L}\p{N}]+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    occ.push({ start: m.index, end: m.index + m[0].length, word: m[0] });
  }

  const matches: AutoCodeMatch[] = [];
  for (let i = 0; i + tokens.length <= occ.length; i++) {
    let ok = true;
    for (let t = 0; t < tokens.length; t++) {
      if (!wordMatches(tokens[t], occ[i + t].word)) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const start = occ[i].start;
      const end = occ[i + tokens.length - 1].end;
      matches.push({ start, end, text: content.slice(start, end) });
      i += tokens.length - 1; // don't re-match from inside the same phrase
    }
  }
  return matches;
}

function expandToSentence(content: string, start: number, end: number, terminators: string[]): AutoCodeMatch {
  const termSet = new Set(terminators);
  let s = start;
  while (s > 0 && !termSet.has(content[s - 1])) s--;
  // skip leading whitespace after a terminator
  while (s < content.length && /\s/.test(content[s])) s++;

  let e = end;
  while (e < content.length && !termSet.has(content[e])) e++;
  if (e < content.length) e++; // include the terminator itself

  return { start: s, end: e, text: content.slice(s, e) };
}

export function runAutoCode(
  content: string,
  keyword: string,
  boundary: CaptureBoundary,
  languageCode: string,
  matchMode: AutoCodeMatchMode = 'literal'
): AutoCodeMatch[] {
  const matches = matchMode === 'root' ? findRootMatches(content, keyword) : findExactMatches(content, keyword);
  if (boundary === 'exact') return matches;

  const lang = AUTO_CODE_LANGUAGES.find(l => l.code === languageCode) || AUTO_CODE_LANGUAGES[0];
  const seen = new Set<string>();
  const sentences: AutoCodeMatch[] = [];
  for (const m of matches) {
    const sentence = expandToSentence(content, m.start, m.end, lang.terminators);
    const key = `${sentence.start}-${sentence.end}`;
    if (!seen.has(key)) {
      seen.add(key);
      sentences.push(sentence);
    }
  }
  return sentences;
}
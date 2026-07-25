export type CaptureBoundary = 'exact' | 'sentence';

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
  languageCode: string
): AutoCodeMatch[] {
  const exact = findExactMatches(content, keyword);
  if (boundary === 'exact') return exact;

  const lang = AUTO_CODE_LANGUAGES.find(l => l.code === languageCode) || AUTO_CODE_LANGUAGES[0];
  const seen = new Set<string>();
  const sentences: AutoCodeMatch[] = [];
  for (const m of exact) {
    const sentence = expandToSentence(content, m.start, m.end, lang.terminators);
    const key = `${sentence.start}-${sentence.end}`;
    if (!seen.has(key)) {
      seen.add(key);
      sentences.push(sentence);
    }
  }
  return sentences;
}

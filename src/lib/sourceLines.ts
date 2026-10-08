export interface SourceLine { number: number; start: number; end: number; text: string }

/** Logical source lines, preserving all original characters and CRLF offsets. */
export function sourceLines(content: string): SourceLine[] {
  const lines: SourceLine[] = [];
  const breaks = /\r\n|\r|\n/g;
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = breaks.exec(content))) {
    const end = match.index + match[0].length;
    lines.push({ number: lines.length + 1, start, end, text: content.slice(start, end) });
    start = end;
  }
  lines.push({ number: lines.length + 1, start, end: content.length, text: content.slice(start) });
  return lines;
}

export function sourceLineRange(content: string, start: number, end: number): string {
  const lines = sourceLines(content);
  const lineAt = (position: number) => {
    let low = 0, high = lines.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (lines[mid].start <= position) low = mid; else high = mid - 1;
    }
    return lines[low].number;
  };
  const first = lineAt(Math.max(0, Math.min(start, content.length)));
  const last = lineAt(Math.max(start, Math.min(Math.max(start, end - 1), content.length)));
  return first === last ? `Line ${first}` : `Lines ${first}–${last}`;
}

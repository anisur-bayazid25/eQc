/** REFI-QDA uses zero-based Unicode code points and inclusive last positions.
 * eQc selections use UTF-16 offsets with an exclusive end (DOM/JS convention).
 */
export function utf16ToQdaRange(text: string, start: number, end: number): { start: number; end: number } {
  return { start: Array.from(text.slice(0, start)).length, end: Array.from(text.slice(0, end)).length - 1 };
}

export function qdaToUtf16Range(text: string, start: number, end: number): { start: number; end: number } | null {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) return null;
  const points = Array.from(text);
  if (end >= points.length) return null;
  return { start: points.slice(0, start).join('').length, end: points.slice(0, end + 1).join('').length };
}

/** Short visual identifiers; stored quotes and notes are never altered. */
export function passagePreview(text:string):string {
  const words=text.trim().split(/\s+/u).filter(Boolean);
  return words.length<=8?words.join(' '):`${words.slice(0,4).join(' ')} … ${words.slice(-4).join(' ')}`;
}
export function notePreview(text:string):string {
  const words=text.trim().split(/\s+/u).filter(Boolean);
  return words.length<=10?words.join(' '):`${words.slice(0,8).join(' ')} …`;
}

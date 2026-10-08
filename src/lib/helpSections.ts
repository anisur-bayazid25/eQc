export const helpSlug = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-');
export function helpSections(markdown: string) {
  return markdown.split(/(?=^##\s)/m).filter(part => /^##\s/m.test(part)).map((part, id) => ({
    id, title: part.match(/^##\s+(.+)/m)![1], text: part.replace(/^##\s+.+\r?\n/, '')
  }));
}

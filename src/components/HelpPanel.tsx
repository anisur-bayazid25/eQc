import React, { useEffect, useMemo, useState } from 'react';
import guide from '../../USER_GUIDE.md?raw';
import documentation from '../../DOCUMENTATION.md?raw';
import { helpSlug as slug, helpSections } from '../lib/helpSections';

function MarkdownText({ text, onDocument, onAnchor }: { text: string; onDocument: (book: string) => void; onAnchor: (anchor: string) => void }) {
  function inline(value: string): React.ReactNode[] {
    return value.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\)|\*[^*\n]+\*)/g).map((part, i) => {
      if (part.startsWith('**')) return <strong key={i}>{inline(part.slice(2, -2))}</strong>;
      if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
      if (part.startsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
      const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
      if (link) {
        const [, label, href] = link;
        if (/^USER_GUIDE|^DOCUMENTATION/.test(href)) return <button className="help-link" key={i} onClick={() => onDocument(href.startsWith('USER_GUIDE') ? 'guide' : 'documentation')}>{label}</button>;
        if (href.startsWith('#')) return <a key={i} href={href} onClick={e => { e.preventDefault(); onAnchor(href.slice(1)); }}>{label}</a>;
        if (/^https?:\/\//.test(href) || /^(CHANGELOG|AI_CHANGELOG)\.md$/.test(href)) return <a key={i} href={href.startsWith('http') ? href : 'https://github.com/anisur-bayazid25/eQc/blob/main/' + href} target="_blank" rel="noopener noreferrer">{label}</a>;
        return label;
      }
      return part;
    });
  }
  const lines = text.replace(/\r/g, '').split('\n'), blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], key = i;
    if (!line.trim() || /^!\[/.test(line)) continue;
    if (/^---+$/.test(line.trim())) { blocks.push(<hr key={key} />); continue; }
    if (/^#{1,6}\s/.test(line)) { const title = line.replace(/^#+\s/, ''); blocks.push(<h3 key={key} id={'help-' + slug(title)}>{inline(title)}</h3>); continue; }
    if (line.startsWith('```')) { const code: string[] = []; while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]); blocks.push(<pre key={key}>{code.join('\n')}</pre>); continue; }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) { if (!/^\|[\s:|-]+\|$/.test(lines[i])) rows.push(lines[i].replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())); i++; } i--;
      blocks.push(<div className="help-table" key={key}><table><thead><tr>{rows[0]?.map((cell, n) => <th key={n}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.slice(1).map((row, n) => <tr key={n}>{row.map((cell, c) => <td key={c}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>); continue;
    }
    const list = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)/);
    if (list) {
      const ordered = /\d/.test(list[2]), items: string[] = [];
      while (i < lines.length) { const item = lines[i].match(/^\s*([-*]|\d+\.)\s+(.+)/); if (!item || /\d/.test(item[1]) !== ordered) break; items.push(item[2]); i++; } i--;
      const content = items.map((item, n) => <li key={n}>{inline(item)}</li>); blocks.push(ordered ? <ol key={key}>{content}</ol> : <ul key={key}>{content}</ul>); continue;
    }
    if (line.startsWith('> ')) { blocks.push(<blockquote key={key}>{inline(line.slice(2))}</blockquote>); continue; }
    blocks.push(<p key={key}>{inline(line)}</p>);
  }
  return <div className="help-text">{blocks}</div>;
}
export default function HelpPanel() {
  const [search, setSearch] = useState(''), [book, setBook] = useState('guide'), [expanded, setExpanded] = useState(false);
  const [anchor, setAnchor] = useState('');
  const [revealedSection, setRevealedSection] = useState('');
  const [anchorVisit, setAnchorVisit] = useState(0);
  const sections = useMemo(() => helpSections(book === 'guide' ? guide : documentation), [book]);
  useEffect(() => {
    if (!anchor) return;
    const target = document.getElementById('help-' + anchor);
    if (target) {
      for (let parent: HTMLElement | null = target; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
      target.scrollIntoView({ block: 'start' });
    }
  }, [anchor, anchorVisit, book, search]);
  const terms = search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = sections.filter(section => terms.every(term => (section.title + ' ' + section.text).toLocaleLowerCase().includes(term)));
  return <main className="panel help-panel"><header><h1>Help</h1></header>
    <div className="help-controls"><label>Search documentation<input type="search" placeholder="Try: merge codes, memos, QDPX, refinement…" value={search} onChange={e => { setRevealedSection(''); setAnchor(''); setSearch(e.target.value); }} /></label><label>Read<select aria-label="Documentation to read" value={book} onChange={e => { setRevealedSection(''); setAnchor(''); setSearch(''); setBook(e.target.value); }}><option value="guide">Complete user guide</option><option value="documentation">Application documentation</option></select></label><button onClick={() => { setRevealedSection(''); setAnchor(''); setExpanded(!expanded); }}>{expanded ? 'Collapse sections' : 'Read complete documentation'}</button></div>
    {search && <p role="status">{matches.length} sections match your search.</p>}
    <div className="help-sections">{matches.map((section, index) => <details key={`${book}-${section.id}-${expanded}-${search}`} id={'help-' + slug(section.title)} open={expanded || !!search || revealedSection === 'help-' + slug(section.title) || index === 0 && section.title === 'Table of Contents'}><summary>{section.title}</summary><MarkdownText text={section.text} onDocument={value => { setRevealedSection(''); setAnchor(''); setSearch(''); setBook(value); }} onAnchor={value => { const section = sections.find(section => slug(section.title) === value || [...section.text.matchAll(/^#{1,6}\s+(.+)$/gm)].some(heading => slug(heading[1]) === value)); setRevealedSection(section ? 'help-' + slug(section.title) : ''); setSearch(''); setAnchor(value); setAnchorVisit(visit => visit + 1); }} /></details>)}</div>
    {!matches.length && <p>No matching sections. Try a shorter phrase or choose the other documentation.</p>}
  </main>;
}

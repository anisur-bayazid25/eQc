import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Project } from '../domain';
import { codeTreeLeaves, WorkspaceSurprise } from '../lib/easterEggs';
import PikachuArtwork from './PikachuArtwork';
import SnorlaxArtwork from './SnorlaxArtwork';
import GifArtwork from './GifArtwork';
import totoroAnimation from '../assets/totoro.gif';
import totoroStill from '../assets/totoro-still.png';
import jijiAnimation from '../assets/jiji.gif';
import jijiStill from '../assets/jiji-still.png';

export function PatienceSnorlax({ origin, onDone }: { origin: { x: number; y: number }; onDone: () => void }) {
  const doneRef = useRef(onDone); doneRef.current = onDone;
  const cardRef = useRef<HTMLElement>(null), [position,setPosition] = useState({left:origin.x,top:origin.y});
  useLayoutEffect(() => {
    const place = () => {
      const box = cardRef.current?.getBoundingClientRect(); if (!box) return;
      const margin=10, gap=14;
      const left=Math.max(margin,Math.min(origin.x+gap,window.innerWidth-box.width-margin));
      const preferredTop=origin.y+gap+box.height <= window.innerHeight-margin ? origin.y+gap : origin.y-box.height-gap;
      const top=Math.max(margin,Math.min(preferredTop,window.innerHeight-box.height-margin));
      setPosition({left,top});
    };
    place(); window.addEventListener('resize',place);
    return () => window.removeEventListener('resize',place);
  }, [origin.x,origin.y]);
  useEffect(() => { const timer = setTimeout(() => doneRef.current(), 10000); return () => clearTimeout(timer); }, []);
  return <aside ref={cardRef} className="patience-snorlax" style={position} role="status"><SnorlaxArtwork/><p>Calm Down!</p><button onClick={onDone} aria-label="Dismiss Snorlax">×</button></aside>;
}

export const critterLines = {
  owl: 'Have you considered coding that thought?',
  jiji: 'One more subcode. Then a sandwich break.',
  mushroom: 'A memo a day keeps ‘why did I code this?’ away.',
  totoro: 'A little shelter for a growing forest of documents.'
};
type CritterKind = keyof typeof critterLines;
export function Critter({ kind }: { kind: CritterKind }) {
  if (kind === 'totoro') return <GifArtwork src={totoroAnimation} still={totoroStill} className="egg-critter egg-totoro"/>;
  if (kind === 'jiji') return <GifArtwork src={jijiAnimation} still={jijiStill} className="egg-critter egg-jiji"/>;
  return <svg className={`egg-critter egg-${kind}`} viewBox="0 0 100 100" aria-hidden="true">
    {kind === 'owl' && <>
      <path d="M20 78H86" stroke="#7a523a" strokeWidth="8" strokeLinecap="round" />
      <path d="M28 26L22 9L42 20Q55 12 67 20L82 9L75 30Q86 53 74 74Q52 87 31 71Q16 52 28 26" fill="#987046" />
      <ellipse cx="50" cy="58" rx="23" ry="22" fill="#dfbf84" />
      <circle cx="38" cy="37" r="15" fill="#fff4dd"/><circle cx="66" cy="37" r="15" fill="#fff4dd"/>
      <circle className="egg-owl-eye" cx="39" cy="38" r="6" fill="#24313d"/><circle className="egg-owl-eye" cx="65" cy="38" r="6" fill="#24313d"/>
      <path d="M47 45L56 45L51 55Z" fill="#e6a536"/><path d="M35 73V82M63 73V82" stroke="#c98d32" strokeWidth="5"/>
      <path d="M19 43Q15 65 30 69M79 43Q91 60 75 69" fill="none" stroke="#6e5035" strokeWidth="7" strokeLinecap="round"/>
    </>}
    {kind === 'mushroom' && <>
      <path d="M42 47L38 85Q54 96 66 84L59 47" fill="#f3e0ba"/><path d="M8 47Q17 4 51 10Q82 9 95 47Q55 66 8 47" fill="#d35c53"/>
      <ellipse cx="28" cy="33" rx="8" ry="6" fill="#fff4db"/><ellipse cx="60" cy="24" rx="8" ry="6" fill="#fff4db"/><ellipse cx="78" cy="42" rx="6" ry="5" fill="#fff4db"/>
      <circle cx="46" cy="70" r="3" fill="#4a3b32"/><circle cx="59" cy="70" r="3" fill="#4a3b32"/><path d="M47 79Q53 85 59 79" fill="none" stroke="#4a3b32" strokeWidth="2"/>
    </>}

  </svg>;
}

export function WorkspaceCritter({ kind, onDone }: { kind: WorkspaceSurprise; onDone: () => void }) {
  const doneRef = useRef(onDone); doneRef.current = onDone;
  useEffect(() => { const timer = setTimeout(() => doneRef.current(), kind === 'jiji' ? 5000 : 10000); return () => clearTimeout(timer); }, [kind]);
  return <aside className="workspace-critter" data-critter={kind} role="status"><Critter kind={kind}/><p>{critterLines[kind]}</p><button onClick={onDone} aria-label={`Dismiss ${kind}`}>×</button></aside>;
}

export function GrowingCodeTree({ project, onClose }: { project: Project; onClose: () => void }) {
  const leaves = codeTreeLeaves(project.codes), height = Math.max(420, Math.ceil(leaves.length / 8) * 64 + 250);
  const positions = new Map(leaves.map(leaf => [leaf.code.id, leaf]));
  const [selected, setSelected] = useState<string | null>(null), [saying, setSaying] = useState<CritterKind>('owl');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; closeRef.current?.focus();
    const timer = setInterval(() => setSaying(current => current === 'owl' ? 'mushroom' : 'owl'), 12000);
    return () => { clearInterval(timer); previous?.focus(); };
  }, []);
  const current = project.codes.find(code => code.id === selected);
  return <div className="egg-tree-overlay" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button, [tabindex="0"]'), first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <section className="egg-tree-panel" role="dialog" aria-modal="true" aria-labelledby="egg-tree-title">
      <header><div><h2 id="egg-tree-title">A little room to grow</h2><p>{project.name} · {leaves.length} code {leaves.length === 1 ? 'leaf' : 'leaves'}</p></div><button ref={closeRef} onClick={onClose}>Close tree</button></header>
      <div className="egg-tree-scroll"><svg className="egg-code-tree" viewBox={`0 0 1000 ${height}`} role="group" aria-label="Your codes growing as tree leaves">
        <path d={`M485 ${height-80}Q465 ${height/2} 500 85L523 85Q505 ${height/2} 526 ${height-80}Z`} fill="#7e573a"/>
        {leaves.map(({code,x,y}) => {
          const parent = code.parentId ? positions.get(code.parentId) : null;
          return <path key={code.id} className="egg-tree-branch" d={parent ? `M${parent.x} ${parent.y}Q${(parent.x+x)/2} ${Math.max(parent.y,y)+35} ${x} ${y}` : `M505 ${height-110}Q505 ${y+90} ${x} ${y}`} stroke="#896346" opacity={parent ? .8 : 1} strokeWidth={parent ? 2.5 : 6} fill="none"/>;
        })}
        {leaves.map(({code,x,y},index) => <g key={code.id} className="egg-tree-leaf" style={{animationDelay:`${Math.min(index * .04, 2)}s`}} role="button" tabIndex={0} aria-label={`Leaf: ${code.name}`} aria-pressed={selected === code.id} onClick={() => setSelected(code.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(code.id); } }}>
          <title>{code.name}{code.definition ? ` — ${code.definition}` : ''}</title>
          <path d={`M${x-54} ${y}Q${x-18} ${y-40} ${x+54} ${y}Q${x+12} ${y+38} ${x-54} ${y}Z`} fill={code.color || '#61a56b'} stroke={selected === code.id ? '#f4cb60' : '#426345'} strokeWidth={selected === code.id ? 4 : 1.5}/>
          <path d={`M${x-46} ${y}H${x+42}`} stroke="#ffffff" opacity=".3"/>
          <rect x={x-46} y={y-9} width="92" height="18" rx="8" fill="#163321" opacity=".88"/>
          <text x={x} y={y+4} textAnchor="middle" fontSize="11" fill="#fff8e9">{Array.from(code.name).slice(0,16).join('')}{Array.from(code.name).length > 16 ? '…' : ''}</text>
        </g>)}
        <ellipse cx="510" cy={height-72} rx="405" ry="22" fill="#78a35d" opacity=".25"/>
        {!leaves.length && <text x="500" y="150" textAnchor="middle" fill="#426345">Your first code will become the first leaf.</text>}
      </svg>
        <div className="egg-tree-friends">
          {(['owl','jiji','mushroom','totoro'] as CritterKind[]).map(kind => <button key={kind} className={`egg-friend egg-friend-${kind}`} aria-label={`${kind}: ${critterLines[kind]}`} onClick={() => setSaying(kind)}><Critter kind={kind}/></button>)}
        </div>
      </div>
      <p className="egg-tree-saying" role="status">{critterLines[saying]}</p>
      <footer>{current ? <><strong>{current.name}</strong><p>{current.definition || current.summary || 'This leaf is still finding its meaning.'}</p></> : <p>Choose a leaf to read its code. Even a small idea can branch out.</p>}</footer>
    </section>
  </div>;
}

export function CaptureBall({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone); doneRef.current = onDone;
  useEffect(() => { const timer = setTimeout(() => doneRef.current(), 3000); return () => clearTimeout(timer); }, []);
  return <div className="egg-capture" aria-label="A Poké Ball releases the eQc logo" role="status"><div className="egg-pokeball"><span/></div><div className="egg-logo-burst"><img src="./eqc-logo.png" alt="eQc emerges"/><p>A wild idea appeared!</p></div></div>;
}

export function PikachuCourier({ origin, onDone }: { origin: { x: number; y: number }; onDone: () => void }) {
  const doneRef = useRef(onDone); doneRef.current = onDone;
  useEffect(() => { const timer = setTimeout(() => doneRef.current(), 4000); return () => clearTimeout(timer); }, []);
  const left = Math.min(Math.max(0,origin.x),window.innerWidth-135);
  return <div className="egg-mail-layer"><div className="egg-courier" style={{left,top:Math.min(Math.max(0,origin.y-76),window.innerHeight-120),'--egg-mail-distance':`${window.innerWidth-left}px`} as React.CSSProperties} role="status" aria-label="Pikachu carries a letter to your mail app">
    <PikachuArtwork/>
  </div></div>;
}

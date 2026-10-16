import {standardMapColors,themeMapColors} from '../lib/mapPalettes';
import React,{useEffect,useState} from 'react';

export function normalizeMapColor(value:string):string|null {
  const raw=value.trim().replace(/^#/,'');
  if(/^[\da-f]{6}$/i.test(raw))return '#'+raw.toLowerCase();
  if(/^[\da-f]{3}$/i.test(raw))return '#'+Array.from(raw).map(c=>c+c).join('').toLowerCase();
  return null;
}
function hueColor(h:number,s=.66,l=.52):string {
  const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
  const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return '#'+rgb.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
}
export default function MapColorPicker({label,value,onChange}:{label:string;value:string;onChange:(color:string)=>void}){
  const [recent,setRecent]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('eqc-map-recent-colours')||'[]').filter((c:unknown)=>typeof c==='string'&&normalizeMapColor(c)).slice(0,10);}catch{return [];}});
  const color=normalizeMapColor(value)||'#334155';
  const [hex,setHex]=useState(color),[palette,setPalette]=useState<string[]>([]),[error,setError]=useState(false);
  useEffect(()=>{setHex(color);setError(false);},[color]);
  const apply=(color:string)=>{setHex(color);setError(false);onChange(color);setRecent(previous=>{const next=[color,...previous.filter(c=>c!==color)].slice(0,10);try{localStorage.setItem('eqc-map-recent-colours',JSON.stringify(next));}catch{}return next;});};
  const submit=()=>{const normalized=normalizeMapColor(hex);if(normalized)apply(normalized);else setError(true);};
  return <div className="map-color-control"><input aria-label={label} title={label} type="color" value={color} onChange={e=>apply(e.target.value)}/><details className="map-color-details"><summary title="Hex colour and palette" aria-label={label+' hex and palette'}>#</summary><div className="map-color-popover"><input aria-label={label+' hex'} title="Hex colour" maxLength={7} value={hex} onChange={e=>{setHex(e.target.value);setError(false);}} onBlur={submit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submit();}}}/><button type="button" title="Generate coordinated palette" aria-label={label+' generate palette'} onClick={()=>{const hue=Math.floor(Math.random()*360);setPalette([hueColor(hue),hueColor((hue+30)%360),hueColor((hue+180)%360),hueColor((hue+210)%360),hueColor(hue,.45,.86),hueColor(hue,.6,.27)]);}}>🎨</button>{error&&<small role="alert">Use #RGB or #RRGGBB.</small>}{[['Theme colours',themeMapColors],['Standard colours',standardMapColors],['Recent colours',recent]].map(([title,swatches])=><section className="map-swatch-section" key={String(title)}><small>{title as string}</small><div className="map-word-swatches">{(swatches as string[]).map((c,i)=><button key={c+i} type="button" aria-label={label+' use '+c} title={c} style={{backgroundColor:c}} onClick={()=>apply(c)}/>)}</div></section>)}{palette.length>0&&<div className="map-color-swatches">{palette.map(color=><button key={color} type="button" aria-label={label+' use '+color} title={color} style={{backgroundColor:color}} onClick={()=>apply(color)}/>)}</div>}</div></details></div>;
}

import React, { useEffect, useRef, useState } from 'react';
import animation from '../assets/zoro.gif';
import still from '../assets/zoro-still.png';
import GifArtwork from './GifArtwork';

// Image preloading works with packaged file:// assets as well as the dev server.
const preload = new Image(); preload.src=animation;
let playback=0;
export default function ZoroSlash({ name, kind, onDone }: { name: string; kind: 'file' | 'code' | 'project'; onDone: () => void }) {
  const loadedRef=useRef(false);
  const doneRef=useRef(onDone); doneRef.current=onDone;
  const [src,setSrc]=useState<string | null>(null), [ready,setReady]=useState(false);
  useEffect(() => {
    setSrc(`${animation}?play=${++playback}`);
    const fallback=setTimeout(()=>{ if (!loadedRef.current) setSrc(still); },2000);
    return()=>clearTimeout(fallback);
  },[]);
  useEffect(()=>{if(!ready)return;const timer=setTimeout(()=>doneRef.current(),1500);return()=>clearTimeout(timer);},[ready]);
  return <div className="zoro-layer" role="status" aria-label={`Zoro slices the deleted ${kind}: ${name}`}><div className={`zoro-stage ${ready ? 'zoro-ready' : ''}`}>
    <div className="zoro-target"><div className="zoro-target-half zoro-target-top"><small>{kind}</small><strong>{name}</strong></div><div className="zoro-target-half zoro-target-bottom" aria-hidden="true"><small>{kind}</small><strong>{name}</strong></div></div>
    {src && <GifArtwork src={src} still={still} className="zoro-art" onLoad={()=>{loadedRef.current=true;setReady(true);}} onError={()=>{setSrc(still);setReady(true);}}/>}
    <svg className="zoro-slash" viewBox="0 0 460 240" aria-hidden="true"><path d="M139 169Q253 44 425 64" fill="none" stroke="#b8f0b8" strokeWidth="11"/><path d="M139 169Q253 44 425 64" fill="none" stroke="#fffef0" strokeWidth="4"/></svg>
  </div></div>;
}

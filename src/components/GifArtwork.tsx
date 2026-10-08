import React from 'react';

// A first-frame fallback keeps animated GIFs still when reduced motion is preferred.
export default function GifArtwork({ src, still, className, onLoad, onError }: { src: string; still: string; className: string; onLoad?: () => void; onError?: () => void }) {
  return <picture><source media="(prefers-reduced-motion: reduce)" srcSet={still}/><img className={className} src={src} alt="" aria-hidden="true" draggable={false} onLoad={onLoad} onError={onError}/></picture>;
}

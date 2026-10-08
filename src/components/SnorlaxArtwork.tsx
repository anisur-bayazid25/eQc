import React from 'react';
import GifArtwork from './GifArtwork';
import animation from '../assets/snorlax.gif';
import still from '../assets/snorlax-still.png';

export default function SnorlaxArtwork() {
  return <GifArtwork src={animation} still={still} className="snorlax-art"/>;
}

import React from 'react';
import GifArtwork from './GifArtwork';
import animation from '../assets/zoro.gif';
import still from '../assets/zoro-still.png';

export default function ZoroArtwork() {
  return <GifArtwork src={animation} still={still} className="zoro-art"/>;
}

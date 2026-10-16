import React from 'react';
import {photoGeometry,PhotoCrop} from '../lib/profilePhoto';
export default function ProfilePhoto({src,crop,alt=''}:{src:string;crop?:PhotoCrop;alt?:string}){
 if(!crop)return <img src={src} alt={alt}/>;
 const g=photoGeometry(crop);
 return <span className="profile-photo-frame"><img src={src} alt={alt} draggable={false} style={{position:'absolute',maxWidth:'none',width:g.width*100+'%',height:g.height*100+'%',left:g.left*100+'%',top:g.top*100+'%',objectFit:'fill'}}/></span>;
}

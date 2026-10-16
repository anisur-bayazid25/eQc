import type {Code,MapAnnotation,MapDesign,MapEdgeStyle} from '../domain';

export interface MapPalette {id:string;name:string;note:string;colors:string[];scale:string;ramp?:string[];}
// Scientific samples: Matplotlib _cm_listed.py; qualitative colours: ColorBrewer and Tableau.
export const mapPalettes:MapPalette[]=[
{"id": "viridis", "name": "Viridis", "note": "Scientific sequential ramp \u00b7 colour-vision-aware", "colors": ["#440154", "#46327e", "#365c8d", "#277f8e", "#1fa187", "#4ac16d", "#a0da39", "#fde725"], "scale": "#fde725", "ramp": ["#440154", "#46327e", "#365c8d", "#277f8e", "#1fa187", "#4ac16d", "#a0da39", "#fde725"]},{"id": "magma", "name": "Magma", "note": "Scientific sequential ramp", "colors": ["#000004", "#221150", "#5f187f", "#982d80", "#d3436e", "#f8765c", "#febb81", "#fcfdbf"], "scale": "#fcfdbf", "ramp": ["#000004", "#221150", "#5f187f", "#982d80", "#d3436e", "#f8765c", "#febb81", "#fcfdbf"]},{"id": "plasma", "name": "Plasma", "note": "Scientific sequential ramp", "colors": ["#0d0887", "#5302a3", "#8b0aa5", "#b83289", "#db5c68", "#f48849", "#febd2a", "#f0f921"], "scale": "#f0f921", "ramp": ["#0d0887", "#5302a3", "#8b0aa5", "#b83289", "#db5c68", "#f48849", "#febd2a", "#f0f921"]},{"id": "inferno", "name": "Inferno", "note": "Scientific sequential ramp", "colors": ["#000004", "#280b53", "#65156e", "#9f2a63", "#d44842", "#f57d15", "#fac228", "#fcffa4"], "scale": "#fcffa4", "ramp": ["#000004", "#280b53", "#65156e", "#9f2a63", "#d44842", "#f57d15", "#fac228", "#fcffa4"]},{"id": "cividis", "name": "Cividis", "note": "Scientific sequential ramp \u00b7 colour-vision-aware", "colors": ["#00224e", "#213b6e", "#4c556c", "#6c6e72", "#8e8978", "#b1a570", "#d9c55c", "#fee838"], "scale": "#fee838", "ramp": ["#00224e", "#213b6e", "#4c556c", "#6c6e72", "#8e8978", "#b1a570", "#d9c55c", "#fee838"]},{"id": "set2", "name": "ColorBrewer Set2", "note": "Soft categorical colours", "colors": ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"], "scale": "#386d52"},{"id": "tableau", "name": "Tableau 10", "note": "Distinct categorical colours", "colors": ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ab"], "scale": "#365f7a"},
 {id:'coastal',name:'Muted coast',note:'Soft blues, teal and sand',colors:['#537c91','#6b9692','#9c9275','#8e7d99','#b18179','#788d69','#697eaa','#af9565'],scale:'#365f7a'},
 {id:'sage',name:'Sage garden',note:'Calm botanical colours',colors:['#62856c','#87976b','#a69271','#688f95','#8d8197','#b18b82','#7b8297','#a49c7c'],scale:'#386d52'},
 {id:'clay',name:'Earth & clay',note:'Warm muted natural tones',colors:['#ac7360','#a88c60','#7d9279','#708b99','#9e7b87','#8e846b','#7f849e','#af947f'],scale:'#884d39'},
 {id:'dusk',name:'Lavender dusk',note:'Soft violet, blue and rose',colors:['#86719e','#6e89a6','#a78095','#76988f','#ac9473','#757f9b','#a57e70','#8e997c'],scale:'#695080'},
 {id:'spectrum',name:'Soft spectrum',note:'Colourful, gently muted categories',colors:['#587fba','#bf8066','#73996c','#a17eb0','#c1a358','#5c9c9c','#b77991','#7c8caa'],scale:'#426c9e'},
 {id:'accessible',name:'Colour-blind friendly',note:'Okabe–Ito colours; keep labels visible',colors:['#0072b2','#e69f00','#009e73','#cc79a7','#56b4e9','#d55e00','#f0e442','#333333'],scale:'#0072b2'},
 {id:'blue-orange',name:'Blue & amber',note:'Avoids red–green pairs; use labels for close shades',colors:['#476f95','#bd8245','#7193b2','#d3a36d','#375572','#98622f','#a1b8ca','#e0c5a3'],scale:'#375572'},
 {id:'grayscale',name:'Black & white',note:'Grayscale for print; retain labels and line styles',colors:['#272727','#777777','#b5b5b5','#4c4c4c','#969696','#d0d0d0','#626262','#e3e3e3'],scale:'#202020'},
 {id:'mono-blue',name:'Monochrome slate',note:'One blue hue, varied lightness',colors:['#365b78','#52738d','#7190a6','#95acbd','#bacbd6','#44677f','#809caf','#a6bccb'],scale:'#284f6c'},
 {id:'mono-teal',name:'Monochrome teal',note:'One teal hue, varied lightness',colors:['#346d6a','#528681','#719e99','#94b7b1','#bcd2ce','#427975','#82aaa4','#a5c3be'],scale:'#255c59'},
];
export function mixColor(a:string,b:string,t:number):string {return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');}
export function paletteShade(palette:MapPalette,value:number):string {const ramp=palette.ramp;if(!ramp?.length)return mixColor('#f5f7f9',palette.scale,value);const position=Math.max(0,Math.min(1,value))*(ramp.length-1),i=Math.min(ramp.length-2,Math.floor(position));return mixColor(ramp[i],ramp[i+1],position-i);}
export function readableInk(fill:string):string {
 const rgb=[1,3,5].map(i=>parseInt(fill.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),l=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 return (l+.05)/.05>=1.05/(l+.05)?'#000000':'#ffffff';
}
export interface PaletteCanvas {codes:Code[];mapAnnotations?:MapAnnotation[];mapEdgeStyles?:MapEdgeStyle[];mapDesign?:MapDesign;}
// Retain original group keys, so switching through grayscale does not merge categories.
export function reversedPalette(palette:MapPalette,invert=false):MapPalette {return invert?{...palette,colors:[...palette.colors].reverse(),ramp:[...(palette.ramp||['#f5f7f9',palette.scale])].reverse()}:palette;}
export function recolorMap<T extends PaletteCanvas>(canvas:T,palette:MapPalette,invert=false):T {
 palette=reversedPalette(palette,invert);
 const groups=new Map<string,number>();const color=(key:string)=>{if(!groups.has(key))groups.set(key,groups.size);return palette.colors[groups.get(key)!%palette.colors.length];};
 const codes=canvas.codes.map(c=>{const a=c.mapAppearance,key=a?.paletteKey||a?.stroke||c.color,stroke=color(key);return {...c,mapAppearance:{width:180,height:80,fontSize:16,...a,paletteKey:key,fill:mixColor('#ffffff',stroke,.2),stroke,textColor:'#17212b'}};});
 const heat=canvas.mapDesign?.family==='heat-map',cells=(canvas.mapAnnotations||[]).filter(a=>a.kind==='rect'&&a.fill&&/^\d+(\.\d+)?$/.test(a.text||'')),max=Math.max(1,...cells.map(a=>Number(a.text)));
 const mapAnnotations=canvas.mapAnnotations?.map(a=>{
  if(heat&&cells.includes(a)){const fill=paletteShade(palette,Number(a.text)/max);return {...a,fill,color:'#ffffff',textColor:readableInk(fill)};}
  if(a.imageData)return a;
  if(a.kind==='text'){const ink=canvas.mapDesign?.family==='word-cloud'&&a.id.startsWith('suggested:cloud:word:')?color(a.paletteKey||a.color):'#17212b';return {...a,paletteKey:a.paletteKey||a.color,color:ink,textColor:ink};}
  const key=a.paletteKey||(a.fill&&a.fill!=='none'?a.fill:a.color),stroke=color(key),fill=a.fill&&a.fill!=='none'?(canvas.mapDesign?.family==='histomap'||a.fillOpacity!==undefined&&a.fillOpacity<1?stroke:mixColor('#ffffff',stroke,.2)):a.fill;
  return {...a,paletteKey:key,color:a.flow?'none':stroke,fill,gradientTo:a.gradientTo?color(a.gradientKey||a.gradientTo):undefined,gradientKey:a.gradientKey||a.gradientTo,textColor:a.labelInside?readableInk(fill&&fill!=='none'?fill:'#ffffff'):'#17212b'};
 });
 const mapEdgeStyles=canvas.mapEdgeStyles?.map(e=>({...e,paletteKey:e.paletteKey||e.color||e.kind,color:color(e.paletteKey||e.color||e.kind),labelColor:'#17212b'}));
 return {...canvas,codes,mapAnnotations,mapEdgeStyles,mapDesign:{...(canvas.mapDesign||{mode:'manual',width:1600,height:1000,maxLinks:0,rootIds:[]}),paletteId:palette.id,paletteInverted:invert}};
}

export const standardMapColors=['#000000','#ffffff','#c00000','#ff0000','#ffc000','#ffff00','#92d050','#00b050','#00b0f0','#0070c0','#002060','#7030a0'];
export const themeMapColors=['#334155','#64748b','#426c9e','#5c9c9c','#73996c','#c1a358','#bf8066','#b77991','#86719e','#8e846b'].flatMap(c=>[mixColor('#ffffff',c,.16),mixColor('#ffffff',c,.36),mixColor('#ffffff',c,.65),c,mixColor(c,'#000000',.22),mixColor(c,'#000000',.45)]);

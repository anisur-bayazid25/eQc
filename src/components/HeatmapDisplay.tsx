import React,{useState} from 'react';
import {buildHeatmap,retainHeatmapEdits} from '../lib/heatmap';
import {recolorMap} from '../lib/mapPalettes';
import type {MapPalette} from '../lib/mapPalettes';
import type {MapAnnotation} from '../domain';
import type {MapSuggestion} from '../lib/mapSuggestions';
import type {VisualizationData,VisualizationOptions} from '../lib/visualizations';

export default function HeatmapDisplay({data,options,palette,inverted,annotations,onApply}:{data:VisualizationData;options:Record<string,unknown>;palette?:MapPalette;inverted?:boolean;annotations:MapAnnotation[];onApply:(s:MapSuggestion)=>void}){
 const [error,setError]=useState('');const o=options as unknown as VisualizationOptions;
 const apply=(patch:Partial<VisualizationOptions>)=>{try{
  const colour=(s:MapSuggestion)=>{if(!palette)return s;const p=recolorMap({codes:[],mapAnnotations:s.annotations,mapDesign:s.design},palette,inverted);return {...s,annotations:p.mapAnnotations!,design:p.mapDesign!};};
  onApply(retainHeatmapEdits(colour(buildHeatmap(data,{...o,...patch})),colour(buildHeatmap(data,o)),annotations));setError('');
 }catch(e){setError(e instanceof Error?e.message:String(e));}};
 return <section className="matrix-display" aria-label="Heat map display"><strong>Heat map display</strong><label><input type="checkbox" checked={!!o.heatHideZeroRows} onChange={e=>apply({heatHideZeroRows:e.target.checked})}/>Hide all-zero rows</label><label><input type="checkbox" checked={!!o.heatHideZeroColumns} onChange={e=>apply({heatHideZeroColumns:e.target.checked})}/>Hide all-zero columns</label><label><input type="checkbox" checked={!!o.heatTranspose} onChange={e=>apply({heatTranspose:e.target.checked})}/>Swap rows and columns</label><small>Updates immediately. Hides only entire empty rows or columns; zero cells within remaining data stay visible. Source coding is unchanged.</small>{error&&<p role="alert">{error}</p>}</section>;
}

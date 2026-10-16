import React,{useEffect,useRef,useState} from 'react';
import type {VisualizationData,VisualizationOptions} from '../lib/visualizations';
import type {MapSuggestion} from '../lib/mapSuggestions';
import type {MapPalette} from '../lib/mapPalettes';
import type {MapAnnotation} from '../domain';

export default function CloudStopWords({value,onChange,options,data,palette,inverted,annotations,description,onApply}:{value:string;onChange:(value:string)=>void;options?:Record<string,unknown>;data:VisualizationData;palette?:MapPalette;inverted?:boolean;annotations:MapAnnotation[];description?:string;onApply:(s:MapSuggestion)=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),alive=useRef(true);
 const latest=useRef({options,annotations,data,palette,inverted,value});latest.current={options,annotations,data,palette,inverted,value};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const apply=async()=>{setBusy(true);setMessage('Placing words…');try{
  const {prepareWordCloud,buildWordCloud,preserveCloudDecorations,captureCloudWordStyles,preserveCloudWordAppearance}=await import('../lib/wordCloud');
  const previous=options as unknown as VisualizationOptions;const ready=await prepareWordCloud(data,captureCloudWordStyles({...previous,wordStops:value},annotations));
  if(!alive.current)return;
  const unchanged=()=>{const current=latest.current;return current.options===options&&current.annotations===annotations&&current.palette===palette&&current.inverted===inverted&&current.data.docs===data.docs&&current.data.codes===data.codes&&current.data.codedSegments===data.codedSegments;};if(!unchanged()){setMessage('The canvas changed while placing words. Apply Changes again to use your latest edits.');return;}
  let suggestion=buildWordCloud(data,ready);
  if(palette){const {recolorMap}=await import('../lib/mapPalettes');const colored=recolorMap({codes:[],mapAnnotations:suggestion.annotations,mapDesign:suggestion.design},palette,inverted);suggestion.annotations=colored.mapAnnotations!;suggestion.design=colored.mapDesign!;}
  if(alive.current&&!unchanged()){setMessage('The canvas changed while placing words. Apply Changes again to use your latest edits.');return;}
  if(alive.current){onApply(preserveCloudDecorations(preserveCloudWordAppearance(suggestion,previous,annotations),annotations,description,previous.cloudWords));setMessage('Exclusions applied.');}
 }catch(error){if(alive.current)setMessage(error instanceof Error?error.message:String(error));}finally{if(alive.current)setBusy(false);}};
 return <section className="cloud-stop-words" aria-label="Word cloud exclusions"><strong>Word exclusions</strong><label>Exclude words (comma or newline separated)<textarea aria-label="Word cloud stop words" rows={4} style={{width:'100%',boxSizing:'border-box',resize:'vertical'}} value={value} disabled={busy} onChange={e=>onChange(e.target.value)}/></label><button disabled={busy} onClick={()=>onChange(value+',interviewer,interviewee,respondent,participant,interview')}>Exclude interview role words</button><details className="inspector-advanced"><summary>Import a stop-word list</summary><label>Text or CSV file<input aria-label="Import cloud stop words" type="file" accept=".txt,.csv" disabled={busy} onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(f.size>100000){setMessage('Use a stop-word file under 100 KB.');return;}const text=await f.text();if(alive.current)onChange(latest.current.value+','+text);}}/></label></details><button className="primary-btn" disabled={busy} onClick={apply}>{busy?'Placing words…':'Apply Changes'}</button><small>Repositions words. Headings, deleted headings, added objects, colours and cloud settings are kept.</small>{message&&<p role="status">{message}</p>}</section>;
}

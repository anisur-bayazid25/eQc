import React,{useId} from 'react';

export default function VisualizationLimit({label,ariaLabel,value,min=1,max,suggestions,onChange}:{label:string;ariaLabel:string;value:number;min?:number;max:number;suggestions:number[];onChange:(value:number)=>void}){
 const id=useId();
 return <div className="visualization-limit"><label htmlFor={id}>{label}</label><input id={id} aria-label={ariaLabel} type="number" min={min} max={max} value={value} onChange={e=>onChange(Math.max(min,Math.min(max,Number(e.target.value)||min)))}/><div className="visualization-limit-presets" role="group" aria-label={label+' suggestions'}>{suggestions.filter(n=>n>=min&&n<=max).map(n=><button key={n} type="button" aria-label={'Set '+label.toLowerCase()+' to '+n} aria-pressed={value===n} onClick={()=>onChange(n)}>{n}</button>)}</div><small>Choose a preset or enter {min}–{max}.</small></div>;
}

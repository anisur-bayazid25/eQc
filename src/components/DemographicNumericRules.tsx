import React,{useState} from 'react';
import {DemographicField,DemographicOperator,demographicNumber,makeDemographicBands,makeDemographicRule} from '../lib/demographicTable';
import IconButton from './IconButton';

export default function DemographicNumericRules({field,values,onChange}:{field:DemographicField;values:string[];onChange:(bands:DemographicField['bands'])=>void}) {
  const [operator,setOperator]=useState<DemographicOperator>('between'),[x,setX]=useState(''),[y,setY]=useState(''),[includeMin,setIncludeMin]=useState(true),[includeMax,setIncludeMax]=useState(true),[width,setWidth]=useState(10),[error,setError]=useState('');
  const numeric=values.flatMap(v=>{const n=demographicNumber(v);return n===undefined?[]:[n];});
  const update=(id:string,patch:Partial<DemographicField['bands'][number]>)=>onChange(field.bands.map(b=>b.id===id?{...b,...patch}:b));
  function add(split=false){try{
    if(!x.trim()||operator==='between'&&!split&&!y.trim())throw Error('Enter the comparison value'+(operator==='between'&&!split?' and range end.':'.'));
    const n=Number(x);
    onChange([...field.bands,...(split?[makeDemographicRule('lt',n),makeDemographicRule('gte',n)]:[makeDemographicRule(operator,n,Number(y),includeMin,includeMax)])]);setError('');
  }catch(e){setError(e instanceof Error?e.message:String(e));}}
  return <div className="demographic-numeric-rules">
    <div className="demographic-rule-composer">
      <strong>Create a numeric category</strong>
      <label>Comparison<select aria-label="Numeric comparison" value={operator} onChange={e=>setOperator(e.target.value as DemographicOperator)}><option value="gt">Greater than (&gt;)</option><option value="gte">At least (≥)</option><option value="lt">Less than (&lt;)</option><option value="lte">At most (≤)</option><option value="eq">Equal to (=)</option><option value="between">Between</option></select></label>
      <div className="demographic-rule-inputs"><label>{operator==='between'?'From':'Value'}<input aria-label="Numeric rule value" type="number" step="any" value={x} onChange={e=>setX(e.target.value)}/></label>{operator==='between'&&<label>To<input aria-label="Numeric rule end" type="number" step="any" value={y} onChange={e=>setY(e.target.value)}/></label>}</div>
      {operator==='between'&&<div className="demographic-rule-inputs"><label className="demographic-check"><input type="checkbox" checked={includeMin} onChange={e=>setIncludeMin(e.target.checked)}/>Include start</label><label className="demographic-check"><input type="checkbox" checked={includeMax} onChange={e=>setIncludeMax(e.target.checked)}/>Include end</label></div>}
      <div className="demographic-variable-order"><button onClick={()=>add()}>Add rule</button><button title="Create two categories: below the value, and at least the value" onClick={()=>add(true)}>Split at value</button></div>
    </div>
    <details className="demographic-rule-generator"><summary>Equal-width groups</summary><label>Band width<input aria-label="Numeric band width" type="number" step="any" min={.000001} value={width} onChange={e=>setWidth(Number(e.target.value))}/></label><button onClick={()=>{try{onChange(makeDemographicBands(numeric,width));setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}}}>Generate bands</button><small>Replaces the current numeric groups.</small></details>
    {error&&<p role="alert">{error}</p>}
    <div className="section-hint">{numeric.length} distinct numeric values available. Unmatched numbers appear in Other values. Non-numeric values are treated as missing.</div>
    {field.bands.map(b=><div className="demographic-band-editor" key={b.id}>
      <label>Category label<input aria-label={'Band label '+b.id} value={b.label} onChange={e=>update(b.id,{label:e.target.value})}/></label>
      <label>Lower bound<input aria-label={'Band minimum '+b.id} type="number" step="any" value={b.min??''} onChange={e=>update(b.id,{min:e.target.value===''?undefined:Number(e.target.value)})}/></label>
      <label>Upper bound<input aria-label={'Band maximum '+b.id} type="number" step="any" value={b.max??''} onChange={e=>update(b.id,{max:e.target.value===''?undefined:Number(e.target.value)})}/></label>
      <label className="demographic-check"><input aria-label={'Include lower bound '+b.id} type="checkbox" checked={b.includeMin!==false} onChange={e=>update(b.id,{includeMin:e.target.checked})}/>Include lower</label>
      <label className="demographic-check"><input aria-label={'Include upper bound '+b.id} type="checkbox" checked={b.includeMax===true} onChange={e=>update(b.id,{includeMax:e.target.checked})}/>Include upper</label>
      <IconButton icon="close" label={'Remove band '+b.label} onClick={()=>onChange(field.bands.filter(x=>x.id!==b.id))}/>
    </div>)}
  </div>;
}

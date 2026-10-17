import React, {useState} from 'react';
import {attributeKey,caseAttributeFields} from '../lib/caseAttributes';

export default function CaseAttributesEditor({value,onChange}:{value:Record<string,string>;onChange:(value:Record<string,string>)=>void}) {
  const [newName,setNewName]=useState(''),[error,setError]=useState('');
  const standardKeys=caseAttributeFields.map(field=>attributeKey(value,field.aliases));
  function change(key:string,text:string){onChange({...value,[key]:text});}
  return <fieldset className="case-attribute-fields"><legend>Case attributes</legend>
    {caseAttributeFields.map(field=>{const key=attributeKey(value,field.aliases)||field.key;return <label key={field.key}>{field.label}<input aria-label={'Case '+field.label} value={value[key]||''} onChange={event=>change(key,event.target.value)}/></label>;})}
    <small>Quote attribution uses only name, age, gender, occupation and area/country when available. Leave the quote name empty to use the case name.</small>
    <strong>Other attributes</strong>
    {Object.entries(value).filter(([key])=>!standardKeys.includes(key)).map(([key,text])=><div className="research-actions" key={key}><label>{key}<input aria-label={'Case attribute '+key} value={text} onChange={event=>change(key,event.target.value)}/></label><button type="button" aria-label={'Remove attribute '+key} onClick={()=>{const next={...value};delete next[key];onChange(next);}}>Remove</button></div>)}
    <div className="research-actions"><label>Attribute name<input aria-label="New case attribute name" value={newName} onChange={event=>setNewName(event.target.value)}/></label><button type="button" onClick={()=>{const key=newName.trim();if(!key)return;if(attributeKey(value,[key])||caseAttributeFields.some(field=>field.aliases.some(alias=>alias.toLowerCase()===key.toLowerCase()))){setError('This attribute already has a field above.');return;}change(key,'');setNewName('');setError('');}}>Add attribute</button></div>
    {error&&<p role="status">{error}</p>}
  </fieldset>;
}

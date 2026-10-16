let context:CanvasRenderingContext2D|null|undefined;
export function fitMapText(text:string,width:number,height:number,size:number,fontFamily='Segoe UI, Arial, sans-serif',bold=true,italic=false):{fontSize:number;lines:string[]} {
  if(context===undefined&&typeof document!=='undefined')context=document.createElement('canvas').getContext('2d');
  const wrap=(fontSize:number)=>{
    if(context)context.font=`${italic?'italic ':''}${bold?'600 ':''}${fontSize}px ${fontFamily}`;
    const measure=(text:string)=>context?context.measureText(text).width:Array.from(text).length*fontSize*.56;
    const lines:string[]=[];
    for(const paragraph of text.split(/\r?\n/)){
      let line='';
      for(const word of paragraph.split(/\s+/).filter(Boolean)){
        if(line&&measure(line+' '+word)>width){lines.push(line);line='';}
        if(measure(word)<=width){line+=(line?' ':'')+word;continue;}
        for(const char of Array.from(word)){if(line&&measure(line+char)>width){lines.push(line);line='';}line+=char;}
      }
      lines.push(line);
    }
    return lines;
  };
  let fontSize=Math.max(4,size);
  const words=text.split(/\s+/).filter(w=>/^[A-Za-z-]{1,24}$/.test(w));
  while(fontSize>4){if(context)context.font=`${italic?'italic ':''}${bold?'600 ':''}${fontSize}px ${fontFamily}`;if(!words.some(w=>(context?context.measureText(w).width:w.length*fontSize*.56)>width))break;fontSize--;}
  let lines=wrap(fontSize);
  while(fontSize>4&&lines.length*fontSize*1.16>height){fontSize=Math.max(4,fontSize-1);lines=wrap(fontSize);}
  return {fontSize,lines};
}

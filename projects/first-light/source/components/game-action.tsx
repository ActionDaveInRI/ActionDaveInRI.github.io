// @ts-nocheck
'use client';
import {useEffect,useState,useId} from 'react';
import {Button} from '@/components/ui/button';
import {ChevronRight} from 'lucide-react';

export function ModelPortrait({asset='habitat',config={},className=''}){
 const [src,setSrc]=useState(''),key=JSON.stringify(config);
 useEffect(()=>{let active=true;import('@/lib/portraits.js').then(({modelPortrait})=>{if(active)setSrc(modelPortrait(asset,JSON.parse(key)));});return()=>{active=false;};},[asset,key]);
 return <span className={'model-portrait '+className} aria-hidden="true">{src&&<img src={src} alt="" width="240" height="200" draggable="false"/>}</span>;
}
export function ActionCard({asset,config,title,description,meta,blocked,onClick,selected=false,compact=false}){
 const id=useId();
 return <div className={'action-option '+(compact?'compact ':'')+(selected?'selected':'')}>
  <Button variant="outline" className="illustrated-action" disabled={!!blocked} onClick={onClick} aria-describedby={blocked?id:undefined} aria-pressed={selected||undefined}>
   <ModelPortrait asset={asset} config={config}/><span className="action-copy"><b>{title}</b>{description&&<span>{description}</span>}{meta&&<small>{meta}</small>}</span><ChevronRight className="action-chevron" size={16}/>
  </Button>{blocked&&<p className="action-blocker" id={id}>{blocked}</p>}
 </div>;
}

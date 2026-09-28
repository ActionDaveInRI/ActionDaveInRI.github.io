// @ts-nocheck
'use client';
import {Leaf,Users,Package,Pause,TrendingUp,ArrowUpRight,Check,Pickaxe,Radio,Boxes} from 'lucide-react';
import {ModelPortrait} from './game-action';
import {GROWTH_POLICIES,NEIGHBORHOODS,cityStage} from '@/lib/city.js';
import {colonyForecast,setGrowthPolicy,WORLDS} from '@/lib/game.js';

export function CityPanel({state,world,apply,onVisit}){
 const c=state.colonies[world],f=colonyForecast(state,state.turn+1,world),u=f.city,city=c.city;
 const Icons={agriculture:Leaf,industry:Pickaxe,trade:Boxes,research:Radio};
 const label={hold:'Population held',support:'Supplies needed',economy:'More work needed',food:'Food reserve low',materials:'Materials needed',building:u.pending?.kind==='market'?'Shops underway':'Homes underway',land:'Expansion constrained',residents:'Crewed expansion needed'}[u.blocker]||(u.start?'New homes next season':u.arrivals?`+${u.arrivals} residents next season`:'Households interested');
 return <section className="city-panel" data-section="city">
  <div className="city-heading"><ModelPortrait asset="neighborhood" config={{kind:city.civic?'commons':u.dominant,environment:WORLDS[world].environment,building:!!u.pending}}/><div><small>YOUR GROWING SETTLEMENT</small><h3>{cityStage(c)}</h3><span>{c.population} residents <span className="city-separator">/</span> {c.capacity} places</span></div></div>
  {c.kind==='settlement'&&<>
   <div className="city-goal"><span>{city.civic?<><Check size={14}/>Founders’ Commons · +1 work</>:<>First town <b>{Math.min(c.population,24)} / 24</b></>}</span><div className="bar"><span style={{width:Math.min(100,c.population/24*100)+'%'}}/></div></div>
   <div className="city-policy" role="group" aria-label="Growth policy">{[['steady',TrendingUp,'Steady'],['welcome',ArrowUpRight,'Welcome'],['hold',Pause,'Hold']].map(([id,Icon,name])=><button key={id} aria-pressed={city.policy===id} title={GROWTH_POLICIES[id].description} onClick={()=>apply(s=>setGrowthPolicy(s,id,world))}><Icon size={17}/>{name}</button>)}</div>
  </>}
  <div className={'city-status '+(u.progressing?'growing':'')}><strong>{label}</strong>{c.kind==='settlement'&&<span className="growth-dots" aria-label={`${city.momentum} of ${u.required} supported seasons`}>{Array.from({length:u.required},(_,i)=><i key={i} className={i<city.momentum?'filled':''}/>)}</span>}</div>
  <div className="city-vitals">
   {[[Leaf,'Food',`${f.reserve} / ${u.foodNeeded}`,Math.min(1,f.reserve/u.foodNeeded),u.blocker==='food'||u.blocker==='support'],[Users,'Livelihoods',`${c.population} / ${u.supported}`,Math.min(1,c.population/u.supported),u.blocker==='economy'],[Package,'New homes',`${u.cost} M`,Math.min(1,u.materialsAvailable/(u.cost+GROWTH_POLICIES[city.policy].materials)),u.blocker==='materials']].map(([Icon,title,value,fill,warn])=><div key={title} className={warn?'low':''}><Icon size={17}/><small>{title}</small><b>{value}</b><span className="vital-meter"><i style={{width:fill*100+'%'}}/></span></div>)}
  </div>
  <div className="city-economy" aria-label="Contributions to the supported population">{Object.entries(u.activity).map(([key,n])=>{const Icon=Icons[key];return <span key={key} className={n?'active':''} title={`${NEIGHBORHOODS[key].label}: supports ${n} residents`}><Icon size={15}/>{n}</span>;})}</div>
  {city.plots.length>0&&<div className="district-gallery">{city.plots.map((p,i)=><button key={p.id} title={`${p.name} · ${p.remaining?'Building · '+p.remaining+' seasons':p.kind==='commons'?'+1 construction work':NEIGHBORHOODS[p.kind].cause}`} onClick={()=>onVisit(p.id)}><ModelPortrait asset="neighborhood" config={{kind:p.kind,environment:WORLDS[world].environment,variation:i,building:p.remaining>0,dense:c.population>=40}}/><span>{p.name}</span>{p.remaining>0&&<small>{p.remaining} seasons</small>}</button>)}</div>}
  <details className="city-explanation"><summary>Why? <span>Growth &amp; recent changes</span></summary><p>{u.reason}</p><p>{GROWTH_POLICIES[city.policy].description} Homes add four places and take two supported seasons. New households use more food.</p><p>Founding services support 12 residents. Harvests, production, research and cargo handled in the last four seasons support more. {u.freight} cargo handled recently.</p>{city.lastEvent&&<p><b>Season {city.lastEvent.turn+1}</b> · {city.lastEvent.text}</p>}{city.plots.map(p=><p key={p.id}><b>{p.name}</b> · S{p.built+1} · {p.kind==='commons'?'Built by a community of 24.':`Grew from ${NEIGHBORHOODS[p.kind].cause}.`}</p>)}</details>
 </section>;
}

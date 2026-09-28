'use client';
import {useEffect,useRef,useState} from 'react';
import {Pause,Volume2,VolumeX,Anchor,ChevronRight,RotateCcw,Link2,Unlink,Gamepad2,Settings2} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Progress} from '@/components/ui/progress';
const initial={started:false,state:'playing',hull:100,salvage:100,value:12000,distance:503,attached:true,tension:0,boost:100,kills:0,blocked:0,dock:0,time:0,notice:'',ropeLength:23,controller:false,input:'keyboard'};
export default function Home(){
 const host=useRef<HTMLDivElement>(null),map=useRef<SVGSVGElement>(null),game=useRef<any>(null);
 const [status,setStatus]=useState<any>(initial),[ready,setReady]=useState(false),[error,setError]=useState(''),[paused,setPaused]=useState(false),[muted,setMuted]=useState(false),[effects,setEffects]=useState(true),[touch,setTouch]=useState(false);
 useEffect(()=>{let live=true;setTouch(matchMedia('(pointer:coarse)').matches);import('@/lib/game/engine').then(({Game})=>{if(!live)return;try{game.current=new Game(host.current,map.current,(s:any)=>{if(live)setStatus(s);},setPaused);setReady(true);}catch(e){console.error(e);setError('The 3D renderer could not start. Enable hardware acceleration or open this in another browser.');}});return()=>{live=false;game.current?.dispose();game.current=null;};},[]);
 const start=(practice=false)=>{setPaused(false);game.current?.start(practice);};
 const toggleMute=()=>{game.current?.mute(!muted);setMuted(!muted);};
 const toggleEffects=()=>{game.current?.setQuality(effects?'low':'high');setEffects(!effects);};
 const end=status.started&&status.state!=='playing';
 const format=(n:number)=>Math.round(n).toLocaleString('en-US');
 return <main className={`game-root ${touch?'touch-mode':''} ${status.started?'in-run':'at-menu'}`}>
   <div className="scene" ref={host} aria-label="3D salvage encounter"/>
   <div className="vignette"/>
   <header className="topbar">
    <div className="wordmark"><span className="brand-icon"><Anchor size={20}/></span><div>WRECK RUN<small>SALVAGE DIVISION <span>/</span> 07</small></div></div>
    <div className="sector">KESTREL DEBRIS FIELD<span>OUTER BELT · SECTOR 04</span></div>
    <nav className="system-buttons" aria-label="Game settings">
     <button className="icon-button" onClick={toggleMute} aria-label={muted?'Enable sound':'Mute sound'} title={muted?'Enable sound':'Mute sound'}>{muted?<VolumeX size={19}/>:<Volume2 size={19}/>}</button>
     {status.started&&<button className="icon-button" onClick={()=>game.current?.pause(true)} aria-label="Pause game" title="Pause · Esc"><Pause size={19}/></button>}
    </nav>
   </header>
   {status.started&&!end&&<>
    <div className="mission-strip"><span className="eyebrow">{status.dock>0?'RECOVERY IN PROGRESS':'ACTIVE CONTRACT'}</span><strong>{status.dock>0?'Hold inside the recovery ring':'Bring the Kestrel home'}</strong><span className="mission-distance">{status.dock>0?`${Math.round(status.dock/3*100)}% secured`:`${Math.round(status.distance)} m to recovery`}</span><div className="journey-track"><i style={{width:`${Math.max(0,Math.min(100,(1-status.distance/503)*100))}%`}}/></div></div>
    <aside className="ship-panel">
     <div className="stat-line"><span>TUG HULL</span><strong className={status.hull<30?'danger':''}>{Math.ceil(status.hull)}<small>%</small></strong></div><Progress className="hull-meter" value={status.hull} aria-label="Tug hull integrity"/>
     <div className="stat-line cargo-line"><span>SALVAGE VALUE</span><strong className="amber">{format(status.value)}<small> CR</small></strong></div><Progress className="cargo-meter" value={status.salvage} aria-label="Salvage integrity"/>
     <div className="tow-state"><span className={status.attached?'cyan':'danger'}>{status.attached?<Link2 size={14}/>:<Unlink size={14}/>} {status.attached?'TOW SECURED':'TOW RELEASED'}</span><span>{status.attached?`${Math.round(status.ropeLength)} m`:'E to attach'}</span></div>
     <div className="tension-track"><i style={{width:`${status.tension*100}%`,background:status.tension>.8?'#f5b365':'#83b3ba'}}/></div>
    </aside>
    
    <div className="engine-strip"><span>BOOST</span><Progress value={status.boost} className="boost-meter" aria-label="Boost reserve"/><small>{status.boost<15?'RECHARGING':`${Math.round(status.boost)}%`}</small></div>
    <div className="comms" role="status" aria-live="polite">{status.notice&&<><span>COMMS <i/></span><p>{status.notice}</p></>}</div>
    {!touch&&<footer className="controls"><span><kbd>W A S D</kbd> thrust</span><span><kbd>MOUSE</kbd> aim / fire</span><span><kbd>SHIFT</kbd> boost</span><span><kbd>SPACE</kbd> brake</span><span><kbd>E</kbd> tow</span><span><kbd>F</kbd> winch</span></footer>}
   </>}
   {!status.started&&<div className="intro-layout">
    <section className="intro-card">
     <div className="contract-kicker"><span/> SALVAGE CONTRACT 218</div>
     <h1>WRECK<br/><em>RUN.</em></h1>
     <p className="intro-lead">Your payday.<br/>Your cover.</p>
     <p className="brief">Tow a derelict freighter through raider territory. Keep its hull between you and incoming fire. Bring home what’s left.</p>
     <div className="contract-value"><span>MAXIMUM RECOVERY</span><strong>12,000 <small>CR</small></strong></div>
     <button className="primary-button launch" disabled={!ready} onClick={()=>start(false)}>{ready?'Take the tow':'Preparing the tug…'}<ChevronRight size={21}/></button>
     <button className="practice-button" disabled={!ready} onClick={()=>start(true)}>Quiet tow <span>Learn the handling without raiders</span></button>
     {error&&<p className="error" role="alert">{error}</p>}
    </section>
    <div className="intro-notes"><div><b>01</b><span>MOVE THE COVER<small>The wreck absorbs shots. Every hit costs salvage.</small></span></div><div><b>02</b><span>FEEL THE WEIGHT<small>Boost, brake, reel in. Release the tow to fight.</small></span></div><div><b>03</b><span>GET BOTH HOME<small>Hold tug and wreck inside the cyan recovery ring.</small></span></div><p>{touch?'TWIN STICKS + TOUCH CONTROLS':'WASD + MOUSE  /  STANDARD CONTROLLER'}<span>~ 2 MINUTE RUN</span></p></div>
   </div>}
   <aside className={`radar ${!status.started||end?"hidden-map":""}`}><div>RECOVERY ROUTE <span>↑</span></div><svg ref={map} role="img" aria-label="Map showing tug, wreck, raiders and recovery point"/><p><i/>TUG <i/>WRECK</p></aside>
   {touch&&status.started&&!paused&&!end&&<div className="touch-controls">
    <Stick label="THRUST" onMove={(x,z)=>{if(game.current){game.current.touchMove={x,z};game.current.lastInput='touch';}}}/>
    <div className="touch-actions"><Hold label="BOOST" onHold={v=>{if(game.current)game.current.touchBoost=v;}}/><button onClick={()=>game.current?.sim.toggleTow()} aria-label="Release or attach tow">{status.attached?'RELEASE':'ATTACH'}</button><button onClick={()=>game.current?.sim.winch()}>WINCH</button><Hold label="BRAKE" onHold={v=>{if(game.current)game.current.touchBrake=v;}}/></div>
    <Stick label="AIM / FIRE" onMove={(x,z,active)=>{if(game.current){game.current.touchAim={x,z,active:active&&Math.hypot(x,z)>.2};game.current.gamepadActive=false;}}}/>
   </div>}
   <Dialog open={paused&&!end} onOpenChange={v=>game.current?.pause(v)}><DialogContent className="pause-card" showCloseButton={false} onEscapeKeyDown={e=>{e.preventDefault();game.current?.pause(false);}}>
    <span className="eyebrow">FLIGHT PAUSED</span><DialogTitle className="pause-title">Take a breath.</DialogTitle><DialogDescription>Your tug and cargo will wait right here.</DialogDescription>
    <div className="control-table"><span>Thrust</span><b>WASD / left stick</b><span>Aim & fire</span><b>Mouse / right stick + RT</b><span>Boost / brake</span><b>Shift / Space · LT / B</b><span>Attach / release tow</span><b>E / A</b><span>Change cable length</span><b>F / X</b><span>Camera zoom</span><b>Mouse wheel</b></div>
    <div className="pause-settings"><button onClick={toggleMute}>{muted?<VolumeX size={17}/>:<Volume2 size={17}/>}Sound {muted?'off':'on'}</button><button onClick={toggleEffects}><Settings2 size={17}/>Effects {effects?'high':'low'}</button><button onClick={()=>setTouch(!touch)}><Gamepad2 size={17}/>Touch {touch?'on':'off'}</button></div>
    <button className="primary-button" onClick={()=>game.current?.pause(false)}>Return to the tow<ChevronRight size={19}/></button><button className="text-button" onClick={()=>start(game.current?.sim.practice)}><RotateCcw size={14}/> Restart run</button>
   </DialogContent></Dialog>
   {end&&<section className="result-overlay"><div className="result-card"><span className="eyebrow">{status.state==='won'?'CONTRACT COMPLETE':'CONTRACT LOST'}</span><h2>{status.state==='won'?'Brought it home.':'Lost in the belt.'}</h2><p>{status.state==='won'?'The Kestrel is secured. The rest is a matter of paperwork.':status.hull<=0?'Your tug was disabled before recovery.':'The wreck broke apart before recovery.'}</p><div className="payout"><span>{status.state==='won'?'SALVAGE PAID':'SALVAGE LOST'}</span><strong>{format(status.value)} <small>CR</small></strong></div><div className="run-stats"><span><strong>{status.blocked}</strong>shots absorbed</span><span><strong>{status.kills}</strong>raiders disabled</span><span><strong>{Math.floor(status.time/60)}:{String(Math.floor(status.time%60)).padStart(2,'0')}</strong>flight time</span></div><button className="primary-button" onClick={()=>start(false)}>Make another run<RotateCcw size={17}/></button><button className="text-button" onClick={()=>start(true)}>Practice a quiet tow</button></div></section>}
   <div className="version">WR—01 <span>{status.software?"COMPATIBILITY RENDERER":"PHYSICS / SALVAGE ENCOUNTER"}</span></div>
 </main>;
}
function Stick({label,onMove}:{label:string,onMove:(x:number,z:number,active:boolean)=>void}){
 const ref=useRef<HTMLDivElement>(null),pointer=useRef<number|null>(null);const [offset,setOffset]=useState([0,0]);
 const move=(e:any)=>{if(e.pointerId!==pointer.current||!ref.current)return;const r=ref.current.getBoundingClientRect(),radius=r.width*.34,dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy),scale=l>radius?radius/l:1;setOffset([dx*scale,dy*scale]);const dead=.1,x=dx*scale/radius,y=dy*scale/radius;onMove(Math.abs(x)<dead?0:x,Math.abs(y)<dead?0:y,true);};
 const end=(e:any)=>{if(e.pointerId!==pointer.current)return;pointer.current=null;setOffset([0,0]);onMove(0,0,false);};
 return <div className="stick" ref={ref} onPointerDown={e=>{pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);move(e);}} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} role="group" aria-label={`${label} touch stick`}><div className="stick-ring"/><i style={{transform:`translate(${offset[0]}px,${offset[1]}px)`}}/><span>{label}</span></div>;
}
function Hold({label,onHold}:{label:string,onHold:(active:boolean)=>void}){return <button onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);onHold(true);}} onPointerUp={()=>onHold(false)} onPointerCancel={()=>onHold(false)} onLostPointerCapture={()=>onHold(false)}>{label}</button>;}

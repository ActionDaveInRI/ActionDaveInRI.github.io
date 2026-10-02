export const QUALITY_KEY='bramblewild-graphics-quality';
export function readQuality(storage){try{const value=storage?.getItem(QUALITY_KEY);return ['high','balanced','low'].includes(value)?value:'high'}catch{return 'high'}}
export function qualityProfile(quality,dpr=1){
 const base=Math.min(Math.max(dpr,1),2);
 return quality==='low'?{ratio:base*.6,shadowSize:0,shadowSpan:44}:quality==='balanced'?{ratio:base*.8,shadowSize:2048,shadowSpan:48}:{ratio:base,shadowSize:4096,shadowSpan:64};
}

// Sustained frame pacing only: never change a setting without the player's choice.
export class PerformanceWatch{
 constructor(){this.declined=false;this.reset()}
 reset(){this.warmup=8;this.elapsed=0;this.frames=0;this.slow=[];this.pending=false}
 decline(){this.declined=true;this.reset()}
 sample(seconds,active=true){
  if(!active||!Number.isFinite(seconds)||seconds<=0){this.reset();return false}
  if(this.declined)return false;
  // A single stall contributes at most one bucket; sustained long frames still count.
  seconds=Math.min(seconds,1);
  if(this.warmup>0){this.warmup-=seconds;return false}
  this.elapsed+=seconds;this.frames++;
  if(this.elapsed>=1){this.slow.push(this.frames/this.elapsed<40);this.elapsed=0;this.frames=0;if(this.slow.length>10)this.slow.shift();this.pending=this.slow.length===10&&this.slow.filter(Boolean).length>=8;}
  return this.pending;
 }
}

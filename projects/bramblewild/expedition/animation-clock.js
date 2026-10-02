// Animation consumes the same fixed steps as movement. A fast display must never
// interpret a frame between simulation steps as a stop and restart.
export class AnimationClock {
 constructor(){this.accumulator=0;this.step=1/60}
 advance(elapsed,update){this.accumulator+=Math.min(Math.max(0,elapsed),.1);while(this.accumulator+1e-10>=this.step){update(this.step);this.accumulator=Math.max(0,this.accumulator-this.step)}}
}

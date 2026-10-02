import {clearSegment} from './navigation.js';
import {angleDelta,MOVES} from './moves.js';
export class Engagement {
 constructor(){this.cancel()}
 cancel(){this.active=false;this.status='Facing';this.origin=null;this.last=null;this.stuck=0}
 begin(player){this.cancel();this.active=true;this.origin={x:player.x,z:player.z};this.status='Approaching'}
 update(game,enemy,input,dt){if(!this.active)return input;if(!enemy||game.player.dead){this.cancel();return input}if(game.paused||game.hitstop>0)return input;
 if(Math.hypot(input.x??0,input.z??0)>.05||input.guard||input.turn||input.manualFacing||input.sprint){this.cancel();return input}
 const p=game.player,d=Math.hypot(enemy.x-p.x,enemy.z-p.z),reach=Math.min(2.2,game.weapon.length+.2),aim=Math.atan2(enemy.x-p.x,enemy.z-p.z),out={...input,aim,target:{x:enemy.x,z:enemy.z}};
 if(Math.hypot(p.x-this.origin.x,p.z-this.origin.z)>10||Math.hypot(enemy.x-this.origin.x,enemy.z-this.origin.z)>14){this.cancel();return out}
 if(p.action||p.stagger>0){this.status=p.stagger>0?'Recovering':'Attacking';this.last=null;return out}
 if(d>reach){if(!clearSegment(game.layer,p,enemy)){this.cancel();return out}if(this.last&&Math.hypot(p.x-this.last.x,p.z-this.last.z)<.003)this.stuck+=dt;else this.stuck=0;this.last={x:p.x,z:p.z};if(this.stuck>.7){this.cancel();return out}this.status='Approaching';const speed=Math.min(1,(d-reach+.1)/.6);return {...out,x:(enemy.x-p.x)/d*speed,z:(enemy.z-p.z)/d*speed}}
 this.last=null;this.stuck=0;
 if(p.stamina<MOVES.cut.cost+MOVES.step.cost+8){this.status='Catching breath';return out}
 this.status='Attacking';if(Math.abs(angleDelta(p.heading,aim))<.25&&!game.buffer)game.request('cut',out);return out;
 }
}

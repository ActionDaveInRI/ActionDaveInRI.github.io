// Soft facing assistance never changes movement or a committed attack's heading.
export class CombatTarget {
 constructor(){this.clear()}
 clear(){this.id=null;this.layer=null}
 toggle(enemy,layer){if(this.id===enemy.id&&this.layer===layer){this.clear();return false}this.id=enemy.id;this.layer=layer;return true}
 cycle(game,range=16){
  const p=game.player,list=p.dead?[]:game.enemies.filter(e=>!e.dead&&Math.hypot(e.x-p.x,e.z-p.z)<range&&game.visible(e)&&game.lineClear(p,e)).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
  const current=this.layer===game.layerId?list.findIndex(e=>e.id===this.id):-1,chosen=list.length?list[(current+1)%list.length]:null;
  if(chosen){this.id=chosen.id;this.layer=game.layerId}else this.clear();return chosen;
 }
 resolve(game){const e=game.enemies.find(e=>e.id===this.id);if(this.layer!==game.layerId||game.player.dead||!e||e.dead||Math.hypot(e.x-game.player.x,e.z-game.player.z)>24||!game.visible(e)||!game.lineClear(game.player,e)){this.clear();return null}return e}
 aim(game){const e=this.resolve(game);return e?{aim:Math.atan2(e.x-game.player.x,e.z-game.player.z),target:{x:e.x,z:e.z}}:null}
}

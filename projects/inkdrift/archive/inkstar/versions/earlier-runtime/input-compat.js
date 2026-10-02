(function(){'use strict';
var canvas=document.getElementById('game');if(!canvas)return;
var latched=false;
function fireAction(){
  if(latched)return;latched=true;
  try{window.dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true,cancelable:true}));}
  catch(err){var d=document.createEvent('Event');d.initEvent('keydown',true,true);d.key='e';window.dispatchEvent(d);}
  setTimeout(function(){
    try{window.dispatchEvent(new KeyboardEvent('keyup',{key:'e',bubbles:true,cancelable:true}));}
    catch(err){var u=document.createEvent('Event');u.initEvent('keyup',true,true);u.key='e';window.dispatchEvent(u);}
    latched=false;
  },120);
}
function inActionButton(x,y){
  var W=window.innerWidth||320,H=window.innerHeight||320;
  var left=W-120,right=W-10,top=H-150,bottom=H-84;
  return x>=left&&x<=right&&y>=top&&y<=bottom;
}
canvas.addEventListener('touchstart',function(e){
  for(var i=0;i<e.changedTouches.length;i++){
    var t=e.changedTouches[i];
    if(inActionButton(t.clientX,t.clientY)){fireAction();break;}
  }
},{passive:true});
})();
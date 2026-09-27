(function(){
'use strict';
var boot=document.getElementById('boot');
function fail(message){if(boot){boot.style.display='block';boot.textContent='Loader error: '+message;}}
fetch('game-v4.js?v=8',{cache:'no-store'})
  .then(function(response){if(!response.ok)throw new Error('HTTP '+response.status);return response.text();})
  .then(function(source){
    source=source
      .replace("cost:420","cost:0")
      .replace("cost:860","cost:0")
      .replace("cost:1450","cost:0")
      .replace("cost:1080","cost:0")
      .replace("var PAINT_COST=55;","var PAINT_COST=0;");
    var script=document.createElement('script');
    script.text=source+'\n//# sourceURL=game-v4-zero-cost.js';
    document.head.appendChild(script);
  })
  .catch(function(error){fail(error&&error.message?error.message:String(error));});
})();

export function createEventLog(root){
 const entries=root.querySelector('.log-entries'),toggle=root.querySelector('#log-toggle'),dock=root.querySelector('#log-dock'),glass=root.querySelector('#log-glass');
 let last=null,fade;
 const save=()=>{try{localStorage.setItem('bramblewild-log',JSON.stringify({dock:root.dataset.dock,glass:root.dataset.glass}))}catch{}};
 const sync=()=>{dock.setAttribute('aria-label',root.dataset.dock==='top'?'Move trail log to bottom':'Move trail log to top');dock.textContent=root.dataset.dock==='top'?'↓':'↑';glass.setAttribute('aria-pressed',String(root.dataset.glass==='true'))};
 try{const saved=JSON.parse(localStorage.getItem('bramblewild-log'));if(saved){root.dataset.dock=saved.dock==='top'?'top':'bottom';root.dataset.glass=String(saved.glass!=='false')}}catch{}
 sync();
 toggle.onclick=()=>{const expanded=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(expanded));root.classList.toggle('expanded',expanded);toggle.querySelector('span').textContent=expanded?'Close':'History';if(expanded)entries.scrollTop=entries.scrollHeight};
 dock.onclick=()=>{root.dataset.dock=root.dataset.dock==='top'?'bottom':'top';sync();save()};
 glass.onclick=()=>{root.dataset.glass=String(root.dataset.glass!=='true');sync();save()};
 return (text,kind='message')=>{
  if(!text)return;
  const atEnd=entries.scrollHeight-entries.scrollTop-entries.clientHeight<24,now=performance.now();
  if(last?.text===text&&now-last.time<2500){last.count++;last.row.textContent=text+' ×'+last.count;last.time=now}
  else{const row=document.createElement('div');row.className='log-entry '+kind;row.textContent=text;entries.append(row);last={text,row,count:1,time:now};while(entries.children.length>60)entries.firstElementChild.remove()}
  if(atEnd||!root.classList.contains('expanded'))entries.scrollTop=entries.scrollHeight;
  if(!['hit','block','evade'].includes(kind))root.querySelector('.log-announcement').textContent=text;
  root.classList.add('recent');clearTimeout(fade);fade=setTimeout(()=>root.classList.remove('recent'),9000);
 };
}

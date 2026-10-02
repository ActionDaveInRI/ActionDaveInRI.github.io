import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const root=path.resolve(import.meta.dirname,'..');
let html=await readFile(path.join(root,'public/demo/index.html'),'utf8');
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const result=await build({stdin:{contents:source,resolveDir:path.join(root,'public/demo'),loader:'js'},bundle:true,format:'iife',platform:'browser',target:'es2022',write:false,minifyWhitespace:true,plugins:[{name:'vendored-three',setup(b){b.onResolve({filter:/^three(?:\/|$)/},args=>({path:args.path==='three'?path.join(root,'public/demo/vendor/three.module.js'):path.join(root,'public/demo/vendor',args.path.replace('three/',''))}));}}]});
const safe=s=>s.replaceAll('</script','<\\/script');
html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'');
html=html.replace(/<script type="module">[\s\S]*?<\/script>/,()=>'<script>'+safe(result.outputFiles[0].text)+'</script>');
const d3=await readFile(path.join(root,'public/demo/vendor/d3.min.js'),'utf8');
html=html.replace('<script src="/demo/vendor/d3.min.js"></script>',()=>'<script>'+safe(d3)+'</script>');
html=html.replace(/<link\b[^>]*rel="icon"[^>]*>/g,'');
if(/<(?:script|link)\b[^>]*(?:src|href)="(?:https?:|\/)/.test(html))throw Error('External script or stylesheet remains');
const output=path.join(root,'public/geography-explorer.html');
await writeFile(output,html);
// Keep the previously shared download address serving the current explorer.
await writeFile(path.join(root,'public/pathfinder-survey.html'),html);
console.log('Standalone export:',output,Buffer.byteLength(html),'bytes');

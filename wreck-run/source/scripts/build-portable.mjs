import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const temporary=resolve('.portable-build');
mkdirSync(temporary,{recursive:true});
try {
  writeFileSync(resolve(temporary,'entry.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import Home from '../app/page';import '../app/globals.css';createRoot(document.getElementById('root')).render(<Home/>);`);
  await build({configFile:false,publicDir:false,plugins:[react()],resolve:{alias:{'@':root}},define:{'process.env.NODE_ENV':'"production"'},build:{outDir:resolve(temporary,'out'),emptyOutDir:true,minify:true,lib:{entry:resolve(temporary,'entry.tsx'),formats:['iife'],name:'WreckRun',fileName:()=> 'game.js'},rollupOptions:{output:{inlineDynamicImports:true}},cssCodeSplit:false}});
  const out=resolve(temporary,'out');
  const js=readFileSync(resolve(out,'game.js'),'utf8');
  const css=readdirSync(out).filter(f=>f.endsWith('.css')).map(f=>readFileSync(resolve(out,f),'utf8')).join('\n');
  writeFileSync(resolve(root,'../index.html'),`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Wreck Run — Salvage Under Fire</title><meta name="description" content="Tow a derelict freighter through raider territory. Your salvage is your cover."><style>${css}</style></head><body><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`);
  console.log('Portable Wreck Run built: ../index.html');
} finally {
  rmSync(temporary,{recursive:true,force:true});
}

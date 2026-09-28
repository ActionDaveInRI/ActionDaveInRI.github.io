import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/demo/vendor');
export async function resolve(specifier,context,nextResolve){
  if(specifier==='three')return {url:pathToFileURL(path.join(base,'three.module.js')).href,shortCircuit:true};
  if(specifier.startsWith('three/addons/'))return {url:pathToFileURL(path.join(base,specifier.slice(6))).href,shortCircuit:true};
  return nextResolve(specifier,context);
}

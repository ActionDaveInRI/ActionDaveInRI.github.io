import {copyFile} from 'node:fs/promises';
import path from 'node:path';
import './export-standalone.mjs';
const root=path.resolve(import.meta.dirname,'..');
await copyFile(path.join(root,'public/geography-explorer.html'),path.join(root,'../index.html'));
console.log('Portable Star Cluster built: ../index.html');

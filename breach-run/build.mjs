import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const root = new URL('./', import.meta.url);
const ts = await readFile(new URL('source/game.ts', root), 'utf8');
await writeFile(new URL('game.js', root), stripTypeScriptTypes(ts, { mode: 'strip' }));
const css = await readFile(new URL('source/globals.css', root), 'utf8');
await writeFile(new URL('style.css', root), css.replace('@import "tailwindcss";', '/* Static release: original custom styles; no Tailwind utilities are used. */\nbutton { background: transparent; border: 0 solid; }'));
console.log('Rebuilt Breach Run standalone game.js and style.css from saved v2 source.');

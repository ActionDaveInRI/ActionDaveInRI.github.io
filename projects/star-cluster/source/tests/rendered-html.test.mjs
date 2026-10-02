import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../public/',import.meta.url);
test('published portable entry contains the explorer and has no remote dependencies',()=>{
 const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
 assert.match(html,/<title>Star Cluster to Planet Tile — Geographic Explorer<\/title>/);
 assert.doesNotMatch(html,/<iframe\b/);
 assert.ok(existsSync(new URL('demo/vendor/three.module.js',root)));
 const standalone=readFileSync(new URL('geography-explorer.html',root),'utf8');
 assert.equal(html,standalone);
 assert.ok(standalone.includes('SYSTEM_CHART_UI'));
 assert.doesNotMatch(standalone,/<(?:script|link)\b[^>]*(?:src|href)="(?:https?:|\/)/);
 assert.equal(standalone,readFileSync(new URL('pathfinder-survey.html',root),'utf8'));
});

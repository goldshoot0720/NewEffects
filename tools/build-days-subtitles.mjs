#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readBilingualLines} from './bilingual-lyrics.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ref=path.join(root,'assets/ref/days');
const title='DAYS!';
const stamp=t=>{
  const ms=Math.round(t*1000),pad=(v,n=2)=>String(v).padStart(n,'0');
  return `${pad(Math.floor(ms/3600000))}:${pad(Math.floor(ms/60000)%60)}:${pad(Math.floor(ms/1000)%60)},${pad(ms%1000,3)}`;
};
const lines=readBilingualLines(ref,'ja');
const {duration,cues}=JSON.parse(fs.readFileSync(path.join(ref,'timings-ja.json'),'utf8'));
if(!Number.isFinite(duration)||duration<=0||new Set(cues.map(c=>c.line)).size!==lines.length) throw Error(`Expected timings for all ${lines.length} source lines`);
const blocks=cues.map((c,i)=>{
  if(!Number.isInteger(c.line)||c.line<1||c.line>lines.length||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end-c.start<.5||c.end>duration||(i&&c.start<cues[i-1].end)) throw Error(`Invalid cue ${i+1}`);
  return `${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${lines[c.line-1]}\n`;
});
fs.writeFileSync(path.join(root,title+'.srt'),blocks.join('\n'));
console.log(`${title}: ${cues.length} cues, ${duration.toFixed(2)} seconds`);

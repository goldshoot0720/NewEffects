#!/usr/bin/env node
// Rebuild the reviewed, bilingual V West subtitles without changing the lyrics.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ref=path.join(root,'assets/ref/vwest');
const lines=name=>fs.readFileSync(path.join(ref,name),'utf8').trim().split(/\r?\n/);
const ja=lines('lyrics-ja.txt'),zh=lines('lyrics-zh.txt');
const {duration,cues}=JSON.parse(fs.readFileSync(path.join(ref,'timings.json'),'utf8'));
if(cues.length!==41 || ja.length!==cues.length || zh.length!==cues.length) throw Error('Expected 41 matching bilingual cues');
const stamp=t=>{
  const ms=Math.round(t*1000),pad=(v,n=2)=>String(v).padStart(n,'0');
  return `${pad(Math.floor(ms/3600000))}:${pad(Math.floor(ms/60000)%60)}:${pad(Math.floor(ms/1000)%60)},${pad(ms%1000,3)}`;
};
const blocks=cues.map((c,i)=>{
  if(c.line!==i+1 || !Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start<0 || c.start>=c.end || c.end>duration || (i&&c.start<cues[i-1].end)) throw Error('Invalid cue '+(i+1));
  return `${c.line}\n${stamp(c.start)} --> ${stamp(c.end)}\n${ja[i]}\n${zh[i]}\n`;
});
fs.writeFileSync(path.join(root,'subtitles','後はやるだけ！.srt'),blocks.join('\n'));
console.log('Rebuilt 41 bilingual cues with reviewed second-half timings');

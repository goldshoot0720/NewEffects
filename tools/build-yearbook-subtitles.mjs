#!/usr/bin/env node
import fs from 'node:fs';
import {readBilingualLines} from './bilingual-lyrics.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ref=path.join(root,'assets/ref/yearbook');
const compact=s=>s.replace(/\s/g,'');
const stamp=t=>{
  const ms=Math.round(t*1000),pad=(v,n=2)=>String(v).padStart(n,'0');
  return `${pad(Math.floor(ms/3600000))}:${pad(Math.floor(ms/60000)%60)}:${pad(Math.floor(ms/1000)%60)},${pad(ms%1000,3)}`;
};
for(const [lang,title,count] of [['zh','我與國中畢業紀念冊的對話',95],['en','我與國中畢業紀念冊的對話(英文歌詞)',92],['ja','我與國中畢業紀念冊的對話(日文歌詞)',108],['yue','我與國中畢業紀念冊的對話(粵文歌詞)',109]]){
  const lines=readBilingualLines(ref,lang);
  if(lang==='zh'&&compact(lines.join(''))!==compact(fs.readFileSync(path.join(ref,'lyrics-original.txt'),'utf8'))) throw Error('Chinese segmentation changed the original text');
  const {duration,cues}=JSON.parse(fs.readFileSync(path.join(ref,`timings-${lang}.json`),'utf8'));
  if(lines.length!==count||!Number.isFinite(duration)||duration<=0||new Set(cues.map(c=>c.line)).size!==count) throw Error(`Invalid ${lang} source coverage`);
  const blocks=cues.map((c,i)=>{
    if(!Number.isInteger(c.line)||c.line<1||c.line>count||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end-c.start<.5-1e-6||c.end>duration||(i&&c.start<cues[i-1].end-1e-6)) throw Error(`Invalid ${lang} cue ${i+1}`);
    return `${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${lines[c.line-1]}\n`;
  });
  fs.writeFileSync(path.join(root,title+'.srt'),blocks.join('\n'));
  console.log(`${title}: ${cues.length} cues, ${duration.toFixed(2)} seconds`);
}

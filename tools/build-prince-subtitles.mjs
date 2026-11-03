#!/usr/bin/env node
import fs from 'node:fs';
import {readBilingualLines} from './bilingual-lyrics.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ref=path.join(root,'assets/ref/plumbing-prince');
const compact=s=>s.replace(/\s/g,'');
const stamp=t=>{
  const ms=Math.round(t*1000),pad=(v,n=2)=>String(v).padStart(n,'0');
  return `${pad(Math.floor(ms/3600000))}:${pad(Math.floor(ms/60000)%60)}:${pad(Math.floor(ms/1000)%60)},${pad(ms%1000,3)}`;
};
const versions=[['zh','塗哥水電王子爆紅',83,[]],['en','塗哥水電王子爆紅(英文歌詞)',97,[]],['ja','塗哥水電王子爆紅(日文歌詞)',110,[]],['yue','塗哥水電王子爆紅(粵文歌詞)',102,[53,54,55]]];
const selected=process.argv.slice(2);
if(selected.some(lang=>!versions.some(v=>v[0]===lang))) throw Error('Unknown language');
for(const [lang,title,count,unsung] of versions){
  if(selected.length&&!selected.includes(lang)) continue;
  const lines=readBilingualLines(ref,lang);
  if(lang==='zh'&&compact(lines.join(''))!==compact(fs.readFileSync(path.join(ref,'lyrics-original.txt'),'utf8'))) throw Error('Segmentation changed the original story');
  const {duration,cues,omitted=[]}=JSON.parse(fs.readFileSync(path.join(ref,`timings-${lang}.json`),'utf8'));
  const covered=new Set(cues.map(c=>c.line));
  if(lines.length!==count||!Number.isFinite(duration)||duration<=0||JSON.stringify(omitted.map(c=>c.line))!==JSON.stringify(unsung)||omitted.some(c=>!c.reason)||covered.size!==count-unsung.length||unsung.some(n=>covered.has(n))) throw Error(`Invalid ${lang} source coverage`);
  const blocks=cues.map((c,i)=>{
    if(!Number.isInteger(c.line)||c.line<1||c.line>lines.length||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end-c.start<.5-1e-6||c.end>duration||(i&&c.start<cues[i-1].end-1e-6)) throw Error(`Invalid cue ${i+1}`);
    return `${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${lines[c.line-1]}\n`;
  });
  fs.writeFileSync(path.join(root,title+'.srt'),blocks.join('\n'));
  console.log(`${title}: ${cues.length} cues, ${duration.toFixed(2)} seconds`);
}

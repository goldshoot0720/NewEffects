#!/usr/bin/env node
import fs from 'node:fs';
import {readBilingualLines} from './bilingual-lyrics.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ref=path.join(root,'assets/ref/bubu-fur');
const stamp=t=>{
  const ms=Math.round(t*1000),pad=(v,n=2)=>String(v).padStart(n,'0');
  return `${pad(Math.floor(ms/3600000))}:${pad(Math.floor(ms/60000)%60)}:${pad(Math.floor(ms/1000)%60)},${pad(ms%1000,3)}`;
};
for(const [lang,title] of [['zh','喵布布本喵掉的毛'],['en','喵布布本喵掉的毛(英文歌詞)'],['ja','喵布布本喵掉的毛(日文歌詞)'],['yue','喵布布本喵掉的毛(粵文歌詞)']]){
  const lines=readBilingualLines(ref,lang);
  const {duration,cues}=JSON.parse(fs.readFileSync(path.join(ref,`timings-${lang}.json`),'utf8'));
  if(lines.length!==48||cues.length!==48||!Number.isFinite(duration)||duration<=0) throw Error(`Expected 48 matching ${lang} lyrics/timing cues`);
  const blocks=cues.map((c,i)=>{
    if(c.line!==i+1||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end-c.start<.5||c.end>duration||(i&&c.start<cues[i-1].end)) throw Error(`Invalid ${lang} cue ${i+1}`);
    return `${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${lines[i]}\n`;
  });
  fs.writeFileSync(path.join(root,title+'.srt'),blocks.join('\n'));
  console.log(`${title}: ${cues.length} cues, ${duration.toFixed(2)} seconds`);
}

#!/usr/bin/env node
// Rebuild each language from the user's original lyrics and reviewed audio timings.
import fs from 'node:fs';
import {readBilingualLines} from './bilingual-lyrics.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ref=path.join(root,'assets/ref/wedding');
const versions=[['zh','最瞎結婚理由',33],['en','最瞎結婚理由(英文歌詞)',34],['yue','最瞎結婚理由(粵文歌詞)',34],['ja','最瞎結婚理由(日文歌詞)',34]];
const stamp=t=>{
  const ms=Math.round(t*1000),pad=(v,n=2)=>String(v).padStart(n,'0');
  return `${pad(Math.floor(ms/3600000))}:${pad(Math.floor(ms/60000)%60)}:${pad(Math.floor(ms/1000)%60)},${pad(ms%1000,3)}`;
};
for(const [lang,title,count] of versions){
  const lines=readBilingualLines(ref,lang);
  const {duration,cues}=JSON.parse(fs.readFileSync(path.join(ref,`timings-${lang}.json`),'utf8'));
  if(!Number.isFinite(duration)||duration<=0||lines.length!==count||cues.length!==count) throw Error(`Invalid ${lang} lyrics/timing count`);
  const blocks=cues.map((c,i)=>{
    if(c.line!==i+1||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end-c.start<.5||c.end>duration||(i&&c.start<cues[i-1].end)) throw Error(`Invalid ${lang} cue ${i+1}`);
    return `${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${lines[i]}\n`;
  });
  fs.writeFileSync(path.join(root,title+'.srt'),blocks.join('\n'));
  console.log(`${title}: ${count} cues, ${duration.toFixed(2)} seconds`);
}

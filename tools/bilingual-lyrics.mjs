import fs from 'node:fs';
import path from 'node:path';

// Each translation belongs to a source line, so repeated cues reuse the same pair.
export function readBilingualLines(ref,lang){
  const source=fs.readFileSync(path.join(ref,`lyrics-${lang}.txt`),'utf8').split(/\r?\n/).filter(l=>l.trim());
  if(lang==='zh') return source;
  const translations=JSON.parse(fs.readFileSync(path.join(ref,'translations-zh.json'),'utf8'))[lang];
  if(!Array.isArray(translations)||translations.length!==source.length) throw Error(`Incomplete ${lang} Chinese translations: ${ref}`);
  const repeated=new Map();
  return source.map((line,i)=>{
    const zh=translations[i];
    if(typeof zh!=='string'||!zh.trim()||/[\r\n\u3040-\u30ff]/.test(zh)) throw Error(`Invalid ${lang} translation ${i+1}: ${ref}`);
    if(repeated.has(line)&&repeated.get(line)!==zh.trim()) throw Error(`Inconsistent repeated ${lang} translation ${i+1}: ${ref}`);
    repeated.set(line,zh.trim());
    return `${line}\n${zh.trim()}`;
  });
}

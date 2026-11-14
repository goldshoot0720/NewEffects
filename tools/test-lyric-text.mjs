#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const box={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'lyric-text.js'),'utf8'),box);
const LyricText=box.window.LyricText;
assert.equal(LyricText.clean('「你好，世界！」🔥♪'),'你好世界');
assert.equal(LyricText.clean("Don't—stop! Thirty-seven"),'Dont stop Thirty seven');
assert.equal(LyricText.clean('祝(いわ)う！ [hey]'),'祝(いわ)う hey');
assert.equal(LyricText.plain('祝(いわ)う！ [hey]'),'祝う hey');
assert.equal(LyricText.clean('20,250,000'),'20250000');
assert.equal(LyricText.clean('「…！？—」🔥♪'),'');
assert.equal(LyricText.clean('Forever＆ever'),'Forever ever');
assert.equal(LyricText.clean('Story－旅路－は続く'),'Story 旅路 は続く');
assert.equal(LyricText.clean('Storyー旅路ーは続く'),'Storyー旅路ーは続く');
assert.equal(LyricText.mainIsEnOrJa('Keep your eyes on me'), true);
assert.equal(LyricText.mainIsEnOrJa('雨(あめ)が降る'), true);
assert.equal(LyricText.mainIsEnOrJa('招財喵布布送嚟祝福'), false);
assert.equal(LyricText.translationSize('Keep your eyes on me right now', 32, 36), 28.8);
assert.equal(LyricText.translationSize('Keep your eyes on me', 66, 36), 36);
assert.equal(LyricText.translationSize('雨(あめ)', 40, 46), 36);
assert.equal(LyricText.translationSize('招財喵布布', 30, 36), 36);
const parser=(file,end)=>{
  const code=fs.readFileSync(path.join(root,file),'utf8'),start=code.indexOf('function parseSrt(text)');
  return vm.runInNewContext(code.slice(start,code.indexOf(end,start))+';parseSrt',{LyricText});
};
const pv=parser('pv.js','const PUNCT'),v2=parser('v2.html','function parse(text)');
const sample='1\n00:00:01,000 --> 00:00:02,500\nHello, world!\n你好，世界！\n\n2\n00:00:03,000 --> 00:00:04,000\n雨(あめ)！\n下雨！\n';
const a=pv(sample),b=v2(sample).filter(c=>c.text);
assert.equal(a[0].jp,'Hello world');
assert.equal(a[0].zh,'你好世界');
assert.equal(a[0].start,1);assert.equal(a[0].end,2.5);
assert.equal(a[1].jp,'雨(あめ)');
assert.equal(JSON.stringify(a.map(c=>[c.jp,c.zh])),JSON.stringify(b.map(c=>[c.text,c.zh])));
let count=0;
for(const name of fs.readdirSync(root).filter(f=>f.endsWith('.srt'))){
  const text=fs.readFileSync(path.join(root,name),'utf8');
  const p=pv(text),q=v2(text).filter(c=>c.text);
  assert.equal(p.length,q.length,name);
  for(let i=0;i<p.length;i++){
    assert.equal(p[i].jp,q[i].text,name);
    assert.equal(p[i].zh,q[i].zh||'',name);
    assert.ok(!/[\p{P}\p{S}]/u.test(LyricText.plain(p[i].jp)+p[i].zh),name);
    count++;
  }
}
// Forever＆ever 的逐字填色時間：每個字要對得上 tokenize() 切出來的字母數，時間也不能倒退。
{
  const code=fs.readFileSync(path.join(root,'pv.js'),'utf8');
  const tokStart=code.indexOf('function tokenize(text)'),tokEnd=code.indexOf('// 片頭膠卷用',tokStart);
  const box={};
  vm.runInNewContext(`const PUNCT='、。・「」『』…,.';\n${code.slice(tokStart,tokEnd)}\n__out={tokenize}`,box);
  const {tokenize}=box.__out;
  const fill=JSON.parse(fs.readFileSync(path.join(root,'assets/ref/forever/fill-ja.json'),'utf8'));
  const srtText=fs.readFileSync(path.join(root,'Forever＆ever.srt'),'utf8');
  const cues=pv(srtText);
  assert.equal(fill.lines.length,cues.length,'逐字填色的句數');
  cues.forEach((c,i)=>{
    const line=fill.lines[i];
    assert.equal(line.jp,fill.lines[i].jp,`第 ${i+1} 句歌詞`);
    let k=0,prev=-1;
    for(const u of tokenize(c.jp)){
      if(u.sp) continue;
      const n=[...u.t].length;
      assert.ok(k+n<=line.t.length,`第 ${i+1} 句字數`);
      for(let j=0;j<n;j++){
        const [s,e]=line.t[k++];
        assert.ok(s<=e,`第 ${i+1} 句每個字要有起訖時間`);
        assert.ok(e>=prev,`第 ${i+1} 句時間要往前走`);
        prev=e;
      }
    }
    assert.equal(k,line.t.length,`第 ${i+1} 句每個字都有時間`);
    assert.ok(prev<=c.end+0.2,`第 ${i+1} 句填色要在字幕結束前收完`);
  });
}
console.log(`PASS: punctuation, ruby, numbers, bilingual parsing and ${count} local subtitle cues`);

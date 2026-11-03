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
console.log(`PASS: punctuation, ruby, numbers, bilingual parsing and ${count} local subtitle cues`);

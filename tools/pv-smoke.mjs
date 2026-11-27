#!/usr/bin/env node
// 不用瀏覽器的 pv.js 冒煙測試：用假的 canvas context 把 pv.js 跑起來，
// 依真正的 SRT 建好分鏡，再把每個鏡頭函式在許多時間點呼叫一次，確認不會丟出例外。
// 用途是在沒有 Chrome（或 headless Chrome 起不來）時快速檢查分鏡與鏡頭邏輯。
// 用法：node tools/pv-smoke.mjs [歌曲編號]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const songIndex = Number(process.argv[2] || 5);
const raw = fs.readFileSync(path.join(ROOT, 'pv.js'), 'utf8');

// 把 init() 換成測試掛勾，其餘原封不動地載入
const cut = raw.lastIndexOf('init().catch(');
if(cut < 0) throw new Error('找不到 init()，pv.js 結構可能變了');
const hook = `window.__t = {buildShots, SHOTS, MEMBERS, LEAD, OTHERS, parseSrt, SONGS, CHARACTER_GROUPS, characterLineup,
  setA(a){ A = a; },
  setup(list, cast){
    for(const group of CHARACTER_GROUPS){
      group.members=characterEntries(group,cast).map(meta=>({meta,img:{width:meta.w,height:meta.h}}));
      group.backdrop={width:1920,height:1080};
    }
    if(song.art==='vwest') FACES.push(...cast.vwest.map(m=>m.groupFace));
    cues = list;
    cues.forEach((c, i) => {
      c.i = i; c.ju = tokenize(c.jp); c.zu = tokenize(c.zh || '');
      c.jW = c.ju.reduce((a, u) => a + u.w, 0) || 1;
      const tj = tapeUnits(c.ju), tz = tapeUnits(c.zu);
      c.jo = TJ.length; TJ.push({sep: i + 1}, ...tj); c.jn = tj.length;
      c.zo = TZ.length; TZ.push({sep: i + 1}, ...tz); c.zn = tz.length;
    });
    prepare({width: 673, height: 537});
    sections = buildSections(); shots = buildShots();
  }};\n})();\n`;

const N = 4000;
const wave = () => { const a = new Float32Array(N); for(let i = 0; i < N; i++) a[i] = .35 + .3*Math.sin(i*.05); return a; };
const gradient = {addColorStop(){}};
const ctx = new Proxy({}, {
  get(t, k){
    if(k === 'createLinearGradient' || k === 'createRadialGradient') return () => gradient;
    if(k === 'measureText') return () => ({width: 120});
    if(k === 'createImageData') return (w, h) => ({data: new Uint8ClampedArray(w*h*4)});
    if(k === 'getImageData') return (x, y, w, h) => ({data: new Uint8ClampedArray(w*h*4)});
    if(k === 'canvas') return {width: 1920, height: 1080};
    if(k in t) return t[k];
    return () => {};
  },
  set(t, k, v){ t[k] = v; return true; }
});
const el = () => ({getContext: () => ctx, width: 1920, height: 1080, style: {setProperty(){}}, classList: {add(){}, remove(){}, toggle(){}},
  textContent: '', addEventListener(){}, appendChild(){}, querySelector: () => el(), href: '', options: [], value: ''});

const sandbox = {
  SpriteRig:{draw(){}},
  console, Math, Date, JSON, Number, String, Array, Object, Float32Array, Int32Array, Uint8Array, Uint8ClampedArray,
  ImageData: class { constructor(d, w, h){ this.data = d; this.width = w; this.height = h; } },
  URLSearchParams, performance: {now: () => Date.now()},
  requestAnimationFrame(){}, setTimeout, clearTimeout,
  fetch: async () => ({ok: false, json: async () => ({}), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0)}),
  Image: class { constructor(){ this.width = 1024; this.height = 1216; } set src(v){ setTimeout(() => this.onload && this.onload(), 0); } },
  location: {search: `?song=${songIndex}`, protocol: 'http:', origin: 'http://127.0.0.1:8765'},
  document: {getElementById: el, querySelector: el, createElement: el, body: {classList: {add(){}, remove(){}}}, fonts: {load: async () => {}}, addEventListener(){}, title: ''},
  addEventListener(){}, devicePixelRatio: 1
};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT,'playlist-order.js'),'utf8'),sandbox,{filename:'playlist-order.js'});
vm.runInContext(fs.readFileSync(path.join(ROOT,'lyric-text.js'),'utf8'),sandbox,{filename:'lyric-text.js'});
vm.runInContext(raw.slice(0, cut) + hook, sandbox, {filename: 'pv.js'});

const T = sandbox.window.__t;
const song = T.SONGS[songIndex];
if(!song) throw new Error(`pv.js 沒有第 ${songIndex} 首歌`);
const srtPath = path.join(ROOT, 'subtitles', song.subs);
if(!fs.existsSync(srtPath)) throw new Error(`找不到字幕檔 ${srtPath}`);
const cues = T.parseSrt(fs.readFileSync(srtPath, 'utf8'));
// 用真實音檔長度（沒有 ffprobe 或音檔不在本機時退回 141.57 秒）
let dur = 141.57;
try{
  const {execFileSync} = await import('node:child_process');
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
    path.join(ROOT, 'audio', song.audio)], {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
  if(+out > 1) dur = +out;
}catch{}

T.setA({rms: wave(), low: wave(), mid: wave(),
  cumMid: (() => { const c = new Float32Array(N + 1); for(let i = 0; i < N; i++) c[i+1] = c[i] + .09; return c; })(),
  bpm: 116.2, spb: 60/116.2, beat0: 0, barOff: 0, dur});
T.setup(cues, JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/ref/cast/cast.json'), 'utf8')));

console.log(`歌曲 ${songIndex}「${song.title}」  成員 ${T.MEMBERS.length} 位、主唱 #${T.LEAD}、歌詞 ${cues.length} 句`);
const shots = T.buildShots();
console.log(`分鏡 ${shots.length} 個：${[...new Set(shots.map(s => s.type))].join(', ')}`);
for(const type of ['film', 'bike', 'windows', 'typo', 'stage', 'outro']){
  const list = shots.filter(s => s.type === type);
  if(list.length) console.log(`  ${type.padEnd(8)} ${list.length} 個  ${list.slice(0, 6).map(s => `${s.start.toFixed(1)}-${s.end.toFixed(1)}`).join(' ')}`);
}

// 每個鏡頭在許多時間點各呼叫一次；直接用分鏡自己的時間，最貼近實際播放
let ok = 0, fail = 0;
const times = [];
for(let t = 0; t < dur; t += 1.7) times.push(t);
for(const [name, fn] of Object.entries(T.SHOTS)){
  if(name === 'characters') continue;
  for(const sh of shots.filter(s => s.type === name).length ? shots.filter(s => s.type === name) : [{type: name, start: 10, end: 20}]){
    for(const t of times){
      if(t < sh.start - .5 || t > sh.end + .5) continue;
      const probe = Object.assign({}, sh, {cue: cues[Math.min(cues.length - 1, Math.floor(t/7))] || cues[0],
        pair: sh.pair || [T.LEAD, (T.LEAD + 1) % T.MEMBERS.length], members: sh.members || [T.LEAD, 1, 2], layout: sh.layout || 0});
      try{ fn(t, probe, (t - sh.start)/Math.max(.01, sh.end - sh.start)); ok++; }
      catch(e){ fail++; console.log(`  ✘ ${name} @${t.toFixed(1)}s：${e.message}`); }
    }
  }
}
console.log(`鏡頭函式：${ok} 次通過、${fail} 次失敗`);
// Previously the character shot was skipped entirely. Exercise every member
// with real sprite dimensions, including entry animation and later beats.
const cast = JSON.parse(fs.readFileSync(path.join(ROOT,'assets/ref/cast/cast.json'),'utf8'));
for(const [i,group] of T.CHARACTER_GROUPS.entries()){
  assert.equal(group.members.length,group.count);
  for(const actor of group.members) assert.ok(fs.existsSync(path.join(ROOT,'assets/ref/cast',actor.meta.file)));
  if(group.lineup){
    const layout=T.characterLineup(group.members);
    assert.equal(new Set(layout.map(p=>p.y)).size,1,'all actors share a baseline');
    layout.forEach((p,j)=>{
      assert.ok(p.left>=79.99 && p.right<=1840.01 && p.h>0 && p.y-p.h>=150);
      if(j)assert.ok(p.left-layout[j-1].right>=17.99,'no overlapping character cells');
    });
  }
  for(const t of [0,.3,1,7,14])T.SHOTS.characters(t,{group:i,start:0,end:15},t/15);
}
if(songIndex>=54 && songIndex<=69){
  const v2=fs.readFileSync(path.join(ROOT,'v2.html'),'utf8');
  const a=v2.indexOf('const DEFAULT_SONGS = ['),b=v2.indexOf('\n];',a);
  const cfg=vm.runInNewContext(v2.slice(a,b+3)+';DEFAULT_SONGS').find(s=>s.subs===song.subs);
  const group=T.CHARACTER_GROUPS[0];
  assert.equal(cfg.cast,group.sheet);
  assert.equal(T.MEMBERS.length,group.count);
  assert.equal(cast[cfg.cast][cfg.lead].file,cast[T.MEMBERS[T.LEAD].sheet][T.MEMBERS[T.LEAD].idx].file,'both players use the same lead');
  assert.deepEqual([...new Set(T.MEMBERS.map(m=>m.idx))].sort((a,b)=>a-b),Array.from({length:group.count},(_,i)=>i));
  assert.ok(group.lineup);
}
if(fail) process.exit(1);
console.log('✅ 分鏡與所有鏡頭函式都沒有丟出例外');

/* BEST 4U 歌詞 PV：同一套 render(t) 供瀏覽器即時預覽，也供 render-pv.mjs 逐格輸出成 MP4。
   畫面全部由時間 t 決定（不保留逐格狀態），任意跳轉與重複渲染都會得到相同畫面。 */
(() => {
'use strict';
const W = 1920, H = 1080, FPS = 30;
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const JOB = params.get('job') || '0';
const cv = document.getElementById('pv');
const g = cv.getContext('2d');
const $ = s => document.querySelector(s);

// 主視覺：參考圖與臉部座標（Ken Burns 鏡頭的目標）；cast 第一位是主唱，sprite 由 tools/cutout.mjs 從參考圖去背
const ARTS = {
  best4u: {src: 'assets/best4u-cover.webp', crop: [0, 38, 673, 537],
    faces: [[118, 110], [195, 160], [272, 124], [372, 127], [455, 157], [533, 102], [238, 234], [305, 242], [385, 224]]},
  rooftop: {src: 'assets/ref/rooftop6.webp', crop: [0, 0, 1536, 1024],
    faces: [[195, 195], [400, 190], [680, 140], [925, 250], [1165, 225], [1385, 250]]},
  stage: {src: 'assets/ref/stage9.webp', crop: [0, 0, 1774, 887],
    faces: [[195, 165], [345, 200], [510, 195], [690, 195], [860, 215], [1060, 205], [1235, 215], [1400, 205], [1580, 190]]}
};
const SONGS = [
  {title: '大好きだよって叫ぶんだ', ver: '小日向理瀬 ver.', file: '大好きだよって叫ぶんだ [小日向理瀬ver.]',
   subs: 'Subtitle_この想いは止められないよ いつだって眩...も_1790793102916.srt', theme: 'summer', art: 'best4u',
   cast: [['idol', 0, '理瀬', '#f6a531'], ['idol', 1, '純華', '#2ba6e1'], ['idol', 2, '陽和', '#ee5b97'], ['idol', 3, '咲希', '#3cc39a'], ['idol', 4, '雪乃', '#8d6ad6']]},
  {title: 'SUNRISE', ver: '小日向理瀬 ver.', file: 'SUNRISE [小日向理瀬ver.]',
   subs: 'Subtitle_《SUN RISE…》手をとっては競い...…_1790794218236.srt', theme: 'sunrise', art: 'rooftop',
   cast: [['casual', 4, '理瀬', '#f6a531'], ['casual', 1, '陽和', '#ee5b97'], ['casual', 0, '純華', '#2ba6e1'], ['casual', 2, '咲希', '#3cc39a'], ['casual', 3, '雪乃', '#8d6ad6'], ['casual', 11, '智', '#f0c23a']]},
  {title: 'HELLO HERO', ver: '御社 智 ver.', file: 'HELLO HERO [御社 智ver.]',
   subs: 'Subtitle_これまでもこれからも　変わらずいるよヨ...る_1790795207681.srt', theme: 'twilight', art: 'stage',
   cast: [['casual', 11, '智', '#f0c23a'], ['casual', 7, '', '#e0524f'], ['casual', 8, '', '#ee5b97'], ['casual', 9, '', '#f4a6b8'], ['casual', 10, '', '#2ba6e1']]}
];
// 每首歌一組配色：夏日向日葵、日出、黃昏星空
const THEMES = {
  summer:   {sky: ['#0b3d74', '#2f8fe0', '#bfeaff'], pastel: ['#fff8dc', '#d6f0ff'], accent: '#ffd23f', accent2: '#ff7b54', cool: '#5fd0ff', deep: '#0b2d55', particle: 'petal'},
  sunrise:  {sky: ['#22164a', '#b8487d', '#ffbf7a'], pastel: ['#fff1e6', '#ffe0ef'], accent: '#ffc35c', accent2: '#ff5f93', cool: '#a99bff', deep: '#2a1640', particle: 'spark'},
  twilight: {sky: ['#050820', '#2b2366', '#d0677a'], pastel: ['#eef0ff', '#ffe6ea'], accent: '#ffd56b', accent2: '#9c7bff', cool: '#62d4ff', deep: '#14123a', particle: 'star'}
};
const LOGO = [['B', '#2ba6e1'], ['E', '#f6a531'], ['S', '#ee5b97'], ['T', '#2ba6e1'], [' ', ''], ['4', '#f6a531'], ['U', '#8d6ad6']];
const POP = ['#ee5b97', '#2ba6e1', '#f6a531', '#8d6ad6', '#3cc39a', '#f08a4b'];
const FONT = {
  jp: '"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif',
  mincho: '"Hiragino Mincho ProN",serif',
  maru: '"Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif',
  zh: '"PingFang TC","Heiti TC",sans-serif',
  mono: 'Menlo,monospace',
  cond: '"Avenir Next Condensed","Avenir Next",sans-serif',
  logo: '"Avenir Next",sans-serif'
};

const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, u) => a + (b - a)*u;
const smooth = u => { u = clamp(u); return u*u*(3 - 2*u); };
const easeOut = u => 1 - Math.pow(1 - clamp(u), 3);
const easeBack = u => { u = clamp(u); const c = 1.9; return 1 + (c + 1)*Math.pow(u - 1, 3) + c*Math.pow(u - 1, 2); };
const hash = n => { const s = Math.sin(n*127.1 + 311.7)*43758.5453; return s - Math.floor(s); };
const frac = x => x - Math.floor(x);
const pad = (n, l = 2) => String(Math.max(0, n)).padStart(l, '0');
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

const song = SONGS[clamp(+(params.get('song') || 0) | 0, 0, SONGS.length - 1)];
song.audio = song.file + '.mp3';
const T = THEMES[song.theme];
const ART = ARTS[song.art], AW = ART.crop[2], AH = ART.crop[3], FACES = ART.faces;
// 成員：0 是主唱；名字未知的成員以編號標示
const MEMBERS = song.cast.map(([sheet, idx, name, color], i) => ({sheet, idx, name: name || `No.${pad(i + 1)}`, color, img: null, meta: null}));
const OTHERS = MEMBERS.map((_, i) => i).slice(1);
let A = null, cues = [], sections = [], shots = [], TJ = [], TZ = [], C = {};

/* ---------------- 音訊分析：節拍、低中頻能量 ---------------- */
async function analyse(buf){
  const SR = 22050;
  const ab = await new OfflineAudioContext(1, 1, SR).decodeAudioData(buf);
  const filtered = async chain => {
    const oc = new OfflineAudioContext(1, ab.length, SR);
    const src = oc.createBufferSource(); src.buffer = ab;
    let node = src;
    for(const [type, f, q] of chain){ const b = oc.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; node.connect(b); node = b; }
    node.connect(oc.destination); src.start();
    return (await oc.startRendering()).getChannelData(0);
  };
  const full = await filtered([]);
  const low = await filtered([['lowpass', 150, .7], ['lowpass', 150, .7]]);
  const mid = await filtered([['highpass', 300, .7], ['lowpass', 3400, .7]]);
  const dur = ab.duration;
  const rms = (x, rate) => {
    const n = Math.ceil(dur*rate), out = new Float32Array(n);
    for(let f = 0; f < n; f++){
      const a = Math.floor(f*SR/rate), b = Math.min(x.length, Math.floor((f + 1)*SR/rate));
      let s = 0; for(let i = a; i < b; i++) s += x[i]*x[i];
      out[f] = Math.sqrt(s/Math.max(1, b - a));
    }
    return out;
  };
  const norm = a => { const s = Float32Array.from(a).sort(); const p = s[Math.floor(s.length*.98)] || 1; for(let i = 0; i < a.length; i++) a[i] = Math.min(1.3, a[i]/p); return a; };
  const out = {dur, rms: norm(rms(full, FPS)), low: norm(rms(low, FPS)), mid: norm(rms(mid, FPS))};
  out.cumMid = new Float32Array(out.mid.length + 1);
  for(let i = 0; i < out.mid.length; i++) out.cumMid[i + 1] = out.cumMid[i] + out.mid[i]*out.mid[i];

  // 節拍：低頻＋全頻起音包絡 → 自相關取 BPM → 細掃 BPM 與相位
  const R = 100, l100 = rms(low, R), f100 = rms(full, R), n = l100.length;
  const on = new Float32Array(n);
  for(let i = 1; i < n; i++)
    on[i] = Math.max(0, Math.log1p(80*l100[i]) - Math.log1p(80*l100[i - 1])) + .5*Math.max(0, Math.log1p(80*f100[i]) - Math.log1p(80*f100[i - 1]));
  const pre = new Float32Array(n + 1); for(let i = 0; i < n; i++) pre[i + 1] = pre[i] + on[i];
  const flat = new Float32Array(n);
  for(let i = 0; i < n; i++){ const a = Math.max(0, i - 25), b = Math.min(n, i + 25); flat[i] = Math.max(0, on[i] - (pre[b] - pre[a])/(b - a)); }
  let best = -1, lag0 = 50;
  for(let lag = 28; lag <= 90; lag++){
    let s = 0; for(let i = 0; i + lag < n; i++) s += flat[i]*flat[i + lag];
    s *= Math.exp(-.5*Math.pow(Math.log2(6000/lag/128)/.55, 2));
    if(s > best){ best = s; lag0 = lag; }
  }
  const B = 64; let score = -1, bpm = 6000/lag0, phase = 0;
  for(let c = 6000/lag0 - 3; c <= 6000/lag0 + 3; c += .01){
    const P = 6000/c, bins = new Float32Array(B);
    for(let i = 0; i < n; i++) bins[Math.floor((i % P)/P*B)] += flat[i];
    for(let k = 0; k < B; k++){
      const v = bins[(k + B - 1) % B]*.5 + bins[k] + bins[(k + 1) % B]*.5;
      if(v > score){ score = v; bpm = c; phase = (k + .5)/B*P/R; }
    }
  }
  out.bpm = bpm; out.spb = 60/bpm; out.beat0 = phase;
  // 小節起點：四個拍位裡低頻起音最強者
  const sums = [0, 0, 0, 0];
  for(let j = 0; phase + j*out.spb < dur; j++){ const i = Math.round((phase + j*out.spb)*R); sums[j % 4] += flat[i] || 0; }
  out.barOff = sums.indexOf(Math.max(...sums));
  return out;
}
const sample = (arr, t) => arr[clamp(Math.round(t*FPS), 0, arr.length - 1)] || 0;
const cumMid = t => { const x = clamp(t*FPS, 0, A.mid.length), i = Math.floor(x), f = x - i; return A.cumMid[i] + (A.cumMid[Math.min(A.mid.length, i + 1)] - A.cumMid[i])*f; };
const beatPos = t => (t - A.beat0)/A.spb;
const pulse = t => Math.exp(-frac(beatPos(t))*6);
const energy = t => .55 + .6*sample(A.rms, t);

/* ---------------- 歌詞：SRT、斷詞、演唱進度 ---------------- */
function parseSrt(text){
  const tt = s => { const m = s.match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? +m[1]*3600 + +m[2]*60 + +m[3] + +('0.' + m[4]) : null; };
  const out = [];
  for(const block of text.replace(/\r/g, '').split(/\n\s*\n/)){
    const ls = block.split('\n').filter(x => x.trim());
    const i = ls.findIndex(x => x.includes('-->')); if(i < 0) continue;
    const [start, end] = ls[i].split('-->').map(tt); if(start == null) continue;
    const body = ls.slice(i + 1).map(x => x.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    let zh = '';
    if(body.length > 1 && !/[぀-ヿ]/.test(body[body.length - 1])) zh = body.pop();
    const jp = body.join(' ');
    if(jp) out.push({start, end: Math.max(end, start + .5), jp, zh});
  }
  return out.sort((a, b) => a.start - b.start);
}
const PUNCT = '、。・「」『』…,.';
function tokenize(text){
  const out = []; let bk = false;
  const re = /([一-鿿々〆ヶ]+)[(（]([ぁ-ゟ゠-ヿ]+)[)）]|[A-Za-z0-9'’!?！？\-_~]+|./gsu;
  for(const m of text.matchAll(re)){
    const c = m[0];
    if(m[1]){ out.push({t: m[1], ruby: m[2], bk, w: m[1].length + .3}); continue; }
    if('［《[(（'.includes(c)){ bk = true; continue; }
    if('］》])）'.includes(c)){ bk = false; continue; }
    if(/^\s$/u.test(c)) out.push({t: ' ', sp: true, bk, w: .5});
    else if(/^[A-Za-z0-9]/.test(c)) out.push({t: c, latin: true, bk, w: Math.max(1, c.length*.45)});
    else if(PUNCT.includes(c) || /^[!?！？\-_~]+$/.test(c)) out.push({t: c, bk, w: .3, punct: true});
    else out.push({t: c, bk, w: 1});
  }
  let cw = 0; for(const u of out){ u.cw = cw; cw += u.w; }
  return out;
}
// 片頭膠卷用：每格一個字（漢字詞拆字、英文整字）
function tapeUnits(units){
  const out = [];
  for(const u of units){
    if(u.sp || (u.punct && PUNCT.includes(u.t))) continue;
    if(u.latin || u.punct) out.push({t: u.t, bk: u.bk, latin: u.latin});
    else for(const ch of u.t) out.push({t: ch, bk: u.bk});
  }
  return out;
}
// 演唱進度：線性時間與中頻（人聲）能量累積各半
function prog(c, t){
  if(t <= c.start) return 0;
  const e = c.start + (c.end - c.start)*.93;
  if(t >= e) return 1;
  const lin = (t - c.start)/(e - c.start);
  const m0 = cumMid(c.start), m1 = cumMid(e);
  const en = m1 - m0 > 1e-6 ? clamp((cumMid(t) - m0)/(m1 - m0)) : lin;
  return clamp(.45*lin + .55*en);
}
function lastStarted(t){ let r = null; for(const c of cues){ if(c.start <= t) r = c; else break; } return r; }
function activeCue(t){ const c = lastStarted(t + .25); return c && t < c.end + .35 ? c : null; }

function buildSections(){
  const lv = cues.map(c => { let s = 0, n = 0; for(let x = c.start; x < c.end; x += 1/FPS){ s += sample(A.rms, x); n++; } return s/Math.max(1, n); });
  const thr = [...lv].sort((a, b) => a - b)[Math.floor(lv.length*.58)];
  const lab = lv.map(v => v >= thr ? 'C' : 'V');
  for(let i = 1; i < lab.length - 1; i++){
    if(lab[i] === 'V' && lab[i - 1] === 'C' && lab[i + 1] === 'C') lab[i] = 'C';
    else if(lab[i] === 'C' && lab[i - 1] !== 'C' && lab[i + 1] !== 'C') lab[i] = 'V';
  }
  const blocks = [];
  lab.forEach((l, i) => { const b = blocks[blocks.length - 1]; if(b && b.l === l) b.cues.push(cues[i]); else blocks.push({l, cues: [cues[i]]}); });
  const secs = [{start: 0, label: 'INTRO'}];
  blocks.forEach((b, k) => {
    if(b.l === 'C'){ secs.push({start: b.cues[0].start, label: 'CHORUS', cues: b.cues}); return; }
    if(b.cues.length >= 4){
      const h = Math.ceil(b.cues.length/2);
      secs.push({start: b.cues[0].start, label: 'A-MELO', cues: b.cues.slice(0, h)});
      secs.push({start: b.cues[h].start, label: 'B-MELO', cues: b.cues.slice(h)});
    } else secs.push({start: b.cues[0].start, label: blocks[k + 1]?.l === 'C' && k > 0 ? 'B-MELO' : 'A-MELO', cues: b.cues});
  });
  for(const s of secs) for(const c of s.cues || []) c.sec = s;
  // 長間奏另立段落
  for(let i = 1; i < cues.length; i++) if(cues[i].start - cues[i - 1].end > 3){
    secs.push({start: cues[i - 1].end, label: 'INTERLUDE'});
    if(cues[i].sec.start < cues[i].start) secs.push({start: cues[i].start, label: cues[i].sec.label});
  }
  secs.push({start: cues[cues.length - 1].end, label: 'OUTRO'});
  secs.sort((a, b) => a.start - b.start).forEach((s, i) => s.no = i + 1);
  return secs;
}
const sectionAt = t => { let r = sections[0]; for(const s of sections){ if(s.start <= t) r = s; else break; } return r; };

function buildShots(){
  const out = [], snap = t => A.beat0 + Math.round((t - A.beat0)/A.spb)*A.spb;
  const add = (type, start, end, o = {}) => { if(end - start > .05) out.push({type, start, end, seed: out.length + 1, ...o}); };
  const n = {film: 0, typo: 0, stage: 0, windows: 0, verse: 0};
  const first = cues[0], last = cues[cues.length - 1];
  const outroStart = Math.min(last.end, A.dur - 7);
  if(first.start > 1.2) add('stage', 0, first.start, {variant: 'intro'});
  cues.forEach((c, i) => {
    const next = cues[i + 1];
    const end = Math.min(next ? Math.min(c.end, next.start) : c.end, outroStart);
    if(end <= c.start) return;
    const label = c.sec?.label || 'A-MELO';
    let type = label === 'CHORUS' ? 'stage' : label === 'B-MELO' ? 'typo' : (Math.floor(n.verse++/2) % 2 ? 'windows' : 'film');
    const parts = Math.max(1, Math.round((end - c.start)/6.5));
    for(let p = 0; p < parts; p++){
      const s = p ? snap(c.start + (end - c.start)*p/parts) : c.start;
      const e = p < parts - 1 ? snap(c.start + (end - c.start)*(p + 1)/parts) : end;
      const k = n[type]++;
      const o = {cue: c};
      if(type === 'stage') o.variant = ['wide', 'close', 'screen', 'close2'][k % 4];
      if(type === 'typo'){ o.member = k % 2 ? OTHERS[(k >> 1) % OTHERS.length] : 0; o.side = k % 2; }
      if(type === 'film'){ const nf = FACES.length, a = Math.floor(hash(k*3 + 1)*nf); o.faceA = FACES[a]; o.faceB = FACES[(a + 1 + Math.floor(hash(k*5 + 2)*(nf - 2))) % nf]; o.zoomIn = k % 2 === 0; }
      if(type === 'windows'){ o.members = [0, OTHERS[(k*2) % OTHERS.length], OTHERS[(k*2 + 1) % OTHERS.length]]; o.layout = k % 2; }
      add(type, s, e, o);
    }
    if(next && next.start - c.end > 1 && c.end < outroStart) add('stage', c.end, Math.min(next.start, outroStart), {variant: 'break'});
  });
  add('outro', outroStart, A.dur);
  return out;
}
function shotAt(t){
  let lo = 0, hi = shots.length - 1;
  while(lo < hi){ const m = (lo + hi + 1) >> 1; if(shots[m].start <= t) lo = m; else hi = m - 1; }
  return shots[lo];
}

/* ---------------- 預先繪製的素材 ---------------- */
function prepare(cover){
  const art = mk(AW, AH); art.getContext('2d').drawImage(cover, ART.crop[0], ART.crop[1], AW, AH, 0, 0, AW, AH);
  const blurred = (scale, px) => { const c = mk(Math.round(AW*scale), Math.round(AH*scale)), x = c.getContext('2d'); x.filter = `blur(${px}px)`; x.drawImage(art, -AW*scale*.05, -AH*scale*.05, AW*scale*1.1, AH*scale*1.1); return c; };
  C.art = art; C.bloom = blurred(.5, 5); C.blur = blurred(.6, 16);
  const sky = mk(W, H), sx = sky.getContext('2d'), gr = sx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, T.sky[0]); gr.addColorStop(.55, T.sky[1]); gr.addColorStop(1, T.sky[2]);
  sx.fillStyle = gr; sx.fillRect(0, 0, W, H); C.sky = sky;
  const pastel = mk(W, H), px = pastel.getContext('2d'), pg = px.createLinearGradient(0, 0, W, H);
  pg.addColorStop(0, T.pastel[0]); pg.addColorStop(1, T.pastel[1]); px.fillStyle = pg; px.fillRect(0, 0, W, H);
  px.fillStyle = 'rgba(80,90,140,.10)';
  for(let y = 20; y < H; y += 36) for(let x = 20 + (y/36 % 2)*18; x < W; x += 36){ px.beginPath(); px.arc(x, y, 2.2, 0, Math.PI*2); px.fill(); }
  C.pastel = pastel;
  const vig = mk(W, H), vx = vig.getContext('2d'), vg = vx.createRadialGradient(W/2, H/2, H*.35, W/2, H/2, H*1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); vx.fillStyle = vg; vx.fillRect(0, 0, W, H); C.vig = vig;
  const noise = mk(256, 256), nx = noise.getContext('2d'), id = nx.createImageData(256, 256);
  for(let i = 0; i < id.data.length; i += 4){ const v = hash(i*.37)*255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  nx.putImageData(id, 0, 0); C.noise = g.createPattern(noise, 'repeat');
  const beam = mk(360, 1300), bx = beam.getContext('2d'), bg = bx.createLinearGradient(0, 0, 0, 1300);
  bg.addColorStop(0, 'rgba(255,255,255,.9)'); bg.addColorStop(.6, 'rgba(255,255,255,.18)'); bg.addColorStop(1, 'rgba(255,255,255,0)');
  bx.fillStyle = bg; bx.beginPath(); bx.moveTo(165, 0); bx.lineTo(195, 0); bx.lineTo(360, 1300); bx.lineTo(0, 1300); bx.closePath(); bx.filter = 'blur(6px)'; bx.fill();
  C.beam = beam;
  const floor = mk(W, 420), fx = floor.getContext('2d'), fg = fx.createLinearGradient(0, 0, 0, 420);
  fg.addColorStop(0, 'rgba(10,8,30,.55)'); fg.addColorStop(1, 'rgba(4,4,14,.96)'); fx.fillStyle = fg; fx.fillRect(0, 0, W, 420);
  fx.strokeStyle = 'rgba(255,255,255,.08)'; fx.lineWidth = 2;
  for(let i = -14; i <= 14; i++){ fx.beginPath(); fx.moveTo(W/2 + i*40, 0); fx.lineTo(W/2 + i*260, 420); fx.stroke(); }
  for(let k = 1; k < 9; k++){ const y = 420*Math.pow(k/9, 1.7); fx.beginPath(); fx.moveTo(0, y); fx.lineTo(W, y); fx.stroke(); }
  C.floor = floor;
  C.glow = {};
}
function glowSprite(color){
  if(C.glow[color]) return C.glow[color];
  const c = mk(128, 128), x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(.18, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return C.glow[color] = c;
}
const glow = (x, y, r, color, a = 1) => { g.globalAlpha = a; g.drawImage(glowSprite(color), x - r, y - r, r*2, r*2); g.globalAlpha = 1; };

/* ---------------- 共用畫面元件 ---------------- */
function backdrop(t, o = {}){
  g.drawImage(C.sky, 0, 0);
  const s = 1.22 + .04*Math.sin(t*.07), w = W*s, h = w*AH/AW;
  g.globalAlpha = o.art ?? .5;
  g.drawImage(C.blur, (W - w)/2 + Math.sin(t*.05)*50, (H - h)/2 + Math.cos(t*.04)*40, w, h);
  g.globalAlpha = o.tint ?? .5; g.drawImage(C.sky, 0, 0); g.globalAlpha = 1;
  if(o.dim){ g.fillStyle = `rgba(0,0,0,${o.dim})`; g.fillRect(0, 0, W, H); }
}
function particles(t, n, layer = 0, kind = T.particle){
  g.save();
  for(let i = 0; i < n; i++){
    const h1 = hash(i + layer*97), h2 = hash(i*3.1 + 7 + layer), h3 = hash(i*7.7 + 1), h4 = hash(i*1.3 + 5);
    if(kind === 'star'){
      const tw = .5 + .5*Math.sin(t*(1 + h3*3) + h4*6), x = h1*W, y = h2*H*.8, r = 3 + h3*7;
      g.globalCompositeOperation = 'lighter';
      glow(x, y, r*3, h4 > .7 ? T.accent : '#cfe3ff', .25 + .6*tw);
      if(h3 > .8){ g.strokeStyle = `rgba(255,255,255,${.5*tw})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - r*2.5, y); g.lineTo(x + r*2.5, y); g.moveTo(x, y - r*2.5); g.lineTo(x, y + r*2.5); g.stroke(); }
    } else if(kind === 'spark'){
      const life = 5 + h3*5, age = frac(t/life + h1), x = h2*W + Math.sin(t*.6 + i)*30, y = H*(1.05 - age*1.25);
      g.globalCompositeOperation = 'lighter';
      glow(x, y, 6 + h4*16, h4 > .5 ? T.accent : T.accent2, Math.sin(age*Math.PI)*.8);
    } else {
      const life = 7 + h3*6, age = frac(t/life + h1), x = h2*W*1.2 - age*320 + Math.sin(t*1.3 + i)*25, y = -60 + age*(H + 120);
      g.globalCompositeOperation = 'source-over';
      g.save(); g.translate(x, y); g.rotate(t*(h4 - .5)*3 + i); g.scale(1, .45 + .4*Math.abs(Math.sin(t*2 + i)));
      g.globalAlpha = .85*Math.sin(age*Math.PI); g.fillStyle = h4 > .35 ? T.accent : T.accent2;
      g.beginPath(); g.ellipse(0, 0, 9 + h3*9, 5 + h3*4, 0, 0, Math.PI*2); g.fill(); g.restore();
    }
  }
  g.restore();
}
// 二次元風格：四角星閃光與集中線
let sparkleFade = 1;
function sparkle(x, y, r, color, a = 1, rot = 0){
  a *= sparkleFade;
  if(a <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a;
  g.globalCompositeOperation = 'lighter'; glow(0, 0, r*1.6, color, a*.6); g.globalCompositeOperation = 'source-over';
  g.globalAlpha = a; g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(0, -r);
  for(let k = 0; k < 4; k++){ const a0 = k*Math.PI/2; g.quadraticCurveTo(0, 0, Math.sin(a0 + Math.PI/2)*r, -Math.cos(a0 + Math.PI/2)*r); }
  g.closePath(); g.fill(); g.restore();
}
function sparkles(t, n, layer = 0, area = [0, 0, W, H]){
  for(let i = 0; i < n; i++){
    const h1 = hash(i*6.1 + layer*13), h2 = hash(i*2.3 + layer*7 + 1), h3 = hash(i*4.7 + 3), per = 1.6 + h3*2.2;
    const ph = frac(t/per + h1), a = Math.sin(ph*Math.PI);
    sparkle(area[0] + h2*area[2], area[1] + h1*area[3], (10 + h3*22)*(.6 + .4*a), [T.accent, T.cool, '#ffffff', T.accent2][i % 4], a*.95, ph*.8);
  }
}
function focusLines(t, a, cx = W/2, cy = H/2, inner = 360, color = '255,255,255'){
  if(a <= 0) return;
  const seed = Math.floor(t*12);
  g.save(); g.fillStyle = `rgba(${color},${.55*a})`;
  for(let i = 0; i < 90; i++){
    const h1 = hash(i*3.3 + seed*.71), h2 = hash(i*7.9 + seed*.37);
    const ang = (i + h1*.8)/90*Math.PI*2, w = .004 + h2*.01, r0 = inner*(1 + h1*.5), r1 = 1500;
    g.beginPath();
    g.moveTo(cx + Math.cos(ang - w)*r1, cy + Math.sin(ang - w)*r1);
    g.lineTo(cx + Math.cos(ang)*r0, cy + Math.sin(ang)*r0);
    g.lineTo(cx + Math.cos(ang + w)*r1, cy + Math.sin(ang + w)*r1);
    g.closePath(); g.fill();
  }
  g.restore();
}
function bokeh(t, n, layer = 0){
  g.save(); g.globalCompositeOperation = 'lighter';
  for(let i = 0; i < n; i++){
    const h1 = hash(i*9.1 + layer), h2 = hash(i*4.3 + 2 + layer), h3 = hash(i*2.9 + 4);
    glow(frac(h1 + t*.006*(h3 + .2))*W*1.2 - W*.1, h2*H + Math.sin(t*.3 + i)*30, 60 + h3*110, [T.accent, T.cool, T.accent2][i % 3], .09 + .06*Math.sin(t*.5 + i));
  }
  g.restore();
}
function confetti(t, n, amount = 1){
  for(let i = 0; i < n; i++){
    const h1 = hash(i*5.3 + 11), h2 = hash(i*8.1 + 3), h3 = hash(i*2.2 + 9), life = 3.5 + h3*2.5, age = frac(t/life + h1);
    const x = h2*W + Math.sin(t*2 + i)*40, y = -40 + age*(H + 80);
    g.save(); g.translate(x, y); g.rotate(t*(2 + h3*4) + i); g.scale(1, Math.cos(t*(3 + h1*4) + i));
    g.globalAlpha = amount*Math.min(1, (1 - age)*4); g.fillStyle = POP[i % POP.length];
    g.fillRect(-7, -4, 14, 8); g.restore();
  }
  g.globalAlpha = 1;
}
function artView(x, y, w, h, fa, fb, z0, z1, u, t, focusY = .42){
  const z = lerp(z0, z1, smooth(u)), f = [lerp(fa[0], fb[0], smooth(u)), lerp(fa[1], fb[1], smooth(u))];
  const sc = Math.max(w/AW, h/AH)*z*(1 + .01*pulse(t)), sw = w/sc, sh = h/sc;
  const sx = clamp(f[0] - sw/2, 0, AW - sw), sy = clamp(f[1] - sh*focusY, 0, AH - sh);
  g.drawImage(C.art, sx, sy, sw, sh, x, y, w, h);
  const k = C.bloom.width/AW;
  g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = .28;
  g.drawImage(C.bloom, sx*k + C.bloom.width*.05/1.1, sy*k + C.bloom.height*.05/1.1, sw*k/1.1, sh*k/1.1, x, y, w, h);
  g.restore();
}
function roundRect(x, y, w, h, r){ g.beginPath(); g.roundRect(x, y, w, h, r); }

/* 舞者：沿用 dance-sprites.js 的網格變形，依拍點切換舞步 */
function danceState(i, t, o = {}){
  const b = beatPos(t), en = energy(t)*(o.e ?? 1);
  const move = (Math.floor(b/8) + (o.alt ? i % 2 : 0)) % 4;
  const p = b - (move === 2 ? i*.25 : 0), fr = frac(p);
  let wave, hop;
  if(move === 0){ wave = Math.sin(Math.PI*p); hop = Math.abs(Math.sin(Math.PI*p))*14; }
  else if(move === 1){ wave = Math.sin(Math.PI*p/2); hop = Math.abs(Math.sin(Math.PI*p))*8; }
  else if(move === 2){ wave = 1.15*Math.sin(Math.PI*p); hop = Math.abs(Math.sin(Math.PI*p))*24; }
  else { wave = (Math.floor(p) % 2 ? 1 : -1)*(.55 + .45*Math.cos(Math.PI*fr)); hop = Math.pow(1 - fr, 2)*18; }
  return {wave, energy: en, hop: hop*en, squash: Math.max(0, 1 - fr*6)*.035*en, tilt: .05*Math.sin(Math.PI*p/2), mouth: o.mouth || 0, lead: !!o.lead};
}
// 去背角色的舞動：腳踩地、上半身分條側彎，加上跳躍、壓縮與傾斜（2D 切圖動畫）
function drawDancer(i, x, y, h, st){
  const m = MEMBERS[i]; if(!m?.img) return;
  const img = m.img, iw = img.width, ih = img.height, k = h/ih, w = iw*k;
  const hop = st.hop*h/420, sq = st.squash*4;
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, 0, w*.32*(1 - Math.min(.35, hop/h*3)), h*.02, 0, 0, Math.PI*2); g.fill();
  g.translate(0, -hop); g.rotate(st.tilt*.6); g.scale(1 + sq*.5, 1 - sq);
  const strips = 28, sway = st.wave*st.energy*h*.035, breathe = 1 + .012*Math.sin(beatPos(T0)*Math.PI);
  for(let s = 0; s < strips; s++){
    const v0 = s/strips, v1 = (s + 1)/strips, v = (v0 + v1)/2;
    const bend = sway*Math.pow(1 - v, 1.7), sy = v0*ih, sh = (v1 - v0)*ih + 1;
    const sx = v < .62 ? breathe : 1;
    g.drawImage(img, 0, sy, iw, Math.min(sh, ih - sy), -w*sx/2 + bend, -h + v0*h, w*sx, (v1 - v0)*h + 1);
  }
  g.restore();
}
let T0 = 0;

/* 文字排版：依寬度斷行，必要時縮小字級 */
const layoutCache = new Map();
function layout(units, font, size, maxW, maxRows = 2, minSize = 30){
  const key = units.map(u => u.t).join('') + font + size + maxW + maxRows;
  if(layoutCache.has(key)) return layoutCache.get(key);
  let s = size, rows;
  for(;;){
    rows = [[]]; let x = 0, lastSp = -1;
    const items = units.map(u => { g.font = font(u.bk ? s*.72 : s); return {u, w: u.sp ? s*.38 : g.measureText(u.t).width}; });
    for(const it of items){
      const row = rows[rows.length - 1];
      if(x + it.w > maxW && row.length){
        const cut = lastSp >= 0 ? lastSp + 1 : row.length;
        const moved = row.splice(cut);
        while(row.length && row[row.length - 1].u.sp) row.pop();
        rows.push(moved); x = moved.reduce((a, m) => a + m.w, 0); lastSp = -1;
      }
      const r = rows[rows.length - 1];
      if(it.u.sp && !r.length) continue;
      if(it.u.sp) lastSp = r.length;
      r.push(it); x += it.w;
    }
    if(rows.length <= maxRows || s <= minSize) break;
    s *= .9;
  }
  const res = {size: s, rows: rows.filter(r => r.length).map(r => { let x = 0; for(const it of r){ it.x = x; x += it.w; } return {items: r, w: x}; })};
  layoutCache.set(key, res);
  return res;
}
const jpFont = s => `600 ${s}px ${FONT.jp}`;
const zhFont = s => `600 ${s}px ${FONT.zh}`;

function fitFont(text, fontFn, size, maxW){
  g.font = fontFn(size); const w = g.measureText(text).width;
  return w > maxW ? size*maxW/w : size;
}
// 卡拉OK 歌詞：白字深邊，已唱部分以主題色漸層填滿
function karaokeCue(c, t, o, alpha = 1, dy = 0){
  if(alpha <= 0) return;
  const L = layout(c.ju, jpFont, o.size, o.maxW, 2), s = L.size, rowH = s*1.5;
  const sung = prog(c, t)*c.jW;
  const y0 = o.y - (L.rows.length - 1)*rowH + dy;
  const appear = t - c.start + .25;
  g.save(); g.lineJoin = 'round'; g.textBaseline = 'alphabetic';
  let k = 0;
  L.rows.forEach((row, ri) => {
    const rx = o.cx - row.w/2, ry = y0 + ri*rowH;
    for(const it of row.items){
      const u = it.u; k++;
      if(u.sp) continue;
      const e = easeOut((appear - k*.015)/.3);
      const a = alpha*e; if(a <= 0) continue;
      const fs = u.bk ? s*.72 : s, x = rx + it.x, y = ry + (1 - e)*s*.3;
      g.globalAlpha = a; g.font = jpFont(fs);
      g.lineWidth = fs*.17; g.strokeStyle = 'rgba(12,10,32,.8)'; g.strokeText(u.t, x, y);
      g.fillStyle = u.bk ? '#cfe8ff' : '#ffffff'; g.fillText(u.t, x, y);
      const f = clamp((sung - u.cw)/u.w);
      if(f > 0){
        g.save(); g.beginPath(); g.rect(x - 4, y - fs*1.6, (it.w + 8)*f, fs*2); g.clip();
        const gr = g.createLinearGradient(0, y - fs, 0, y);
        gr.addColorStop(0, u.bk ? T.cool : T.accent); gr.addColorStop(1, u.bk ? '#ffffff' : T.accent2);
        g.fillStyle = gr; g.fillText(u.t, x, y); g.restore();
      }
      if(u.ruby){
        const rs = fs*.36; g.font = jpFont(rs);
        const rw = g.measureText(u.ruby).width, rxx = x + it.w/2 - rw/2, ryy = y - fs*.92;
        g.lineWidth = rs*.25; g.strokeText(u.ruby, rxx, ryy);
        g.fillStyle = f > .5 ? T.accent : '#ffffff'; g.fillText(u.ruby, rxx, ryy);
      }
    }
  });
  if(c.zh && o.zhSize){
    const zs = fitFont(c.zh, zhFont, o.zhSize, o.maxW*1.05);
    g.font = zhFont(zs); const zw = g.measureText(c.zh).width, zx = o.cx - zw/2, zy = y0 + (L.rows.length - 1)*rowH + s*.55 + zs*1.15;
    g.globalAlpha = alpha*easeOut((appear - .15)/.4);
    g.lineWidth = zs*.18; g.strokeStyle = 'rgba(12,10,32,.75)'; g.strokeText(c.zh, zx, zy);
    g.fillStyle = 'rgba(255,255,255,.72)'; g.fillText(c.zh, zx, zy);
    g.save(); g.beginPath(); g.rect(zx - 2, zy - zs*1.2, (zw + 4)*prog(c, t), zs*1.6); g.clip(); g.fillStyle = '#ffffff'; g.fillText(c.zh, zx, zy); g.restore();
  }
  g.restore();
}
function karaoke(t, o){
  const c = activeCue(t); if(!c) return;
  const i = cues.indexOf(c), prev = cues[i - 1];
  if(prev && t < c.start + .35 && t >= prev.end - .1){ const u = clamp((t - Math.max(prev.end - .1, c.start - .25))/.35); karaokeCue(prev, t, o, 1 - u, -u*o.size*.8); }
  const fadeOut = clamp((t - c.end)/.35);
  karaokeCue(c, t, o, 1 - fadeOut, -fadeOut*o.size*.5);
}
function lyricShade(y0, a = .6){
  const gr = g.createLinearGradient(0, y0, 0, H);
  gr.addColorStop(0, 'rgba(6,6,20,0)'); gr.addColorStop(.55, `rgba(6,6,20,${a})`); gr.addColorStop(1, `rgba(6,6,20,${a})`);
  g.fillStyle = gr; g.fillRect(0, y0, W, H - y0);
}

/* 立體貼紙字：白色粗外框＋深色立體側邊＋主題色填色（參考泡泡字標題） */
function stickerText(str, cx, cy, size, colors, t0, t, o = {}){
  const chars = [...str], fnt = o.font || (s => `${s}px ${FONT.maru}`);
  g.save(); g.font = fnt(size); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const ws = chars.map(ch => g.measureText(ch).width*(o.track ?? .96));
  const total = ws.reduce((a, b) => a + b, 0);
  let x = cx - total/2;
  const pos = chars.map((ch, i) => { const p = {ch, x: x + ws[i]/2, i}; x += ws[i]; return p; });
  const depth = size*.08;
  const st = p => {
    const e = easeBack((t - t0 - p.i*.06)/.5), a = clamp((t - t0 - p.i*.06)/.15);
    const bob = Math.sin(t*3 + p.i*.8)*size*.025*(o.bob ?? 1);
    return {e, a, y: cy + (1 - e)*size*.6 + bob, r: (hash(p.i*3 + str.length) - .5)*.16};
  };
  for(const pass of [0, 1, 2, 3]){
    for(const p of pos){
      if(p.ch === ' ') continue;
      const s = st(p); if(s.a <= 0) continue;
      const col = colors[p.i % colors.length];
      g.save(); g.globalAlpha = s.a*(o.alpha ?? 1); g.translate(p.x, s.y); g.rotate(s.r); g.scale(s.e, s.e);
      if(pass === 0){ g.lineWidth = size*.3; g.strokeStyle = o.shadow || 'rgba(40,20,60,.35)'; g.strokeText(p.ch, depth*.6, depth*1.6); }
      if(pass === 1){ g.lineWidth = size*.3; g.strokeStyle = '#ffffff'; g.strokeText(p.ch, 0, 0); }
      if(pass === 2){ g.lineWidth = size*.07; g.strokeStyle = shade(col, -.45); g.fillStyle = shade(col, -.45); g.strokeText(p.ch, 0, depth); g.fillText(p.ch, 0, depth); }
      if(pass === 3){ g.lineWidth = size*.06; g.strokeStyle = col; g.fillStyle = col; g.strokeText(p.ch, 0, 0); g.fillText(p.ch, 0, 0);
        g.globalAlpha *= .35; g.fillStyle = '#ffffff'; g.save(); g.beginPath(); g.rect(-size, -size, size*2, size*.62); g.clip(); g.fillText(p.ch, 0, 0); g.restore(); }
      g.restore();
    }
  }
  g.restore();
}
function shade(hex, k){
  const n = parseInt(hex.slice(1), 16), f = c => Math.round(k < 0 ? c*(1 + k) : c + (255 - c)*k);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function logo(cx, cy, size, t0, t, alpha = 1){
  g.save(); g.font = `italic 800 ${size}px ${FONT.logo}`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.lineJoin = 'round';
  const ws = LOGO.map(([c]) => c === ' ' ? size*.28 : g.measureText(c).width*.94), total = ws.reduce((a, b) => a + b, 0);
  let x = cx - total/2;
  LOGO.forEach(([c, col], i) => {
    const w = ws[i], e = easeBack((t - t0 - i*.07)/.45), a = clamp((t - t0 - i*.07)/.12)*alpha;
    if(c !== ' ' && a > 0){
      g.save(); g.globalAlpha = a; g.translate(x + w/2, cy + (1 - e)*size*.5); g.transform(1, 0, -.12, 1, 0, 0);
      g.lineWidth = size*.16; g.strokeStyle = '#ffffff'; g.strokeText(c, 0, 0);
      g.fillStyle = col; g.fillText(c, 0, 0); g.restore();
    }
    x += w;
  });
  g.restore();
}

/* ---------------- 鏡頭 ---------------- */
// 膠卷：左為日文、右為中文，一格一字隨演唱捲動（參考膠卷歌詞 PV）
function tapePos(t, kind){
  const c = lastStarted(t);
  if(!c) return -3 + 3*smooth(t/Math.max(.5, cues[0].start));
  const off = kind === 'jp' ? c.jo : c.zo, n = kind === 'jp' ? c.jn : c.zn;
  return off + easeOut((t - c.start)/.4) + prog(c, t)*n;
}
function strip(x, w, tape, pos, t, kind){
  const fh = 190, cy = H/2;
  g.fillStyle = 'rgba(8,8,14,.9)'; g.fillRect(x, 0, w, H);
  g.fillStyle = 'rgba(236,232,222,.85)';
  const off = frac(pos*fh/44)*44;
  for(let y = -44 - off + 10; y < H + 44; y += 44){ roundRect(x + 8, y, 16, 24, 4); g.fill(); roundRect(x + w - 24, y, 16, 24, 4); g.fill(); }
  const k0 = Math.floor(pos - cy/fh) - 2, k1 = Math.ceil(pos + cy/fh) + 2;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for(let k = k0; k <= k1; k++){
    const item = tape[k]; if(!item) continue;
    const y = cy + (k + .5 - pos)*fh, fx = x + 36, fw = w - 72, fy = y - fh/2 + 12, fhh = fh - 24;
    const d = pos - k, active = d >= 0 && d < 1;
    g.fillStyle = active ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.55)'; g.fillRect(fx, fy, fw, fhh);
    g.strokeStyle = active ? T.accent : 'rgba(255,255,255,.3)'; g.lineWidth = active ? 3 : 1.5; g.strokeRect(fx, fy, fw, fhh);
    g.font = `10px ${FONT.mono}`; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillText(`${kind === 'jp' ? 'J' : 'Z'}${pad(k, 3)}`, fx + 22, fy + 10);
    if(item.sep){
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(x + w/2, y, 40, 0, Math.PI*2); g.stroke();
      g.font = `300 44px ${FONT.mincho}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(item.sep, x + w/2, y + 2);
      continue;
    }
    let fs = item.latin || item.t.length > 1 ? Math.min(64, (fw - 20)/Math.max(1, item.t.length*.55)) : 104;
    if(item.bk) fs *= .78;
    g.font = item.latin ? `italic 600 ${fs}px ${FONT.cond}` : kind === 'jp' ? `600 ${fs}px ${FONT.mincho}` : `500 ${fs}px ${FONT.zh}`;
    if(active){
      const pop = 1 + .12*Math.exp(-d*5);
      g.save(); g.translate(x + w/2, y); g.scale(pop, pop);
      g.shadowColor = T.accent; g.shadowBlur = 28; g.fillStyle = item.bk ? T.cool : T.accent; g.fillText(item.t, 0, 4); g.restore();
    } else {
      g.fillStyle = d >= 1 ? (item.bk ? 'rgba(180,215,255,.9)' : 'rgba(255,255,255,.92)') : 'rgba(255,255,255,.22)';
      g.fillText(item.t, x + w/2, y + 4);
    }
  }
  const sg = g.createLinearGradient(0, 0, 0, H);
  sg.addColorStop(0, 'rgba(0,0,0,.85)'); sg.addColorStop(.18, 'rgba(0,0,0,0)'); sg.addColorStop(.82, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.85)');
  g.fillStyle = sg; g.fillRect(x, 0, w, H);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
function shotFilm(t, sh, u){
  backdrop(t, {dim: .5});
  bokeh(t, 8, 1);
  const px = 540, pw = 840;
  artView(px, 0, pw, H, sh.faceA, sh.faceB, sh.zoomIn ? 1.05 : 1.4, sh.zoomIn ? 1.4 : 1.05, u, t);
  for(const [x0, dir] of [[px, 1], [px + pw, -1]]){
    const gr = g.createLinearGradient(x0, 0, x0 + dir*90, 0); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(dir > 0 ? x0 : x0 - 90, 0, 90, H);
  }
  g.save(); g.globalCompositeOperation = 'lighter'; particles(t, 24, 2); g.restore();
  sparkles(t, 8, 2, [px, 0, pw, 760]);
  strip(270, 230, TJ, tapePos(t, 'jp'), t, 'jp');
  strip(1420, 230, TZ, tapePos(t, 'zh'), t, 'zh');
  g.save(); g.beginPath(); g.rect(px, 0, pw, H); g.clip();
  lyricShade(780, .55);
  karaoke(t, {cx: 960, y: 960, size: 48, maxW: 760, zhSize: 28});
  g.restore();
}
// 大字動態排版：成員特寫＋逐字蹦出
function shotTypo(t, sh, u){
  backdrop(t, {dim: .3, art: .35});
  const c = sh.cue, left = sh.side === 0;
  // 斜向色帶與大號段落數字
  g.save(); g.globalAlpha = .14;
  for(let i = 0; i < 3; i++){
    g.fillStyle = [T.accent, T.accent2, T.cool][i];
    const x = ((t*60 + i*700) % (W + 1200)) - 600;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 220, 0); g.lineTo(x - 260, H); g.lineTo(x - 480, H); g.closePath(); g.fill();
  }
  g.restore();
  g.save(); g.font = `800 520px ${FONT.logo}`; g.textAlign = left ? 'right' : 'left'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.1)';
  g.strokeText(pad(c.i + 1), left ? W - 40 : 40, H - 80); g.restore();
  // 背景漂浮的直排殘影字（參考星空散字）
  g.save(); g.font = `500 54px ${FONT.mincho}`; g.textAlign = 'center';
  for(let i = 0; i < 18; i++){
    const it = TJ[(c.jo + 3 + i*5) % TJ.length]; if(!it || it.sep || it.latin) continue;
    const x = hash(i*4.1 + c.i)*W, y = frac(hash(i*7.3) - t*.012*(1 + hash(i)))*H*1.2 - H*.1;
    g.fillStyle = `rgba(255,255,255,${.08 + .1*hash(i*2.7)})`; g.fillText(it.t, x, y);
  }
  g.restore();
  particles(t, 30, 3);
  focusLines(t, .35*(1 - clamp((t - c.start)/.8)) + .12*pulse(t)*energy(t), left ? 1270 : 650, H*.45, 520);
  sparkles(t, 10, 9 + c.i, [left ? 800 : 160, 140, 940, 700]);
  const mx = left ? 470 : W - 470, m = sh.member;
  g.save(); g.globalCompositeOperation = 'lighter'; glow(mx, 520, 560, MEMBERS[m].color, .45); g.restore();
  const enter = easeOut((t - sh.start)/.5);
  drawDancer(m, mx + (left ? -1 : 1)*(1 - enter)*200, 110 + 1350, 1350, danceState(m, t, {e: .6}));
  // 成員名牌
  g.save(); g.globalAlpha = enter; g.font = `700 30px ${FONT.jp}`;
  const tag = `${MEMBERS[m].name}`, tx = left ? 70 : W - 70 - g.measureText(tag).width - 40;
  roundRect(tx, H - 150, g.measureText(tag).width + 40, 52, 26); g.fillStyle = MEMBERS[m].color; g.fill();
  g.fillStyle = '#fff'; g.fillText(tag, tx + 20, H - 113); g.restore();
  // 逐字蹦出
  const cx = left ? 1270 : 650, maxW = 980;
  const L = layout(c.ju, jpFont, 150, maxW, 3, 60), s = L.size, rowH = s*1.45;
  const sung = prog(c, t)*c.jW;
  const y0 = H*.45 - (L.rows.length - 1)*rowH/2;
  g.save(); g.lineJoin = 'round'; g.textBaseline = 'middle';
  let k = 0;
  L.rows.forEach((row, ri) => {
    const rx = cx - row.w/2, ry = y0 + ri*rowH;
    for(const it of row.items){
      const un = it.u; k++;
      if(un.sp) continue;
      const fs = un.bk ? s*.72 : s, x = rx + it.x + it.w/2, an = clamp((sung - un.cw + .35)/1.1);
      g.font = jpFont(fs); g.textAlign = 'center';
      if(an <= 0){ g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.18)'; g.strokeText(un.t, x, ry); continue; }
      const sc = lerp(1.9, 1, easeBack(an)), rot = (hash(k*3.3 + c.i) - .5)*.35*(1 - easeOut(an));
      g.save(); g.translate(x, ry); g.rotate(rot); g.scale(sc, sc); g.globalAlpha = clamp(an*3);
      g.fillStyle = un.bk ? T.cool : T.accent2; g.fillText(un.t, fs*.05, fs*.06);
      g.lineWidth = fs*.08; g.strokeStyle = 'rgba(10,10,30,.6)'; g.strokeText(un.t, 0, 0);
      g.fillStyle = an < 1 ? T.accent : '#ffffff'; g.fillText(un.t, 0, 0);
      if(un.ruby){ g.font = jpFont(fs*.32); g.fillStyle = T.accent; g.fillText(un.ruby, 0, -fs*.72); }
      g.restore();
    }
  });
  if(c.zh){
    const zy = y0 + (L.rows.length - 1)*rowH + s*.75 + 40, zs = fitFont(c.zh, zhFont, 46, maxW);
    g.globalAlpha = easeOut((t - c.start - .2)/.5); g.font = zhFont(zs); g.textAlign = 'center';
    const zw = g.measureText(c.zh).width;
    g.fillStyle = T.accent; g.fillRect(cx - zw/2 - 30, zy - 4, 12, 12);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText(c.zh, cx + 6, zy);
  }
  g.restore();
}
// 視窗特寫：成員在彈出的應用程式視窗裡跳舞，歌詞打進搜尋列（參考桌寵 PV）
const WIN_LAYOUTS = [
  [[560, 360, 640, 470, -.03], [1340, 330, 640, 470, .025], [960, 470, 700, 500, -.01]],
  [[520, 420, 620, 460, .03], [1000, 330, 660, 480, -.02], [1440, 450, 620, 460, .02]]
];
function shotWindows(t, sh, u){
  g.drawImage(C.pastel, 0, 0);
  g.save(); g.globalAlpha = .5; bokeh(t, 6, 4); g.restore();
  for(let i = 0; i < 14; i++){
    const x = hash(i*3.7 + 1)*W, y = hash(i*5.9 + 2)*H*.85, tw = .5 + .5*Math.sin(t*2 + i), col = [T.accent2, T.cool, T.accent][i % 3];
    g.save(); g.translate(x, y); g.rotate(t*.3 + i); g.globalAlpha = .45 + .5*tw; g.fillStyle = col;
    const r = 8 + 10*tw; g.beginPath(); g.moveTo(0, -r);
    for(let k = 0; k < 4; k++){ const a0 = (k + 1)*Math.PI/2; g.quadraticCurveTo(0, 0, Math.sin(a0)*r, -Math.cos(a0)*r); }
    g.fill(); g.restore();
  }
  WIN_LAYOUTS[sh.layout].forEach(([cx, cy, w, h, rot], i) => {
    const m = sh.members[i], mem = MEMBERS[m], ap = easeBack((t - sh.start - i*.12)/.45);
    if(ap <= 0) return;
    g.save(); g.translate(cx, cy + Math.sin(t*1.4 + i*2)*8); g.rotate(rot); g.scale(ap, ap);
    const x = -w/2, y = -h/2, bar = 54;
    roundRect(x + 12, y + 16, w, h, 18); g.fillStyle = 'rgba(40,30,80,.18)'; g.fill();
    roundRect(x, y, w, h, 18); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 5; g.strokeStyle = T.deep; g.stroke();
    g.save(); roundRect(x, y, w, h, 18); g.clip();
    g.fillStyle = mem.color; g.fillRect(x, y, w, bar);
    const cg = g.createLinearGradient(0, y + bar, 0, y + h); cg.addColorStop(0, shade(mem.color, .82)); cg.addColorStop(1, shade(mem.color, .55));
    g.fillStyle = cg; g.fillRect(x, y + bar, w, h - bar);
    g.save(); g.beginPath(); g.rect(x, y + bar, w, h - bar); g.clip();
    g.globalCompositeOperation = 'lighter'; glow(0, y + bar + 150, 260, '#ffffff', .5); g.globalCompositeOperation = 'source-over';
    drawDancer(m, 0, y + bar + 30 + 1000, 1000, danceState(m, t, {e: .8, alt: true}));
    g.restore();
    g.fillStyle = T.deep; g.fillRect(x, y + bar - 3, w, 3);
    g.restore();
    g.font = `800 26px ${FONT.jp}`; g.fillStyle = '#ffffff'; g.textBaseline = 'middle';
    g.beginPath(); g.arc(x + 30, y + bar/2, 13, 0, Math.PI*2); g.fill();
    g.fillStyle = mem.color; g.beginPath(); g.arc(x + 30, y + bar/2, 6, 0, Math.PI*2); g.fill();
    g.fillStyle = '#ffffff'; g.fillText(`${mem.name}.pv`, x + 54, y + bar/2 + 1);
    g.font = `700 15px ${FONT.cond}`; g.letterSpacing = '4px'; g.textAlign = 'right';
    g.fillText(`MEMBER ${pad(m + 1)}`, x + w - 120, y + bar/2 + 1); g.letterSpacing = '0px'; g.textAlign = 'left';
    for(let b = 0; b < 3; b++){ g.beginPath(); g.arc(x + w - 84 + b*28, y + bar/2, 10, 0, Math.PI*2); g.lineWidth = 3; g.strokeStyle = T.deep; g.fillStyle = '#ffffff'; g.fill(); g.stroke(); }
    g.restore();
  });
  // 搜尋列歌詞
  const c = activeCue(t);
  const bw = 1360, bh = 104, bx = W/2 - bw/2, by = 880;
  const ap = easeBack((t - sh.start - .25)/.45);
  g.save(); g.translate(W/2, by + bh/2); g.scale(ap, ap); g.translate(-W/2, -(by + bh/2));
  roundRect(bx + 8, by + 10, bw, bh, bh/2); g.fillStyle = 'rgba(40,30,80,.2)'; g.fill();
  roundRect(bx, by, bw, bh, bh/2); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 6; g.strokeStyle = T.deep; g.stroke();
  g.beginPath(); g.arc(bx + bh/2 + 4, by + bh/2, 36, 0, Math.PI*2); g.fillStyle = T.accent2; g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(bx + bh/2, by + bh/2 - 4, 13, 0, Math.PI*2); g.stroke();
  g.beginPath(); g.moveTo(bx + bh/2 + 9, by + bh/2 + 5); g.lineTo(bx + bh/2 + 19, by + bh/2 + 15); g.stroke();
  roundRect(bx + bw - 180, by + 20, 150, 64, 14); g.lineWidth = 4; g.strokeStyle = T.deep; g.stroke();
  g.font = `800 26px ${FONT.cond}`; g.fillStyle = T.deep; g.textBaseline = 'middle'; g.letterSpacing = '2px'; g.fillText('ENTER ↵', bx + bw - 160, by + 53); g.letterSpacing = '0px';
  if(c){
    const sung = prog(c, t)*c.jW, text = c.ju.filter(un => un.cw < sung + .2).map(un => un.t).join('');
    const fs = fitFont(c.jp.replace(/[(（][^)）]*[)）]/g, ''), jpFont, 50, bw - 340);
    g.font = jpFont(fs); g.fillStyle = T.deep; g.fillText(text, bx + bh + 30, by + bh/2 + 2);
    const tw = g.measureText(text).width;
    if(frac(t*2) < .6){ g.fillStyle = T.accent2; g.fillRect(bx + bh + 36 + tw, by + 26, 5, bh - 52); }
    if(c.zh){
      const zs = fitFont(c.zh, zhFont, 32, 1100); g.font = zhFont(zs); g.letterSpacing = '2px';
      const zw = g.measureText(c.zh).width + 70, zx = W/2 - zw/2, zy = by - 82;
      g.globalAlpha = easeOut((t - c.start)/.4);
      roundRect(zx, zy, zw, 58, 29); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 4; g.strokeStyle = T.deep; g.stroke();
      g.beginPath(); g.arc(zx + 30, zy + 29, 9, 0, Math.PI*2); g.fillStyle = T.accent2; g.fill();
      g.fillStyle = T.deep; g.fillText(c.zh, zx + 52, zy + 30); g.letterSpacing = '0px';
    }
  } else {
    g.font = jpFont(40); g.fillStyle = 'rgba(40,40,80,.35)'; g.fillText('♪ ・・・', bx + bh + 30, by + bh/2 + 2);
  }
  g.restore();
}
// 舞台：LED 大螢幕播放封面，六人在聚光燈下跳舞
function shotStage(t, sh, u){
  const close = sh.variant === 'close' || sh.variant === 'close2', screen = sh.variant === 'screen';
  g.save();
  if(close){ const z = lerp(1.5, 1.62, u), fx = sh.variant === 'close2' ? 760 : 960; g.translate(fx, 640); g.scale(z, z); g.translate(-fx, -640); }
  else if(screen){ const z = lerp(1.32, 1.18, smooth(u)); g.translate(960, 330); g.scale(z, z); g.translate(-960, -330); }
  else { const z = lerp(1, 1.05, u); g.translate(960, 560); g.scale(z, z); g.translate(-960, -560); }
  backdrop(t, {dim: .45, art: .35});
  const b = beatPos(t), pl = pulse(t), en = energy(t);
  // LED 螢幕
  const sx = 410, sy = 60, sw = 1100, shh = 540;
  g.save(); g.shadowColor = T.accent2; g.shadowBlur = 40; roundRect(sx - 14, sy - 14, sw + 28, shh + 28, 16); g.fillStyle = '#0a0a16'; g.fill(); g.restore();
  g.save(); g.beginPath(); g.rect(sx, sy, sw, shh); g.clip();
  const fi = Math.floor(hash(sh.seed*1.7)*FACES.length);
  artView(sx, sy, sw, shh, [AW/2, FACES[0][1]], FACES[fi % FACES.length], 1, 1.25, u, t, .35);
  const sheen = g.createLinearGradient(sx, sy, sx + sw, sy + shh);
  sheen.addColorStop(0, 'rgba(255,255,255,.16)'); sheen.addColorStop(.45, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,.06)');
  g.fillStyle = sheen; g.fillRect(sx, sy, sw, shh);
  g.globalAlpha = .1*pl; g.fillStyle = '#fff'; g.fillRect(sx, sy, sw, shh); g.globalAlpha = 1;
  g.restore();
  // 兩側燈柱
  for(const lx of [250, 1670]){
    for(let r = 0; r < 12; r++){
      const on = (Math.floor(b) + r + (lx > 900 ? 2 : 0)) % 4 === 0;
      g.globalCompositeOperation = 'lighter';
      glow(lx, 100 + r*48, on ? 30 : 14, r % 2 ? T.accent : T.cool, on ? .9 : .3);
      g.globalCompositeOperation = 'source-over';
    }
  }
  // 地板
  g.drawImage(C.floor, 0, 700);
  g.fillStyle = T.accent; g.globalAlpha = .55 + .4*pl; g.fillRect(0, 698, W, 4); g.globalAlpha = 1;
  // 聚光燈
  g.save(); g.globalCompositeOperation = 'lighter';
  for(let i = 0; i < 6; i++){
    const bx0 = 200 + i*304, ang = .38*Math.sin(b*Math.PI/4 + i*1.1) + (i < 3 ? .12 : -.12);
    g.save(); g.translate(bx0, -40); g.rotate(ang); g.globalAlpha = .1 + .14*pl*en;
    g.drawImage(C.beam, -180, 0); g.restore();
  }
  g.restore();
  if(sh.variant === 'break' || sh.variant === 'intro'){
    for(let i = 0; i < 48; i++){
      const lvl = clamp(sample(A.low, t)*.6 + sample(A.mid, t - i*.01)*.5*(.5 + hash(i + Math.floor(t*8)*.01)), .05, 1.2);
      g.fillStyle = POP[i % POP.length]; g.globalAlpha = .45;
      g.fillRect(40 + i*39.5, 700 - lvl*120, 28, lvl*120);
    }
    g.globalAlpha = 1;
  }
  // 舞者：後排三人、前排兩人加中央主唱
  const O = OTHERS, spots = O.length >= 5
    ? [[.31, 790, 400, O[0]], [.5, 775, 390, O[1]], [.69, 790, 400, O[2]], [.17, 935, 480, O[3]], [.83, 935, 480, O[4]], [.5, 985, 560, 0]]
    : [[.34, 790, 400, O[0]], [.66, 790, 400, O[1]], [.15, 935, 480, O[2]], [.85, 935, 480, O[3]], [.5, 985, 560, 0]];
  const intro = sh.variant === 'intro' ? clamp((t - .5)/1.5) : 1;
  spots.forEach(([fx, y, h, m], k) => {
    if(close && O.length >= 5 && k === 1) return;  // 特寫時後排中央被主唱擋住，不畫以免頭部從主唱後方冒出
    const delay = k*.08, st = danceState(m, t, {alt: true, e: m === 0 ? 1 : .9});
    g.save(); g.globalAlpha = easeOut((intro - delay)/.5 + (intro >= 1 ? 1 : 0));
    g.globalCompositeOperation = 'lighter'; glow(fx*W, y - h*.5, h*.7, MEMBERS[m].color, .18 + .2*pl); g.globalCompositeOperation = 'source-over';
    drawDancer(m, fx*W, y, h, st);
    g.restore();
  });
  if(sh.cue?.sec?.label === 'CHORUS' || sh.variant === 'break') confetti(t, 70, sh.variant === 'break' ? .7 : 1);
  sparkles(t, 16, 8, [0, 40, W, 700]);
  const secStart = sh.cue?.sec?.label === 'CHORUS' ? sh.cue.sec.start : -99;
  focusLines(t, (1 - clamp((t - secStart)/1.4))*.9, W/2, 560, 420);
  g.save(); g.globalCompositeOperation = 'lighter'; particles(t, 30, 5); g.restore();
  g.restore();
  if(sh.variant === 'break'){
    g.save(); g.font = `italic 800 150px ${FONT.logo}`; g.textAlign = 'center'; g.lineWidth = 3;
    g.strokeStyle = `rgba(255,255,255,${.35 + .3*pl})`; g.letterSpacing = '18px'; g.strokeText('DANCE BREAK', W/2, 540); g.restore();
  }
  lyricShade(760, .7);
  karaoke(t, {cx: W/2, y: 985, size: 66, maxW: 1560, zhSize: 36});
}
// 尾聲：封面拍立得＋LOGO，最後淡出
function shotOutro(t, sh, u){
  backdrop(t, {dim: .25});
  bokeh(t, 12, 6);
  particles(t, 40, 7);
  const lt = t - sh.start, cw = 980, ch = cw*AH/AW, rot = -.025 + Math.sin(t*.5)*.01;
  const e = easeBack(lt/.9);
  g.save(); g.translate(W/2, 470 + (1 - e)*200 + Math.sin(t*.8)*6); g.rotate(rot); g.scale(.85 + .15*e, .85 + .15*e); g.globalAlpha = clamp(lt/.4);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-cw/2 - 4, -ch/2 + 4, cw + 36, ch + 36);
  g.fillStyle = '#fff'; g.fillRect(-cw/2 - 18, -ch/2 - 18, cw + 36, ch + 36);
  g.drawImage(C.art, -cw/2, -ch/2, cw, ch);
  g.restore();
  sparkles(t, 14, 11);
  logo(W/2, 900, 150, sh.start + .6, t);
  g.save(); g.globalAlpha = clamp((lt - 1.4)/.6); g.textAlign = 'center';
  g.font = `600 34px ${FONT.jp}`; g.fillStyle = '#fff'; g.fillText(`${song.title}  ／  ${song.ver}`, W/2, 1010);
  g.restore();
  karaoke(t, {cx: W/2, y: 120, size: 52, maxW: 1500, zhSize: 30});
}
const SHOTS = {film: shotFilm, typo: shotTypo, windows: shotWindows, stage: shotStage, outro: shotOutro};

/* ---------------- 覆蓋層：片頭標題、轉場、HUD ---------------- */
function titleCard(t){
  const end = clamp(cues[0].start - .2, 4, 8);
  if(t > end + .7) return;
  const out = clamp((t - end)/.7), a = 1 - out;
  g.save();
  g.fillStyle = `rgba(8,6,24,${.45*a})`; g.fillRect(0, 0, W, H);
  g.globalAlpha = a; g.translate(0, -out*60);
  g.textAlign = 'center'; g.font = `600 24px ${FONT.cond}`; g.letterSpacing = '8px'; g.fillStyle = 'rgba(255,255,255,.85)';
  g.globalAlpha = a*clamp((t - .3)/.6); g.fillText('EXH KANAGAWA TOURNAMENT 2048 · TOP-4 TEAM COMPILATION ALBUM', W/2, 250); g.letterSpacing = '0px';
  g.globalAlpha = a;
  sparkleFade = a; sparkles(t, 12, 12, [200, 180, 1520, 700]); sparkleFade = 1;
  logo(W/2, 360, 120, .5, t);
  const size = Math.min(200, 1600/[...song.title].length/.96);
  stickerText(song.title, W/2, 590, size, POP, 1.1, t);
  const pa = easeBack((t - 1.9)/.5);
  if(pa > 0){
    g.font = `800 34px ${FONT.jp}`; g.letterSpacing = '6px';
    const label = `♪  ${song.ver}`, w = g.measureText(label).width + 80;
    g.save(); g.translate(W/2, 790); g.scale(pa, pa);
    roundRect(-w/2 + 6, -38, w, 76, 38); g.fillStyle = 'rgba(30,20,60,.35)'; g.fill();
    roundRect(-w/2, -44, w, 76, 38); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 5; g.strokeStyle = T.deep; g.stroke();
    g.fillStyle = T.deep; g.textBaseline = 'middle'; g.fillText(label, 0, -5); g.restore();
    g.letterSpacing = '0px';
  }
  g.restore();
}
function transition(t){
  for(const sh of shots){
    if(!sh.start) continue;
    const d = t - sh.start; if(d < -.22 || d > .22) continue;
    const prev = shots[shots.indexOf(sh) - 1];
    if(prev && prev.type === sh.type && sh.type !== 'stage'){ if(d > 0){ g.fillStyle = `rgba(255,255,255,${.35*(1 - d/.22)})`; g.fillRect(0, 0, W, H); } return; }
    const u = (d + .22)/.44, cols = [LOGO[0][1], LOGO[2][1], LOGO[1][1], LOGO[6][1]];
    g.save();
    cols.forEach((col, i) => {
      const x = lerp(-1100, W + 500, smooth(u - i*.04)) + i*150;
      g.fillStyle = col; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 260, 0); g.lineTo(x - 140, H); g.lineTo(x - 400, H); g.closePath(); g.fill();
    });
    if(d > 0 && sh.type === 'stage'){ g.fillStyle = `rgba(255,255,255,${.5*(1 - d/.22)})`; g.fillRect(0, 0, W, H); }
    g.restore();
    return;
  }
}
function hud(t, sh){
  const dark = sh.type === 'windows';
  const ink = dark ? 'rgba(20,20,60,.75)' : 'rgba(255,255,255,.82)';
  g.save(); g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 2; g.textBaseline = 'alphabetic';
  for(const [x, y, dx, dy] of [[34, 34, 1, 1], [W - 34, 34, -1, 1], [34, H - 34, 1, -1], [W - 34, H - 34, -1, -1]]){
    g.beginPath(); g.moveTo(x, y + dy*26); g.lineTo(x, y); g.lineTo(x + dx*26, y); g.stroke();
  }
  const sec = sectionAt(t), b = beatPos(t), bar = Math.max(1, Math.floor((b - A.barOff)/4) + 1), total = Math.floor((beatPos(A.dur) - A.barOff)/4) + 1;
  g.font = `600 22px ${FONT.cond}`; g.letterSpacing = '3px';
  g.fillText(`BEST 4U  /  ${song.title}`, 60, 70);
  g.font = `15px ${FONT.mono}`; g.letterSpacing = '1px';
  g.fillText(`SEC.${pad(sec.no)}  ${sec.label}`, 60, 96);
  g.textAlign = 'right';
  const f = Math.floor(t*FPS), tc = `${pad(Math.floor(t/3600))}:${pad(Math.floor(t/60) % 60)}:${pad(Math.floor(t) % 60)}:${pad(f % FPS)}`;
  g.font = `18px ${FONT.mono}`; g.fillText(tc, W - 60, 70);
  g.font = `15px ${FONT.mono}`; g.fillText(`BAR ${pad(bar, 3)} / ${pad(total, 3)}`, W - 60, 96);
  g.textAlign = 'left';
  g.fillText(`♩=${A.bpm.toFixed(1)}`, 60, H - 62);
  [['LO', A.low], ['MI', A.mid], ['AL', A.rms]].forEach(([n, arr], i) => {
    const v = clamp(sample(arr, t)/1.1);
    g.fillText(n, 160 + i*96, H - 62); g.globalAlpha = .3; g.fillRect(186 + i*96, H - 72, 50, 8); g.globalAlpha = 1; g.fillRect(186 + i*96, H - 72, 50*v, 8);
  });
  const beatInBar = ((Math.floor(b - A.barOff) % 4) + 4) % 4;
  for(let i = 0; i < 4; i++){ g.globalAlpha = i === beatInBar ? 1 : .3; g.beginPath(); g.arc(W - 150 + i*26, H - 68, 7, 0, Math.PI*2); g.fill(); }
  g.globalAlpha = 1;
  g.fillStyle = dark ? 'rgba(20,20,60,.2)' : 'rgba(255,255,255,.2)'; g.fillRect(60, H - 44, W - 120, 3);
  g.fillStyle = T.accent; g.fillRect(60, H - 44, (W - 120)*clamp(t/A.dur), 3);
  g.letterSpacing = '0px';
  g.restore();
}

function render(t){
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.letterSpacing = '0px'; g.shadowBlur = 0;
  T0 = t;
  const sh = shotAt(t), u = clamp((t - sh.start)/(sh.end - sh.start));
  const z = 1 + (sh.type === 'stage' ? .016 : .006)*pulse(t)*energy(t);
  g.save(); g.translate(W/2, H/2); g.scale(z, z); g.translate(-W/2, -H/2);
  SHOTS[sh.type](t, sh, u);
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  titleCard(t);
  transition(t);
  g.drawImage(C.vig, 0, 0);
  g.save(); g.globalAlpha = .045; g.translate(-Math.floor(hash(Math.floor(t*FPS))*256), -Math.floor(hash(Math.floor(t*FPS) + .5)*256));
  g.fillStyle = C.noise; g.fillRect(0, 0, W + 256, H + 256); g.restore();
  hud(t, sh);
  const fade = Math.max(1 - clamp(t/.8), clamp((t - (A.dur - 2.5))/2.4));
  if(fade > 0){ g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
}

/* ---------------- 載入、預覽與逐格輸出 ---------------- */
const msg = s => { $('#msg').textContent = s; };
function post(path, body){ return fetch(`/__pv/${path}?job=${encodeURIComponent(JOB)}`, {method: 'POST', body}); }
window.addEventListener('error', e => { if(RENDER) post('error', String(e.message || e)); });
window.addEventListener('unhandledrejection', e => { if(RENDER) post('error', String(e.reason?.stack || e.reason)); });

async function init(){
  if(RENDER) document.body.classList.add('render');
  const sel = $('#song');
  SONGS.forEach((s, i) => sel.add(new Option(`${s.title}（${s.ver}）`, i, false, s === song)));
  sel.onchange = () => { location.search = `?song=${sel.value}`; };
  msg('載入音訊與素材…');
  const loadImg = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('找不到 ' + src)); im.src = src; });
  const get = async (name, kind) => { const r = await fetch(encodeURIComponent(name)); if(!r.ok) throw new Error('找不到 ' + name); return r[kind](); };
  const [cover, srt, buf] = await Promise.all([loadImg(ART.src), get(song.subs, 'text'), get(song.audio, 'arrayBuffer')]);
  await Promise.all([jpFont(40), zhFont(40), `300 40px ${FONT.mincho}`, `40px ${FONT.maru}`, `italic 800 40px ${FONT.logo}`, `600 40px ${FONT.cond}`]
    .map(f => document.fonts.load(f, 'あ漢字ABC')));
  const castJson = await fetch('assets/ref/cast/cast.json').then(r => { if(!r.ok) throw new Error('找不到角色切圖，請先執行 node tools/cutout.mjs'); return r.json(); });
  await Promise.all(MEMBERS.map(async m => { m.meta = castJson[m.sheet][m.idx]; m.img = await loadImg('assets/ref/cast/' + m.meta.file); }));
  msg('分析節拍…');
  A = await analyse(buf);
  cues = parseSrt(srt);
  if(!cues.length) throw new Error('字幕是空的');
  cues.forEach((c, i) => {
    c.i = i; c.ju = tokenize(c.jp); c.zu = tokenize(c.zh || '');
    c.jW = c.ju.reduce((a, u) => a + u.w, 0) || 1;
    const tj = tapeUnits(c.ju), tz = tapeUnits(c.zu);
    c.jo = TJ.length; TJ.push({sep: i + 1}, ...tj); c.jn = tj.length;
    c.zo = TZ.length; TZ.push({sep: i + 1}, ...tz); c.zn = tz.length;
  });
  sections = buildSections();
  shots = buildShots();
  prepare(cover);
  console.log(`BPM ${A.bpm.toFixed(2)} 拍點 ${A.beat0.toFixed(3)}s 段落`, sections.map(s => `${s.label}@${s.start.toFixed(1)}`).join(' '));
  msg('');
  if(RENDER) return renderAll();
  preview();
}
async function renderAll(){
  const from = +(params.get('from') || 0), to = Math.min(A.dur, +(params.get('to') || A.dur));
  const f0 = Math.round(from*FPS), f1 = Math.round(to*FPS);
  await post('meta', JSON.stringify({title: song.title, ver: song.ver, audio: song.audio, file: song.file, frames: f1 - f0, from, to, fps: FPS, bpm: A.bpm,
    shots: shots.map(s => `${s.type}${s.variant ? ':' + s.variant : ''}@${s.start.toFixed(2)}`).join(' ')}));
  for(let f = f0; f < f1; f++){
    render(f/FPS);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .92));
    const r = await post('frame', blob);
    if(!r.ok) throw new Error('輸出中斷');
  }
  await post('done', '');
}
function preview(){
  const audio = new Audio(encodeURIComponent(song.audio));
  const play = $('#play'), seek = $('#seek'), time = $('#time');
  const fmt = s => `${Math.floor(s/60)}:${pad(Math.floor(s % 60))}`;
  play.disabled = false; play.textContent = '▶ 播放';
  play.onclick = () => audio.paused ? audio.play() : audio.pause();
  audio.onplay = () => { play.textContent = '❚❚ 暫停'; };
  audio.onpause = () => { play.textContent = '▶ 播放'; };
  seek.oninput = () => { audio.currentTime = seek.value/1000*A.dur; };
  const start = +(params.get('t') || 0); if(start) audio.currentTime = start;
  addEventListener('keydown', e => { if(e.code === 'Space' && e.target === document.body){ e.preventDefault(); play.click(); } });
  let idle = 0; addEventListener('pointermove', () => { idle = performance.now(); $('#ui').classList.remove('idle'); });
  const loop = () => {
    const t = audio.currentTime || start;
    if(!window.PV.hold) render(Math.min(t, A.dur - 1/FPS));
    if(document.activeElement !== seek) seek.value = Math.round(t/A.dur*1000);
    time.textContent = `${fmt(t)} / ${fmt(A.dur)}`;
    $('#ui').classList.toggle('idle', !audio.paused && performance.now() - idle > 2500);
    requestAnimationFrame(loop);
  };
  loop();
}
window.PV = {hold: false, render: t => { window.PV.hold = true; render(t); }, get shots(){ return shots; }, get analysis(){ return A; }, get sections(){ return sections; }};
init().catch(e => { console.error(e); msg('錯誤：' + e.message); if(RENDER) post('error', String(e.stack || e)); });
})();

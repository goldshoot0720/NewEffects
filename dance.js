/* 載歌載舞：六位參考人物／Q 版舞者，主唱以音量驅動嘴型開合。 */
(() => {
const cv = document.getElementById('dance'), g = cv.getContext('2d');
let CW = 0, CH = 0;
new ResizeObserver(() => {
  const r = stage.getBoundingClientRect(), d = devicePixelRatio || 1;
  CW = r.width; CH = r.height; cv.width = CW*d; cv.height = CH*d; g.setTransform(d, 0, 0, d, 0, 0);
}).observe(stage);

const SKIN = '#ffe4d4', MOUTH = '#b8324a';
const MEMBERS = [
  {hair: '#8a704d', costume: '#4fcf93', accent: '#e2ffec', eye: '#3a7bd5', style: 'ponytail'},
  {hair: '#6b4535', costume: '#ff6fae', accent: '#ffd6ea', eye: '#8a4fd6', style: 'twintail'},
  {hair: '#a8703f', costume: '#46b0ff', accent: '#d9f1ff', eye: '#3a7bd5', style: 'bob'},
  {hair: '#6b4535', costume: '#f3bc47', accent: '#fff1a8', eye: '#2e8b57', style: 'long'},
  {hair: '#35284f', costume: '#8a6cff', accent: '#e9e0ff', eye: '#2f9bd8', style: 'long'},
  {hair: '#f1cf72', costume: '#58c2d5', accent: '#d9faff', eye: '#2e8b57', style: 'long'}
];
MEMBERS.forEach((m,index) => { m.index=index; m.blinkAt = 1 + Math.random()*3; m.blinkT = 0; });

/* ---------- 音訊分析（MP3 模式） ---------- */
let ac = null, an = null, freq = null;
function ensureAudio(){
  if(ac || !(window.AudioContext || window.webkitAudioContext)) return;
  try{
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaElementSource(vid);
    an = ac.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = .5;
    src.connect(an); an.connect(ac.destination);
    freq = new Uint8Array(an.frequencyBinCount);
  }catch(e){ console.warn('無法分析音訊，改用固定節拍', e); ac = null; an = null; }
}
vid.addEventListener('play', () => { ensureAudio(); if(ac && ac.state === 'suspended') ac.resume(); });

let clock = 0, beatBase = 0, sinceBeat = 0, interval = .5, intervals = [], lastBeatClock = -9;
let env = 0, bassAvg = 0, level = .5, vocal = 0, noteAcc = 0;
let previousSong = null, previousTime = 0, lastStatus = '', info = {};
const phase = () => beatBase + sinceBeat/interval;
function onBeat(){
  const iv = clock - lastBeatClock;
  if(iv > .28 && iv < 1.2){
    intervals.push(iv); if(intervals.length > 12) intervals.shift();
    const s = [...intervals].sort((a, b) => a - b); interval = s[s.length >> 1];
  }
  beatBase = Math.round(phase()); sinceBeat = 0; lastBeatClock = clock; env = 1;
}
function analyse(dt, playing, singing){
  env = Math.max(0, env - dt*3.2);
  if(!playing){ vocal *= .8; return; }
  clock += dt; sinceBeat += dt;
  if(an && media.kind === 'file' && ac.state === 'running'){
    an.getByteFrequencyData(freq);
    let b = 0; for(let i = 1; i <= 5; i++) b += freq[i]; b /= 5*255;
    let v = 0; for(let i = 7; i <= 70; i++) v += freq[i]; v /= 64*255;
    bassAvg += (b - bassAvg)*Math.min(1, dt*2.5);
    if(b > bassAvg*1.12 + .03 && b > .3 && clock - lastBeatClock > .28) onBeat();
    level += ((b + v)/2 - level)*Math.min(1, dt*5);
    vocal += (v - vocal)*Math.min(1, dt*18);
  } else {
    // YouTube 模式拿不到音訊，用固定 120 BPM 模擬
    interval = .5;
    if(sinceBeat >= interval) onBeat();
    level = .55;
    vocal = singing ? .3 + .25*Math.abs(Math.sin(clock*11)) * Math.abs(Math.sin(clock*3.1)) : 0;
  }
}

/* ---------- 舞步：每 8 拍換一組 ---------- */
const S = p => Math.sin(Math.PI*p), AS = p => Math.abs(Math.sin(Math.PI*p));
const MOVES = [
  p => ({la: 2.5 + .4*S(p), ra: 2.5 - .4*S(p), tilt: .06*S(p), hop: 1}),                          // 雙手舉高揮動
  p => ({la: -.9 + .7*AS(p), ra: -.9 + .7*AS(p), tilt: 0, hop: .7, happy: AS(p) < .25}),           // 拍手
  p => ({la: .5 + .25*S(p/2), ra: .5 - .25*S(p/2), tilt: .13*S(p/2), hop: .4}),                    // 左右搖擺
  p => (Math.floor(p) % 2 ? {la: 2.9, ra: .35, tilt: -.06, hop: 1} : {la: .35, ra: 2.9, tilt: .06, hop: 1}), // 輪流指天
  p => ({la: 2.2 + .3*AS(p), ra: 2.2 + .3*AS(p), tilt: 0, hop: Math.floor(p) % 2 ? 1.7 : .5, happy: true}), // V 字跳
  p => ({la: .95, ra: .95, tilt: .1*S(p), hop: .6})                                                // 叉腰
];

/* ---------- 繪圖 ---------- */
function limb(x, y, side, a, len, w, col){
  const ex = x + side*Math.sin(a)*len, ey = y + Math.cos(a)*len;
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
  return [ex, ey];
}
function ellipse(x, y, rx, ry, col, rot = 0){ g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI*2); g.fill(); }
function bow(x, y, sz, col, edge){
  g.fillStyle = col; g.strokeStyle = edge; g.lineWidth = .35;
  for(const d of [-1, 1]){ g.beginPath(); g.moveTo(x, y); g.lineTo(x + d*sz, y - sz*.6); g.lineTo(x + d*sz, y + sz*.6); g.closePath(); g.fill(); g.stroke(); }
  ellipse(x, y, sz*.3, sz*.3, edge);
}

function drawDancer(m, x, y, s, st){
  if(prefs.danceStyle === 'anime' && window.SpriteDancers?.ready){
    const fit=Math.min(1, CW/CH/2.05);
    SpriteDancers.draw(g,m.index,x,y,CH*(st.mic ? .53 : .43)*fit,{
      wave:st.armWave,energy:st.energy,hop:st.hopY*CH/155,
      tilt:st.tilt,squash:st.squash*.45,mouth:st.mouth,lead:st.mic
    });
    return st;
  }
  const sw = st.sway;
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(0, 0, 8.5*s*(1 - Math.min(.4, st.hopY/25)), 2*s, 0, 0, Math.PI*2); g.fill();
  g.translate(0, -st.hopY*s);
  g.scale(s*(1 + st.squash*.6), s*(1 - st.squash));
  g.rotate(st.tilt);

  // 後方長髮
  if(m.style === 'long'){ g.fillStyle = m.hair; g.beginPath(); g.roundRect(-10.2, -33, 20.4, 19 + st.hopY*.05, [9, 9, 4, 4]); g.fill(); }
  // 腿
  for(const d of [-1, 1]){
    const kx = d*(2.2 + st.squash*6);
    limb(kx, -9, d, .05, 8.6, 2.3, SKIN);
    limb(kx + d*.25, -4, d, .05, 3.6, 2.5, '#ffffff');
    ellipse(kx + d*.6, -.3, 1.9, 1, m.costume);
  }
  // 裙子
  const fl = st.flare;
  g.fillStyle = m.costume;
  g.beginPath(); g.moveTo(-4, -16); g.lineTo(4, -16); g.lineTo(7.2 + fl, -8.4);
  g.quadraticCurveTo(0, -6.6, -7.2 - fl, -8.4); g.closePath(); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = .9;
  g.beginPath(); g.moveTo(7.2 + fl, -8.4); g.quadraticCurveTo(0, -6.6, -7.2 - fl, -8.4); g.stroke();
  // 上衣
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(-3.9, -21.6, 7.8, 6.2, 1.6); g.fill();
  bow(0, -20.4, 1.7, m.accent, m.costume);
  // 手臂
  const hands = [];
  for(const d of [-1, 1]){
    const a = d < 0 ? st.la : st.ra;
    const h = limb(d*4.1, -20.1, d, a, 7.4, 1.9, SKIN);
    ellipse(h[0], h[1], 1.25, 1.25, SKIN);
    ellipse(d*4.2, -20.3, 1.9, 1.7, m.costume);
    hands.push(h);
  }
  // 頭髮（側邊）
  g.fillStyle = m.hair;
  if(m.style === 'twintail') for(const d of [-1, 1]) ellipse(d*10.6, -26 + Math.abs(sw)*.5, 3.2, 8, m.hair, d*(.28 + sw*.25));
  if(m.style === 'ponytail') ellipse(10.2, -31.5, 2.8, 7, m.hair, .95 + sw*.35);
  g.beginPath(); g.arc(0, -29, 9.9, 0, Math.PI*2); g.fill();
  if(m.style === 'bob'){ g.beginPath(); g.roundRect(-10.2, -30, 20.4, 8.5, [0, 0, 4, 4]); g.fill(); }
  // 臉
  ellipse(0, -28.3, 9, 8.8, SKIN);
  // 瀏海
  g.fillStyle = m.hair;
  g.beginPath(); g.arc(0, -29, 10, Math.PI*1.02, Math.PI*1.98);
  g.lineTo(8.6, -30.5); g.lineTo(6, -29.4); g.lineTo(4, -31.6); g.lineTo(1.2, -30.2);
  g.lineTo(-1.6, -31.8); g.lineTo(-4.2, -29.6); g.lineTo(-6.4, -31.2); g.lineTo(-8.6, -30.2); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = .7;
  g.beginPath(); g.arc(-1, -30.5, 7.5, Math.PI*1.2, Math.PI*1.45); g.stroke();
  // 眼睛
  for(const d of [-1, 1]){
    const ex = d*3.3, ey = -26.8;
    if(st.happy){ g.strokeStyle = '#3a2430'; g.lineWidth = .7; g.beginPath(); g.arc(ex, ey + .6, 1.4, Math.PI*1.15, Math.PI*1.85); g.stroke(); }
    else if(st.blink){ g.strokeStyle = '#3a2430'; g.lineWidth = .6; g.beginPath(); g.moveTo(ex - 1.4, ey); g.quadraticCurveTo(ex, ey + .7, ex + 1.4, ey); g.stroke(); }
    else {
      ellipse(ex, ey, 1.45, 1.95, '#2a1c2e');
      ellipse(ex, ey + .25, 1.15, 1.55, m.eye);
      ellipse(ex, ey + .5, .6, .8, '#1d1426');
      ellipse(ex - .45, ey - .75, .5, .5, '#fff');
    }
  }
  ellipse(-5.6, -24.4, 1.6, .85, 'rgba(255,120,150,.45)');
  ellipse(5.6, -24.4, 1.6, .85, 'rgba(255,120,150,.45)');
  // 嘴巴
  if(st.mouth > .08){
    ellipse(0, -23.3, 1 + .45*st.mouth, .3 + 1.45*st.mouth, MOUTH);
    if(st.mouth > .35) ellipse(0, -23.3 + .9*st.mouth, .7, .45*st.mouth, '#ff8fa3');
  } else {
    g.strokeStyle = MOUTH; g.lineWidth = .55;
    g.beginPath(); g.arc(0, -24.3, 1.2, Math.PI*.2, Math.PI*.8); g.stroke();
  }
  // 髮飾
  bow(-6.6, -36.2, 1.6, m.accent, m.costume);
  // 麥克風（主唱）
  if(st.mic){
    const [hx, hy] = hands[1], dx = 0 - hx, dy = -23.3 - hy, rot = Math.atan2(dx, -dy);
    g.save(); g.translate(hx, hy); g.rotate(rot);
    g.fillStyle = '#2b2b33'; g.beginPath(); g.roundRect(-.55, -2.6, 1.1, 4.2, .4); g.fill();
    ellipse(0, -3.3, 1.15, 1.15, '#d9dbe3');
    g.restore();
  }
  g.restore();
  return st;
}

function drawLights(){
  const bg=g.createLinearGradient(0,0,0,CH);
  bg.addColorStop(0,'rgba(15,18,42,.76)');bg.addColorStop(.65,'rgba(29,16,44,.86)');bg.addColorStop(1,'rgba(10,9,26,.98)');
  g.fillStyle=bg;g.fillRect(0,0,CW,CH);
  const floor=g.createLinearGradient(0,CH*.58,0,CH);
  floor.addColorStop(0,'rgba(143,100,206,.18)');floor.addColorStop(1,'rgba(23,15,38,0)');
  g.fillStyle=floor;g.beginPath();g.ellipse(CW/2,CH*.77,CW*.7,CH*.2,0,0,Math.PI*2);g.fill();
  const hues = [330, 200, 48, 280];
  g.globalCompositeOperation = 'lighter';
  hues.forEach((h, k) => {
    const ox = CW*(.12 + .25*k), a = Math.sin(clock*.7 + k*1.7)*.35, L = CH*.82;
    const tx = ox + Math.tan(a)*L, sp = CW*.07;
    const grd = g.createLinearGradient(ox, 0, tx, L);
    grd.addColorStop(0, `hsla(${h} 100% 70% / ${.2 + env*.18})`);
    grd.addColorStop(1, `hsla(${h} 100% 70% / 0)`);
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(ox - 4, -5); g.lineTo(ox + 4, -5); g.lineTo(tx + sp, L); g.lineTo(tx - sp, L); g.closePath(); g.fill();
  });
  g.globalCompositeOperation = 'source-over';
  for(let i=0;i<24;i++){
    const x=CW*(i+.5)/24, yy=CH*.57;
    g.fillStyle=`hsla(${200+i*7} 95% 75% / ${.22+env*.5})`;
    g.beginPath();g.roundRect(x-CW*.012,yy,CW*.024,CH*.014,CH*.005);g.fill();
  }
  const fy = CH*.63, grd = g.createRadialGradient(CW/2, fy, 0, CW/2, fy, CW*.45);
  grd.addColorStop(0, `rgba(255,140,200,${.22 + env*.2})`); grd.addColorStop(1, 'rgba(255,140,200,0)');
  g.fillStyle = grd; g.beginPath(); g.ellipse(CW/2, fy, CW*.45, CH*.09, 0, 0, Math.PI*2); g.fill();
}

const art = () => document.querySelector('#cover .art');
function frame(dt, playing){
  if(!prefs.dance || !CW){ return; }
  const raw=media.time();
  if(curSong!==previousSong || Math.abs(raw-previousTime)>1.5){
    clock=raw;interval=.5;intervals=[];beatBase=Math.floor(raw/interval);sinceBeat=raw%interval;
    lastBeatClock=raw-.5;bassAvg=0;vocal=0;env=0;noteAcc=0;
    previousSong=curSong;
  }
  previousTime=raw;
  const singing = timed.length ? !!(curLine && curLine.text) : playing;
  analyse(dt, playing, singing);
  g.clearRect(0, 0, CW, CH);
  drawLights();
  const a = art(); if(a) a.style.transform = `scale(${1 + env*.025})`;

  const song = typeof cfgOf === 'function' && curSong ? cfgOf(curSong) : {};
  const lead = prefs.danceLead === 'auto' ? (song.lead || 0) : Math.max(0,Math.min(5,+prefs.danceLead || 0));
  const order = [1, 2, 3, 4, 5].map(k => (lead + k) % 6);
  const p = phase(), moveFn = MOVES[Math.floor(p/8) % MOVES.length];
  const strength=+prefs.danceEnergy || 1;
  const amp = playing ? (1.6 + 2.6*clamp(level, 0, 1))*strength : 0;
  const breath = Math.sin(performance.now()/600)*.3;
  const unit = CH/38;

  // 眨眼
  for(const m of MEMBERS){
    m.blinkAt -= dt;
    if(m.blinkAt <= 0){ m.blinkT = .13; m.blinkAt = 2 + Math.random()*3.5; }
    m.blinkT = Math.max(0, m.blinkT - dt);
  }

  const slots = [[.10, .66], [.27, .65], [.40, .63], [.74, .65], [.90, .66]];
  order.forEach((mi, k) => {
    const [fx, fy] = slots[k], left = fx < .5;
    const pk = p - k*.05;
    const mv = moveFn(pk);
    const hop = playing ? AS(pk)*amp*mv.hop : Math.max(0, breath);
    drawDancer(MEMBERS[mi], CW*fx, CH*fy, unit*.3, {
      la: left ? mv.ra : mv.la, ra: left ? mv.la : mv.ra, tilt: (left ? -1 : 1)*mv.tilt,
      hopY: hop, squash: playing ? .05*Math.pow(1 - AS(pk), 6)*level : 0, flare: hop*.25,
      sway: S(pk/2), armWave:S(pk/2),energy:playing ? strength : 0,
      happy: playing && mv.happy && env > .3, blink: MEMBERS[mi].blinkT > 0, mouth: 0
    });
  });

  // 主唱
  const mv = moveFn(p);
  const mouth = singing && playing ? clamp((vocal - .1)*3.2, 0, 1) : 0;
  const hopL = playing ? AS(p)*amp*.55*mv.hop : Math.max(0, breath);
  const sx = CW*.55, sy = CH*.72, ss = unit*.38;
  drawDancer(MEMBERS[lead], sx, sy, ss, {
    la: singing ? mv.la : mv.la, ra: 2.72 + .08*S(p), tilt: mv.tilt*.5,
    hopY: hopL, squash: playing ? .04*Math.pow(1 - AS(p), 6)*level : 0, flare: hopL*.25,
    sway: S(p/2),armWave:S(p/2),energy:playing ? strength : 0,
    happy: false, blink: MEMBERS[lead].blinkT > 0 && !mouth, mouth, mic: true
  });
  const activeStyle=prefs.danceStyle === 'anime' && window.SpriteDancers?.ready ? 'anime' : 'chibi';
  const mode=an && media.kind==='file' ? 'MP3 音量／節拍驅動' : '固定 120 BPM';
  const label=(activeStyle==='anime' ? '六位參考人物' : '六位 Q 版偶像')+' · '+(playing ? mode : '按播放開始');
  if(label!==lastStatus){lastStatus=label;const el=document.getElementById('danceStatus');if(el)el.textContent=label;}
  info={style:activeStyle,count:MEMBERS.length,lead,playing,singing,mouth,phase:p,mode};

  // 音符
  if(prefs.particles && singing && playing && mouth > .15){
    noteAcc += dt*mouth*7;
    while(noteAcc > 1){
      noteAcc--;
      const u = W/100;
      const headY=activeStyle==='anime' ? sy-CH*.47*Math.min(1,CW/CH/2.05)-hopL*CH/155 : sy-(hopL+30)*ss;
      P.push({x: sx + ss*(4 + Math.random()*3), y: headY, vx: (Math.random()*.8 + .4)*6*u*(Math.random() < .5 ? -1 : 1),
        vy: -(5 + Math.random()*5)*u, g: 0, drag: .97, life: 0, max: 1.6 + Math.random(), size: (1 + Math.random()*.8)*u,
        rot: (Math.random() - .5)*.6, vr: (Math.random() - .5)*1.5, sway: 1.5*u, ph: Math.random()*6,
        kind: 'note', ch: Math.random() < .5 ? '♪' : '♫', color: ['#ff8cc6', '#8fd3ff', '#ffe08a', '#c9a7ff'][Math.random()*4 | 0]});
    }
  }
}
function clear(){ g.clearRect(0, 0, CW, CH); noteAcc=0;const a = art(); if(a) a.style.transform = ''; }
window.Dance = {frame, clear, inspect:()=>({...info})};
})();

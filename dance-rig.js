/* 切圖傀儡：把一張 T-pose 去背立繪拆成「手臂／腿／身體」幾層，讓參考人物真的抬手、踏步。
   立繪是平面的，這裡先量測輪廓推估肩線、髖線與手臂帶，再逐欄找出手臂的實際剪影。
   關鍵是「權重混色」而不是硬性拆解：每個像素依所在位置分配到手臂／腿／身體的權重（和為 1），
   各層用同一張原圖乘上自己的權重，再以加法混色疊回去。Σ權重 = 1，所以
   - 靜止時畫面等於原圖，不會有接縫或色差；
   - 關節附近權重是漸變的，手臂抬起時底下的身體會自動「填補」該區域（線性混合蒙皮），
     不會破洞、不會硬切，動作也跟著平滑。
   用法：SpriteRig.draw(ctx, img, x, y, height, state)；(x, y) 是腳底中心，height 是畫出來的高度。 */
(() => {
  'use strict';
  const ALPHA = 40, CACHE_MAX = 12;
  const measureCache = new WeakMap();
  const bakeCache = new Map();          // img -> rig（LRU，避免同時留太多大圖層）
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

  // 量測輪廓：每一列的前景左右界，用來找張開的雙臂、肩膀與雙腿分叉
  function measure(img){
    let r = measureCache.get(img);
    if(r) return r;
    const W = img.width, H = img.height;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d', {willReadFrequently: true});
    x.drawImage(img, 0, 0);
    let d;
    try{ d = x.getImageData(0, 0, W, H).data; }catch{ r = {W, H, ok: false}; measureCache.set(img, r); return r; }
    const xMin = new Int32Array(H), xMax = new Int32Array(H), cnt = new Int32Array(H);
    for(let y = 0; y < H; y++){
      let lo = W, hi = -1, n = 0;
      for(let xx = 0; xx < W; xx++) if(d[(y*W + xx)*4 + 3] > ALPHA){ n++; if(xx < lo) lo = xx; if(xx > hi) hi = xx; }
      xMin[y] = lo; xMax[y] = hi; cnt[y] = n;
    }
    let top = 0; while(top < H - 1 && cnt[top] < 2) top++;
    let bot = H - 1; while(bot > top && cnt[bot] < 2) bot--;
    const hh = Math.max(1, bot - top);
    const widthAt = y => xMax[y] - xMin[y] + 1;
    let maxW = 0, widest = top;
    for(let y = top; y <= top + hh*.6; y++) if(widthAt(y) > maxW){ maxW = widthAt(y); widest = y; }
    const thr = maxW*.72;
    let aTop = widest, aBot = widest;
    while(aTop > top && widthAt(aTop - 1) > thr) aTop--;
    while(aBot < bot && widthAt(aBot + 1) > thr) aBot++;
    // 上半身明顯比中段寬才是有張開的手臂（裙子不會被誤判）；斜的手臂也能通過
    const midW = widthAt(top + Math.round(hh*.5));
    const arms = maxW > midW*1.1 && widest < top + hh*.6;
    const armTop = arms ? aTop : top, armBot = arms ? aBot : top;
    const shoulderY = (armTop + armBot)/2;
    const sRow = Math.min(bot, Math.round(armBot + hh*.05));
    const shoulderLX = xMin[sRow], shoulderRX = xMax[sRow];
    // 髖線：從中段往下找第一列出現左右兩段（胯下）
    let hipY = Math.round(top + hh*.62), legs = false;
    for(let y = Math.round(top + hh*.42); y < Math.round(top + hh*.86); y++){
      if(widthAt(y) < maxW*.05) continue;
      let runs = 0, gap = 0, run = 0, prev = false;
      const minGap = Math.max(2, Math.round(maxW*.03));
      for(let xx = xMin[y]; xx <= xMax[y]; xx++){
        const on = d[(y*W + xx)*4 + 3] > ALPHA;
        if(on && !prev) runs++;
        if(!on) run++; else run = 0;
        if(run > gap) gap = run;
        prev = on;
      }
      if(runs >= 2 && gap >= minGap){ hipY = y; legs = true; break; }
    }
    const legSplit = (xMin[hipY] + xMax[hipY])/2;
    // 手臂的實際上下緣：逐欄找出「含手臂列的那一段連續前景」
    const armTopAt = new Int32Array(W).fill(-1), armBotAt = new Int32Array(W).fill(-1);
    if(arms){
      const scan = (from, to) => {
        for(let x = from; x <= to; x++){
          let best = -1, bestD = 1e9;
          for(let y = top; y <= hipY; y++) if(d[(y*W + x)*4 + 3] > ALPHA){
            const dd = Math.abs(y - widest); if(dd < bestD){ bestD = dd; best = y; }
          }
          if(best < 0) continue;
          let a = best, b = best;
          while(a > top && d[((a - 1)*W + x)*4 + 3] > ALPHA) a--;
          while(b < hipY && d[((b + 1)*W + x)*4 + 3] > ALPHA) b++;
          armTopAt[x] = a; armBotAt[x] = b;
        }
      };
      scan(0, shoulderLX);
      scan(shoulderRX, W - 1);
    }
    r = {W, H, ok: true, top, bot, hh, arms, armTop, armBot, shoulderY, shoulderLX, shoulderRX, hipY, legs, legSplit,
      armTopAt, armBotAt, maxW};
    measureCache.set(img, r);
    return r;
  }

  // 逐像素算權重，並把原圖依權重拆成五張圖層
  function bake(img){
    const r = measure(img);
    if(!r.ok) return null;
    const {W, H} = r, N = W*H;
    const src = document.createElement('canvas');
    src.width = W; src.height = H;
    const sc = src.getContext('2d', {willReadFrequently: true});
    sc.drawImage(img, 0, 0);
    const d = sc.getImageData(0, 0, W, H).data;

    const shY = r.shoulderY, shL = r.shoulderLX, shR = r.shoulderRX;
    const hipY = r.hipY, legX = r.legSplit;
    const bandH = Math.max(6, r.armBot - r.armTop);
    const fBand = Math.max(2, bandH*.3);                 // 手臂上下緣的羽化
    const r0 = Math.max(6, bandH*.85);                   // 肩關節混合帶（半寬）
    const r1 = Math.max(4, r.hh*.035);                   // 髖關節垂直混合帶（半高）
    const r2 = Math.max(4, r.maxW*.04);                  // 兩腿之間的混合帶（半寬）
    // 左／右臂：用肩膀那欄的上下緣當帶，再往軀幹方向做水平漸變
    const armWeight = (x, y, shoulderX, side) => {
      const cx = side < 0 ? Math.min(x, shoulderX) : Math.max(x, shoulderX);
      const a = r.armTopAt[cx], b = r.armBotAt[cx];
      if(a < 0 || b < a) return 0;
      const v = Math.min(clamp01((y - (a - fBand))/fBand), clamp01(((b + fBand) - y)/fBand));
      const h = side < 0 ? clamp01((shoulderX + r0 - x)/(2*r0)) : clamp01((x - shoulderX + r0)/(2*r0));
      return v*h;
    };

    const keys = ['body', 'armL', 'armR', 'legL', 'legR'];
    const wts = {};
    const box = {};
    for(const k of keys){ wts[k] = new Float32Array(N); box[k] = [W, H, -1, -1]; }
    const touch = (b, x, y) => { if(x < b[0]) b[0] = x; if(y < b[1]) b[1] = y; if(x > b[2]) b[2] = x; if(y > b[3]) b[3] = y; };
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      const i = y*W + x;
      if(d[i*4 + 3] <= ALPHA) continue;
      const aL = r.arms ? armWeight(x, y, shL, -1) : 0;
      const aR = r.arms ? armWeight(x, y, shR, 1) : 0;
      let lL = 0, lR = 0;
      if(r.legs){
        const band = clamp01((y - (hipY - r1))/(2*r1));
        lL = band*clamp01((legX - x)/r2);
        lR = band*clamp01((x - legX)/r2);
      }
      const limb = Math.min(1, aL + aR + lL + lR);
      wts.armL[i] = aL; wts.armR[i] = aR; wts.legL[i] = lL; wts.legR[i] = lR;
      wts.body[i] = 1 - limb;
      for(const k of keys) if(wts[k][i] > 0.002) touch(box[k], x, y);
    }

    const layers = {};
    for(const k of keys){
      const [x0, y0, x1, y1] = box[k];
      if(x1 < 0){ layers[k] = null; continue; }
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const cx = c.getContext('2d');
      const id = cx.createImageData(cw, ch), o = id.data, m = wts[k];
      const isBody = k === 'body';
      const others = isBody ? keys.filter(x => x !== 'body') : null;
      for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++){
        const i = y*W + x, w = m[i]; if(w <= 0.002) continue;
        const t = ((y - y0)*cw + (x - x0))*4;
        o[t] = d[i*4]; o[t + 1] = d[i*4 + 1]; o[t + 2] = d[i*4 + 2];
        const A = d[i*4 + 3];
        // 身體的 alpha 取「原圖扣掉其他層」，四捨五入的誤差就不會累積成亮邊
        o[t + 3] = isBody
          ? Math.max(0, A - others.reduce((s, x2) => s + Math.round(A*Math.min(1, wts[x2][i])), 0))
          : Math.round(A*Math.min(1, w));
      }
      cx.putImageData(id, 0, 0);
      layers[k] = {c, x0, y0, w: cw, h: ch};
    }
    const rig = {r, layers, r0};
    bakeCache.delete(img); bakeCache.set(img, rig);
    if(bakeCache.size > CACHE_MAX) bakeCache.delete(bakeCache.keys().next().value);
    return rig;
  }

  // 離屏畫布：各層以加法混色疊起來（Σ權重 = 1，所以等於原圖），再整張貼到畫面上
  let tmp = null;
  function temp(w, h){
    w = Math.ceil(w); h = Math.ceil(h);
    if(!tmp){ tmp = document.createElement('canvas'); }
    if(tmp.width < w || tmp.height < h){ tmp.width = Math.max(w, tmp.width); tmp.height = Math.max(h, tmp.height); }
    return tmp;
  }

  function draw(ctx, img, x, y, h, st = {}){
    if(!img) return;
    const r = measure(img);
    const w = img.width*h/img.height;
    const hop = st.hop || 0, sq = st.squash || 0, tilt = (st.tilt || 0)*.6;
    if(!r.ok){
      ctx.save(); ctx.translate(x, y); ctx.translate(0, -hop); ctx.rotate(tilt); ctx.scale(1 + sq*.5, 1 - sq);
      ctx.drawImage(img, -w/2, -h, w, h); ctx.restore(); return;
    }
    let rig = bakeCache.get(img);
    if(!rig){ rig = bake(img); if(!rig){
      ctx.save(); ctx.translate(x, y); ctx.translate(0, -hop); ctx.rotate(tilt); ctx.scale(1 + sq*.5, 1 - sq);
      ctx.drawImage(img, -w/2, -h, w, h); ctx.restore(); return;
    } }
    bakeCache.delete(img); bakeCache.set(img, rig);

    const amp = Math.max(0, Math.min(1.4, st.energy || 0));
    const sw = Math.max(-1, Math.min(1, st.wave || 0));
    // 需要特定姿勢（例如騎車）時可直接指定關節角度，不必走節拍擺動
    const armA = st.armA !== undefined ? st.armA : (0.22 + 0.62*sw)*amp;
    const armB = st.armB !== undefined ? st.armB : (0.22 - 0.62*sw)*amp;
    const legA = st.legA !== undefined ? st.legA : 0.15*sw*amp;
    const legB = st.legB !== undefined ? st.legB : -0.15*sw*amp;
    const moving = amp > .01 || st.armA !== undefined || st.legA !== undefined;
    const kx = w/r.W, ky = h/r.H;
    const px = v => v*kx, py = v => v*ky;

    const cv = temp(w, h), tc = cv.getContext('2d');
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalCompositeOperation = 'source-over';
    tc.clearRect(0, 0, cv.width, cv.height);
    tc.globalCompositeOperation = 'lighter';          // 權重相加＝原圖，接縫自然消失
    const put = (layer, cx, cy, ang) => {
      if(!layer) return;
      tc.save();
      if(ang){ tc.translate(cx, cy); tc.rotate(ang); tc.translate(-cx, -cy); }
      tc.drawImage(layer.c, layer.x0*kx, layer.y0*ky, layer.w*kx, layer.h*ky);
      tc.restore();
    };
    const shLX = px(r.shoulderLX), shRX = px(r.shoulderRX), shYy = py(r.shoulderY);
    const hipX = px(r.legSplit), hipYy = py(r.hipY);
    put(rig.layers.body, 0, 0, 0);
    put(rig.layers.legL, hipX, hipYy, moving ? legA : 0);
    put(rig.layers.legR, hipX, hipYy, moving ? legB : 0);
    put(rig.layers.armL, shLX, shYy, moving ? armA : 0);
    put(rig.layers.armR, shRX, shYy, moving ? armB : 0);
    tc.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.translate(x, y);
    ctx.translate(0, -hop);
    ctx.rotate(tilt);
    ctx.scale(1 + sq*.5, 1 - sq);
    ctx.drawImage(cv, 0, 0, Math.ceil(w), Math.ceil(h), -w/2, -h, w, h);
    ctx.restore();
  }

  window.SpriteRig = {draw, measure, bake};
})();

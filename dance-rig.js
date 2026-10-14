/* 切圖傀儡：把一張 T-pose 去背立繪拆成「手臂／腿／身體」幾層，讓參考人物真的抬手、踏步。
   立繪是平面的，這裡先量測輪廓推估肩線、髖線與手臂帶，再逐欄找出手臂的實際剪影。
   關鍵是「權重混色」而不是硬性拆解：每個像素依所在位置分配到手臂／腿／身體的權重（和為 1），
   各層用同一張原圖乘上自己的權重，再疊回去。身體先畫，手腳以一般混色蓋上去。
   關節附近權重是漸變的，手臂抬起時底下的身體會留一點來填補。
   不用加法混色：手一轉，關節重疊的部分會加到發白，肩膀像被打了一盞燈。
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
    // 五指張開後，指尖那幾列和手臂一樣寬，手臂帶會被撐到整隻手那麼高。
    // 肩膀厚度和雙馬尾裁切跟前臂走，不跟著指尖變厚。
    {
      const span = Math.max(1, xMax[widest] - xMin[widest]);
      const forearm = [];
      const probeCol = x => {
        let best = -1, bestD = 1e9;
        const y0 = Math.max(top, widest - 80), y1 = Math.min(bot, widest + 80);
        for(let yy = y0; yy <= y1; yy++) if(d[(yy*W + x)*4 + 3] > ALPHA){
          const dd = Math.abs(yy - widest); if(dd < bestD){ bestD = dd; best = yy; }
        }
        if(best < 0) return;
        let a = best, b = best;
        while(a > top && d[((a - 1)*W + x)*4 + 3] > ALPHA) a--;
        while(b < bot && d[((b + 1)*W + x)*4 + 3] > ALPHA) b++;
        if(b - a > hh*.2) return;
        forearm.push(b - a);
      };
      for(const t of [.12, .16, .2]){
        probeCol(xMin[widest] + Math.round(span*t));
        probeCol(xMax[widest] - Math.round(span*t));
      }
      if(forearm.length >= 3){
        forearm.sort((p, q) => p - q);
        const thick = forearm[Math.floor(forearm.length/2)];
        if(aBot - aTop > thick*1.55){
          const half = Math.max(4, Math.round(thick/2));
          aTop = Math.max(top, widest - half);
          aBot = Math.min(bot, widest + half);
        }
      }
    }
    // 上半身明顯比中段寬才是有張開的手臂（裙子不會被誤判）；斜的手臂也能通過
    const midW = widthAt(top + Math.round(hh*.5));
    const arms = maxW > midW*1.1 && widest < top + hh*.6;
    const armTop = arms ? aTop : top, armBot = arms ? aBot : top;
    const shoulderY = (armTop + armBot)/2;
    // 腋下才是肩膀：手臂帶下方、裙子張開之前最窄的那一列。還很寬的話，轉軸會落在袖子上。
    let sRow = Math.min(bot - 1, armBot + 1);
    let bestW = widthAt(sRow);
    const sEnd = Math.min(bot - 1, armBot + Math.max(8, Math.round(hh*.16)));
    for(let y = sRow + 1; y <= sEnd; y++){
      const w = widthAt(y);
      if(w < bestW){ bestW = w; sRow = y; }
    }
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
          // 張開的五指中間是透明的，每一指各自是一段。離手臂帶近的都算手。
          // 雙馬尾、耳朵、外套若伸出手臂帶太多，整段留在身體上，手一抬才不會甩到前面。
          const slack = Math.max(12, Math.round((armBot - armTop) * 0.9));
          let aMin = 1e9, bMax = -1;
          for(let y = top; y <= hipY; y++){
            if(d[(y*W + x)*4 + 3] <= ALPHA) continue;
            let a = y, b = y;
            while(b < hipY && d[((b + 1)*W + x)*4 + 3] > ALPHA) b++;
            const tooFar = armTop - a > slack * 2 || b - armBot > slack * 2;
            if(tooFar){
              if(b < armTop || a > armBot){ y = b; continue; }
              a = Math.max(a, armTop); b = Math.min(b, armBot);
            }
            if(a < aMin) aMin = a;
            if(b > bMax) bMax = b;
            y = b;
          }
          if(bMax < 0 || aMin > bMax) continue;
          armTopAt[x] = aMin; armBotAt[x] = bMax;
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

  // 圖層像素裡，從最底下一列實心的鞋底往上累積，直到寬度突然變大（裙襬）為止。
  function soleFromAlpha(data, w, h, x0, y0){
    const rows = [];
    const limit = Math.max(14, Math.round(h*.15));
    for(let y = h - 1; y >= 0 && rows.length < limit; y--){
      let n = 0, sx = 0, lo = w, hi = -1;
      for(let x = 0; x < w; x++) if(data[(y*w + x)*4 + 3] > ALPHA){
        n++; sx += x; if(x < lo) lo = x; if(x > hi) hi = x;
      }
      if(n >= 4) rows.push({y, n, sx, lo, hi});
    }
    if(!rows.length) return null;
    const base = rows[0].hi - rows[0].lo + 1;
    let accN = 0, accX = 0, used = 0;
    for(const row of rows){
      const rw = row.hi - row.lo + 1;
      if(used && rw > base*2.4 && rw > base + 10) break;
      accN += row.n; accX += row.sx; used++;
      if(used >= 8) break;
    }
    return {x: x0 + accX/accN, y: y0 + rows[0].y};
  }

  // 腿只沿著鞋子往上長，長到裙襬或胯下就停。
  // 以前髖線以下整片對半切，裙子和尾巴會被兩腿扯開，中縫還留一條身體殘影。
  function legCorridors(d, W, H, top, bot, hh, maxW){
    const runsAt = y => {
      const runs = [];
      let inn = false, lo = 0;
      for(let x = 0; x < W; x++){
        const on = d[(y*W + x)*4 + 3] > ALPHA;
        if(on && !inn){ inn = true; lo = x; }
        else if(!on && inn){ if(x - lo >= 3) runs.push([lo, x - 1]); inn = false; }
      }
      if(inn && W - lo >= 3) runs.push([lo, W - 1]);
      return runs;
    };
    let seedY = -1, pair = null, best = 0;
    const yFrom = Math.max(top, bot - Math.round(hh*.18));
    for(let y = bot; y >= yFrom; y--){
      let rs = runsAt(y);
      if(rs.length < 2) continue;
      rs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
      const two = [rs[0], rs[1]].sort((a, b) => a[0] - b[0]);
      const w1 = two[0][1] - two[0][0] + 1, w2 = two[1][1] - two[1][0] + 1;
      const gap = two[1][0] - two[0][1] - 1;
      if(gap < 4 || Math.max(w1, w2) > maxW*.34) continue;
      const m = Math.min(w1, w2);
      if(m > best){ best = m; seedY = y; pair = two; }
    }
    if(!pair) return null;
    const L = new Array(H).fill(null), R = new Array(H).fill(null);
    const put = (side, y, lo, hi, w) => { if(lo <= hi) (side ? R : L)[y] = [lo, hi, w]; };
    const cors = [
      {lo: pair[0][0], hi: pair[0][1], alive: true},
      {lo: pair[1][0], hi: pair[1][1], alive: true}
    ];
    put(0, seedY, pair[0][0], pair[0][1], 1);
    put(1, seedY, pair[1][0], pair[1][1], 1);
    const ankle = Math.max(8, Math.min(pair[0][1] - pair[0][0], pair[1][1] - pair[1][0]) + 1);
    const sudden = w => w > ankle*1.85 && w > ankle + 12;
    const yCap = top + Math.round(hh*.40);
    let merged = 0;
    for(let y = seedY - 1; y >= yCap && (cors[0].alive || cors[1].alive); y--){
      const rs = runsAt(y);
      const alive = [0, 1].filter(i => cors[i].alive);
      if(!rs.length || !alive.length) break;
      const match = {};
      for(const i of alive){
        let bestN = 0, bestRun = null;
        for(const run of rs){
          const n = Math.min(run[1], cors[i].hi + 18) - Math.max(run[0], cors[i].lo - 18) + 1;
          if(n > bestN){ bestN = n; bestRun = run; }
        }
        match[i] = bestN > 0 ? bestRun : null;
      }
      if(alive.every(i => !match[i])) break;
      const same = alive.length === 2 && match[0] && match[0] === match[1];
      if(same){
        // 兩腿併成一塊就是裙襬或上衣，不再往上切。胯下最多留兩列當關節。
        merged++;
        if(merged > 2) break;
        const run = match[0];
        if(run[1] - run[0] + 1 > ankle*2.4) break;
        const mid = Math.floor(((cors[0].lo + cors[0].hi) + (cors[1].lo + cors[1].hi))/4);
        const parts = [[run[0], Math.min(run[1], mid)], [Math.max(run[0], mid + 1), run[1]]];
        for(const i of [0, 1]){
          const lo = parts[i][0], hi = parts[i][1];
          if(hi - lo + 1 >= 3) put(i, y, lo, hi, 1);
        }
        continue;
      }
      merged = 0;
      let any = false;
      for(const i of alive){
        const run = match[i];
        if(!run){ cors[i].alive = false; continue; }
        let lo = run[0], hi = run[1], w = hi - lo + 1;
        const prevW = cors[i].hi - cors[i].lo + 1;
        // 大腿比鞋口寬是漸變，整條褲子都要算進腿裡。
        // 只有這一列突然多出一截（尾巴、裙襬）才把多的剪掉，不能在大腿中間停下來。
        if(prevW >= 8 && w > prevW * 1.55 && w > prevW + 16){
          const pad = Math.max(4, Math.round(prevW * .12));
          lo = Math.max(lo, cors[i].lo - pad);
          hi = Math.min(hi, cors[i].hi + pad);
          w = hi - lo + 1;
          if(w < 3){ cors[i].alive = false; continue; }
        }else if(sudden(w)){
          cors[i].alive = false; continue;
        }
        cors[i].lo = lo; cors[i].hi = hi;
        put(i, y, lo, hi, 1);
        any = true;
      }
      if(!any) break;
    }
    const foot = [
      {lo: pair[0][0], hi: pair[0][1], alive: true},
      {lo: pair[1][0], hi: pair[1][1], alive: true}
    ];
    for(let y = seedY + 1; y <= bot; y++){
      const rs = runsAt(y);
      if(!rs.length) break;
      const match = {};
      for(const i of [0, 1]){
        if(!foot[i].alive) continue;
        let bestN = 0, bestRun = null;
        for(const run of rs){
          const n = Math.min(run[1], foot[i].hi + 6) - Math.max(run[0], foot[i].lo - 6) + 1;
          if(n > bestN){ bestN = n; bestRun = run; }
        }
        match[i] = bestN > 0 ? bestRun : null;
      }
      if(match[0] && match[0] === match[1]){
        const run = match[0];
        const mid = Math.floor((foot[0].lo + foot[0].hi + foot[1].lo + foot[1].hi)/4);
        const parts = [[run[0], Math.min(run[1], mid)], [Math.max(run[0], mid + 1), run[1]]];
        for(const i of [0, 1]){
          const lo = parts[i][0], hi = parts[i][1];
          if(hi - lo + 1 < 2){ foot[i].alive = false; continue; }
          foot[i].lo = lo; foot[i].hi = hi;
          put(i, y, lo, hi, 1);
        }
      }else{
        for(const i of [0, 1]){
          if(!foot[i].alive) continue;
          const run = match[i];
          if(!run){ foot[i].alive = false; continue; }
          foot[i].lo = run[0]; foot[i].hi = run[1];
          put(i, y, run[0], run[1], 1);
        }
      }
    }
    // 每條腿繞自己褲頭的中心轉。繞身體中線轉的話，大腿上緣會被扯離軀幹，褲管橫向裂開。
    // 交界不留半透明帶：那幾列一半留在身上、一半跟著轉，看起來就是一道裂縫。
    const pivotOf = arr => {
      for(let y = 0; y < H; y++) if(arr[y]) return {x: (arr[y][0] + arr[y][1]) / 2, y};
      return null;
    };
    const pL = pivotOf(L), pR = pivotOf(R);
    return {L, R, pivot: (pL || pR) ? (pL || pR).y : bot, pivotL: pL, pivotR: pR};
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
    const corridors = r.legs ? legCorridors(d, W, H, r.top, r.bot, r.hh, r.maxW) : null;

    const shY = r.shoulderY, shL = r.shoulderLX, shR = r.shoulderRX;
    const hipY = r.hipY, legX = r.legSplit;
    const bandH = Math.max(6, r.armBot - r.armTop);
    // 羽化只留在關節上幾個像素。邊緣若半透明，手一抬就會在原位留下一點一線的描邊。
    const fBand = Math.max(1, bandH*.06);
    const r0 = Math.max(3, bandH*.18);
    // 身體只留關節根部。留到會動的那一段，就會在原位多出一條殘影。
    let thighW = Math.max(12, Math.round(r.hh*.04));
    if(corridors){
      for(const p of [corridors.pivotL, corridors.pivotR]){
        if(!p) continue;
        const row = (p === corridors.pivotL ? corridors.L : corridors.R)[Math.round(p.y)];
        if(row) thighW = Math.max(thighW, row[1] - row[0] + 1);
      }
    }
    const armReach = Math.max(8, bandH*.95);
    const legReach = Math.max(10, Math.min(thighW*.42, r.hh*.05));
    const r1 = Math.max(4, r.hh*.035);                   // 髖關節垂直混合帶（半高）
    // 兩腿之間的混合帶刻意很窄：這條帶上的權重會留給身體層，腿一擺動就會在原位
    // 留下一根細長的殘影；但也不能窄到硬切，否則裙襬／圍裙會被兩腿扯成兩半。
    const r2 = Math.max(2, r.maxW*.012);
    // 左／右臂：用肩膀那欄的上下緣當帶，再往軀幹方向做水平漸變
    const armWeight = (x, y, shoulderX, side) => {
      const cx = side < 0 ? Math.min(x, shoulderX) : Math.max(x, shoulderX);
      const a = r.armTopAt[cx], b = r.armBotAt[cx];
      if(a < 0 || b < a) return 0;
      const v = Math.min(clamp01((y - (a - fBand))/fBand), clamp01(((b + fBand) - y)/fBand));
      // 肩膀以外整段都是手臂，只往胸口淡出幾個像素。從肩膀外面才開始算，手會懸在身體旁邊。
      const into = Math.max(4, r0);
      const h = side < 0 ? clamp01((shoulderX + into - x)/into) : clamp01((x - shoulderX + into)/into);
      return v*h;
    };

    const keys = ['body', 'armL', 'armR', 'legL', 'legR'];
    const wts = {};
    const box = {};
    for(const k of keys){ wts[k] = new Float32Array(N); box[k] = [W, H, -1, -1]; }
    const touch = (b, x, y) => { if(x < b[0]) b[0] = x; if(y < b[1]) b[1] = y; if(x > b[2]) b[2] = x; if(y > b[3]) b[3] = y; };
    // 中間權重會在身體和手腳各留半層，轉開之後就是殘影。夠深的歸手腳，很淺的留在身上。
    const own = w => w >= .72 ? 1 : w <= .38 ? 0 : (w - .38) / .34;
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      const i = y*W + x;
      if(d[i*4 + 3] <= ALPHA) continue;
      const aL = r.arms ? own(armWeight(x, y, shL, -1)) : 0;
      const aR = r.arms ? own(armWeight(x, y, shR, 1)) : 0;
      let lL = 0, lR = 0;
      if(corridors){
        const rowL = corridors.L[y], rowR = corridors.R[y];
        if(rowL && x >= rowL[0] && x <= rowL[1]) lL = own(rowL[2]);
        if(rowR && x >= rowR[0] && x <= rowR[1]) lR = own(rowR[2]);
      }else if(r.legs){
        const band = clamp01((y - (hipY - r1))/(2*r1));
        lL = own(band*clamp01((legX - x)/r2));
        lR = own(band*clamp01((x - legX)/r2));
      }
      const limb = Math.min(1, aL + aR + lL + lR);
      // 關節周圍的像素身體也留著。手腳轉開時袖口和大腿根還在，不會露出三角空縫。
      const near = (px0, py0, reach) => clamp01(1 - Math.hypot(x - px0, y - py0)/reach);
      let keep = 0;
      if(aL > 0) keep = near(shL, shY, armReach);
      if(aR > 0) keep = Math.max(keep, near(shR, shY, armReach));
      if(lL > 0){
        const p = corridors && corridors.pivotL;
        keep = Math.max(keep, near(p ? p.x : legX, p ? p.y : hipY, legReach));
      }
      if(lR > 0){
        const p = corridors && corridors.pivotR;
        keep = Math.max(keep, near(p ? p.x : legX, p ? p.y : hipY, legReach));
      }
      wts.armL[i] = aL; wts.armR[i] = aR; wts.legL[i] = lL; wts.legR[i] = lR;
      wts.body[i] = 1 - limb*(1 - keep);
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
      for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++){
        const i = y*W + x, w = m[i]; if(w <= 0.002) continue;
        const t = ((y - y0)*cw + (x - x0))*4;
        o[t] = d[i*4]; o[t + 1] = d[i*4 + 1]; o[t + 2] = d[i*4 + 2];
        const A = d[i*4 + 3];
        o[t + 3] = Math.round(A*Math.min(1, w));
      }
      cx.putImageData(id, 0, 0);
      // 鞋底取最底下那一小段的重心，不取整條腿的外框中心。
      // 外框中心在大腿，裙襬又比鞋子寬；踏板若跟著外框，就會畫在小腿或裙緣旁邊。
      layers[k] = {c, x0, y0, w: cw, h: ch, sole: (k === 'legL' || k === 'legR') ? soleFromAlpha(o, cw, ch, x0, y0) : null};
    }
    const rig = {r, layers, r0, armThick: bandH, thighW, pivotY: corridors ? corridors.pivot : r.hipY,
      pivotL: corridors ? corridors.pivotL : null, pivotR: corridors ? corridors.pivotR : null};
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
    // 不以 0.3 為靜止角。那一轉會把原本接好的肩膀立刻拉開。
    const armA = st.armA !== undefined ? st.armA : sw*amp;
    const armB = st.armB !== undefined ? st.armB : -sw*amp;
    const legA = st.legA !== undefined ? st.legA : 0.22*sw*amp;
    const legB = st.legB !== undefined ? st.legB : -0.22*sw*amp;
    const moving = amp > .01 || st.armA !== undefined || st.legA !== undefined;
    const kx = w/r.W, ky = h/r.H;
    const px = v => v*kx, py = v => v*ky;

    const cv = temp(w, h), tc = cv.getContext('2d');
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalCompositeOperation = 'source-over';
    tc.clearRect(0, 0, cv.width, cv.height);
    const put = (layer, cx, cy, ang) => {
      if(!layer) return;
      tc.save();
      if(ang){ tc.translate(cx, cy); tc.rotate(ang); tc.translate(-cx, -cy); }
      tc.drawImage(layer.c, layer.x0*kx, layer.y0*ky, layer.w*kx, layer.h*ky);
      tc.restore();
    };
    // 根部留在身上，越往外彎得越多。整條一起轉的話，袖口和大腿根會撕開。
    const putChain = (layer, jx, jy, ang, axis, thick) => {
      if(!layer) return;
      if(!ang || Math.abs(ang) < .025){ put(layer, jx, jy, ang); return; }
      const x0 = layer.x0*kx, y0 = layer.y0*ky, lw = layer.w*kx, lh = layer.h*ky;
      const x1 = x0 + lw, y1 = y0 + lh;
      const origin = axis === 'x' ? jx : jy;
      const far = axis === 'x'
        ? (Math.abs(x0 - jx) > Math.abs(x1 - jx) ? x0 : x1)
        : (Math.abs(y0 - jy) > Math.abs(y1 - jy) ? y0 : y1);
      const near = axis === 'x'
        ? (Math.abs(x0 - far) > Math.abs(x1 - far) ? x0 : x1)
        : (Math.abs(y0 - far) > Math.abs(y1 - far) ? y0 : y1);
      const sign = far >= origin ? 1 : -1;
      const length = Math.abs(far - origin);
      if(length < 8){ put(layer, jx, jy, ang); return; }
      const {n, bend} = chainPlan(length, thick);
      let px0 = jx, py0 = jy, prev = 0;
      const rad = Math.max(2, thick*.5);
      for(let i = 0; i < n; i++){
        const t1 = (i + 1)/n;
        const A = ang*bend(t1);
        const sIn = origin + sign*length*(i/n);
        const sOut = origin + sign*length*t1;
        const srcX = axis === 'x' ? sIn : jx;
        const srcY = axis === 'y' ? sIn : jy;
        const outX = axis === 'x' ? sOut : jx;
        const outY = axis === 'y' ? sOut : jy;
        tc.save();
        tc.translate(px0, py0); tc.rotate(A); tc.translate(-srcX, -srcY);
        tc.beginPath();
        const pad = 1.5;
        if(axis === 'x'){
          const lo = Math.min(i === 0 ? near : sIn, sOut) - pad;
          const hi = Math.max(i === 0 ? near : sIn, sOut) + pad;
          tc.rect(lo, y0 - pad, hi - lo, lh + pad*2);
        }else{
          const lo = Math.min(i === 0 ? near : sIn, sOut) - pad;
          const hi = Math.max(i === 0 ? near : sIn, sOut) + pad;
          tc.rect(x0 - pad, lo, lw + pad*2, hi - lo);
        }
        tc.clip();
        tc.drawImage(layer.c, x0, y0, lw, lh);
        tc.restore();
        const vx = outX - srcX, vy = outY - srcY;
        const c = Math.cos(A), s = Math.sin(A);
        const nx = px0 + c*vx - s*vy, ny = py0 + s*vx + c*vy;
        // 角度差得夠大才補圓，不然每一段都重畫一張圖，舞台會掉幀。
        if(i < n - 1 && Math.abs(A - prev) > .1){
          tc.save();
          tc.translate(nx, ny); tc.rotate(A);
          tc.beginPath(); tc.arc(0, 0, rad, 0, Math.PI*2); tc.clip();
          tc.drawImage(layer.c, x0 - outX, y0 - outY, lw, lh);
          tc.restore();
        }
        px0 = nx; py0 = ny; prev = A;
      }
    };
    const shLX = px(r.shoulderLX), shRX = px(r.shoulderRX), shYy = py(r.shoulderY);
    // 轉軸就是肩膀上那顆圓的圓心，不能改到袖子外緣，否則圓和手臂會錯開。
    const armPivot = (layer, side) => side < 0 ? [shLX, shYy] : [shRX, shYy];
    // 每條腿繞自己的褲頭轉，褲管才不會在大腿被橫向扯開。裙子的轉軸在裙襬下緣。
    const hipX = px(r.legSplit), hipYy = py(rig.pivotY != null ? rig.pivotY : r.hipY);
    const legPivot = (p, fx, fy) => p ? [px(p.x), py(p.y)] : [fx, fy];
    const [lx, ly] = legPivot(rig.pivotL, hipX, hipYy);
    const [rx, ry] = legPivot(rig.pivotR, hipX, hipYy);
    const armThick = py(rig.armThick || (r.armBot - r.armTop));
    const thigh = px(rig.thighW || r.hh*.04);
    put(rig.layers.body, 0, 0, 0);
    putChain(rig.layers.legL, lx, ly, moving ? legA : 0, 'y', thigh);
    putChain(rig.layers.legR, rx, ry, moving ? legB : 0, 'y', thigh);
    const [alx, aly] = armPivot(rig.layers.armL, -1);
    const [arx, ary] = armPivot(rig.layers.armR, 1);
    putChain(rig.layers.armL, alx, aly, moving ? armA : 0, 'x', armThick);
    putChain(rig.layers.armR, arx, ary, moving ? armB : 0, 'x', armThick);
    tc.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.translate(x, y);
    ctx.translate(0, -hop);
    ctx.rotate(tilt);
    ctx.scale(1 + sq*.5, 1 - sq);
    ctx.drawImage(cv, 0, 0, Math.ceil(w), Math.ceil(h), -w/2, -h, w, h);
    ctx.restore();
  }

  // 根部不動、越往外彎越多。畫的時候和算鞋底位置要用同一組分段。
  function chainPlan(length, thick){
    const glue = Math.min(length*.4, Math.max(thick*.95, 4));
    const n = Math.max(4, Math.min(6, Math.round(length / Math.max(thick*.8, 10))));
    const bend = t => {
      const u = Math.min(1, Math.max(0, (t*length - glue) / Math.max(1, length - glue)));
      return u*u*(3 - 2*u);
    };
    return {n, bend};
  }
  // 跟 putChain 同一套彎法，回傳原圖像素轉完之後的位置。踏板要跟著鞋底，不能用整條腿硬轉的公式。
  function chainPoint(jx, jy, axis, far, ang, thick, sx, sy){
    const rigid = () => {
      const a = ang || 0, c = Math.cos(a), s = Math.sin(a);
      const dx = sx - jx, dy = sy - jy;
      return [jx + c*dx - s*dy, jy + s*dx + c*dy];
    };
    if(!ang || Math.abs(ang) < .025) return rigid();
    const origin = axis === 'x' ? jx : jy;
    const sign = far >= origin ? 1 : -1;
    const length = Math.abs(far - origin);
    if(length < 8) return rigid();
    const {n, bend} = chainPlan(length, thick);
    const coord = axis === 'x' ? sx : sy;
    let t = (coord - origin)/(sign*length);
    if(t < 0) t = 0; else if(t > 1) t = 1;
    const i = Math.min(n - 1, Math.floor(t*n));
    let px = jx, py = jy, A = 0;
    for(let k = 0; k <= i; k++){
      const t1 = (k + 1)/n;
      A = ang*bend(t1);
      if(k === i) break;
      const sIn = origin + sign*length*(k/n);
      const sOut = origin + sign*length*t1;
      const srcX = axis === 'x' ? sIn : jx, srcY = axis === 'y' ? sIn : jy;
      const outX = axis === 'x' ? sOut : jx, outY = axis === 'y' ? sOut : jy;
      const c = Math.cos(A), s = Math.sin(A);
      const vx = outX - srcX, vy = outY - srcY;
      px = px + c*vx - s*vy; py = py + s*vx + c*vy;
    }
    const sIn = origin + sign*length*(i/n);
    const srcX = axis === 'x' ? sIn : jx, srcY = axis === 'y' ? sIn : jy;
    const c = Math.cos(A), s = Math.sin(A);
    return [px + c*(sx - srcX) - s*(sy - srcY), py + s*(sx - srcX) + c*(sy - srcY)];
  }

  window.SpriteRig = {draw, measure, bake, chainPoint};
})();

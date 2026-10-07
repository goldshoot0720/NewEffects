/* 參考人物舞者：使用 tools/cutout.mjs 從參考圖去背的角色切圖，腳踩地、上半身分條側彎，搭配跳躍與壓縮。 */
(() => {
  'use strict';
  const status = document.getElementById('danceStatus');
  // best4u 依主唱選單：小日向理瀬、葉山陽和、前原純華、小鷹咲希、橘雪乃、御社智
  // anaru 是「生徒会にも穴はある！」六人，只在該首歌使用
  const SETS = {
    best4u: {sheet: 'casual', idx: [4, 1, 0, 2, 3, 11]},
    anaru: {sheet: 'anaru', idx: [0, 1, 2, 3, 4, 5]}
  };
  const actors = {best4u: [], anaru: []};
  let active = 'best4u';
  const api = window.SpriteDancers = {ready: false, error: null, draw, use};
  function use(name){ if(actors[name]?.length === 6) active = name; }
  function fail(message){
    api.error = message;
    if(status) status.textContent = '人物素材無法載入，使用 Q 版舞者';
    console.warn(message);
  }
  function loadSet(cast, spec){
    return Promise.all(spec.idx.map(i => new Promise((ok, no) => {
      const meta = cast[spec.sheet][i], img = new Image();
      img.onload = () => ok({img, meta});
      img.onerror = () => no(new Error('找不到 ' + (meta && meta.file)));
      img.src = 'assets/ref/cast/' + meta.file;
    })));
  }
  fetch('assets/ref/cast/cast.json')
    .then(r => { if(!r.ok) throw new Error('找不到 assets/ref/cast/cast.json'); return r.json(); })
    .then(cast => Promise.all([
      loadSet(cast, SETS.best4u),
      loadSet(cast, SETS.anaru).catch(e => { console.warn(e); return []; })
    ]))
    .then(([best, anaru]) => {
      actors.best4u.push(...best);
      actors.anaru.push(...anaru);
      api.ready = true;
      if(status) status.textContent = '六位人物已就緒 · 按播放開始';
    })
    .catch(e => fail('人物素材讀取失敗：' + e.message));

  function draw(ctx, index, x, y, height, state){
    const actor = actors[active][index];
    if(!api.ready || !actor) return;
    const {img} = actor, iw = img.width, ih = img.height, w = iw*height/ih;
    const wave = state.wave || 0, energy = state.energy || 0, squash = state.squash || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 0, w*.32, height*.022, 0, 0, Math.PI*2); ctx.fill();
    ctx.translate(0, -(state.hop || 0)); ctx.rotate((state.tilt || 0)*.6);
    ctx.scale(1 + squash*2, 1 - squash*4);
    // 分條繪製：越往上側彎越多，腳底不動
    const strips = 24, sway = wave*energy*height*.035;
    for(let s = 0; s < strips; s++){
      const v0 = s/strips, v1 = (s + 1)/strips, v = (v0 + v1)/2, sy = v0*ih;
      ctx.drawImage(img, 0, sy, iw, Math.min((v1 - v0)*ih + 1, ih - sy),
        -w/2 + sway*Math.pow(1 - v, 1.7), -height + v0*height, w, (v1 - v0)*height + 1);
    }
    if(state.lead){
      // 主唱腳下的光圈
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,190,230,${.35 + .4*(state.mouth || 0)})`; ctx.lineWidth = Math.max(1, height*.006);
      ctx.beginPath(); ctx.ellipse(0, 0, w*.42, height*.03, 0, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }
})();

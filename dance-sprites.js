/* 參考人物舞者：使用 tools/cutout.mjs 從參考圖去背的角色切圖，腳踩地、上半身分條側彎，搭配跳躍與壓縮。 */
(() => {
  'use strict';
  const status = document.getElementById('danceStatus');
  // best4u 依主唱選單：小日向理瀬、葉山陽和、前原純華、小鷹咲希、橘雪乃、御社智
  // anaru 是「生徒会にも穴はある！」六人，lucky 是招財喵布布八人，都只在該首歌使用
  const SETS = {
    best4u: {sheet: 'casual', idx: [4, 1, 0, 2, 3, 11]},
    anaru: {sheet: 'anaru', idx: [0, 1, 2, 3, 4, 5]},
    lucky: {sheet: 'lucky', idx: [0, 1, 2, 3, 4, 5, 6, 7]}
  };
  const actors = {best4u: [], anaru: [], lucky: []};
  let active = 'best4u';
  const api = window.SpriteDancers = {ready: false, error: null, draw, use, count};
  function use(name){ if(actors[name]?.length) active = name; }
  // 只有目前這組已載入時才回報人數，讓呼叫端在素材還沒好之前沿用預設的六人
  function count(name){ return active === name ? actors[name].length : 0; }
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
    .then(cast => Promise.all(Object.keys(SETS).map(k =>
      loadSet(cast, SETS[k]).catch(e => { console.warn(e); return []; }))))
    .then(loaded => {
      Object.keys(SETS).forEach((k, i) => actors[k].push(...loaded[i]));
      api.ready = true;
      if(status) status.textContent = `${actors.best4u.length} 位人物已就緒 · 按播放開始`;
    })
    .catch(e => fail('人物素材讀取失敗：' + e.message));

  function draw(ctx, index, x, y, height, state){
    const actor = actors[active][index];
    if(!api.ready || !actor) return;
    const {img} = actor, iw = img.width, ih = img.height, w = iw*height/ih;
    const wave = state.wave || 0, energy = state.energy || 0, squash = state.squash || 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, w*.32, height*.022, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // 手臂／腿／身體分層的傀儡動畫，見 dance-rig.js
    SpriteRig.draw(ctx, img, x, y, height, {
      wave, energy, hop: state.hop || 0, tilt: state.tilt || 0, squash: squash*.45
    });
    if(state.lead){
      // 主唱腳下的光圈
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,190,230,${.35 + .4*(state.mouth || 0)})`; ctx.lineWidth = Math.max(1, height*.006);
      ctx.beginPath(); ctx.ellipse(x, y, w*.42, height*.03, 0, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
  }
})();

/* 共用播放模式：單曲循環與自動下一首，兩版播放器共用同一組開關。
   兩個開關互斥——開啟其中一個會關掉另一個，免得「又循環又跳下一首」互相打架。 */
(() => {
  const LOOP_KEY = 'lyricfx:loop', NEXT_KEY = 'lyricfx:autonext';
  const read = (key, fallback) => { try{ const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; }catch{ return fallback; } };
  const write = (key, on) => { try{ localStorage.setItem(key, on ? '1' : '0'); }catch{} };
  let single = read(LOOP_KEY, false);
  let auto = read(NEXT_KEY, false);
  if(single && auto) auto = false;   // 兩個都開的舊資料，以單曲循環為準
  const ui = {loop: null, next: null};
  const sync = () => {
    if(ui.loop){
      const text = single ? '單曲循環：開（播完自動重播）' : '單曲循環：關';
      ui.loop.setAttribute('aria-pressed', String(single));
      ui.loop.classList.toggle('on', single);
      ui.loop.title = text;
      ui.loop.setAttribute('aria-label', text);
    }
    if(ui.next){
      const text = auto ? '自動播放下一首：開（播完接著播下一首）' : '自動播放下一首：關';
      ui.next.setAttribute('aria-pressed', String(auto));
      ui.next.classList.toggle('on', auto);
      ui.next.title = text;
      ui.next.setAttribute('aria-label', text);
    }
    write(LOOP_KEY, single);
    write(NEXT_KEY, auto);
  };
  window.PlayerLoop = {
    bind(button){
      ui.loop = button;
      button.addEventListener('click', () => { single = !single; if(single) auto = false; sync(); });
      sync();
      return {get single(){ return single; }};
    },
    bindNext(button){
      ui.next = button;
      button.addEventListener('click', () => { auto = !auto; if(auto) single = false; sync(); });
      sync();
      return {get auto(){ return auto; }};
    }
  };
})();

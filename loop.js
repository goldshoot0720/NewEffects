/* 共用單曲循環：兩版播放器共用同一個開關，開啟後播完自動從頭再播一次。 */
(() => {
  const KEY = 'lyricfx:loop';
  window.PlayerLoop = {
    bind(button){
      let single = false;
      try{ single = localStorage.getItem(KEY) === '1'; }catch{}
      const sync = () => {
        const text = single ? '單曲循環：開（播完自動重播）' : '單曲循環：關';
        button.setAttribute('aria-pressed', String(single));
        button.classList.toggle('on', single);
        button.title = text;
        button.setAttribute('aria-label', text);
        try{ localStorage.setItem(KEY, single ? '1' : '0'); }catch{}
      };
      button.addEventListener('click', () => { single = !single; sync(); });
      sync();
      return {get single(){ return single; }};
    }
  };
})();

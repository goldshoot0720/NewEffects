// Keep source files intact; normalize only lyrics shown or exported by the players.
(() => {
  const rubyPattern=/([一-鿿々〆ヶ]+|[A-Za-z]+(?: +[A-Za-z]+)*)[(（]([ぁ-ゟ゠-ヿ]+)[)）]/gu;
  function clean(value){
    const ruby=[];
    let text=String(value??'').replace(rubyPattern,(_,base,reading)=>{
      ruby.push(`${base}(${reading})`);
      return `\uE000${ruby.length-1}\uE001`;
    });
    text=text.replace(/(?<=\p{L})[-‐‑‒–—](?=\p{L})/gu,' ')
      .replace(/[\p{P}\p{S}]/gu,'').replace(/[ \t]+/g,' ').trim();
    return text.replace(/\uE000(\d+)\uE001/g,(_,i)=>ruby[+i]);
  }
  const plain=value=>clean(value).replace(rubyPattern,'$1');
  // 英、日主句下的中文只可以略小，不能比畫出來的主句大。中文、粵文主句維持原本的翻譯字級。
  const glossRatio=0.9;
  function mainIsEnOrJa(text){
    const raw=String(text??'');
    if(/[ぁ-ゟ゠-ヿ]/.test(raw)) return true;
    const value=plain(raw);
    const letters=(value.match(/[A-Za-z]/g)||[]).length;
    const cjk=(value.match(/[一-鿿]/g)||[]).length;
    return letters>0 && letters>=cjk;
  }
  function translationSize(mainText, mainSize, requested){
    if(!mainIsEnOrJa(mainText)) return requested;
    return Math.min(requested, mainSize*glossRatio);
  }
  window.LyricText=Object.freeze({clean,plain,mainIsEnOrJa,translationSize});
})();

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
  window.LyricText=Object.freeze({clean,plain});
})();

// Keep the stored song IDs/indices stable while grouping language versions for display and navigation.
(() => {
  'use strict';
  // 同一首歌的版本：中文（原版）→ 英文 → 日文 → 粵文
  const languages={英文:1,日文:2,粵文:3};
  const describe=title=>{
    const text=String(title||'').trim(),match=text.match(/[（(](英文|日文|粵文)歌詞[）)]$/);
    return {base:match?text.slice(0,match.index).trim():text,language:match?languages[match[1]]:0};
  };
  // 歌名本身用哪種語言寫：英文 → 日文 → 中文（有假名算日文，漢字算中文，其餘算英文）
  const scripts={en:1,ja:2,zh:3};
  // 歌名後面常附「[歌手ver.]」，判斷語言前先去掉，免得歌手的日文假名把英文歌名算成日文
  const bareName=base=>base.replace(/\s*[\[【][^\]】]*[\]】]\s*$/,'').trim()||base;
  // 有些日文歌名整首都是漢字，沒有假名可判斷（例：脳天気）。下面這些是新字體，
  // 只有日本這樣寫，繁體與簡體都不使用；出現任何一個就當日文，免得日文歌被排到中文歌後面。
  const JA_ONLY=/[脳気変図実発経対応売読鉄駅転伝単戦様悪圧囲栄営円塩縁穏仮価広払抜沢択訳辺弁歩桜涙覚観関験険剣検権歓銭闘雑霊頼竜亀増蔵臓醸陥徳恵蛍齢斎剤済砕粋酔髄摂渋猟塁圏顕]/;
  const scriptOf=base=>{
    const name=bareName(base);
    if(/[\u3040-\u30ff]/.test(name)) return scripts.ja;
    if(JA_ONLY.test(name)) return scripts.ja;
    if(/[\u3400-\u9fff]/.test(name)) return scripts.zh;
    return scripts.en;
  };
  function group(items,reference=items){
    const byId=new Map(reference.filter(s=>s.id!=null).map(s=>[s.id,s]));
    const meta=new Map();   // 歌名（去掉語言標註）→ {語言, 首次出現順序}
    const note=base=>{if(!meta.has(base)) meta.set(base,{script:scriptOf(base),first:meta.size});};
    for(const song of reference) note(describe(song.title).base);
    const entries=items.map((song,index)=>{
      const {base,language}=describe(byId.get(song.id)?.title||song.title);
      note(base);
      return {song,index,base,language};
    });
    return entries.sort((a,b)=>{
      const ma=meta.get(a.base),mb=meta.get(b.base);
      return ma.script-mb.script||ma.first-mb.first||a.language-b.language||a.index-b.index;
    }).map(e=>e.song);
  }
  window.SongOrder={group};
})();

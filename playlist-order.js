// Keep the stored song IDs/indices stable while grouping language versions for display and navigation.
(() => {
  'use strict';
  // 同一首歌的版本：中文（原版）→ 英文 → 日文 → 粵文
  const languages={英文:1,日文:2,粵文:3};
  const describe=title=>{
    const text=String(title||'').replace(/\s*[\[【][^\]】]*[\]】]\s*$/,'').trim(),match=text.match(/[（(](英文|日文|粵文)歌詞[）)]$/);
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
  const animeTitles={
    'Extreme Hearts':['大好きだよって叫ぶんだ','SUNRISE','HELLO HERO','明日へのBreakShoot'],
    '生徒会にも穴はある！':['風の中は走るっきゃないっ！','ぴ'],
    '超かぐや姫！':['私は、わたしの事が好き。'],
    'あいうら':['カニ☆Do-Luck!'],
    'グロウアップショウ ～ひまわりのサーカス団～':['ユラリユレル','DAYS!'],
    '真夜中ハートチューン':['月に向かって撃て','声の軌跡'],
    'FX戦士くるみちゃん':['$・¥・€','FX戦士くるみちゃん'],
    '才女のお世話':['完璧じゃないわたし','最最最高級のお世話して'],
    'ローリング☆ガールズ':['人にやさしく','月の爆撃機','英雄にあこがれて','1000のバイオリン','脳天気','TRAIN-TRAIN','シャララ','STONES','夕暮れ','終わらない歌'],
    '逆境無頼カイジ':['未来は僕等の手の中','負け犬たちのレクイエム','Chase the Light!','CからはじまるABC'],
    '[C] THE MONEY OF SOUL AND POSSIBILITY CONTROL':['マトリョーシカ','RPG']
  };
  const animeByTitle=new Map(Object.entries(animeTitles).flatMap(([name,titles])=>titles.map(t=>[t,name])));
  const gameKey=title=>title.normalize('NFKC').replace(/\s*&\s*/g,'&');
  const gameByTitle=new Map([
    [gameKey('Forever＆ever'),'ゲーム「メモリーズオフ 双想 Break out of my shell」']
  ]);
  function categories(items,reference=items){
    const result=new Map(),byId=new Map(reference.filter(s=>s.id!=null).map(s=>[s.id,s]));
    for(const item of group(items,reference)){
      const song=byId.get(item.id)||item;
      // Display titles identify the work; audio filenames may be romanized
      // aliases (ユラリユレル is stored as yurariyureru.mp3).
      const {base}=describe(song.title||song.file||song.audio?.replace(/\.mp3$/,''));
      const anime=animeByTitle.get(bareName(base));
      const game=gameByTitle.get(gameKey(bareName(base)));
      const kind=anime?'anime':game?'game':'song',label=anime||game||base,id=`${kind}:${label}`;
      if(!result.has(id))result.set(id,{id,label,kind,items:[]});
      result.get(id).items.push(item);
    }
    return [...result.values()];
  }
  function optionLabel(item,category){
    if(category.kind!=='song') return item.ver?`${item.title}（${item.ver}）`:item.title;
    const {language}=describe(item.title||item.file||item.audio?.replace(/\.mp3$/,''));
    return ['中文','英文','日文','粵文'][language]=== '中文' && category.items.length===1
      ? '原版' : ['中文','英文','日文','粵文'][language];
  }
  window.SongOrder={group,categories,optionLabel};
})();

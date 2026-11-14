/* BEST 4U 歌詞 PV：同一套 render(t) 供瀏覽器即時預覽，也供 render-pv.mjs 逐格輸出成 MP4。
   畫面全部由時間 t 決定（不保留逐格狀態），任意跳轉與重複渲染都會得到相同畫面。 */
(() => {
'use strict';
const W = 1920, H = 1080, FPS = 30;
const params = new URLSearchParams(location.search);
const CHARACTER_PV = params.get('mode') === 'characters';
const CHARACTER_SHOT_LENGTH = 15;
const RENDER = params.has('render');
const JOB = params.get('job') || '0';
const cv = document.getElementById('pv');
const g = cv.getContext('2d');
const $ = s => document.querySelector(s);

// 主視覺：參考圖與臉部座標（Ken Burns 鏡頭的目標）；cast 第一位是主唱，sprite 由 tools/cutout.mjs 從參考圖去背
const ARTS = {
  vwest: {src:'assets/ref/vwest/group.png', crop:[0,0,1920,1080], faces:[]},
  breakshoot: {src: 'assets/ref/breakshoot-cover.png', crop: [0, 0, 720, 720],
    faces: [[142, 145], [288, 145], [433, 145], [579, 145], [142, 338], [288, 338], [433, 338], [579, 338], [142, 531], [288, 531], [433, 531], [579, 531]]},
  growup: {src: 'assets/ref/growup/group.png', crop: [0, 0, 1920, 1080],
    faces: [[190, 89], [571, 89], [935, 89], [1340, 89], [1706, 89], [193, 629], [565, 629], [958, 629], [1342, 629], [1726, 629]]},
  best4u: {src: 'assets/best4u-cover.webp', crop: [0, 38, 673, 537],
    faces: [[118, 110], [195, 160], [272, 124], [372, 127], [455, 157], [533, 102], [238, 234], [305, 242], [385, 224]]},
  rooftop: {src: 'assets/ref/rooftop6.webp', crop: [0, 0, 1536, 1024],
    faces: [[195, 195], [400, 190], [680, 140], [925, 250], [1165, 225], [1385, 250]]},
  stage: {src: 'assets/ref/stage9.webp', crop: [0, 0, 1774, 887],
    faces: [[195, 165], [345, 200], [510, 195], [690, 195], [860, 215], [1060, 205], [1235, 215], [1400, 205], [1580, 190]]},
  anaru: {src: 'assets/ref/anaru6.png', crop: [0, 0, 1920, 1080],
    faces: [[181, 369], [588, 377], [919, 402], [1216, 372], [1486, 367], [1726, 380]]},
  // 招財喵布布八人：由 tools/build-group.mjs 把 tools/cutout-solo.mjs 的切圖拼成群像
  lucky8: {src: 'assets/ref/lucky8.png', crop: [0, 0, 1920, 1080],
    faces: [[234, 111], [720, 104], [718, 644], [1195, 644], [1198, 104], [1679, 105], [244, 644], [1674, 644]]},
  aiura: {src: 'assets/ref/aiura-group.png', crop: [0, 0, 1920, 1080],
    faces: [[976, 285], [425, 287], [1469, 294]]},
  // 超かぐや姫！：畫面取自歌詞影片，由 tools/cutout-kaguya.py 去背切圖並拼成群像
  kaguya: {src: 'assets/ref/kaguya-group.png', crop: [0, 0, 1920, 1080],
    faces: [[960, 300], [430, 446], [1500, 464]]},
  // メモリーズオフ 双想：使用者提供的 Forever＆ever 單曲封面
  forever: {src: 'assets/ref/forever/cover.png', crop: [0, 0, 727, 720],
    faces: [[250, 115], [500, 120], [195, 360], [400, 310], [360, 500], [165, 590]]}
};
const SONGS = [
  {title: '大好きだよって叫ぶんだ', ver: '小日向理瀬 ver.', file: '大好きだよって叫ぶんだ [小日向理瀬ver.]',
   subs: 'Subtitle_この想いは止められないよ いつだって眩...も_1790793102916.srt', theme: 'summer', art: 'best4u',
   cast: [['idol', 0, '理瀬', '#f6a531'], ['idol', 1, '純華', '#2ba6e1'], ['idol', 2, '陽和', '#ee5b97'], ['idol', 3, '咲希', '#3cc39a'], ['idol', 4, '雪乃', '#8d6ad6']]},
  {title: 'SUNRISE', ver: '小日向理瀬 ver.', file: 'SUNRISE [小日向理瀬ver.]',
   subs: 'Subtitle_《SUN RISE…》手をとっては競い...…_1790794218236.srt', theme: 'sunrise', art: 'rooftop',
   cast: [['casual', 4, '理瀬', '#f6a531'], ['casual', 1, '陽和', '#ee5b97'], ['casual', 0, '純華', '#2ba6e1'], ['casual', 2, '咲希', '#3cc39a'], ['casual', 3, '雪乃', '#8d6ad6'], ['casual', 8, '智', '#f0c23a']]},
  {title: 'HELLO HERO', ver: '御社 智 ver.', file: 'HELLO HERO [御社 智ver.]',
   subs: 'Subtitle_これまでもこれからも　変わらずいるよヨ...る_1790795207681.srt', theme: 'twilight', art: 'stage',
   cast: [['casual', 8, '智', '#f0c23a'], ['casual', 7, '羽月', '#e0524f'], ['casual', 11, 'ティーナ', '#79c5a3'], ['casual', 9, '祐里子', '#f4a6b8'], ['casual', 10, '千尋', '#2ba6e1']]},
  {title: '風の中は走るっきゃないっ！', ver: '三月のパンタシア', file: '風の中は走るっきゃないっ！ [三月のパンタシア]',
   subs: '風の中は走るっきゃないっ！.srt', theme: 'wind', art: 'anaru',
   series: '三月のパンタシア', kicker: 'TVアニメ「生徒会にも穴はある！」OP',
   cast: [['anaru', 0, '梅', '#e07a45'], ['anaru', 1, '寿子', '#e0893a'], ['anaru', 2, 'こころ', '#f08aaa'], ['anaru', 3, 'たん', '#6ecf9a'], ['anaru', 4, '有栖', '#7aa2ff'], ['anaru', 5, '敏深', '#d7c4a8']]},
  {title: 'ぴ', ver: 'ナナヲアカリ', file: 'ぴ [ナナヲアカリ]',
   subs: 'ぴ.srt', theme: 'pit', art: 'anaru',
   series: 'ナナヲアカリ', kicker: 'TVアニメ「生徒会にも穴はある！」ED',
   cast: [['anaru', 0, '梅', '#e07a45'], ['anaru', 1, '寿子', '#e0893a'], ['anaru', 2, 'こころ', '#f08aaa'], ['anaru', 3, 'たん', '#6ecf9a'], ['anaru', 4, '有栖', '#7aa2ff'], ['anaru', 5, '敏深', '#d7c4a8']]},
  {title: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥', ver: 'Suno v6', file: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥',
   subs: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥.srt', theme: 'lucky', art: 'lucky8', lead: 2,
   series: '招財喵布布', kicker: '鋒兄生日祝福曲',
   cast: [['lucky', 0, '鯨魚娘', '#3f7fd0'], ['lucky', 1, '咕咕嘎嘎', '#3a4250'], ['lucky', 2, '鋒兄', '#b08a4a'], ['lucky', 3, '塗哥', '#7b8794'],
          ['lucky', 4, '喵布布', '#d9822b'], ['lucky', 5, '喵白白', '#8d97a3'], ['lucky', 6, 'Claude 娘', '#d9874e'], ['lucky', 7, 'GPT 娘', '#c2b9e9']]},
  {title: '私は、わたしの事が好き。', ver: 'かぐや(cv.夏吉ゆうこ)', file: '私は、わたしの事が好き。 [かぐや(cv.夏吉ゆうこ)]',
   subs: '私は、わたしの事が好き。.srt', theme: 'kaguya', art: 'kaguya',
   series: 'HoneyWorks', kicker: '映画「超かぐや姫！」',
   cast: [['kaguya', 0, 'かぐや', '#f2a7c3'], ['kaguya', 1, '彩葉', '#7fd8bb'], ['kaguya', 2, 'ツキ', '#e9a94f']]},
  {title: 'カニ☆Do-Luck!', ver: 'あいうらぶ', file: 'カニ☆Do-Luck!',
   subs: 'カニ☆Do-Luck!.srt', theme: 'summer', art: 'aiura',
   series: 'あいうらぶ', kicker: 'カニ☆Do-Luck!',
   cast: [['aiura', 0, '天谷奏香', '#d58761'], ['aiura', 1, '岩沢彩生', '#c7b75e'], ['aiura', 2, '上原歩子', '#6ea8ac']]},
  {title: 'ユラリユレル', ver: 'NOMELON NOLEMON', file: 'yurariyureru',
   subs: 'yurariyureru.srt', theme: 'growup', art: 'growup', lead: 0,
   series: 'グロウアップショウ', kicker: 'ひまわりのサーカス団 · OPENING',
   cast: [['growup', 0, '鶴巻瑞佳', '#c72d48'], ['growup', 1, '川澄桜翔', '#368fc4'], ['growup', 2, '吾野伊万里', '#73a34b'],
          ['growup', 3, '五十土五十鈴', '#e99038'], ['growup', 4, '由良 葵', '#a28ac4'], ['growup', 5, '由良 茜', '#c74360'],
          ['growup', 6, '酒匂 雫', '#7786ba'], ['growup', 7, 'スヴェトラーナ', '#d7d3c9'], ['growup', 8, '間宮 凛', '#bd8b4c'], ['growup', 9, '麻利亜', '#f1bc3e']]},
  {title: '明日へのBreakShoot', ver: '葉山陽和 ver.', file: '明日へのBreakShoot [葉山陽和ver.]',
   subs: '明日へのBreakShoot.srt', theme: 'wind', art: 'breakshoot', lead: 1, photoAspect: 16/9,
   series: 'Extreme Hearts', kicker: 'CHARACTER SONG · 葉山陽和',
   cast: [['casual', 0, '前原純華', '#2ba6e1'], ['casual', 1, '葉山陽和', '#ee5b97'], ['casual', 2, '小鷹咲希', '#3cc39a'], ['casual', 3, '橘雪乃', '#8d6ad6'],
          ['casual', 4, '小日向理瀬', '#f6a531'], ['casual', 5, 'ミシェル・イェーガー', '#d2c8cf'], ['casual', 6, 'アシュリー・ヴァンクロフト', '#9b85ce'],
          ['casual', 7, '桜井羽月', '#ebbd48'], ['casual', 8, '御社智', '#e9819d'], ['casual', 9, '末宗祐里子', '#e5b8b9'], ['casual', 10, '本田千尋', '#54bed5'], ['casual', 11, 'ティーナ・メルキース', '#74c4a5']]},
  {title: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥(英文歌詞)', ver: 'Suno v6', file: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥(英文歌詞)',
   subs: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥(英文歌詞).srt', theme: 'lucky', art: 'lucky8', lead: 2,
   series: '招財喵布布', kicker: '鋒兄生日祝福曲 · ENGLISH VERSION',
   cast: [['lucky', 0, '鯨魚娘', '#3f7fd0'], ['lucky', 1, '咕咕嘎嘎', '#3a4250'], ['lucky', 2, '鋒兄', '#b08a4a'], ['lucky', 3, '塗哥', '#7b8794'],
          ['lucky', 4, '喵布布', '#d9822b'], ['lucky', 5, '喵白白', '#8d97a3'], ['lucky', 6, 'Claude 娘', '#d9874e'], ['lucky', 7, 'GPT 娘', '#c2b9e9']]},
  {title: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥(日文歌詞)', ver: 'Suno v6', file: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥(日文歌詞)',
   subs: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥(日文歌詞).srt', theme: 'lucky', art: 'lucky8', lead: 2,
   series: '招財喵布布', kicker: '鋒兄生日祝福曲 · 日本語版',
   cast: [['lucky', 0, '鯨魚娘', '#3f7fd0'], ['lucky', 1, '咕咕嘎嘎', '#3a4250'], ['lucky', 2, '鋒兄', '#b08a4a'], ['lucky', 3, '塗哥', '#7b8794'],
          ['lucky', 4, '喵布布', '#d9822b'], ['lucky', 5, '喵白白', '#8d97a3'], ['lucky', 6, 'Claude 娘', '#d9874e'], ['lucky', 7, 'GPT 娘', '#c2b9e9']]},
  {title: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥(粵文歌詞)', ver: 'Suno v6', file: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥(粵文歌詞)',
   subs: '統一發票頭獎得主鋒兄威力彩頭獎得主塗哥(粵文歌詞).srt', theme: 'lucky', art: 'lucky8', lead: 2,
   series: '招財喵布布', kicker: '鋒兄生日祝福曲 · 粵語版',
   cast: [['lucky', 0, '鯨魚娘', '#3f7fd0'], ['lucky', 1, '咕咕嘎嘎', '#3a4250'], ['lucky', 2, '鋒兄', '#b08a4a'], ['lucky', 3, '塗哥', '#7b8794'],
          ['lucky', 4, '喵布布', '#d9822b'], ['lucky', 5, '喵白白', '#8d97a3'], ['lucky', 6, 'Claude 娘', '#d9874e'], ['lucky', 7, 'GPT 娘', '#c2b9e9']]},
  {title:'後はやるだけ！', ver:'V西2025', file:'後はやるだけ！', subs:'後はやるだけ！.srt', theme:'baseball', art:'vwest', lead:0,
   series:'にじさんじ · V西2025', kicker:'さらば碧き面影 · VRWEST',
   cast:[['vwest',0,'壱百満天原サロメ','#b89be4'],['vwest',1,'家長むぎ','#ddb65a'],['vwest',2,'Zeal Ginjoka','#5b9e7b'],['vwest',3,'小野町春香','#51c9e2'],
         ['vwest',4,'矢車りね','#a4c98f'],['vwest',5,'ハユン','#bd5262'],['vwest',6,'早瀬走','#8a75b8'],['vwest',7,'Etna Crimson','#e76443'],
         ['vwest',8,'渋谷ハジメ','#9dc06f'],['vwest',9,'戌亥とこ','#579b76'],['vwest',10,'狂蘭メロコ','#a177bd'],['vwest',11,'本間ひまわり','#f0ac3d'],
         ['vwest',12,'Nagisa Arcinia','#b34e79'],['vwest',13,'ラトナ・プティ','#bd8e5d'],['vwest',14,'エリー・コニファー','#79bdd7'],['vwest',15,'緋八マナ','#e3cc74'],['vwest',16,'樋口楓（監督）','#b7c7ed']]},
  {title:'最瞎結婚理由', ver:'Suno v6-mini', file:'最瞎結婚理由', subs:'最瞎結婚理由.srt', theme:'lucky', art:'lucky8', lead:2,
   series:'鋒兄 · 小塗', kicker:'今彩五三九牽紅線',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'最瞎結婚理由(英文歌詞)', ver:'Suno v6-mini', file:'最瞎結婚理由(英文歌詞)', subs:'最瞎結婚理由(英文歌詞).srt', theme:'lucky', art:'lucky8', lead:2,
   series:'鋒兄 · 小塗', kicker:'THE CRAZIEST WEDDING REASON · ENGLISH VERSION',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'最瞎結婚理由(粵文歌詞)', ver:'Suno v6-mini', file:'最瞎結婚理由(粵文歌詞)', subs:'最瞎結婚理由(粵文歌詞).srt', theme:'lucky', art:'lucky8', lead:2,
   series:'鋒兄 · 小塗', kicker:'今彩五三九牽紅線 · 粵語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'最瞎結婚理由(日文歌詞)', ver:'Suno v6-mini', file:'最瞎結婚理由(日文歌詞)', subs:'最瞎結婚理由(日文歌詞).srt', theme:'lucky', art:'lucky8', lead:2,
   series:'鋒兄 · 小塗', kicker:'今彩五三九牽紅線 · 日本語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒兄進化 Show！🔥', ver:'Suno', file:'鋒兄進化 Show！🔥', subs:'鋒兄進化 Show！🔥.srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒兄 · 塗哥', kicker:'台北有鋒兄真好 · EVOLUTION SHOW',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒兄進化 Show！🔥(英文歌詞)', ver:'Suno v6-mini', file:'鋒兄進化 Show！🔥(英文歌詞)', subs:'鋒兄進化 Show！🔥(英文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒兄 · 塗哥', kicker:"BROTHER FENG'S EVOLUTION SHOW · ENGLISH VERSION",
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒兄進化 Show！🔥(粵文歌詞)', ver:'Suno v6-mini', file:'鋒兄進化 Show！🔥(粵文歌詞)', subs:'鋒兄進化 Show！🔥(粵文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒兄 · 塗哥', kicker:'台北有鋒兄真係好 · 粵語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒兄進化 Show！🔥(日文歌詞)', ver:'Suno v6-mini', file:'鋒兄進化 Show！🔥(日文歌詞)', subs:'鋒兄進化 Show！🔥(日文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒兄 · 塗哥', kicker:'台北有鋒兄真好 · 日本語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'喵布布本喵掉的毛', ver:'Suno', file:'喵布布本喵掉的毛', subs:'喵布布本喵掉的毛.srt', theme:'lucky', art:'lucky8', lead:4, centers:[4],
   series:'喵布布', kicker:'本喵原廠 · 傲嬌出場',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'喵布布本喵掉的毛(英文歌詞)', ver:'Suno v6-mini', file:'喵布布本喵掉的毛(英文歌詞)', subs:'喵布布本喵掉的毛(英文歌詞).srt', theme:'lucky', art:'lucky8', lead:4, centers:[4],
   series:'喵布布', kicker:"BUBU'S ROYAL SHEDDING FUR · ENGLISH VERSION",
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'喵布布本喵掉的毛(日文歌詞)', ver:'Suno v6-mini', file:'喵布布本喵掉的毛(日文歌詞)', subs:'喵布布本喵掉的毛(日文歌詞).srt', theme:'lucky', art:'lucky8', lead:4, centers:[4],
   series:'喵布布', kicker:'本喵原廠 · 日本語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'喵布布本喵掉的毛(粵文歌詞)', ver:'Suno v6-mini', file:'喵布布本喵掉的毛(粵文歌詞)', subs:'喵布布本喵掉的毛(粵文歌詞).srt', theme:'lucky', art:'lucky8', lead:4, centers:[4],
   series:'喵布布', kicker:'本喵原廠 · 粵語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'水電進化 Show', ver:'Suno', file:'水電進化 Show', subs:'水電進化 Show.srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'水電進化 Show', kicker:'從水電進化到樂團',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'水電進化 Show(英文歌詞)', ver:'Suno v6-mini', file:'水電進化 Show(英文歌詞)', subs:'水電進化 Show(英文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'水電進化 Show', kicker:'PLUMBING EVOLUTION SHOW · ENGLISH VERSION',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'水電進化 Show(日文歌詞)', ver:'Suno v6-mini', file:'水電進化 Show(日文歌詞)', subs:'水電進化 Show(日文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'水電進化 Show', kicker:'從水電進化到樂團 · 日本語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'水電進化 Show(粵文歌詞)', ver:'Suno v6-mini', file:'水電進化 Show(粵文歌詞)', subs:'水電進化 Show(粵文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'水電進化 Show', kicker:'由水電進化到樂隊 · 粵語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒塗力百年夢', ver:'Suno', file:'鋒塗力百年夢', subs:'鋒塗力百年夢.srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒塗力', kicker:'資訊 · 文化 · 水電科技',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒塗力百年夢(英文歌詞)', ver:'Suno v6-mini', file:'鋒塗力百年夢(英文歌詞)', subs:'鋒塗力百年夢(英文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒塗力', kicker:'FENG TU POWER · A HUNDRED-YEAR DREAM',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒塗力百年夢(日文歌詞)', ver:'Suno v6-mini', file:'鋒塗力百年夢(日文歌詞)', subs:'鋒塗力百年夢(日文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒塗力', kicker:'資訊 · 文化 · 水電科技 · 日本語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒塗力百年夢(粵文歌詞)', ver:'Suno v6-mini', file:'鋒塗力百年夢(粵文歌詞)', subs:'鋒塗力百年夢(粵文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒塗力', kicker:'資訊 · 文化 · 水電科技 · 粵語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'我與國中畢業紀念冊的對話', ver:'Suno', file:'我與國中畢業紀念冊的對話', subs:'我與國中畢業紀念冊的對話.srt', theme:'twilight', art:'lucky8', lead:2,
   series:'鋒兄 × 畢業紀念冊', kicker:'排列組合 · 一場神秘對話',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'我與國中畢業紀念冊的對話(英文歌詞)', ver:'Suno v6-mini', file:'我與國中畢業紀念冊的對話(英文歌詞)', subs:'我與國中畢業紀念冊的對話(英文歌詞).srt', theme:'twilight', art:'lucky8', lead:2,
   series:'鋒兄 × 畢業紀念冊', kicker:'A YEARBOOK CONVERSATION · ENGLISH VERSION',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'我與國中畢業紀念冊的對話(日文歌詞)', ver:'Suno v6-mini', file:'我與國中畢業紀念冊的對話(日文歌詞)', subs:'我與國中畢業紀念冊的對話(日文歌詞).srt', theme:'twilight', art:'lucky8', lead:2,
   series:'鋒兄 × 畢業紀念冊', kicker:'排列組合 · 畢業紀念冊 · 日本語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'我與國中畢業紀念冊的對話(粵文歌詞)', ver:'Suno v6-mini', file:'我與國中畢業紀念冊的對話(粵文歌詞)', subs:'我與國中畢業紀念冊的對話(粵文歌詞).srt', theme:'twilight', art:'lucky8', lead:2,
   series:'鋒兄 × 畢業紀念冊', kicker:'數字 · 回憶 · 夢想 · 粵語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'塗哥水電王子爆紅', ver:'Suno', file:'塗哥水電王子爆紅', subs:'塗哥水電王子爆紅.srt', theme:'sunrise', art:'lucky8', lead:3,
   series:'塗哥水電王子', kicker:'人物故事 · 鋒兄歷史小學堂',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'塗哥水電王子爆紅(英文歌詞)', ver:'Suno v6-mini', file:'塗哥水電王子爆紅(英文歌詞)', subs:'塗哥水電王子爆紅(英文歌詞).srt', theme:'sunrise', art:'lucky8', lead:3,
   series:'塗哥水電王子', kicker:'THE PLUMBING PRINCE · ENGLISH VERSION',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'塗哥水電王子爆紅(日文歌詞)', ver:'Suno v6-mini', file:'塗哥水電王子爆紅(日文歌詞)', subs:'塗哥水電王子爆紅(日文歌詞).srt', theme:'sunrise', art:'lucky8', lead:3,
   series:'塗哥水電王子', kicker:'水電王子 · 人物故事 · 日本語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'塗哥水電王子爆紅(粵文歌詞)', ver:'Suno v6-mini', file:'塗哥水電王子爆紅(粵文歌詞)', subs:'塗哥水電王子爆紅(粵文歌詞).srt', theme:'sunrise', art:'lucky8', lead:3,
   series:'塗哥水電王子', kicker:'水電王子 · 人物故事 · 粵語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒兄的傳奇人生', ver:'Suno', file:'鋒兄的傳奇人生', subs:'鋒兄的傳奇人生.srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒兄的傳奇人生', kicker:'從頭獎到榜首 · 從榜首到總統',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒兄的傳奇人生(英文歌詞)', ver:'Suno v6-mini', file:'鋒兄的傳奇人生(英文歌詞)', subs:'鋒兄的傳奇人生(英文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒兄的傳奇人生', kicker:'FROM JACKPOT TO PRESIDENT · ENGLISH VERSION',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒兄的傳奇人生(日文歌詞)', ver:'Suno v6-mini', file:'鋒兄的傳奇人生(日文歌詞)', subs:'鋒兄的傳奇人生(日文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒兄的傳奇人生', kicker:'頭獎から首席へ · 首席から大統領へ · 日本語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'鋒兄的傳奇人生(粵文歌詞)', ver:'Suno v6-mini', file:'鋒兄的傳奇人生(粵文歌詞)', subs:'鋒兄的傳奇人生(粵文歌詞).srt', theme:'sunrise', art:'lucky8', lead:2,
   series:'鋒兄的傳奇人生', kicker:'由頭獎去到榜首 · 由榜首去到總統 · 粵語版',
   cast:[['lucky',0,'鯨魚娘','#3f7fd0'],['lucky',1,'咕咕嘎嘎','#3a4250'],['lucky',2,'鋒兄','#b08a4a'],['lucky',3,'塗哥','#7b8794'],
         ['lucky',4,'喵布布','#d9822b'],['lucky',5,'喵白白','#8d97a3'],['lucky',6,'Claude 娘','#d9874e'],['lucky',7,'GPT 娘','#c2b9e9']]},
  {title:'Forever＆ever', ver:'彩音', file:'Forever＆ever', subs:'Forever＆ever.srt', theme:'summer', art:'forever', lead:3,
   series:'メモリーズオフ 双想', kicker:'Break out of my shell · OPENING',
   cast:[['forever',0,'フェルスター・マリー・暁空','#4aa3e8'],['forever',1,'田中結','#e23b6a'],['forever',2,'北方和音','#e0a020'],
         ['forever',3,'洲宮紗絵','#6d5bd0'],['forever',4,'天羽ねね','#ef6a3a'],['forever',5,'中森雪加','#f0a24a']]}
];

// Forever＆ever 的逐字填色時間：每串數字是 clean() 後每個非空白字「唱完」的秒數，
// 與 SRT 的 43 句一一對應（來源：assets/ref/forever/timings-ja.json 的詞級對齊）。
const FOREVER_SYLLABLES = [
  '6.18 6.27 6.35 6.44 6.60 6.76 6.92 7.21 7.49 7.78 8.06',
  '9.20 9.36 9.76 10.20 11.06 11.76',
  '12.12 12.34 12.50 12.66 13.12 13.35 13.58 13.80 13.97 14.14 14.62',
  '15.54 15.88 16.18 16.44 16.68 16.89 17.10',
  '17.56 17.65 17.75 17.84 17.98 18.12 18.26 18.52 18.79 19.05 19.32',
  '20.36 20.72 21.08 21.48 21.86 22.24 23.04',
  '23.46 23.68 23.86 24.12 24.12 24.12 24.12 24.12 24.12 24.72 24.88 25.14 25.42 26.46',
  '29.50 29.90 30.24 30.56 31.06 31.24 31.40 31.56',
  '38.12 38.54 38.66 38.78 38.90 39.38 39.70 40.02 43.64 43.88 44.20 44.42 44.58 44.94 45.40 46.12 46.63 47.14',
  '48.60 48.86 49.12 49.72 50.20 50.52 50.82 51.54 52.36 52.36 52.36 52.66 53.00 53.00 53.34 53.60 53.94 54.28 55.50 56.02 56.88 57.28 57.68',
  '61.52 62.56 63.27 63.98 64.68',
  '68.28 68.80 69.32 70.88 71.12 72.46',
  '73.59 73.90 74.21 74.52 74.71 74.89 75.08 75.67 75.90 76.13 76.36',
  '77.30 77.57 77.84 78.26 78.62 79.44 79.61 79.78 79.88',
  '80.22 80.40 80.60 80.90 81.46 81.58 81.72 81.90 82.16 82.42 82.68',
  '83.29 83.90 84.42 84.58 84.80 85.02 85.24',
  '85.68 85.77 85.87 85.96 86.13 86.29 86.46 86.75 87.04 87.33 87.62',
  '88.72 89.30 90.02 90.50 91.16',
  '91.40 91.64 92.16 92.66 93.06 93.30 93.51 93.72 94.08',
  '97.63 98.08 98.32 98.56 98.86 99.12 99.35 99.58',
  '106.10 106.40 106.58 106.96 107.14 107.56 107.78 107.92 108.11 108.30 111.72 111.88 112.10 112.24 112.38 112.38 112.66 113.00 113.22 113.56 113.90 113.90 113.90',
  '115.26 117.30 117.68 117.94 118.36 118.66 118.96 119.62 120.12 120.54 120.90 121.52 121.78 122.10 122.58 123.06 124.00 126.46',
  '129.56 130.46 131.32 132.14 132.86',
  '135.24 136.12 136.94 139.06 139.30 141.48',
  '143.88 143.99 144.09 144.20 144.35 144.51 144.66 145.40 145.57 145.75 145.92',
  '146.96 147.12 147.52 147.90 148.76 149.42',
  '149.84 150.08 150.25 150.42 150.86 151.10 151.34 151.52 151.70 151.88 152.40',
  '153.28 153.62 153.92 154.16 154.44 154.66 154.88',
  '155.28 155.35 155.43 155.50 155.65 155.79 155.94 156.75 156.93 157.10 157.28',
  '158.18 158.48 158.82 159.24 159.65 160.06 160.76',
  '161.20 161.40 161.62 162.04 162.04 162.04 162.04 162.04 162.04 162.04 162.52 162.68 162.68 162.92 163.16 164.62',
  '167.22 167.66 168.00 168.32 168.84 168.96 169.81 170.66',
  '179.16 179.48 180.20 180.73 181.26 183.10 183.22 184.36',
  '186.50 186.61 186.71 186.82 186.97 187.11 187.26 187.93 188.10 188.27 188.44',
  '189.52 189.79 190.06 190.46 190.82 191.12 191.54 191.96 192.14',
  '192.38 192.62 192.86 193.08 193.66 193.80 193.94 194.08 194.30 194.58 194.86',
  '195.48 196.10 196.54 196.76 196.97 197.19 197.40',
  '197.88 197.97 198.07 198.16 198.31 198.47 198.62 199.33 199.50 199.67 199.84',
  '200.90 201.48 202.14 202.70 203.36',
  '203.60 203.84 204.26 204.86 205.24 205.48 205.67 205.86 206.42',
  '209.80 210.26 210.51 210.76 211.06 211.30 211.57 211.84',
  '229.14 229.40 229.62 229.84 229.84 229.84 229.84 229.84 229.84 229.84 230.24 230.64 230.64 230.92 231.30 232.78',
  '235.49 235.82 236.20 236.42 236.84 237.08 237.29 237.50',
];
// 每首歌一組配色：夏日向日葵、日出、黃昏星空、晴空疾風
const THEMES = {
  baseball: {sky:['#06374d','#237ca4','#c0e9f4'],pastel:['#fff8da','#e7f4fb'],accent:'#ffcc43',accent2:'#f49c36',cool:'#55cee4',deep:'#09283d',particle:'star'},
  growup:   {sky: ['#351429', '#b84b3b', '#ffcb42'], pastel: ['#fff8df', '#ffebbb'], accent: '#ffd64c', accent2: '#dd4058', cool: '#69c7c3', deep: '#301326', particle: 'spark'},
  summer:   {sky: ['#0b3d74', '#2f8fe0', '#bfeaff'], pastel: ['#fff8dc', '#d6f0ff'], accent: '#ffd23f', accent2: '#ff7b54', cool: '#5fd0ff', deep: '#0b2d55', particle: 'petal'},
  sunrise:  {sky: ['#22164a', '#b8487d', '#ffbf7a'], pastel: ['#fff1e6', '#ffe0ef'], accent: '#ffc35c', accent2: '#ff5f93', cool: '#a99bff', deep: '#2a1640', particle: 'spark'},
  twilight: {sky: ['#050820', '#2b2366', '#d0677a'], pastel: ['#eef0ff', '#ffe6ea'], accent: '#ffd56b', accent2: '#9c7bff', cool: '#62d4ff', deep: '#14123a', particle: 'star'},
  wind:     {sky: ['#0e3a66', '#49b4ef', '#e8f8ff'], pastel: ['#f3fbff', '#e5fff6'], accent: '#ffe14a', accent2: '#3ec6ff', cool: '#d7f6ff', deep: '#0c2748', particle: 'wind'},
  pit:      {sky: ['#431a6b', '#ff79b8', '#ffe9a8'], pastel: ['#fff3fb', '#eafaff'], accent: '#ff4f9a', accent2: '#31d3c6', cool: '#ffd166', deep: '#2a1146', particle: 'dot'},
  lucky:    {sky: ['#4a0a16', '#c8202f', '#ffd98a'], pastel: ['#fff6e2', '#ffe4e6'], accent: '#ffd23f', accent2: '#ff4d6d', cool: '#ffb703', deep: '#33070f', particle: 'coin'},
  // 超かぐや姫！：祭典夜的紫藍到燈籠橘，配上升的燈籠光點
  kaguya:   {sky: ['#120e34', '#5a2472', '#ffb45e'], pastel: ['#fff2f8', '#ffe9d2'], accent: '#ffcf6a', accent2: '#ff7fae', cool: '#9ad7ff', deep: '#1a0f33', particle: 'lantern'}
};
const LOGO = [['B', '#2ba6e1'], ['E', '#f6a531'], ['S', '#ee5b97'], ['T', '#2ba6e1'], [' ', ''], ['4', '#f6a531'], ['U', '#8d6ad6']];
const POP = ['#ee5b97', '#2ba6e1', '#f6a531', '#8d6ad6', '#3cc39a', '#f08a4b'];
const FONT = {
  jp: '"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif',
  mincho: '"Hiragino Mincho ProN",serif',
  maru: '"Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif',
  zh: '"PingFang TC","Heiti TC",sans-serif',
  mono: 'Menlo,monospace',
  cond: '"Avenir Next Condensed","Avenir Next",sans-serif',
  logo: '"Avenir Next",sans-serif'
};

const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, u) => a + (b - a)*u;
const smooth = u => { u = clamp(u); return u*u*(3 - 2*u); };
const easeOut = u => 1 - Math.pow(1 - clamp(u), 3);
const easeBack = u => { u = clamp(u); const c = 1.9; return 1 + (c + 1)*Math.pow(u - 1, 3) + c*Math.pow(u - 1, 2); };
const hash = n => { const s = Math.sin(n*127.1 + 311.7)*43758.5453; return s - Math.floor(s); };
const frac = x => x - Math.floor(x);
const pad = (n, l = 2) => String(Math.max(0, n)).padStart(l, '0');
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// 網址沒帶 song 時接上次看的那一首。?song= 優先；逐格輸出不讀、也不寫這份紀錄。
const LAST_SONG_KEY = 'pv-last-song';
function savedSong(){
  try{
    const n = +localStorage.getItem(LAST_SONG_KEY);
    if(Number.isInteger(n) && n >= 0 && n < SONGS.length) return n;
  }catch{}
  return 0;
}
function rememberSong(i){
  try{ localStorage.setItem(LAST_SONG_KEY, String(i)); }catch{}
}
const songIndex = params.has('song') ? clamp(+params.get('song') | 0, 0, SONGS.length - 1) : savedSong();
const song = SONGS[songIndex];
if(!RENDER){
  rememberSong(songIndex);
  if(!params.has('song')){
    try{
      const q = new URLSearchParams(location.search);
      q.set('song', String(songIndex));
      history.replaceState(null, '', `${location.pathname}?${q}`);
    }catch{}
  }
}
song.audio = song.file + '.mp3';
const T = THEMES[song.theme];
const ART = ARTS[song.art], AW = ART.crop[2], AH = ART.crop[3], FACES = ART.faces;
// 成員：song.lead 是主唱（預設第一位）；名字未知的成員以編號標示
const MEMBERS = song.cast.map(([sheet, idx, name, color], i) => ({sheet, idx, name: name || `No.${pad(i + 1)}`, color, img: null, meta: null}));
const LEAD = clamp(+(song.lead ?? 0) | 0, 0, MEMBERS.length - 1);
const OTHERS = MEMBERS.map((_, i) => i).filter(i => i !== LEAD);
const CENTERS = song.centers || (song.cast[0][0] === 'lucky' ? [2,3] : [LEAD]);
const BASE_CHARACTER_GROUPS = [
  {sheet:'casual',title:'十二人 · 制服與便服',src:'assets/ref/casual-remade/group.png',colors:['#11bbde','#ff86b1'],count:12,solo:true},
  {sheet:'rooftop',title:'屋頂六人 · SUNRISE',src:'assets/ref/rooftop6.webp',colors:['#70ccff','#bdf1bc'],count:6},
  {sheet:'idol',title:'RISE 五人 · 演出服',src:'assets/ref/rise5.webp',colors:['#284b92','#f1c265'],count:5},
  {sheet:'stage',title:'舞台九人 · 黃昏演出',src:'assets/ref/stage9.webp',colors:['#918be8','#f9b38e'],count:9}
];
const CHARACTER_GROUPS = song.cast[0][0] === 'anaru'
  ? [{sheet:'anaru', title:'生徒会六人', src:'assets/ref/anaru6.png', colors:['#49b4ef','#ffe14a'], count:6}]
  : song.cast[0][0] === 'lucky'
  ? [{sheet:'lucky', title:'招財喵布布 · 幸運八人', src:'assets/ref/lucky8.png', colors:['#c8202f','#ffd98a'], count:8, solo:true}]
  : song.cast[0][0] === 'kaguya'
  ? [{sheet:'kaguya', title:'かぐや · 彩葉 · ツキ', src:'assets/ref/kaguya-group.png', colors:['#3a1d63','#ffb45e'], count:3, solo:true}]
  : song.cast[0][0] === 'aiura'
  ? [{sheet:'aiura', title:'あいうら · 奏香・彩生・歩子', src:'assets/ref/aiura-group.png', colors:['#7fbfba','#ffe3b2'], count:3, solo:true}]
  : song.cast[0][0] === 'growup'
  ? [{sheet:'growup', title:'ひまわりサーカス · 十人', src:'assets/ref/growup/group.png', colors:['#e8a72f','#ffd968'], count:10, solo:true}]
  : song.cast[0][0] === 'vwest'
  ? [{sheet:'vwest',title:'V西2025 · 選手16人＋監督',src:'assets/ref/vwest/group.png',colors:['#ffcc43','#55cee4'],count:17,solo:true}]
  : song.cast[0][0] === 'forever'
  ? [{sheet:'forever', title:'メモリーズオフ 双想 · 六人', src:'assets/ref/forever/cover.png', colors:['#49b4ef','#ffe9a8'], count:6, solo:true}]
  : song.art === 'breakshoot'
  ? [{sheet:'casual', title:'Extreme Hearts · 十二人', src:'assets/ref/casual-remade/group.png', colors:['#5cabe0','#f3afd3'], count:12,solo:true}]
  : BASE_CHARACTER_GROUPS;
let A = null, cues = [], sections = [], shots = [], TJ = [], TZ = [], C = {}, songScript = 'cjk';

/* ---------------- 音訊分析：節拍、低中頻能量 ---------------- */
async function analyse(buf){
  const SR = 22050;
  // Decoding may detach the input buffer; retain the original for preview audio.
  const ab = await new OfflineAudioContext(1, 1, SR).decodeAudioData(buf.slice(0));
  const filtered = async chain => {
    const oc = new OfflineAudioContext(1, ab.length, SR);
    const src = oc.createBufferSource(); src.buffer = ab;
    let node = src;
    for(const [type, f, q] of chain){ const b = oc.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; node.connect(b); node = b; }
    node.connect(oc.destination); src.start();
    return (await oc.startRendering()).getChannelData(0);
  };
  const full = await filtered([]);
  const low = await filtered([['lowpass', 150, .7], ['lowpass', 150, .7]]);
  const mid = await filtered([['highpass', 300, .7], ['lowpass', 3400, .7]]);
  const dur = ab.duration;
  const rms = (x, rate) => {
    const n = Math.ceil(dur*rate), out = new Float32Array(n);
    for(let f = 0; f < n; f++){
      const a = Math.floor(f*SR/rate), b = Math.min(x.length, Math.floor((f + 1)*SR/rate));
      let s = 0; for(let i = a; i < b; i++) s += x[i]*x[i];
      out[f] = Math.sqrt(s/Math.max(1, b - a));
    }
    return out;
  };
  const norm = a => { const s = Float32Array.from(a).sort(); const p = s[Math.floor(s.length*.98)] || 1; for(let i = 0; i < a.length; i++) a[i] = Math.min(1.3, a[i]/p); return a; };
  const out = {dur, rms: norm(rms(full, FPS)), low: norm(rms(low, FPS)), mid: norm(rms(mid, FPS))};
  out.cumMid = new Float32Array(out.mid.length + 1);
  for(let i = 0; i < out.mid.length; i++) out.cumMid[i + 1] = out.cumMid[i] + out.mid[i]*out.mid[i];

  // 節拍：低頻＋全頻起音包絡 → 自相關取 BPM → 細掃 BPM 與相位
  const R = 100, l100 = rms(low, R), f100 = rms(full, R), n = l100.length;
  const on = new Float32Array(n);
  for(let i = 1; i < n; i++)
    on[i] = Math.max(0, Math.log1p(80*l100[i]) - Math.log1p(80*l100[i - 1])) + .5*Math.max(0, Math.log1p(80*f100[i]) - Math.log1p(80*f100[i - 1]));
  const pre = new Float32Array(n + 1); for(let i = 0; i < n; i++) pre[i + 1] = pre[i] + on[i];
  const flat = new Float32Array(n);
  for(let i = 0; i < n; i++){ const a = Math.max(0, i - 25), b = Math.min(n, i + 25); flat[i] = Math.max(0, on[i] - (pre[b] - pre[a])/(b - a)); }
  let best = -1, lag0 = 50;
  for(let lag = 28; lag <= 90; lag++){
    let s = 0; for(let i = 0; i + lag < n; i++) s += flat[i]*flat[i + lag];
    s *= Math.exp(-.5*Math.pow(Math.log2(6000/lag/128)/.55, 2));
    if(s > best){ best = s; lag0 = lag; }
  }
  const B = 64; let score = -1, bpm = 6000/lag0, phase = 0;
  for(let c = 6000/lag0 - 3; c <= 6000/lag0 + 3; c += .01){
    const P = 6000/c, bins = new Float32Array(B);
    for(let i = 0; i < n; i++) bins[Math.floor((i % P)/P*B)] += flat[i];
    for(let k = 0; k < B; k++){
      const v = bins[(k + B - 1) % B]*.5 + bins[k] + bins[(k + 1) % B]*.5;
      if(v > score){ score = v; bpm = c; phase = (k + .5)/B*P/R; }
    }
  }
  out.bpm = bpm; out.spb = 60/bpm; out.beat0 = phase;
  // 小節起點：四個拍位裡低頻起音最強者
  const sums = [0, 0, 0, 0];
  for(let j = 0; phase + j*out.spb < dur; j++){ const i = Math.round((phase + j*out.spb)*R); sums[j % 4] += flat[i] || 0; }
  out.barOff = sums.indexOf(Math.max(...sums));
  return out;
}
const sample = (arr, t) => arr[clamp(Math.round(t*FPS), 0, arr.length - 1)] || 0;
const cumMid = t => { const x = clamp(t*FPS, 0, A.mid.length), i = Math.floor(x), f = x - i; return A.cumMid[i] + (A.cumMid[Math.min(A.mid.length, i + 1)] - A.cumMid[i])*f; };
const beatPos = t => (t - A.beat0)/A.spb;
const pulse = t => Math.exp(-frac(beatPos(t))*6);
const energy = t => .55 + .6*sample(A.rms, t);

/* ---------------- 歌詞：SRT、斷詞、演唱進度 ---------------- */
function parseSrt(text){
  const tt = s => { const m = s.match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? +m[1]*3600 + +m[2]*60 + +m[3] + +('0.' + m[4]) : null; };
  const out = [];
  for(const block of text.replace(/\r/g, '').split(/\n\s*\n/)){
    const ls = block.split('\n').filter(x => x.trim());
    const i = ls.findIndex(x => x.includes('-->')); if(i < 0) continue;
    const [start, end] = ls[i].split('-->').map(tt); if(start == null) continue;
    const body = ls.slice(i + 1).map(x => x.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    let zh = '';
    if(body.length > 1 && !/[぀-ヿ]/.test(body[body.length - 1])) zh = body.pop();
    const jp = LyricText.clean(body.join(' '));
    zh=LyricText.clean(zh);
    if(jp) out.push({start, end: Math.max(end, start + .5), jp, zh});
  }
  return out.sort((a, b) => a.start - b.start);
}
const PUNCT = '、。・「」『』…,.';
function tokenize(text){
  const out = []; let bk = false;
  const re = /([一-鿿々〆ヶ]+|[A-Za-z]+(?: +[A-Za-z]+)*)[(（]([ぁ-ゟ゠-ヿ]+)[)）]|[A-Za-z0-9'’!?！？\-_~]+|./gsu;
  for(const m of text.matchAll(re)){
    const c = m[0];
    if(m[1]){ out.push({t: m[1], ruby: m[2], bk, w: m[1].length + .3}); continue; }
    if('［《[(（'.includes(c)){ bk = true; continue; }
    if('］》])）'.includes(c)){ bk = false; continue; }
    if(/^\s$/u.test(c)) out.push({t: ' ', sp: true, bk, w: .5});
    else if(/^[A-Za-z0-9]/.test(c)) out.push({t: c, latin: true, bk, w: Math.max(1, c.length*.45)});
    else if(PUNCT.includes(c) || /^[!?！？\-_~]+$/.test(c)) out.push({t: c, bk, w: .3, punct: true});
    else out.push({t: c, bk, w: 1});
  }
  let cw = 0; for(const u of out){ u.cw = cw; cw += u.w; }
  return out;
}
// 片頭膠卷用：每格一個字（漢字詞拆字、英文整字）
function tapeUnits(units){
  const out = [];
  for(const u of units){
    if(u.sp || (u.punct && PUNCT.includes(u.t))) continue;
    if(u.latin || u.punct) out.push({t: u.t, bk: u.bk, latin: u.latin});
    else for(const ch of u.t) out.push({t: ch, bk: u.bk});
  }
  return out;
}
// 演唱進度：線性時間與中頻（人聲）能量累積各半
function prog(c, t){
  if(t <= c.start) return 0;
  // 有逐字時間時，填色跟那個字走，不用整句的音量。鼓和伴奏會把後面的字提前填完。
  if(c.fill){
    let prevT = c.start, prevW = 0;
    for(const m of c.fill){
      if(t < m.t){
        const u = (t - prevT)/Math.max(.04, m.t - prevT);
        return clamp((prevW + (m.w - prevW)*u)/c.jW);
      }
      prevT = m.t; prevW = m.w;
    }
    return 1;
  }
  const e = c.sungEnd ?? (c.start + (c.end - c.start)*.93);
  if(t >= e) return 1;
  const lin = (t - c.start)/(e - c.start);
  const m0 = cumMid(c.start), m1 = cumMid(e);
  const en = m1 - m0 > 1e-6 ? clamp((cumMid(t) - m0)/(m1 - m0)) : lin;
  return clamp(.45*lin + .55*en);
}
function lastStarted(t){ let r = null; for(const c of cues){ if(c.start <= t) r = c; else break; } return r; }
function activeCue(t){ const c = lastStarted(t + .25); return c && t < c.end + .35 ? c : null; }

function buildSections(){
  const lv = cues.map(c => { let s = 0, n = 0; for(let x = c.start; x < c.end; x += 1/FPS){ s += sample(A.rms, x); n++; } return s/Math.max(1, n); });
  const thr = [...lv].sort((a, b) => a - b)[Math.floor(lv.length*.58)];
  const lab = lv.map(v => v >= thr ? 'C' : 'V');
  for(let i = 1; i < lab.length - 1; i++){
    if(lab[i] === 'V' && lab[i - 1] === 'C' && lab[i + 1] === 'C') lab[i] = 'C';
    else if(lab[i] === 'C' && lab[i - 1] !== 'C' && lab[i + 1] !== 'C') lab[i] = 'V';
  }
  // 開頭這句人聲較短、音量較高，會被算進後面的副歌。一算進去，開場就不再是膠卷，後面每段舞台的景別也會整段錯一位。
  if(song.file === 'Forever＆ever' && lab[0] === 'C') lab[0] = 'V';
  const blocks = [];
  lab.forEach((l, i) => { const b = blocks[blocks.length - 1]; if(b && b.l === l) b.cues.push(cues[i]); else blocks.push({l, cues: [cues[i]]}); });
  const secs = [{start: 0, label: 'INTRO'}];
  blocks.forEach((b, k) => {
    if(b.l === 'C'){ secs.push({start: b.cues[0].start, label: 'CHORUS', cues: b.cues}); return; }
    if(b.cues.length >= 4){
      const h = Math.ceil(b.cues.length/2);
      secs.push({start: b.cues[0].start, label: 'A-MELO', cues: b.cues.slice(0, h)});
      secs.push({start: b.cues[h].start, label: 'B-MELO', cues: b.cues.slice(h)});
    } else secs.push({start: b.cues[0].start, label: blocks[k + 1]?.l === 'C' && k > 0 ? 'B-MELO' : 'A-MELO', cues: b.cues});
  });
  for(const s of secs) for(const c of s.cues || []) c.sec = s;
  // 長間奏另立段落
  for(let i = 1; i < cues.length; i++) if(cues[i].start - cues[i - 1].end > 3){
    secs.push({start: cues[i - 1].end, label: 'INTERLUDE'});
    if(cues[i].sec.start < cues[i].start) secs.push({start: cues[i].start, label: cues[i].sec.label});
  }
  secs.push({start: cues[cues.length - 1].end, label: 'OUTRO'});
  secs.sort((a, b) => a.start - b.start).forEach((s, i) => s.no = i + 1);
  return secs;
}
const sectionAt = t => { let r = sections[0]; for(const s of sections){ if(s.start <= t) r = s; else break; } return r; };

function buildShots(){
  if(CHARACTER_PV){
    const out=[];
    for(let start=0,i=0;start<A.dur;start+=CHARACTER_SHOT_LENGTH,i++){
      const end=Math.min(start+CHARACTER_SHOT_LENGTH,A.dur);
      // Keep a short song tail in the preceding shot instead of flashing a new group.
      if(end-start<2 && out.length){out[out.length-1].end=end;break;}
      out.push({type:'characters',group:i%CHARACTER_GROUPS.length,start,end,seed:i+1});
    }
    return out;
  }
  const out = [], snap = t => A.beat0 + Math.round((t - A.beat0)/A.spb)*A.spb;
  const add = (type, start, end, o = {}) => { if(end - start > .05) out.push({type, start, end, seed: out.length + 1, ...o}); };
  const n = {film: 0, typo: 0, stage: 0, windows: 0, verse: 0, bike: 0};
  const first = cues[0], last = cues[cues.length - 1];
  const outroStart = Math.min(last.end, A.dur - 7);
  // 字幕比句子的開始早 0.25 秒出現。畫面從這句字幕出現切進來，到下一句字幕出現切走。
  // 分鏡數仍用句子本身的長度，避免提早開鏡把後面的舞台樣式整段錯開。
  const showAt = t => Math.max(0, t - .25);
  if(first.start > 1.2) add('stage', 0, showAt(first.start), {variant: 'intro'});
  cues.forEach((c, i) => {
    const next = cues[i + 1];
    const vis = showAt(c.start);
    const nextVis = next ? showAt(next.start) : Infinity;
    const cueEnd = Math.min(next ? Math.min(c.end, next.start) : c.end, outroStart);
    const end = Math.min(next ? Math.min(c.end, nextVis) : c.end, outroStart);
    if(end <= vis) return;
    const label = c.sec?.label || 'A-MELO';
    const v = n.verse++;
    let type = label === 'CHORUS' ? 'stage' : label === 'B-MELO' ? 'typo' : (v % 3 === 2 ? 'bike' : (Math.floor(v/2) % 2 ? 'windows' : 'film'));
    const parts = Math.max(1, Math.round((Math.max(0, cueEnd - c.start))/6.5));
    for(let p = 0; p < parts; p++){
      const s = p ? snap(vis + (end - vis)*p/parts) : vis;
      const e = p < parts - 1 ? snap(vis + (end - vis)*(p + 1)/parts) : end;
      const k = n[type]++;
      const o = {cue: c};
      if(type === 'stage') o.variant = ['wide', 'close', 'screen', 'close2'][k % 4];
      if(type === 'typo'){ o.member = k % 2 ? OTHERS[(k >> 1) % OTHERS.length] : LEAD; o.side = k % 2; }
      if(type === 'film'){
        o.rotationOffset=k*2;
        o.pair = [k*2 % MEMBERS.length, (k*2+1) % MEMBERS.length];
      }
      if(type === 'windows'){ o.rotationOffset=k*3; o.members=Array.from({length:3},(_,i)=>(k*3+i)%MEMBERS.length); o.layout = k % 2; }
      add(type, s, e, o);
    }
    if(next && next.start - c.end > 1 && c.end < outroStart){
      const gapEnd = Math.min(nextVis, outroStart);
      const gap = Math.min(next.start, outroStart) - c.end;
      const prevShot = out[out.length - 1];
      // 兩句 B-MELO 之間約 1.5–2.5 秒是節奏，人聲還沒進下一句。
      // 一秒出頭的空檔仍維持原來的舞台休息。沿用上一個字卡的人物，不插 DANCE BREAK，也不把上一句的填色拉長。
      // 空檔收到下一句字幕出現為止，字幕和畫面一起換。
      if(gap > 1.5 && gap <= 2.5 && prevShot?.type === 'typo' && c.sec?.label === 'B-MELO' && next.sec?.label === 'B-MELO'){
        prevShot.end = gapEnd;
      } else if(gap > 4) add('bike', c.end, gapEnd);
      else add('stage', c.end, gapEnd, {variant: 'break'});
    }
  });
  add('outro', outroStart, A.dur);
  return out;
}
function shotAt(t){
  let lo = 0, hi = shots.length - 1;
  while(lo < hi){ const m = (lo + hi + 1) >> 1; if(shots[m].start <= t) lo = m; else hi = m - 1; }
  return shots[lo];
}

/* ---------------- 預先繪製的素材 ---------------- */
function prepare(cover){
  const art = mk(AW, AH); art.getContext('2d').drawImage(cover, ART.crop[0], ART.crop[1], AW, AH, 0, 0, AW, AH);
  const blurred = (scale, px) => { const c = mk(Math.round(AW*scale), Math.round(AH*scale)), x = c.getContext('2d'); x.filter = `blur(${px}px)`; x.drawImage(art, -AW*scale*.05, -AH*scale*.05, AW*scale*1.1, AH*scale*1.1); return c; };
  // C.blur 是各鏡頭共用的背景底：模糊要夠重，否則人物會在半透明底圖上留下像殘影的重影，
  // 所以這裡只留大塊的色塊分布（看得出主題色），看不出角色輪廓。
  C.art = art; C.bloom = blurred(.5, 5); C.blur = blurred(.5, 30);
  const sky = mk(W, H), sx = sky.getContext('2d'), gr = sx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, T.sky[0]); gr.addColorStop(.55, T.sky[1]); gr.addColorStop(1, T.sky[2]);
  sx.fillStyle = gr; sx.fillRect(0, 0, W, H); C.sky = sky;
  const pastel = mk(W, H), px = pastel.getContext('2d'), pg = px.createLinearGradient(0, 0, W, H);
  pg.addColorStop(0, T.pastel[0]); pg.addColorStop(1, T.pastel[1]); px.fillStyle = pg; px.fillRect(0, 0, W, H);
  px.fillStyle = 'rgba(80,90,140,.10)';
  for(let y = 20; y < H; y += 36) for(let x = 20 + (y/36 % 2)*18; x < W; x += 36){ px.beginPath(); px.arc(x, y, 2.2, 0, Math.PI*2); px.fill(); }
  C.pastel = pastel;
  const vig = mk(W, H), vx = vig.getContext('2d'), vg = vx.createRadialGradient(W/2, H/2, H*.35, W/2, H/2, H*1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); vx.fillStyle = vg; vx.fillRect(0, 0, W, H); C.vig = vig;
  const noise = mk(256, 256), nx = noise.getContext('2d'), id = nx.createImageData(256, 256);
  for(let i = 0; i < id.data.length; i += 4){ const v = hash(i*.37)*255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  nx.putImageData(id, 0, 0); C.noise = g.createPattern(noise, 'repeat');
  const beam = mk(360, 1300), bx = beam.getContext('2d'), bg = bx.createLinearGradient(0, 0, 0, 1300);
  bg.addColorStop(0, 'rgba(255,255,255,.9)'); bg.addColorStop(.6, 'rgba(255,255,255,.18)'); bg.addColorStop(1, 'rgba(255,255,255,0)');
  bx.fillStyle = bg; bx.beginPath(); bx.moveTo(165, 0); bx.lineTo(195, 0); bx.lineTo(360, 1300); bx.lineTo(0, 1300); bx.closePath(); bx.filter = 'blur(6px)'; bx.fill();
  C.beam = beam;
  const floor = mk(W, 420), fx = floor.getContext('2d'), fg = fx.createLinearGradient(0, 0, 0, 420);
  fg.addColorStop(0, 'rgba(10,8,30,.55)'); fg.addColorStop(1, 'rgba(4,4,14,.96)'); fx.fillStyle = fg; fx.fillRect(0, 0, W, 420);
  fx.strokeStyle = 'rgba(255,255,255,.08)'; fx.lineWidth = 2;
  for(let i = -14; i <= 14; i++){ fx.beginPath(); fx.moveTo(W/2 + i*40, 0); fx.lineTo(W/2 + i*260, 420); fx.stroke(); }
  for(let k = 1; k < 9; k++){ const y = 420*Math.pow(k/9, 1.7); fx.beginPath(); fx.moveTo(0, y); fx.lineTo(W, y); fx.stroke(); }
  C.floor = floor;
  C.glow = {};
}
function glowSprite(color){
  if(C.glow[color]) return C.glow[color];
  const c = mk(128, 128), x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(.18, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return C.glow[color] = c;
}
const glow = (x, y, r, color, a = 1) => { g.globalAlpha = a; g.drawImage(glowSprite(color), x - r, y - r, r*2, r*2); g.globalAlpha = 1; };

/* ---------------- 共用畫面元件 ---------------- */
function backdrop(t, o = {}){
  g.drawImage(C.sky, 0, 0);
  const s = 1.22 + .04*Math.sin(t*.07), w = W*s, h = w*AH/AW;
  g.globalAlpha = o.art ?? .5;
  g.drawImage(C.blur, (W - w)/2 + Math.sin(t*.05)*50, (H - h)/2 + Math.cos(t*.04)*40, w, h);
  g.globalAlpha = o.tint ?? .5; g.drawImage(C.sky, 0, 0); g.globalAlpha = 1;
  if(o.dim){ g.fillStyle = `rgba(0,0,0,${o.dim})`; g.fillRect(0, 0, W, H); }
}
function particles(t, n, layer = 0, kind = T.particle){
  g.save();
  for(let i = 0; i < n; i++){
    const h1 = hash(i + layer*97), h2 = hash(i*3.1 + 7 + layer), h3 = hash(i*7.7 + 1), h4 = hash(i*1.3 + 5);
    if(kind === 'star'){
      const tw = .5 + .5*Math.sin(t*(1 + h3*3) + h4*6), x = h1*W, y = h2*H*.8, r = 3 + h3*7;
      g.globalCompositeOperation = 'lighter';
      glow(x, y, r*3, h4 > .7 ? T.accent : '#cfe3ff', .25 + .6*tw);
      if(h3 > .8){ g.strokeStyle = `rgba(255,255,255,${.5*tw})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - r*2.5, y); g.lineTo(x + r*2.5, y); g.moveTo(x, y - r*2.5); g.lineTo(x, y + r*2.5); g.stroke(); }
    } else if(kind === 'spark'){
      const life = 5 + h3*5, age = frac(t/life + h1), x = h2*W + Math.sin(t*.6 + i)*30, y = H*(1.05 - age*1.25);
      g.globalCompositeOperation = 'lighter';
      glow(x, y, 6 + h4*16, h4 > .5 ? T.accent : T.accent2, Math.sin(age*Math.PI)*.8);
    } else if(kind === 'wind'){
      const life = 2.2 + h3*1.6, age = frac(t/life + h1);
      const y = 40 + h2*H*.85, x = -80 + age*(W + 220);
      g.globalAlpha = .5*Math.sin(age*Math.PI); g.strokeStyle = h4 > .55 ? '#ffffff' : T.cool; g.lineWidth = 2 + h3*3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 26 - h4*46, y + (h3 - .5)*14); g.stroke();
    } else if(kind === 'dot'){
      // 「ぴ」＝點點與小穴：圓點與空心圓環交錯飄落
      const life = 6 + h3*5, age = frac(t/life + h1), x = h2*W + Math.sin(t*.9 + i)*36, y = -60 + age*(H + 120), r = 9 + h3*24;
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = .8*Math.sin(age*Math.PI);
      if(h4 > .45){
        g.strokeStyle = h4 > .72 ? T.accent : T.accent2; g.lineWidth = 3 + h3*5;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.stroke();
      } else {
        g.fillStyle = h4 > .2 ? '#ffffff' : T.accent2;
        g.beginPath(); g.arc(x, y, r*.55, 0, Math.PI*2); g.fill();
      }
    } else if(kind === 'coin'){
      // 招財金幣：外圓內方的古錢，一邊翻面一邊落下
      const life = 5 + h3*4, age = frac(t/life + h1), x = h2*W + Math.sin(t*.7 + i)*26, y = -70 + age*(H + 140);
      const r = 12 + h3*16, face = Math.abs(Math.cos(t*1.6 + i*1.7));
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = .85*Math.sin(age*Math.PI);
      g.save(); g.translate(x, y); g.scale(.3 + .7*face, 1);
      g.fillStyle = h4 > .5 ? T.accent : T.accent2;
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI*2); g.fill();
      g.strokeStyle = 'rgba(140,74,8,.5)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(120,58,6,.7)'; g.fillRect(-r*.27, -r*.27, r*.54, r*.54);
      g.restore();
    } else if(kind === 'lantern'){
      // 祭典燈籠：暖色小燈籠緩緩上升，邊飄邊搖，中心留一點燭火
      const life = 9 + h3*6, age = frac(t/life + h1);
      const x = h2*W + Math.sin(t*.5 + i*2)*42 + age*40, y = H*1.12 - age*(H*1.3);
      const r = 9 + h3*11, a = Math.sin(age*Math.PI);
      g.globalCompositeOperation = 'lighter';
      glow(x, y, r*3.4, h4 > .6 ? T.accent2 : T.accent, .3*a);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = .92*a; g.fillStyle = h4 > .5 ? T.accent : T.accent2;
      roundRect(x - r*.62, y - r*.85, r*1.24, r*1.7, r*.34); g.fill();
      g.fillStyle = 'rgba(255,246,214,.85)'; g.fillRect(x - r*.16, y - r*.42, r*.32, r*.84);
      g.globalAlpha = .5*a; g.strokeStyle = 'rgba(255,214,150,.9)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, y - r*.85); g.lineTo(x, y - r*1.35); g.stroke();
    } else {
      const life = 7 + h3*6, age = frac(t/life + h1), x = h2*W*1.2 - age*320 + Math.sin(t*1.3 + i)*25, y = -60 + age*(H + 120);
      g.globalCompositeOperation = 'source-over';
      g.save(); g.translate(x, y); g.rotate(t*(h4 - .5)*3 + i); g.scale(1, .45 + .4*Math.abs(Math.sin(t*2 + i)));
      g.globalAlpha = .85*Math.sin(age*Math.PI); g.fillStyle = h4 > .35 ? T.accent : T.accent2;
      g.beginPath(); g.ellipse(0, 0, 9 + h3*9, 5 + h3*4, 0, 0, Math.PI*2); g.fill(); g.restore();
    }
  }
  g.restore();
}
// 二次元風格：四角星閃光與集中線
let sparkleFade = 1;
function sparkle(x, y, r, color, a = 1, rot = 0){
  a *= sparkleFade;
  if(a <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a;
  g.globalCompositeOperation = 'lighter'; glow(0, 0, r*1.6, color, a*.6); g.globalCompositeOperation = 'source-over';
  g.globalAlpha = a; g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(0, -r);
  for(let k = 0; k < 4; k++){ const a0 = k*Math.PI/2; g.quadraticCurveTo(0, 0, Math.sin(a0 + Math.PI/2)*r, -Math.cos(a0 + Math.PI/2)*r); }
  g.closePath(); g.fill(); g.restore();
}
function sparkles(t, n, layer = 0, area = [0, 0, W, H]){
  for(let i = 0; i < n; i++){
    const h1 = hash(i*6.1 + layer*13), h2 = hash(i*2.3 + layer*7 + 1), h3 = hash(i*4.7 + 3), per = 1.6 + h3*2.2;
    const ph = frac(t/per + h1), a = Math.sin(ph*Math.PI);
    sparkle(area[0] + h2*area[2], area[1] + h1*area[3], (10 + h3*22)*(.6 + .4*a), [T.accent, T.cool, '#ffffff', T.accent2][i % 4], a*.95, ph*.8);
  }
}
function focusLines(t, a, cx = W/2, cy = H/2, inner = 360, color = '255,255,255'){
  if(a <= 0) return;
  const seed = Math.floor(t*12);
  g.save(); g.fillStyle = `rgba(${color},${.55*a})`;
  for(let i = 0; i < 90; i++){
    const h1 = hash(i*3.3 + seed*.71), h2 = hash(i*7.9 + seed*.37);
    const ang = (i + h1*.8)/90*Math.PI*2, w = .004 + h2*.01, r0 = inner*(1 + h1*.5), r1 = 1500;
    g.beginPath();
    g.moveTo(cx + Math.cos(ang - w)*r1, cy + Math.sin(ang - w)*r1);
    g.lineTo(cx + Math.cos(ang)*r0, cy + Math.sin(ang)*r0);
    g.lineTo(cx + Math.cos(ang + w)*r1, cy + Math.sin(ang + w)*r1);
    g.closePath(); g.fill();
  }
  g.restore();
}
function bokeh(t, n, layer = 0){
  g.save(); g.globalCompositeOperation = 'lighter';
  for(let i = 0; i < n; i++){
    const h1 = hash(i*9.1 + layer), h2 = hash(i*4.3 + 2 + layer), h3 = hash(i*2.9 + 4);
    glow(frac(h1 + t*.006*(h3 + .2))*W*1.2 - W*.1, h2*H + Math.sin(t*.3 + i)*30, 60 + h3*110, [T.accent, T.cool, T.accent2][i % 3], .09 + .06*Math.sin(t*.5 + i));
  }
  g.restore();
}
function confetti(t, n, amount = 1){
  for(let i = 0; i < n; i++){
    const h1 = hash(i*5.3 + 11), h2 = hash(i*8.1 + 3), h3 = hash(i*2.2 + 9), life = 3.5 + h3*2.5, age = frac(t/life + h1);
    const x = h2*W + Math.sin(t*2 + i)*40, y = -40 + age*(H + 80);
    g.save(); g.translate(x, y); g.rotate(t*(2 + h3*4) + i); g.scale(1, Math.cos(t*(3 + h1*4) + i));
    g.globalAlpha = amount*Math.min(1, (1 - age)*4); g.fillStyle = POP[i % POP.length];
    g.fillRect(-7, -4, 14, 8); g.restore();
  }
  g.globalAlpha = 1;
}
function artView(x, y, w, h, fa, fb, z0, z1, u, t, focusY = .42){
  const z = lerp(z0, z1, smooth(u)), f = [lerp(fa[0], fb[0], smooth(u)), lerp(fa[1], fb[1], smooth(u))];
  const sc = Math.max(w/AW, h/AH)*z*(1 + .01*pulse(t)), sw = w/sc, sh = h/sc;
  const sx = clamp(f[0] - sw/2, 0, AW - sw), sy = clamp(f[1] - sh*focusY, 0, AH - sh);
  g.drawImage(C.art, sx, sy, sw, sh, x, y, w, h);
  const k = C.bloom.width/AW;
  g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = .28;
  g.drawImage(C.bloom, sx*k + C.bloom.width*.05/1.1, sy*k + C.bloom.height*.05/1.1, sw*k/1.1, sh*k/1.1, x, y, w, h);
  g.restore();
}
function roundRect(x, y, w, h, r){ g.beginPath(); g.roundRect(x, y, w, h, r); }

/* 舞者：沿用 dance-sprites.js 的網格變形，依拍點切換舞步 */
function danceState(i, t, o = {}){
  // 前奏、間奏等安靜段落音量很低，這裡設下限，動作才不會縮到幾乎不動
  const b = beatPos(t), en = Math.max(energy(t), .62)*(o.e ?? 1);
  const move = (Math.floor(b/8) + (o.alt ? i % 2 : 0)) % 4;
  const p = b - (move === 2 ? i*.25 : 0), fr = frac(p);
  let wave, hop;
  if(move === 0){ wave = Math.sin(Math.PI*p); hop = Math.abs(Math.sin(Math.PI*p))*14; }
  else if(move === 1){ wave = Math.sin(Math.PI*p/2); hop = Math.abs(Math.sin(Math.PI*p))*8; }
  else if(move === 2){ wave = 1.15*Math.sin(Math.PI*p); hop = Math.abs(Math.sin(Math.PI*p))*24; }
  else { wave = (Math.floor(p) % 2 ? 1 : -1)*(.55 + .45*Math.cos(Math.PI*fr)); hop = Math.pow(1 - fr, 2)*18; }
  return {wave, energy: en, hop: hop*en, squash: Math.max(0, 1 - fr*6)*.035*en, tilt: .05*Math.sin(Math.PI*p/2), mouth: o.mouth || 0, lead: !!o.lead};
}
// 去背角色的舞動：手臂／腿／身體分層的傀儡動畫（見 dance-rig.js），加上跳躍、壓縮與傾斜
function drawDancer(i, x, y, h, st){
  const m = st.actor || MEMBERS[i]; if(!m?.img) return;
  const img = m.img, iw = img.width, ih = img.height, w = iw*h/ih;
  const hop = st.hop*h/420;
  g.save();
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, y, w*.32*(1 - Math.min(.35, hop/h*3)), h*.02, 0, 0, Math.PI*2); g.fill();
  g.restore();
  // st 可以帶 armA/armB/legA/legB 直接指定關節角度（例如合照要一個固定的舞姿）
  SpriteRig.draw(g, img, x, y, h, {wave: st.wave, energy: st.energy, hop, tilt: st.tilt, squash: st.squash*4,
    armA: st.armA, armB: st.armB, legA: st.legA, legB: st.legB, armScale: m.meta?.armScale, legScale: m.meta?.legScale,
    intact: !!m.meta?.intact});
}
// 立繪的 h 就是整張圖的高度，腳的錨點在圖的底邊。
// 手抬起來會高出頭頂，踏步會讓鞋底低於錨點，落地壓縮會把身體再撐寬約一成。
// 這些餘裕跟身高成比例，窄的立繪就不會被多留一圈空白。
function dancerPad(img){
  const aspect = img && img.height ? img.width/img.height : .45;
  return {aspect, top: .18, bot: .04, side: .10};
}
// 把一個人放進矩形。align 決定餘裕算進去之後靠上、置中或靠下。回傳的 y 仍是腳的錨點。
function fitDancer(img, box, align){
  const p = dancerPad(img);
  const bw = Math.max(8, box.r - box.l), bh = Math.max(8, box.b - box.t);
  let h = bh/(1 + p.top + p.bot);
  const span = Math.max(.05, p.aspect)*(1 + p.side);
  if(h*span > bw) h = bw/span;
  const used = h*(1 + p.top + p.bot), slack = Math.max(0, bh - used);
  const sole = align === 'top' ? box.t + used : align === 'center' ? box.t + used + slack/2 : box.b;
  return {x: (box.l + box.r)/2, y: sole - h*p.bot, h};
}
let T0 = 0;

/* 文字排版：依寬度斷行，必要時縮小字級 */
const layoutCache = new Map();
function layout(units, font, size, maxW, maxRows = 2, minSize = 30){
  const key = units.map(u => u.t).join('') + font + size + maxW + maxRows;
  if(layoutCache.has(key)) return layoutCache.get(key);
  let s = size, rows;
  for(;;){
    rows = [[]]; let x = 0, lastSp = -1;
    const items = units.map(u => { g.font = font(u.bk ? s*.72 : s); return {u, w: u.sp ? s*.38 : g.measureText(u.t).width}; });
    for(const it of items){
      const row = rows[rows.length - 1];
      if(x + it.w > maxW && row.length){
        const cut = lastSp >= 0 ? lastSp + 1 : row.length;
        const moved = row.splice(cut);
        while(row.length && row[row.length - 1].u.sp) row.pop();
        rows.push(moved); x = moved.reduce((a, m) => a + m.w, 0); lastSp = -1;
      }
      const r = rows[rows.length - 1];
      if(it.u.sp && !r.length) continue;
      if(it.u.sp) lastSp = r.length;
      r.push(it); x += it.w;
    }
    if(rows.length <= maxRows || s <= minSize) break;
    s *= .9;
  }
  const res = {size: s, rows: rows.filter(r => r.length).map(r => { let x = 0; for(const it of r){ it.x = x; x += it.w; } return {items: r, w: x}; })};
  layoutCache.set(key, res);
  return res;
}
const jpFont = s => `600 ${s}px ${FONT.jp}`;
const zhFont = s => `600 ${s}px ${FONT.zh}`;

function fitFont(text, fontFn, size, maxW){
  g.font = fontFn(size); const w = g.measureText(text).width;
  return w > maxW ? size*maxW/w : size;
}
// 卡拉OK 歌詞：白字深邊，已唱部分以主題色漸層填滿
function karaokeCue(c, t, o, alpha = 1, dy = 0){
  if(alpha <= 0) return;
  const L = layout(c.ju, jpFont, o.size, o.maxW, 2), s = L.size, rowH = s*1.5;
  const sung = prog(c, t)*c.jW;
  const y0 = o.y - (L.rows.length - 1)*rowH + dy;
  const appear = t - c.start + .25;
  g.save(); g.lineJoin = 'round'; g.textBaseline = 'alphabetic';
  let k = 0;
  L.rows.forEach((row, ri) => {
    const rx = o.cx - row.w/2, ry = y0 + ri*rowH;
    for(const it of row.items){
      const u = it.u; k++;
      if(u.sp) continue;
      const e = easeOut((appear - k*.015)/.3);
      const a = alpha*e; if(a <= 0) continue;
      const fs = u.bk ? s*.72 : s, x = rx + it.x, y = ry + (1 - e)*s*.3;
      g.globalAlpha = a; g.font = jpFont(fs);
      g.lineWidth = fs*.17; g.strokeStyle = 'rgba(12,10,32,.8)'; g.strokeText(u.t, x, y);
      g.fillStyle = u.bk ? '#cfe8ff' : '#ffffff'; g.fillText(u.t, x, y);
      const f = clamp((sung - u.cw)/u.w);
      if(f > 0){
        g.save(); g.beginPath(); g.rect(x - 4, y - fs*1.6, (it.w + 8)*f, fs*2); g.clip();
        const gr = g.createLinearGradient(0, y - fs, 0, y);
        gr.addColorStop(0, u.bk ? T.cool : T.accent); gr.addColorStop(1, u.bk ? '#ffffff' : T.accent2);
        g.fillStyle = gr; g.fillText(u.t, x, y); g.restore();
      }
      if(u.ruby){
        const rs = fs*.36; g.font = jpFont(rs);
        const rw = g.measureText(u.ruby).width, rxx = x + it.w/2 - rw/2, ryy = y - fs*.92;
        g.lineWidth = rs*.25; g.strokeText(u.ruby, rxx, ryy);
        g.fillStyle = f > .5 ? T.accent : '#ffffff'; g.fillText(u.ruby, rxx, ryy);
      }
    }
  });
  if(c.zh && o.zhSize){
    const zs = fitFont(c.zh, zhFont, LyricText.translationSize(c.jp, s, o.zhSize), o.maxW*1.05);
    g.font = zhFont(zs); const zw = g.measureText(c.zh).width, zx = o.cx - zw/2, zy = y0 + (L.rows.length - 1)*rowH + s*.55 + zs*1.15;
    g.globalAlpha = alpha*easeOut((appear - .15)/.4);
    g.lineWidth = zs*.18; g.strokeStyle = 'rgba(12,10,32,.75)'; g.strokeText(c.zh, zx, zy);
    g.fillStyle = 'rgba(255,255,255,.72)'; g.fillText(c.zh, zx, zy);
    g.save(); g.beginPath(); g.rect(zx - 2, zy - zs*1.2, (zw + 4)*prog(c, t), zs*1.6); g.clip(); g.fillStyle = '#ffffff'; g.fillText(c.zh, zx, zy); g.restore();
  }
  g.restore();
}
function karaoke(t, o){
  const c = activeCue(t); if(!c) return;
  const i = cues.indexOf(c), prev = cues[i - 1];
  // 兩句中間空超過淡出，上一句已經離場。下一句出現時不再把舊字幕畫回來。
  if(prev && t < prev.end + .35 && t < c.start + .35 && t >= prev.end - .1){ const u = clamp((t - Math.max(prev.end - .1, c.start - .25))/.35); karaokeCue(prev, t, o, 1 - u, -u*o.size*.8); }
  const fadeOut = clamp((t - c.end)/.35);
  karaokeCue(c, t, o, 1 - fadeOut, -fadeOut*o.size*.5);
}
function lyricShade(y0, a = .6){
  const gr = g.createLinearGradient(0, y0, 0, H);
  gr.addColorStop(0, 'rgba(6,6,20,0)'); gr.addColorStop(.55, `rgba(6,6,20,${a})`); gr.addColorStop(1, `rgba(6,6,20,${a})`);
  g.fillStyle = gr; g.fillRect(0, y0, W, H - y0);
}

/* 立體貼紙字：白色粗外框＋深色立體側邊＋主題色填色（參考泡泡字標題） */
function stickerText(str, cx, cy, size, colors, t0, t, o = {}){
  const chars = [...str], fnt = o.font || (s => `${s}px ${FONT.maru}`);
  g.save(); g.font = fnt(size); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const ws = chars.map(ch => g.measureText(ch).width*(o.track ?? .96));
  const total = ws.reduce((a, b) => a + b, 0);
  let x = cx - total/2;
  const pos = chars.map((ch, i) => { const p = {ch, x: x + ws[i]/2, i}; x += ws[i]; return p; });
  const depth = size*.08;
  const st = p => {
    const e = easeBack((t - t0 - p.i*.06)/.5), a = clamp((t - t0 - p.i*.06)/.15);
    const bob = Math.sin(t*3 + p.i*.8)*size*.025*(o.bob ?? 1);
    return {e, a, y: cy + (1 - e)*size*.6 + bob, r: (hash(p.i*3 + str.length) - .5)*.16};
  };
  for(const pass of [0, 1, 2, 3]){
    for(const p of pos){
      if(p.ch === ' ') continue;
      const s = st(p); if(s.a <= 0) continue;
      const col = colors[p.i % colors.length];
      g.save(); g.globalAlpha = s.a*(o.alpha ?? 1); g.translate(p.x, s.y); g.rotate(s.r); g.scale(s.e, s.e);
      if(pass === 0){ g.lineWidth = size*.3; g.strokeStyle = o.shadow || 'rgba(40,20,60,.35)'; g.strokeText(p.ch, depth*.6, depth*1.6); }
      if(pass === 1){ g.lineWidth = size*.3; g.strokeStyle = '#ffffff'; g.strokeText(p.ch, 0, 0); }
      if(pass === 2){ g.lineWidth = size*.07; g.strokeStyle = shade(col, -.45); g.fillStyle = shade(col, -.45); g.strokeText(p.ch, 0, depth); g.fillText(p.ch, 0, depth); }
      if(pass === 3){ g.lineWidth = size*.06; g.strokeStyle = col; g.fillStyle = col; g.strokeText(p.ch, 0, 0); g.fillText(p.ch, 0, 0);
        g.globalAlpha *= .35; g.fillStyle = '#ffffff'; g.save(); g.beginPath(); g.rect(-size, -size, size*2, size*.62); g.clip(); g.fillText(p.ch, 0, 0); g.restore(); }
      g.restore();
    }
  }
  g.restore();
}
function shade(hex, k){
  const n = parseInt(hex.slice(1), 16), f = c => Math.round(k < 0 ? c*(1 + k) : c + (255 - c)*k);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function logo(cx, cy, size, t0, t, alpha = 1){
  g.save(); g.font = `italic 800 ${size}px ${FONT.logo}`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.lineJoin = 'round';
  const ws = LOGO.map(([c]) => c === ' ' ? size*.28 : g.measureText(c).width*.94), total = ws.reduce((a, b) => a + b, 0);
  let x = cx - total/2;
  LOGO.forEach(([c, col], i) => {
    const w = ws[i], e = easeBack((t - t0 - i*.07)/.45), a = clamp((t - t0 - i*.07)/.12)*alpha;
    if(c !== ' ' && a > 0){
      g.save(); g.globalAlpha = a; g.translate(x + w/2, cy + (1 - e)*size*.5); g.transform(1, 0, -.12, 1, 0, 0);
      g.lineWidth = size*.16; g.strokeStyle = '#ffffff'; g.strokeText(c, 0, 0);
      g.fillStyle = col; g.fillText(c, 0, 0); g.restore();
    }
    x += w;
  });
  g.restore();
}

/* ---------------- 鏡頭 ---------------- */
// 膠卷：左為日文、右為中文，一格一字隨演唱捲動（參考膠卷歌詞 PV）
function tapePos(t, kind){
  const c = lastStarted(t);
  if(!c) return -3 + 3*smooth(t/Math.max(.5, cues[0].start));
  const off = kind === 'jp' ? c.jo : c.zo, n = kind === 'jp' ? c.jn : c.zn;
  return off + easeOut((t - c.start)/.4) + prog(c, t)*n;
}
function strip(x, w, tape, pos, t, kind){
  const fh = 190, cy = H/2;
  g.fillStyle = 'rgba(8,8,14,.9)'; g.fillRect(x, 0, w, H);
  g.fillStyle = 'rgba(236,232,222,.85)';
  const off = frac(pos*fh/44)*44;
  for(let y = -44 - off + 10; y < H + 44; y += 44){ roundRect(x + 8, y, 16, 24, 4); g.fill(); roundRect(x + w - 24, y, 16, 24, 4); g.fill(); }
  const k0 = Math.floor(pos - cy/fh) - 2, k1 = Math.ceil(pos + cy/fh) + 2;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for(let k = k0; k <= k1; k++){
    const item = tape[k]; if(!item) continue;
    const y = cy + (k + .5 - pos)*fh, fx = x + 36, fw = w - 72, fy = y - fh/2 + 12, fhh = fh - 24;
    const d = pos - k, active = d >= 0 && d < 1;
    g.fillStyle = active ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.55)'; g.fillRect(fx, fy, fw, fhh);
    g.strokeStyle = active ? T.accent : 'rgba(255,255,255,.3)'; g.lineWidth = active ? 3 : 1.5; g.strokeRect(fx, fy, fw, fhh);
    g.font = `10px ${FONT.mono}`; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillText(`${kind === 'jp' ? 'J' : 'Z'}${pad(k, 3)}`, fx + 22, fy + 10);
    if(item.sep){
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(x + w/2, y, 40, 0, Math.PI*2); g.stroke();
      g.font = `300 44px ${FONT.mincho}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(item.sep, x + w/2, y + 2);
      continue;
    }
    let fs = item.latin || item.t.length > 1 ? Math.min(64, (fw - 20)/Math.max(1, item.t.length*.55)) : 104;
    // 右欄中文只比左欄主句略小：英文單字最大 64，日文單字 104。
    if(kind==='zh' && songScript==='en') fs = Math.min(fs, 64*.9);
    if(kind==='zh' && songScript==='ja') fs = Math.min(fs, 104*.9);
    if(item.bk) fs *= .78;
    g.font = item.latin ? `italic 600 ${fs}px ${FONT.cond}` : kind === 'jp' ? `600 ${fs}px ${FONT.mincho}` : `500 ${fs}px ${FONT.zh}`;
    if(active){
      const pop = 1 + .12*Math.exp(-d*5);
      g.save(); g.translate(x + w/2, y); g.scale(pop, pop);
      g.shadowColor = T.accent; g.shadowBlur = 28; g.fillStyle = item.bk ? T.cool : T.accent; g.fillText(item.t, 0, 4); g.restore();
    } else {
      g.fillStyle = d >= 1 ? (item.bk ? 'rgba(180,215,255,.9)' : 'rgba(255,255,255,.92)') : 'rgba(255,255,255,.22)';
      g.fillText(item.t, x + w/2, y + 4);
    }
  }
  const sg = g.createLinearGradient(0, 0, 0, H);
  sg.addColorStop(0, 'rgba(0,0,0,.85)'); sg.addColorStop(.18, 'rgba(0,0,0,0)'); sg.addColorStop(.82, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.85)');
  g.fillStyle = sg; g.fillRect(x, 0, w, H);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
// Advance through the whole cast within each shot and across successive shots.
function rotatingMembers(t,sh,count){
  const offset=sh.rotationOffset ?? 0;
  const turn=Math.floor(Math.max(0,t-sh.start)/2.4);
  return Array.from({length:Math.min(count,MEMBERS.length)},(_,i)=>(offset+turn*count+i)%MEMBERS.length);
}
function shotFilm(t, sh, u){
  backdrop(t, {dim: .55});
  bokeh(t, 8, 1);
  const px = 540, pw = 840;
  // 中央視窗放實際在跳舞的成員（而不是靜態主視覺）
  const pair = rotatingMembers(t,sh,2).filter(m => MEMBERS[m]?.img);
  g.save();
  g.beginPath(); g.rect(px, 0, pw, H); g.clip();
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(10,12,26,.92)'); bg.addColorStop(.55, 'rgba(26,16,40,.9)'); bg.addColorStop(1, 'rgba(8,8,18,.96)');
  g.fillStyle = bg; g.fillRect(px, 0, pw, H);
  const fl = g.createLinearGradient(0, 830, 0, H);
  fl.addColorStop(0, 'rgba(255,255,255,0)'); fl.addColorStop(1, 'rgba(255,255,255,.12)');
  g.fillStyle = fl; g.fillRect(px, 830, pw, H - 830);
  g.save(); g.globalCompositeOperation = 'lighter';
  glow(px + pw*.28, 620, 520, T.accent, .1 + .08*pulse(t));
  glow(px + pw*.74, 640, 520, T.cool, .09 + .07*pulse(t));
  g.restore();
  const enter = easeOut((t - sh.start)/.55);
  // 膠卷窗是這兩個人的畫面。手張開會碰到左右膠片，腳又會沉進歌詞裡，所以各佔半格、整身收在窗內。
  const gateT = 196, gateB = 888, gateL = px + 28, gateR = px + pw - 28, mid = (gateL + gateR)/2;
  const slots = pair.length === 1
    ? [{l: gateL, t: gateT, r: gateR, b: gateB}]
    : [{l: gateL, t: gateT, r: mid - 10, b: gateB}, {l: mid + 10, t: gateT, r: gateR, b: gateB}];
  pair.forEach((m, i) => {
    const fit = fitDancer(MEMBERS[m].img, slots[i], 'center'), cx = fit.x;
    const st = danceState(m, t, {alt: true, e: .9});
    g.save(); g.globalAlpha = enter;
    drawDancer(m, cx, fit.y, fit.h, st);
    g.restore();
    g.save(); g.globalAlpha = enter; g.font = `700 26px ${FONT.jp}`; g.textAlign = 'center';
    const tag = MEMBERS[m].name, tw = g.measureText(tag).width;
    roundRect(cx - tw/2 - 18, 132, tw + 36, 44, 22); g.fillStyle = MEMBERS[m].color; g.fill();
    g.fillStyle = '#fff'; g.fillText(tag, cx, 162); g.restore();
  });
  g.restore();
  for(const [x0, dir] of [[px, 1], [px + pw, -1]]){
    const gr = g.createLinearGradient(x0, 0, x0 + dir*90, 0); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(dir > 0 ? x0 : x0 - 90, 0, 90, H);
  }
  g.save(); g.globalCompositeOperation = 'lighter'; particles(t, 24, 2); g.restore();
  sparkles(t, 8, 2, [px, 0, pw, 760]);
  strip(270, 230, TJ, tapePos(t, 'jp'), t, 'jp');
  strip(1420, 230, TZ, tapePos(t, 'zh'), t, 'zh');
  g.save(); g.beginPath(); g.rect(px, 0, pw, H); g.clip();
  lyricShade(780, .55);
  karaoke(t, {cx: 960, y: 960, size: 48, maxW: 760, zhSize: 28});
  g.restore();
}
// 大字動態排版：成員特寫＋逐字蹦出
function shotTypo(t, sh, u){
  backdrop(t, {dim: .3, art: .35});
  const c = sh.cue, left = sh.side === 0;
  // 斜向色帶與大號段落數字
  g.save(); g.globalAlpha = .14;
  for(let i = 0; i < 3; i++){
    g.fillStyle = [T.accent, T.accent2, T.cool][i];
    const x = ((t*60 + i*700) % (W + 1200)) - 600;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 220, 0); g.lineTo(x - 260, H); g.lineTo(x - 480, H); g.closePath(); g.fill();
  }
  g.restore();
  g.save(); g.font = `800 520px ${FONT.logo}`; g.textAlign = left ? 'right' : 'left'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.1)';
  g.strokeText(pad(c.i + 1), left ? W - 40 : 40, H - 80); g.restore();
  // 背景漂浮的直排殘影字（參考星空散字）
  g.save(); g.font = `500 54px ${FONT.mincho}`; g.textAlign = 'center';
  for(let i = 0; i < 18; i++){
    const it = TJ[(c.jo + 3 + i*5) % TJ.length]; if(!it || it.sep || it.latin) continue;
    const x = hash(i*4.1 + c.i)*W, y = frac(hash(i*7.3) - t*.012*(1 + hash(i)))*H*1.2 - H*.1;
    g.fillStyle = `rgba(255,255,255,${.08 + .1*hash(i*2.7)})`; g.fillText(it.t, x, y);
  }
  g.restore();
  particles(t, 30, 3);
  focusLines(t, .35*(1 - clamp((t - c.start)/.8)) + .12*pulse(t)*energy(t), left ? 1270 : 650, H*.45, 520);
  sparkles(t, 10, 9 + c.i, [left ? 800 : 160, 140, 940, 700]);
  const m = sh.member, mem = MEMBERS[m];
  // 以前腳錨在畫面下方四百像素，膝蓋以下和外側的手都在畫面外。
  // 進場的位移也算在矩形裡，滑進來的途中手不會先被切掉。名牌留在腳的下面。
  const slide = 100, enter = easeOut((t - sh.start)/.5);
  let mx = left ? 470 : W - 470;
  if(mem?.img){
    const box = left
      ? {l: 36 + slide, t: 64, r: 860, b: H - 172}
      : {l: W - 860, t: 64, r: W - 36 - slide, b: H - 172};
    const fit = fitDancer(mem.img, box);
    mx = fit.x + (left ? -1 : 1)*(1 - enter)*slide;
    g.save(); g.globalCompositeOperation = 'lighter'; glow(mx, fit.y - fit.h*.62, 280, mem.color, .16); g.restore();
    drawDancer(m, mx, fit.y, fit.h, danceState(m, t, {e: .6}));
  }
  // 成員名牌
  if(mem){
    g.save(); g.globalAlpha = enter; g.font = `700 30px ${FONT.jp}`;
    const tag = `${mem.name}`, tx = left ? 70 : W - 70 - g.measureText(tag).width - 40;
    roundRect(tx, H - 150, g.measureText(tag).width + 40, 52, 26); g.fillStyle = mem.color; g.fill();
    g.fillStyle = '#fff'; g.fillText(tag, tx + 20, H - 113); g.restore();
  }
  // 逐字蹦出
  const cx = left ? 1270 : 650, maxW = 980;
  const L = layout(c.ju, jpFont, 150, maxW, 3, 60), s = L.size, rowH = s*1.45;
  const sung = prog(c, t)*c.jW;
  const y0 = H*.45 - (L.rows.length - 1)*rowH/2;
  // 字卡被延到下一句才切時，上一句在自己的結束時間淡出，不在節奏空檔繼續掛著。
  const lyricA = 1 - clamp((t - c.end)/.35);
  if(lyricA <= 0) return;
  g.save(); g.lineJoin = 'round'; g.textBaseline = 'middle';
  let k = 0;
  L.rows.forEach((row, ri) => {
    const rx = cx - row.w/2, ry = y0 + ri*rowH;
    for(const it of row.items){
      const un = it.u;
      if(un.sp) continue;
      // 英文整詞以前一下跳完：Forever 才唱到前半，ever 已經整詞浮出來。
      // 依這個字自己的寬度逐字填，下一個字要輪到才畫淡影。
      const chars = un.latin && [...un.t].length > 1 ? [...un.t] : [un.t];
      const split = chars.length > 1;
      chars.forEach((ch, ci) => {
        k++;
        const cw0 = un.cw + un.w*ci/chars.length, slice = un.w/chars.length;
        const an = split ? clamp((sung - cw0)/Math.max(slice, .2)) : clamp((sung - cw0 + .35)/1.1);
        const x = rx + it.x + it.w*(ci + .5)/chars.length;
        const fs = un.bk ? s*.72 : s;
        g.font = jpFont(fs); g.textAlign = 'center';
        if(an <= 0){
          if(split && sung < cw0 - .2) return;
          g.save(); g.globalAlpha = lyricA;
          g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.18)'; g.strokeText(ch, x, ry); g.restore(); return;
        }
        const sc = lerp(1.9, 1, easeBack(an)), rot = (hash(k*3.3 + c.i) - .5)*.35*(1 - easeOut(an));
        g.save(); g.translate(x, ry); g.rotate(rot); g.scale(sc, sc); g.globalAlpha = clamp(an*3)*lyricA;
        // 以前把色塊往右下錯開再蓋一層。二、に這種細筆畫會露出一塊對不齊的橙邊，看起來像破圖。
        g.lineJoin = 'round'; g.miterLimit = 2;
        g.lineWidth = fs*.12; g.strokeStyle = un.bk ? T.cool : T.accent2; g.strokeText(ch, 0, 0);
        g.lineWidth = fs*.045; g.strokeStyle = 'rgba(8,8,24,.8)'; g.strokeText(ch, 0, 0);
        g.fillStyle = an < 1 ? T.accent : '#ffffff'; g.fillText(ch, 0, 0);
        if(ci === 0 && un.ruby){ g.font = jpFont(fs*.32); g.fillStyle = T.accent; g.fillText(un.ruby, 0, -fs*.72); }
        g.restore();
      });
    }
  });
  if(c.zh){
    const zy = y0 + (L.rows.length - 1)*rowH + s*.75 + 40, zs = fitFont(c.zh, zhFont, LyricText.translationSize(c.jp, s, 46), maxW);
    g.globalAlpha = easeOut(clamp((sung/c.jW - .28)/.4))*lyricA; g.font = zhFont(zs); g.textAlign = 'center';
    const zw = g.measureText(c.zh).width;
    g.fillStyle = T.accent; g.fillRect(cx - zw/2 - 30, zy - 4, 12, 12);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText(c.zh, cx + 6, zy);
  }
  g.restore();
}
// 視窗特寫：成員在彈出的應用程式視窗裡跳舞，歌詞打進搜尋列（參考桌寵 PV）
// 三扇窗並排、彼此留一點空隙。疊在一起時，前面那扇會把後面的人的手和身體擋住。
const WIN_LAYOUTS = [
  [[330, 440, 560, 600, -.018], [960, 420, 580, 600, .01], [1590, 440, 560, 600, -.012]],
  [[360, 460, 540, 580, .02], [960, 430, 580, 600, -.01], [1560, 460, 540, 580, .016]]
];
function shotWindows(t, sh, u){
  const members=rotatingMembers(t,sh,3);
  g.drawImage(C.pastel, 0, 0);
  g.save(); g.globalAlpha = .5; bokeh(t, 6, 4); g.restore();
  for(let i = 0; i < 14; i++){
    const x = hash(i*3.7 + 1)*W, y = hash(i*5.9 + 2)*H*.85, tw = .5 + .5*Math.sin(t*2 + i), col = [T.accent2, T.cool, T.accent][i % 3];
    g.save(); g.translate(x, y); g.rotate(t*.3 + i); g.globalAlpha = .45 + .5*tw; g.fillStyle = col;
    const r = 8 + 10*tw; g.beginPath(); g.moveTo(0, -r);
    for(let k = 0; k < 4; k++){ const a0 = (k + 1)*Math.PI/2; g.quadraticCurveTo(0, 0, Math.sin(a0)*r, -Math.cos(a0)*r); }
    g.fill(); g.restore();
  }
  WIN_LAYOUTS[sh.layout].forEach(([cx, cy, w, h, rot], i) => {
    const m = members[i % members.length], mem = MEMBERS[m], ap = easeBack((t - sh.start - i*.12)/.45);
    if(ap <= 0) return;
    g.save(); g.translate(cx, cy + Math.sin(t*1.4 + i*2)*8); g.rotate(rot); g.scale(ap, ap);
    const x = -w/2, y = -h/2, bar = 54;
    roundRect(x + 12, y + 16, w, h, 18); g.fillStyle = 'rgba(40,30,80,.18)'; g.fill();
    roundRect(x, y, w, h, 18); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 5; g.strokeStyle = T.deep; g.stroke();
    g.save(); roundRect(x, y, w, h, 18); g.clip();
    g.fillStyle = mem.color; g.fillRect(x, y, w, bar);
    const cg = g.createLinearGradient(0, y + bar, 0, y + h); cg.addColorStop(0, shade(mem.color, .82)); cg.addColorStop(1, shade(mem.color, .55));
    g.fillStyle = cg; g.fillRect(x, y + bar, w, h - bar);
    g.save(); g.beginPath(); g.rect(x, y + bar, w, h - bar); g.clip();
    g.globalCompositeOperation = 'lighter'; glow(0, y + bar + 80, 160, '#ffffff', .22); g.globalCompositeOperation = 'source-over';
    // 視窗內容區才是這個人的畫面。人比視窗高時，下半身和兩側的手會被窗框切掉。
    const fit = fitDancer(mem.img, {l: x + 18, t: y + bar + 12, r: x + w - 18, b: y + h - 16}, 'center');
    drawDancer(m, fit.x, fit.y, fit.h, danceState(m, t, {e: .8, alt: true}));
    g.restore();
    g.fillStyle = T.deep; g.fillRect(x, y + bar - 3, w, 3);
    g.restore();
    g.font = `800 26px ${FONT.jp}`; g.fillStyle = '#ffffff'; g.textBaseline = 'middle';
    g.beginPath(); g.arc(x + 30, y + bar/2, 13, 0, Math.PI*2); g.fill();
    g.fillStyle = mem.color; g.beginPath(); g.arc(x + 30, y + bar/2, 6, 0, Math.PI*2); g.fill();
    g.fillStyle = '#ffffff'; g.fillText(mem.name, x + 54, y + bar/2 + 1);
    g.font = `700 15px ${FONT.cond}`; g.letterSpacing = '4px'; g.textAlign = 'right';
    g.fillText(`MEMBER ${pad(m + 1)}`, x + w - 120, y + bar/2 + 1); g.letterSpacing = '0px'; g.textAlign = 'left';
    for(let b = 0; b < 3; b++){ g.beginPath(); g.arc(x + w - 84 + b*28, y + bar/2, 10, 0, Math.PI*2); g.lineWidth = 3; g.strokeStyle = T.deep; g.fillStyle = '#ffffff'; g.fill(); g.stroke(); }
    g.restore();
  });
  // 搜尋列歌詞
  const c = activeCue(t);
  const bw = 1360, bh = 104, bx = W/2 - bw/2, by = 880;
  // 鏡頭已經對齊字幕出現。搜尋列跟這句一起在，不再多等 0.25 秒。
  const ap = c ? 1 : easeBack((t - sh.start)/.45);
  g.save(); g.translate(W/2, by + bh/2); g.scale(ap, ap); g.translate(-W/2, -(by + bh/2));
  roundRect(bx + 8, by + 10, bw, bh, bh/2); g.fillStyle = 'rgba(40,30,80,.2)'; g.fill();
  roundRect(bx, by, bw, bh, bh/2); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 6; g.strokeStyle = T.deep; g.stroke();
  g.beginPath(); g.arc(bx + bh/2 + 4, by + bh/2, 36, 0, Math.PI*2); g.fillStyle = T.accent2; g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(bx + bh/2, by + bh/2 - 4, 13, 0, Math.PI*2); g.stroke();
  g.beginPath(); g.moveTo(bx + bh/2 + 9, by + bh/2 + 5); g.lineTo(bx + bh/2 + 19, by + bh/2 + 15); g.stroke();
  roundRect(bx + bw - 180, by + 20, 150, 64, 14); g.lineWidth = 4; g.strokeStyle = T.deep; g.stroke();
  g.font = `800 26px ${FONT.cond}`; g.fillStyle = T.deep; g.textBaseline = 'middle'; g.letterSpacing = '2px'; g.fillText('ENTER ↵', bx + bw - 160, by + 53); g.letterSpacing = '0px';
  if(c){
    const sung = prog(c, t)*c.jW, text = c.ju.filter(un => un.cw < sung + .2).map(un => un.t).join('');
    const fs = fitFont(c.jp.replace(/[(（][^)）]*[)）]/g, ''), jpFont, 50, bw - 340);
    g.font = jpFont(fs); g.fillStyle = T.deep; g.fillText(text, bx + bh + 30, by + bh/2 + 2);
    const tw = g.measureText(text).width;
    if(frac(t*2) < .6){ g.fillStyle = T.accent2; g.fillRect(bx + bh + 36 + tw, by + 26, 5, bh - 52); }
    if(c.zh){
      const zs = fitFont(c.zh, zhFont, LyricText.translationSize(c.jp, fs, 32), 1100); g.font = zhFont(zs); g.letterSpacing = '2px';
      const zw = g.measureText(c.zh).width + 70, zx = W/2 - zw/2, zy = by - 82;
      g.globalAlpha = easeOut((t - c.start)/.4);
      roundRect(zx, zy, zw, 58, 29); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 4; g.strokeStyle = T.deep; g.stroke();
      g.beginPath(); g.arc(zx + 30, zy + 29, 9, 0, Math.PI*2); g.fillStyle = T.accent2; g.fill();
      g.fillStyle = T.deep; g.fillText(c.zh, zx + 52, zy + 30); g.letterSpacing = '0px';
    }
  } else {
    g.font = jpFont(40); g.fillStyle = 'rgba(40,40,80,.35)'; g.fillText('♪ ・・・', bx + bh + 30, by + bh/2 + 2);
  }
  g.restore();
}
// 舞台：LED 大螢幕播放封面，六人在聚光燈下跳舞
// render() 還會再跟著拍點放大約 2%，所以安全框比畫面再往內一圈。
// 底邊停在歌詞上面，鞋才不會埋進字幕。
const STAGE_SAFE = {l: 48, t: 86, r: W - 48, b: 892};
function stageCam(variant, u){
  // 特寫若放到 1.5 倍，手會衝出左右、腳會掉出畫面。縮到人還站得進去的範圍，靠近的感覺靠把人排大。
  if(variant === 'close' || variant === 'close2') return {fx: variant === 'close2' ? 780 : 960, fy: 620, z: lerp(1.12, 1.22, u)};
  // 螢幕景別只輕輕推近。推太多時，兩側的人和螢幕上排的頭會一起被切掉。
  if(variant === 'screen') return {fx: 960, fy: 460, z: lerp(1.06, 1.02, smooth(u))};
  return {fx: 960, fy: 560, z: lerp(1, 1.035, u)};
}
function shotStage(t, sh, u){
  const close = sh.variant === 'close' || sh.variant === 'close2', screen = sh.variant === 'screen';
  const cam = stageCam(sh.variant, u);
  // 人的站位用這段鏡頭最大的縮放來算，才不會在推近的那一幀被擠出畫面，也不會跟著焦距滑動。
  const camFit = stageCam(sh.variant, stageCam(sh.variant, 1).z >= stageCam(sh.variant, 0).z ? 1 : 0);
  g.save();
  g.translate(cam.fx, cam.fy); g.scale(cam.z, cam.z); g.translate(-cam.fx, -cam.fy);
  backdrop(t, {dim: .45, art: .35});
  const b = beatPos(t), pl = pulse(t), en = energy(t);
  // LED 螢幕
  const sx = 410, sy = 60, sw = 1100, shh = 540;
  g.save(); g.shadowColor = T.accent2; g.shadowBlur = 40; roundRect(sx - 14, sy - 14, sw + 28, shh + 28, 16); g.fillStyle = '#0a0a16'; g.fill(); g.restore();
  g.save(); g.beginPath(); g.rect(sx, sy, sw, shh); g.clip();
  // 螢幕裡放實際在跳舞的成員（輪替四位），但整排收在舞台眾人的頭以上。
  // 同一個人若以半透明、差不多的大小疊在自己身後，手臂和頭會變成第二層殘影。
  const sg = g.createLinearGradient(0, sy, 0, sy + shh);
  sg.addColorStop(0, 'rgba(16,10,34,.96)'); sg.addColorStop(1, 'rgba(38,18,48,.96)');
  g.fillStyle = sg; g.fillRect(sx, sy, sw, shh);
  const nMem = MEMBERS.length, nShow = Math.min(4, nMem), base = (Math.floor(t/5)*nShow) % nMem;
  // 特寫的縮放會把這排裁到只剩腳，那些腳掛在畫面上方又會像殘影，所以特寫不畫。
  // 每一格都要比一個人的全身寬，手和鞋才不會被螢幕邊切掉；人收在螢幕上半，舞台上的頭才擋得到。
  if(!close) for(let i = 0; i < nShow; i++){
    const m = (base + i) % nMem;
    const slot = {l: sx + sw*i/nShow + 12, t: sy + 46, r: sx + sw*(i + 1)/nShow - 12, b: sy + shh*.60};
    const fit = fitDancer(MEMBERS[m].img, slot);
    drawDancer(m, fit.x, fit.y, fit.h, danceState(m, t, {alt: true, e: .72}));
  }
  g.fillStyle = 'rgba(18,8,38,.28)'; g.fillRect(sx, sy, sw, shh);      // 螢幕色調
  g.fillStyle = 'rgba(0,0,0,.2)';                                      // 掃描線
  for(let y = sy; y < sy + shh; y += 7) g.fillRect(sx, y, sw, 3);
  g.font = `600 20px ${FONT.mono}`; g.fillStyle = 'rgba(255,255,255,.55)';
  g.fillText(`LIVE · ${song.series || song.title}`, sx + 24, sy + 36);
  g.beginPath(); g.arc(sx + sw - 40, sy + 30, 7, 0, Math.PI*2);
  g.fillStyle = frac(t) < .5 ? '#ff4d6d' : 'rgba(255,77,109,.25)'; g.fill();
  const edge = g.createLinearGradient(0, sy, 0, sy + shh);
  edge.addColorStop(0, 'rgba(0,0,0,.55)'); edge.addColorStop(.22, 'rgba(0,0,0,0)');
  edge.addColorStop(.78, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = edge; g.fillRect(sx, sy, sw, shh);
  const sheen = g.createLinearGradient(sx, sy, sx + sw, sy + shh);
  sheen.addColorStop(0, 'rgba(255,255,255,.16)'); sheen.addColorStop(.45, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,.06)');
  g.fillStyle = sheen; g.fillRect(sx, sy, sw, shh);
  g.globalAlpha = .04*pl; g.fillStyle = '#fff'; g.fillRect(sx, sy, sw, shh); g.globalAlpha = 1;
  g.restore();
  // 兩側燈柱：只要看得出在跳，不要亮到把旁邊的人吃掉
  for(const lx of [250, 1670]){
    for(let r = 0; r < 12; r++){
      const on = (Math.floor(b) + r + (lx > 900 ? 2 : 0)) % 4 === 0;
      g.globalCompositeOperation = 'lighter';
      glow(lx, 100 + r*48, on ? 18 : 10, r % 2 ? T.accent : T.cool, on ? .42 : .16);
      g.globalCompositeOperation = 'source-over';
    }
  }
  // 地板
  g.drawImage(C.floor, 0, 700);
  g.fillStyle = T.accent; g.globalAlpha = .55 + .4*pl; g.fillRect(0, 698, W, 4); g.globalAlpha = 1;
  // 聚光燈：六道加色疊在主唱身上會把衣服打成白斑，所以亮度壓低
  g.save(); g.globalCompositeOperation = 'lighter';
  for(let i = 0; i < 6; i++){
    const bx0 = 200 + i*304, ang = .38*Math.sin(b*Math.PI/4 + i*1.1) + (i < 3 ? .12 : -.12);
    g.save(); g.translate(bx0, -40); g.rotate(ang); g.globalAlpha = .05 + .06*pl*en;
    g.drawImage(C.beam, -180, 0); g.restore();
  }
  g.restore();
  if(sh.variant === 'break' || sh.variant === 'intro'){
    for(let i = 0; i < 48; i++){
      const lvl = clamp(sample(A.low, t)*.6 + sample(A.mid, t - i*.01)*.5*(.5 + hash(i + Math.floor(t*8)*.01)), .05, 1.2);
      g.fillStyle = POP[i % POP.length]; g.globalAlpha = .45;
      g.fillRect(40 + i*39.5, 700 - lvl*120, 28, lvl*120);
    }
    g.globalAlpha = 1;
  }
  // 舞者：依卡司人數排成後排／中排／前排，中央是主唱。
  // nx、ny 是安全框裡的位置（ny 是把抬手和鞋底的餘裕算進去之後的腳底），nh 是希望的身高占比。
  const O = OTHERS, duo = CENTERS.length===2, soloLucky = song.cast[0][0]==='lucky' && !duo;
  const supporting=MEMBERS.map((_,i)=>i).filter(i=>!CENTERS.includes(i));
  const spots = duo
    ? [...supporting.map((m,i)=>({nx:[.07,.20,.32,.68,.80,.93][i],ny:.72,nh:.40,m})),
       {nx:.42,ny:1,nh:.56,m:CENTERS[0]},{nx:.58,ny:1,nh:.56,m:CENTERS[1]}]
    : soloLucky
    ? [...O.slice(0,4).map((m,i)=>({nx:[.14,.38,.62,.86][i],ny:.64,nh:.34,m})),
       ...O.slice(4).map((m,i)=>({nx:[.12,.29,.80][i],ny:.92,nh:.43,m})),{nx:.50,ny:1,nh:.64,m:LEAD}]
    : O.length > 11
    ? [...O.slice(0,6).map((m,i)=>({nx:(i+.5)/6,ny:.42,nh:.28,m})),
       ...O.slice(6,12).map((m,i)=>({nx:(i+.5)/6,ny:.71,nh:.30,m})),
       ...O.slice(12).map((m,i)=>({nx:[.12,.32,.68,.88][i],ny:1,nh:.34,m})),{nx:.5,ny:1,nh:.37,m:LEAD}]
    : O.length >= 11
    ? [...O.slice(0, 6).map((m, i) => ({nx:(i+.5)/6, ny:.60, nh:.28, m})),
       ...O.slice(6, 11).map((m, i) => ({nx:(i+.5)/5, ny:.78, nh:.31, m})), {nx:.50, ny:1, nh:.50, m:LEAD}]
    : O.length >= 9
    ? [{nx:.08, ny:.65, nh:.34, m:O[0]}, {nx:.29, ny:.65, nh:.34, m:O[1]}, {nx:.50, ny:.65, nh:.34, m:O[2]}, {nx:.71, ny:.65, nh:.34, m:O[3]}, {nx:.92, ny:.65, nh:.34, m:O[4]},
       {nx:.14, ny:.86, nh:.42, m:O[5]}, {nx:.37, ny:.86, nh:.42, m:O[6]}, {nx:.63, ny:.86, nh:.42, m:O[7]}, {nx:.86, ny:.86, nh:.42, m:O[8]}, {nx:.50, ny:1, nh:.58, m:LEAD}]
    : O.length >= 7
    ? [{nx:.07, ny:.74, nh:.42, m:O[0]}, {nx:.22, ny:.72, nh:.40, m:O[1]}, {nx:.50, ny:.70, nh:.40, m:O[2]}, {nx:.78, ny:.72, nh:.40, m:O[3]}, {nx:.93, ny:.74, nh:.42, m:O[4]},
       {nx:.36, ny:.90, nh:.52, m:O[5]}, {nx:.64, ny:.90, nh:.52, m:O[6]}, {nx:.50, ny:1, nh:.64, m:LEAD}]
    : O.length >= 5
    ? [{nx:.28, ny:.74, nh:.46, m:O[0]}, {nx:.50, ny:.70, nh:.44, m:O[1]}, {nx:.72, ny:.74, nh:.46, m:O[2]},
       {nx:.15, ny:.90, nh:.54, m:O[3]}, {nx:.85, ny:.90, nh:.54, m:O[4]}, {nx:.50, ny:1, nh:.64, m:LEAD}]
    : O.length >= 3
    ? [{nx:.28, ny:.74, nh:.46, m:O[0]}, {nx:.72, ny:.74, nh:.46, m:O[1]},
       {nx:.13, ny:.90, nh:.54, m:O[2]}, {nx:.87, ny:.90, nh:.54, m:O[3]}, {nx:.50, ny:1, nh:.64, m:LEAD}]
    : [{nx:.27, ny:.80, nh:.50, m:O[0]}, {nx:.73, ny:.80, nh:.50, m:O[1]},
       {nx:.50, ny:1, nh:.70, m:LEAD}];
  // 後排正中央會被主唱擋住。手張得很開的立繪，冒出的頭和手臂會像主唱的殘影，每個景別都不畫；
  // 較窄的立繪只在特寫拿掉，廣角仍留著當後排。
  const centerBack = duo || soloLucky ? -1 : O.length >= 9 ? -1 : O.length >= 7 ? 2 : O.length >= 5 ? 1 : -1;  const intro = sh.variant === 'intro' ? clamp((t - .5)/1.5) : 1;
  const inv = (cam2, x, y) => [cam2.fx + (x - cam2.fx)/cam2.z, cam2.fy + (y - cam2.fy)/cam2.z];
  const corners = [[STAGE_SAFE.l, STAGE_SAFE.t], [STAGE_SAFE.r, STAGE_SAFE.t], [STAGE_SAFE.l, STAGE_SAFE.b], [STAGE_SAFE.r, STAGE_SAFE.b]].map(([x, y]) => inv(camFit, x, y));
  const box = {
    l: Math.min(...corners.map(p => p[0])), t: Math.min(...corners.map(p => p[1])),
    r: Math.max(...corners.map(p => p[0])), b: Math.max(...corners.map(p => p[1]))
  };
  const bw = box.r - box.l, bh = box.b - box.t;
  const cast = [];
  spots.forEach((s, k) => {
    if(k === centerBack){
      const img = MEMBERS[s.m]?.img, wide = img && img.width/img.height > .6;
      if(wide || close) return;
    }
    cast.push(s);
  });
  // 先照希望的身高排，有人的頭會超出安全框就全體縮小。左右超出的人往內拉，不把主唱一起縮小。
  let fitK = 1;
  for(const s of cast){
    const p = dancerPad(MEMBERS[s.m]?.img), h = bh*s.nh, need = h*(1 + p.top + p.bot);
    const sole = box.t + bh*s.ny;
    if(sole - need < box.t) fitK = Math.min(fitK, (sole - box.t)/need);
    if(h*p.aspect*(1 + p.side) > bw) fitK = Math.min(fitK, bw/(h*p.aspect*(1 + p.side)));
  }
  const placed = cast.map(s => {
    const p = dancerPad(MEMBERS[s.m]?.img), h = bh*s.nh*fitK, half = h*p.aspect*(1 + p.side)/2;
    let x = box.l + bw*s.nx;
    x = Math.max(box.l + half, Math.min(box.r - half, x));
    const y = box.t + bh*s.ny - h*p.bot;
    return {m: s.m, x, y, h};
  });
  placed.forEach(({m, x, y, h}, k) => {
    const delay = k*.08*Math.min(1,11/Math.max(1,placed.length-1)), st = danceState(m, t, {alt: true, e: m === LEAD ? 1 : .9});
    g.save(); g.globalAlpha = easeOut((intro - delay)/.5 + (intro >= 1 ? 1 : 0));
    // 光暈放在頭後方、收小，白色核心才不會從肩膀兩側爆出來
    g.globalCompositeOperation = 'lighter'; glow(x, y - h*.72, h*.32, MEMBERS[m].color, .06 + .05*pl); g.globalCompositeOperation = 'source-over';
    drawDancer(m, x, y, h, st);
    g.restore();
  });
  if(sh.cue?.sec?.label === 'CHORUS' || sh.variant === 'break') confetti(t, 70, sh.variant === 'break' ? .7 : 1);
  sparkles(t, 16, 8, [0, 40, W, 700]);
  const secStart = sh.cue?.sec?.label === 'CHORUS' ? sh.cue.sec.start : -99;
  focusLines(t, (1 - clamp((t - secStart)/1.4))*.9, W/2, 560, 420);
  g.save(); g.globalCompositeOperation = 'lighter'; particles(t, 30, 5); g.restore();
  g.restore();
  if(sh.variant === 'break'){
    g.save(); g.font = `italic 800 150px ${FONT.logo}`; g.textAlign = 'center'; g.lineWidth = 3;
    g.strokeStyle = `rgba(255,255,255,${.35 + .3*pl})`; g.letterSpacing = '18px'; g.strokeText('DANCE BREAK', W/2, 540); g.restore();
  }
  lyricShade(760, .7);
  karaoke(t, {cx: W/2, y: 985, size: 66, maxW: 1560, zhSize: 36});
}
/* ---------------- 騎自行車：個別角色騎車的段落 ---------------- */
// 側面的城市車：輪胎、輪圈、輪輻、菱形車架、前叉、座墊、齒盤與鏈條。
// 輪子比人矮一截，車架才不會被兩顆大圓吞掉。part='back' 在角色後方、'front' 在前方。
function drawBicycle(cx, cy, R, spin, pedal, o = {}){
  const back = o.part !== 'front';
  const rv = R*.74;
  const hubY = cy + (R - rv);
  const rear = [cx - R*1.32, hubY], front = [cx + R*1.32, hubY];
  const crank = [cx - R*.14, cy + R*.16], seat = [cx - R*.78, cy - R*.92];
  const cluster = [cx - R*.42, cy - R*.34];
  const crown = [cx + R*.86, hubY - rv - R*.1];
  const head = [cx + R*.78, cy - R*1.02];
  const frame = o.frame || '#2faf9c';
  const tubeW = Math.max(4, R*.09);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const tube = (a, b, w = tubeW) => {
    g.strokeStyle = '#102028'; g.lineWidth = w + Math.max(2, w*.38);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.strokeStyle = frame; g.lineWidth = w;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  };
  const wheel = p => {
    g.save(); g.translate(p[0], p[1]);
    g.beginPath(); g.arc(0, 0, rv, 0, Math.PI*2);
    g.strokeStyle = '#141820'; g.lineWidth = rv*.22; g.stroke();
    g.beginPath(); g.arc(0, 0, rv*.9, 0, Math.PI*2);
    g.strokeStyle = '#c5ceda'; g.lineWidth = Math.max(1.5, rv*.045); g.stroke();
    g.strokeStyle = 'rgba(214,222,232,.82)'; g.lineWidth = Math.max(1, rv*.022);
    g.rotate(spin);
    for(let i = 0; i < 12; i++){
      const a = i/12*Math.PI*2;
      g.beginPath();
      g.moveTo(Math.cos(a)*rv*.18, Math.sin(a)*rv*.18);
      g.lineTo(Math.cos(a)*rv*.84, Math.sin(a)*rv*.84);
      g.stroke();
    }
    g.fillStyle = '#2a3144'; g.beginPath(); g.arc(0, 0, rv*.13, 0, Math.PI*2); g.fill();
    g.restore();
  };
  const fender = p => {
    g.save(); g.translate(p[0], p[1]);
    const rad = rv*1.22, a0 = Math.PI*1.08, a1 = Math.PI*1.92;
    g.beginPath(); g.arc(0, 0, rad, a0, a1);
    g.strokeStyle = '#102028'; g.lineWidth = rv*.1; g.stroke();
    g.beginPath(); g.arc(0, 0, rad, a0, a1);
    g.strokeStyle = frame; g.lineWidth = rv*.055; g.stroke();
    g.restore();
  };
  if(back){
    wheel(rear); fender(rear);
    tube(crank, rear, tubeW*.72);
    tube(cluster, rear, tubeW*.62);
    tube(crank, cluster);
    tube(cluster, head, tubeW*.78);
    tube(crank, crown);
    tube(crown, head, tubeW*.7);
    tube(cluster, seat, tubeW*.48);
    const ring = rv*.4, cog = rv*.26;
    const dx = rear[0] - crank[0], dy = rear[1] - crank[1], len = Math.hypot(dx, dy) || 1;
    const px = -dy/len, py = dx/len;
    g.strokeStyle = '#1a1e28'; g.lineWidth = Math.max(1.5, rv*.035);
    g.beginPath();
    g.moveTo(crank[0] + px*ring, crank[1] + py*ring);
    g.lineTo(rear[0] + px*cog, rear[1] + py*cog);
    g.moveTo(crank[0] - px*ring, crank[1] - py*ring);
    g.lineTo(rear[0] - px*cog, rear[1] - py*cog);
    g.stroke();
    g.beginPath(); g.arc(crank[0], crank[1], ring, 0, Math.PI*2);
    g.strokeStyle = '#102028'; g.lineWidth = rv*.09; g.stroke();
    g.strokeStyle = frame; g.lineWidth = rv*.045; g.stroke();
    g.beginPath(); g.arc(rear[0], rear[1], cog, 0, Math.PI*2);
    g.strokeStyle = '#1a1e28'; g.lineWidth = rv*.07; g.stroke();
    g.fillStyle = '#2c3138';
    g.beginPath(); g.ellipse(seat[0] + R*.08, seat[1] - R*.05, R*.38, R*.075, -.2, 0, Math.PI*2); g.fill();
  } else {
    wheel(front); fender(front);
    tube(crown, front, tubeW*.78);
    const stem = [head[0] - R*.02, head[1] - R*.18];
    const grip = [stem[0] - R*.36, stem[1] + R*.03];
    tube(head, stem, tubeW*.62);
    tube(grip, [stem[0] + R*.18, stem[1] - R*.02], tubeW*.55);
    // 只留一支手煞車。煞車線、夾器交叉和圓點會在輪冠上變成一點一線。
    g.strokeStyle = '#e8eef8'; g.lineWidth = tubeW*.42;
    g.beginPath();
    g.moveTo(grip[0] + R*.1, grip[1]);
    g.quadraticCurveTo(grip[0] + R*.02, grip[1] + R*.14, grip[0] + R*.16, grip[1] + R*.2);
    g.stroke();
    // 踏板畫在角色前面，但只露出鞋底以下的那一段，鞋子才不會被黃色蓋住，
    // 也不會在腳跟下面空出一截。sy 是鞋底；沒有腳的位置就繞著曲柄轉。
    const rx = R*.16, ry = R*.07;
    const step = (sx, sy) => {
      const py = sy + ry*.35;
      g.strokeStyle = '#2a2f3a'; g.lineWidth = tubeW*.55;
      g.beginPath(); g.moveTo(crank[0], crank[1]); g.lineTo(sx, py); g.stroke();
      g.save();
      g.beginPath(); g.rect(sx - rx - 1, sy - 1, rx*2 + 2, ry*3); g.clip();
      g.fillStyle = T.accent; g.beginPath(); g.ellipse(sx, py, rx, ry, 0, 0, Math.PI*2); g.fill();
      g.restore();
    };
    if(o.feet) o.feet.forEach(([sx, sy]) => step(sx, sy));
    else for(const off of [0, Math.PI]){
      const a = pedal + off;
      step(crank[0] + Math.cos(a)*R*.44, crank[1] + Math.sin(a)*R*.44 - ry*.35);
    }
    // 曲柄軸用深色。塗成跟踏板一樣的黃色時，會在小腿旁邊多一顆沒被踩到的圓點。
    g.fillStyle = '#2a3144'; g.beginPath(); g.arc(crank[0], crank[1], R*.08, 0, Math.PI*2); g.fill();
  }
  g.restore();
}
// 路面：中央虛線往左捲動，遠處加幾道速度線
function drawRoad(t, horizon, speed){
  const road = g.createLinearGradient(0, horizon, 0, H);
  road.addColorStop(0, 'rgba(28,32,48,.92)'); road.addColorStop(1, 'rgba(14,16,26,.98)');
  g.fillStyle = road; g.fillRect(0, horizon, W, H - horizon);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 9;
  const off = (t*speed) % 260;
  for(let x = -off; x < W + 260; x += 260){
    g.beginPath(); g.moveTo(x, horizon + (H - horizon)*.62); g.lineTo(x + 130, horizon + (H - horizon)*.62); g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 4;
  for(let i = 0; i < 3; i++){
    const y = horizon + (H - horizon)*(.16 + i*.3), o2 = (t*speed*(1 + i*.5)) % 420;
    g.beginPath(); g.moveTo(-o2, y); g.lineTo(-o2 + 420, y); g.stroke();
  }
}
// 一位角色騎一台車：車架後半 → 角色 → 前輪與踏板，腿自然被車身擋住
function drawRider(m, cx, cy, R, t, opts = {}){
  const pedal = t*opts.cadence, spin = -t*opts.speed/R;
  const bob = Math.sin(pedal*2)*R*.025;
  const img = MEMBERS[m]?.img;
  // 踏板對準圖層量到的鞋底。以前用整條腿的外框底邊再往下偏，黃色橢圓會懸在褲腳下面。
  // 兩腿一前一後擺（正面立繪在側面視角下讀起來就是踩踏）。
  const intact = !!MEMBERS[m]?.meta?.intact;
  const swing = Math.sin(pedal), amp = (opts.legAmp ?? .30)*(MEMBERS[m]?.meta?.legScale ?? 1);
  const angL = intact ? 0 : amp*swing, angR = intact ? 0 : -amp*swing;
  // SpriteRig.draw 會把傳入的 tilt 再乘 0.6，鞋底的點要一起轉，踏板才跟得上鞋子。
  const tilt = .07*.6;
  let feet = null, h = 0, fx = cx - R*.06, feetY = 0;
  if(img){
    const r = SpriteRig.measure(img), rig = SpriteRig.bake(img);
    h = R*2.9;
    const k = h/img.height, w = img.width*k;
    const hipFrac = r.ok ? r.hipY/r.H : .6;
    feetY = (cy - R*.92) + h*(1 - hipFrac);                 // 髖部落到座墊高度
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const foot = (key, ang) => {
      const L = rig?.layers?.[key]; if(!L?.sole) return null;
      const piv = key === 'legL' ? rig.pivotL : rig.pivotR;
      const jx = piv ? piv.x : r.legSplit, jy = piv ? piv.y : r.hipY;
      const [px0, py0] = SpriteRig.chainPoint(jx, jy, 'y', L.y0 + L.h, ang, rig.thighW || r.hh*.04, L.sole.x, L.sole.y);
      // 鞋底轉出圖外會被切掉，踏板要留在還看得到的鞋底上。
      const px = Math.max(0, Math.min(r.W - 1, px0)), py = Math.max(0, Math.min(r.H - 1, py0));
      const lx = -w/2 + px*k, ly = -h + py*k;
      return [fx + lx*ct - ly*st, feetY + lx*st + ly*ct];
    };
    feet = [foot('legL', angL), foot('legR', angR)].filter(Boolean);
  }
  g.save(); g.translate(0, bob);
  drawBicycle(cx, cy, R, spin, pedal, {frame: opts.frame, part: 'back'});
  if(img) SpriteRig.draw(g, img, fx, feetY, h, {
    energy: 0, wave: 0, hop: 0, tilt: .07,
    armA: -.78 + .07*Math.sin(pedal), armB: -.78 + .07*Math.sin(pedal + 1.6),
    legA: angL, legB: angR, armScale: MEMBERS[m]?.meta?.armScale, intact
  });
  drawBicycle(cx, cy, R, spin, pedal, {frame: opts.frame, part: 'front', feet: feet?.length ? feet : null});
  g.restore();
}
function shotBike(t, sh, u){
  const horizon = 430;
  const R = 100;
  // 前景輪子縮放後會再往下約一個輪半徑。整排一起上移，輪底停在歌詞遮罩之上。
  const lyricTop = 800;
  const frontScale = 1.05;
  const frontY = lyricTop - (R + R*.03)*frontScale;
  backdrop(t, {dim: .25, art: .22});
  g.save(); g.globalAlpha = .5;                          // 遠山視差
  for(let k = 0; k < 2; k++){
    const y = horizon - 40 - k*70, sp = 14 + k*22, off = (t*sp) % 900;
    g.fillStyle = k ? 'rgba(28,22,52,.75)' : 'rgba(52,40,86,.7)';
    g.beginPath(); g.moveTo(-off - 200, y);
    for(let x = -off - 200; x < W + 900; x += 300){ g.lineTo(x + 150, y - 90 - (k ? 40 : 0)); g.lineTo(x + 300, y); }
    g.lineTo(W + 900, H); g.lineTo(-off - 200, H); g.closePath(); g.fill();
  }
  g.restore();
  drawRoad(t, horizon, 380);
  // Every cast member gets a bicycle; the featured pair share the foreground.
  const ride = (m, cx, cy, sc, o) => { g.save(); g.translate(cx, cy); g.scale(sc, sc); drawRider(m, 0, 0, R, t, o); g.restore(); };
  const others=MEMBERS.map((_,i)=>i).filter(i=>!CENTERS.includes(i));
  const rows=Math.ceil(others.length/6),cols=Math.ceil(others.length/Math.max(1,rows));
  const oldTop = horizon + (rows === 1 ? 170 : 70), oldFront = horizon + 420;
  const topY = Math.min(oldTop - 40, horizon + 80);
  const placeY = y => topY + (y - oldTop) / (oldFront - oldTop) * (frontY - topY);
  const plan=others.map((m,i)=>{
    const row=Math.floor(i/cols),count=Math.min(cols,others.length-row*cols),col=i%cols;
    return [m,W*(col+.5)/count,placeY(horizon+(rows===1?170:70+row*100)),rows===1?.62:.38+row*.05,
      {speed:290+row*20,cadence:3.1+m*.04,frame:'rgba(47,175,156,.78)'}];
  });
  CENTERS.forEach((m,i)=>plan.push([m,W*(CENTERS.length===2?[.36,.64][i]:.5),placeY(oldFront),frontScale,
    {speed:430,cadence:4.2,frame:'#2faf9c'}]));
  plan.forEach(([m, cx, cy, sc, o]) => { if(m !== undefined) ride(m, cx, cy, sc, o); });
  g.save(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3;    // 速度線
  for(let i = 0; i < 16; i++){
    const y = horizon + 40 + hash(i*3.3)*(lyricTop - horizon - 70), len = 90 + hash(i*7.1)*220;
    const x = W - ((t*(620 + hash(i)*420) + i*160) % (W + 400));
    g.globalAlpha = .12 + .22*hash(i*5.7);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
  }
  g.restore();
  const tag = CENTERS.map(m=>MEMBERS[m].name).join(' · ');
  g.save(); g.font = `700 30px ${FONT.jp}`;
  const tw = g.measureText(tag).width;
  roundRect(W - 70 - tw - 40, H - 250, tw + 40, 52, 26); g.fillStyle = MEMBERS[LEAD].color; g.fill();
  g.fillStyle = '#fff'; g.fillText(tag, W - 70 - tw - 20, H - 213); g.restore();
  g.save(); g.globalCompositeOperation = 'lighter'; particles(t, 26, 6); g.restore();
  lyricShade(830, .72);
  karaoke(t, {cx: W/2, y: 968, size: 60, maxW: 1560, zhSize: 34});
}
// 拍立得裡的合照：全員用 SpriteRig 現場跳舞，而不是貼上靜態立繪的 T-pose。
// 依人數排成一～三排、主唱放前排正中央；舞姿手腳都在動（手臂大擺、雙腿開合踏步）。
function groupPhoto(t, lt, cw, ch){
  const N = MEMBERS.length, rows = N <= 4 ? 1 : N > 12 ? 3 : 2, cols = Math.ceil(N/rows);
  const order = MEMBERS.map((_, i) => i).filter(i => i !== LEAD);
  const center = (rows-1)*cols + Math.floor((N-(rows-1)*cols)/2);
  order.splice(Math.min(center, order.length), 0, LEAD);
  if(CENTERS.length===2) order.splice(0,order.length,0,1,4,5,6,2,3,7);
  const cellW = cw/cols, cellH = ch/rows, pl = pulse(t), en = Math.max(energy(t), .7);
  order.forEach((m, k) => {
    const mem = MEMBERS[m]; if(!mem?.img) return;
    const row = Math.floor(k/cols), inRow = k % cols, count = Math.min(cols, N - row*cols);
    const cx = -cw/2 + (cols - count)/2*cellW + (inRow + .5)*cellW;
    // 拍立得的白框會把抬過頭頂的手切掉，格子要留出手和鞋的餘裕。
    const pad = dancerPad(mem.img);
    let h = cellH*.98/(1 + pad.top + pad.bot);
    if(h*pad.aspect*(1 + pad.side) > cellW*.96) h = cellW*.96/(pad.aspect*(1 + pad.side));
    const cellTop = -ch/2 + row*cellH, sole = cellTop + (cellH + h*(1 + pad.top + pad.bot))/2;
    const baseY = sole - h*pad.bot;
    const entry = easeOut((lt - k*.05)/.6);
    // 每個人錯開一點拍點，合照才不會像整排一起做體操；雙腿用「開合」而不是左右同擺。
    // 擺幅刻意保守：立繪的腿是切圖拼的，擺太大會在髖部留下一條沒跟上的細縫。
    const p = beatPos(t) + m*.17, sw = Math.sin(Math.PI*p), open = Math.max(0, sw);
    const st = {wave: sw, energy: en, hop: Math.abs(sw)*20*en, tilt: .09*sw,
      squash: Math.max(0, 1 - frac(p)*6)*.05*en,
      legA: (.05 + .13*open)*en, legB: -(.05 + .13*open)*en};
    if(m === LEAD){
      g.save(); g.globalCompositeOperation = 'lighter';
      glow(cx, baseY - h*.5, h*.5, mem.color, (.16 + .12*pl)*entry); g.restore();
    }
    const room = Math.max(0, cw/2 - Math.abs(cx) - h*pad.aspect*(1 + pad.side)/2 - 8);
    g.save(); g.globalAlpha = entry;
    drawDancer(m, cx + (1 - entry)*(inRow % 2 ? 1 : -1)*Math.min(36, room), baseY, h, st);
    g.restore();
  });
}
// 尾聲：拍立得合照＋LOGO，最後淡出
function shotOutro(t, sh, u){
  // 這裡刻意不用主視覺的柔焦底（模糊的人物會在背景留下像殘影的重影），
  // 改成主題色漸層＋一盞打亮合照的柔光，乾淨但仍有聚光感。
  g.drawImage(C.sky, 0, 0);
  g.fillStyle = 'rgba(6,4,16,.5)'; g.fillRect(0, 0, W, H);
  bokeh(t, 12, 6);
  particles(t, 40, 7);
  const lt = t - sh.start, cw = 980, ch = song.photoAspect ? cw/song.photoAspect : cw*AH/AW, rot = -.025 + Math.sin(t*.5)*.01;
  const e = easeBack(lt/.9);
  g.save(); g.translate(W/2, 470 + (1 - e)*200 + Math.sin(t*.8)*6); g.rotate(rot); g.scale(.85 + .15*e, .85 + .15*e); g.globalAlpha = clamp(lt/.4);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-cw/2 - 4, -ch/2 + 4, cw + 36, ch + 36);
  g.fillStyle = '#fff'; g.fillRect(-cw/2 - 18, -ch/2 - 18, cw + 36, ch + 36);
  g.save(); roundRect(-cw/2, -ch/2, cw, ch, 2); g.clip();
  const bg = g.createLinearGradient(0, -ch/2, 0, ch/2);
  bg.addColorStop(0, T.sky[0]); bg.addColorStop(.5, T.sky[1]); bg.addColorStop(1, T.sky[2]);
  g.fillStyle = bg; g.fillRect(-cw/2, -ch/2, cw, ch);
  g.save(); g.globalCompositeOperation = 'lighter';
  const spot = g.createRadialGradient(0, -ch*.08, 0, 0, -ch*.08, Math.max(cw, ch)*.62);
  spot.addColorStop(0, 'rgba(255,255,255,.34)'); spot.addColorStop(.55, 'rgba(255,255,255,.09)'); spot.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = spot; g.fillRect(-cw/2, -ch/2, cw, ch);
  g.restore();
  g.fillStyle = 'rgba(8,6,24,.3)'; g.fillRect(-cw/2, -ch/2, cw, ch);
  groupPhoto(t, lt, cw, ch);
  g.restore();
  g.restore();
  sparkles(t, 14, 11);
  if(song.series) stickerText(song.series, W/2, 900, 78, [T.accent, '#ffffff', T.cool, T.accent2], sh.start + .6, t);
  else logo(W/2, 900, 150, sh.start + .6, t);
  g.save(); g.globalAlpha = clamp((lt - 1.4)/.6); g.textAlign = 'center';
  g.font = `600 34px ${FONT.jp}`; g.fillStyle = '#fff'; g.fillText(`${song.title}  ／  ${song.ver}`, W/2, 1010);
  g.restore();
  karaoke(t, {cx: W/2, y: 120, size: 52, maxW: 1500, zhSize: 30});
}
// 四張參考圖的角色展示：每組保留全身，輪替至整首歌曲結束。
function shotCharacters(t,sh,u){
  const group=CHARACTER_GROUPS[sh.group], local=t-sh.start, actors=group.members;
  g.drawImage(group.backdrop,0,0);
  const pl=pulse(t), floor=g.createLinearGradient(0,600,0,H);
  floor.addColorStop(0,'rgba(255,255,255,0)');floor.addColorStop(1,'rgba(8,14,40,.8)');
  g.fillStyle=floor;g.fillRect(0,450,W,H-450);
  for(let i=0;i<5;i++){
    const x=W*(i+.5)/5, sway=Math.sin(t*.6+i)*240;
    const light=g.createLinearGradient(x,0,x+sway,880);
    light.addColorStop(0,'rgba(255,255,255,.16)');light.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=light;g.beginPath();g.moveTo(x-6,0);g.lineTo(x+6,0);g.lineTo(x+sway+130,900);g.lineTo(x+sway-130,900);g.closePath();g.fill();
  }
  const sizes={casual:[1920,1080],rooftop:[1536,1024],idol:[1536,1024],stage:[1774,887],anaru:[1920,1080],lucky:[1920,1080],kaguya:[1920,1080],aiura:[1920,1080],growup:[1920,1080],vwest:[1920,1080]};
  const [sourceW,sourceH]=sizes[group.sheet],scale=Math.min((W-160)/sourceW,740/sourceH);
  const originX=(W-sourceW*scale)/2,originY=150;
  if(group.matte){
    // 相互遮擋的裙襬採用完整透明群像，保持接縫完整；群像以分條側彎同步呼吸。
    const strips=32,wave=Math.sin(Math.PI*beatPos(t))*energy(t)*7;
    for(let s=0;s<strips;s++){
      const v=s/strips,sy=v*sourceH,sh=Math.min(sourceH/strips+1,sourceH-sy);
      g.drawImage(group.matte,0,sy,sourceW,sh,originX+wave*Math.pow(1-v,1.7),originY+sy*scale,sourceW*scale,sh*scale);
    }
  }
  const focus=Math.floor(Math.max(0,local-2)/2)%actors.length;
  // solo 組的切圖來自各自獨立的立繪，沒有群像座標，改用網格平均排列（人數少時一列排開、每列置中）
  const solo=!!group.solo,n=actors.length,gw=sourceW*scale,gh=sourceH*scale;
  const cols=solo?(n>12?6:n===12?6:n===10?5:Math.min(4,Math.max(1,n))):1,rows=solo?Math.ceil(n/cols):1;
  const cw=solo?gw/cols:0,chh=solo?gh/rows:0;
  actors.forEach((actor,i)=>{
    const slot=group.sheet==='lucky'?[0,1,5,6,2,3,4,7][i]:i;
    const col=solo?slot%cols:i,row=solo?Math.floor(slot/cols):0;
    const inRow=solo?Math.min(cols,n-row*cols):1;
    const h=solo?Math.min(chh*.9,cw*.95*actor.meta.h/actor.meta.w):actor.meta.h*scale;
    const x=solo?originX+(gw-inRow*cw)/2+(col+.5)*cw:originX+(actor.meta.source[0]+actor.meta.w/2)*scale;
    const y=solo?originY+(row+1)*chh-6:originY+(actor.meta.source[1]+actor.meta.h)*scale;
    const entry=easeOut((local-i*.045)/.65);
    const state=danceState(i,t,{e:.23,alt:true});state.actor=actor;
    state.hop=Math.min(state.hop,8);
    g.save();g.globalAlpha=entry;
    if(i===focus){g.globalCompositeOperation='lighter';glow(x,y-h*.5,h*.48,group.colors[0],.18+.12*pl);g.globalCompositeOperation='source-over';}
    if(!group.matte) drawDancer(i,x+(1-entry)*(i%2 ? 100 : -100),y,h*entry,state);
    g.restore();
    g.save();g.textAlign='center';g.font=`600 16px ${FONT.mono}`;g.fillStyle='rgba(255,255,255,.65)';
    g.globalAlpha=entry;g.fillText(pad(i+1),x,y+24);g.restore();
  });
  g.save();g.fillStyle='rgba(9,12,34,.5)';roundRect(42,30,620,96,18);g.fill();
  g.fillStyle='#fff';g.font=`700 34px ${FONT.zh}`;g.fillText(group.title,66,76);
  g.font=`500 18px ${FONT.mono}`;g.fillStyle=group.colors[1];g.fillText(`CHARACTER PV  ·  ${pad(sh.group+1)} / ${pad(CHARACTER_GROUPS.length)}`,68,106);
  g.textAlign='right';g.font=`600 24px ${FONT.mono}`;g.fillStyle='#fff';g.fillText(`${group.count} MEMBERS`,W-60,74);g.restore();
  sparkles(t,20,sh.group+20,[40,110,W-80,740]);
  lyricShade(908,.78);
  karaoke(t,{cx:W/2,y:989,size:48,maxW:1700,zhSize:28});
}
const SHOTS = {film: shotFilm, typo: shotTypo, windows: shotWindows, stage: shotStage, bike: shotBike, outro: shotOutro, characters:shotCharacters};

/* ---------------- 覆蓋層：片頭標題、轉場、HUD ---------------- */
function titleCard(t){
  let end = clamp(cues[0].start - .2, 4, 8);
  // 第一句人聲比鼓點晚。標題若跟著字幕走，節奏段仍會蓋著 Forever。
  if(song.file === 'Forever＆ever') end = Math.min(end, 4.4);
  if(t > end + .7) return;
  const out = clamp((t - end)/.7), a = 1 - out;
  g.save();
  g.fillStyle = `rgba(8,6,24,${.45*a})`; g.fillRect(0, 0, W, H);
  g.globalAlpha = a; g.translate(0, -out*60);
  g.textAlign = 'center'; g.font = `600 24px ${FONT.cond}`; g.letterSpacing = '8px'; g.fillStyle = 'rgba(255,255,255,.85)';
  g.globalAlpha = a*clamp((t - .3)/.6); g.fillText(song.kicker || 'EXH KANAGAWA TOURNAMENT 2048 · TOP-4 TEAM COMPILATION ALBUM', W/2, 250); g.letterSpacing = '0px';
  g.globalAlpha = a;
  sparkleFade = a; sparkles(t, 12, 12, [200, 180, 1520, 700]); sparkleFade = 1;
  if(song.series) stickerText(song.series, W/2, 360, 72, [T.accent, '#ffffff', T.cool, T.accent2], .5, t);
  else logo(W/2, 360, 120, .5, t);
  const size = Math.min(200, 1600/[...song.title].length/.96);
  stickerText(song.title, W/2, 590, size, POP, 1.1, t);
  const pa = easeBack((t - 1.9)/.5);
  if(pa > 0){
    g.font = `800 34px ${FONT.jp}`; g.letterSpacing = '6px';
    const label = `♪  ${song.ver}`, w = g.measureText(label).width + 80;
    g.save(); g.translate(W/2, 790); g.scale(pa, pa);
    roundRect(-w/2 + 6, -38, w, 76, 38); g.fillStyle = 'rgba(30,20,60,.35)'; g.fill();
    roundRect(-w/2, -44, w, 76, 38); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 5; g.strokeStyle = T.deep; g.stroke();
    g.fillStyle = T.deep; g.textBaseline = 'middle'; g.fillText(label, 0, -5); g.restore();
    g.letterSpacing = '0px';
  }
  g.restore();
}
function transition(t){
  for(const sh of shots){
    if(!sh.start) continue;
    const d = t - sh.start; if(d < -.22 || d > .22) continue;
    const prev = shots[shots.indexOf(sh) - 1];
    if(prev && prev.type === sh.type && sh.type !== 'stage'){ if(d > 0){ g.fillStyle = `rgba(255,255,255,${.35*(1 - d/.22)})`; g.fillRect(0, 0, W, H); } return; }
    const u = (d + .22)/.44, cols = [LOGO[0][1], LOGO[2][1], LOGO[1][1], LOGO[6][1]];
    g.save();
    cols.forEach((col, i) => {
      const x = lerp(-1100, W + 500, smooth(u - i*.04)) + i*150;
      g.fillStyle = col; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 260, 0); g.lineTo(x - 140, H); g.lineTo(x - 400, H); g.closePath(); g.fill();
    });
    if(d > 0 && sh.type === 'stage'){ g.fillStyle = `rgba(255,255,255,${.5*(1 - d/.22)})`; g.fillRect(0, 0, W, H); }
    g.restore();
    return;
  }
}
function hud(t, sh){
  const dark = sh.type === 'windows';
  const ink = dark ? 'rgba(20,20,60,.75)' : 'rgba(255,255,255,.82)';
  g.save(); g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 2; g.textBaseline = 'alphabetic';
  for(const [x, y, dx, dy] of [[34, 34, 1, 1], [W - 34, 34, -1, 1], [34, H - 34, 1, -1], [W - 34, H - 34, -1, -1]]){
    g.beginPath(); g.moveTo(x, y + dy*26); g.lineTo(x, y); g.lineTo(x + dx*26, y); g.stroke();
  }
  const sec = sectionAt(t), b = beatPos(t), bar = Math.max(1, Math.floor((b - A.barOff)/4) + 1), total = Math.floor((beatPos(A.dur) - A.barOff)/4) + 1;
  g.font = `600 22px ${FONT.cond}`; g.letterSpacing = '3px';
  g.fillText(`${song.series || 'BEST 4U'}  /  ${song.title}`, 60, 70);
  g.font = `15px ${FONT.mono}`; g.letterSpacing = '1px';
  g.fillText(`SEC.${pad(sec.no)}  ${sec.label}`, 60, 96);
  g.textAlign = 'right';
  const f = Math.floor(t*FPS), tc = `${pad(Math.floor(t/3600))}:${pad(Math.floor(t/60) % 60)}:${pad(Math.floor(t) % 60)}:${pad(f % FPS)}`;
  g.font = `18px ${FONT.mono}`; g.fillText(tc, W - 60, 70);
  g.font = `15px ${FONT.mono}`; g.fillText(`BAR ${pad(bar, 3)} / ${pad(total, 3)}`, W - 60, 96);
  g.textAlign = 'left';
  g.fillText(`♩=${A.bpm.toFixed(1)}`, 60, H - 62);
  [['LO', A.low], ['MI', A.mid], ['AL', A.rms]].forEach(([n, arr], i) => {
    const v = clamp(sample(arr, t)/1.1);
    g.fillText(n, 160 + i*96, H - 62); g.globalAlpha = .3; g.fillRect(186 + i*96, H - 72, 50, 8); g.globalAlpha = 1; g.fillRect(186 + i*96, H - 72, 50*v, 8);
  });
  const beatInBar = ((Math.floor(b - A.barOff) % 4) + 4) % 4;
  for(let i = 0; i < 4; i++){ g.globalAlpha = i === beatInBar ? 1 : .3; g.beginPath(); g.arc(W - 150 + i*26, H - 68, 7, 0, Math.PI*2); g.fill(); }
  g.globalAlpha = 1;
  g.fillStyle = dark ? 'rgba(20,20,60,.2)' : 'rgba(255,255,255,.2)'; g.fillRect(60, H - 44, W - 120, 3);
  g.fillStyle = T.accent; g.fillRect(60, H - 44, (W - 120)*clamp(t/A.dur), 3);
  g.letterSpacing = '0px';
  g.restore();
}

function render(t){
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.letterSpacing = '0px'; g.shadowBlur = 0;
  T0 = t;
  const sh = shotAt(t), u = clamp((t - sh.start)/(sh.end - sh.start));
  const z = 1 + (sh.type === 'stage' ? .016 : .006)*pulse(t)*energy(t);
  g.save(); g.translate(W/2, H/2); g.scale(z, z); g.translate(-W/2, -H/2);
  SHOTS[sh.type](t, sh, u);
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if(!CHARACTER_PV) titleCard(t);
  transition(t);
  g.drawImage(C.vig, 0, 0);
  g.save(); g.globalAlpha = .045; g.translate(-Math.floor(hash(Math.floor(t*FPS))*256), -Math.floor(hash(Math.floor(t*FPS) + .5)*256));
  g.fillStyle = C.noise; g.fillRect(0, 0, W + 256, H + 256); g.restore();
  if(!CHARACTER_PV) hud(t, sh);
  const fade = Math.max(1 - clamp(t/.8), clamp((t - (A.dur - 2.5))/2.4));
  if(fade > 0){ g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
}

/* ---------------- 載入、預覽與逐格輸出 ---------------- */
const msg = s => { $('#msg').textContent = s; };
function post(path, body){ return fetch(`/__pv/${path}?job=${encodeURIComponent(JOB)}`, {method: 'POST', body}); }
window.addEventListener('error', e => { if(RENDER) post('error', String(e.message || e)); });
window.addEventListener('unhandledrejection', e => { if(RENDER) post('error', String(e.reason?.stack || e.reason)); });

let previewAudio = null;
function pvQuery(index, characterMode){
  const query = new URLSearchParams({song:String(index)});
  if(characterMode) query.set('mode','characters');
  const speed = $('#speed').value;
  if(speed !== '1') query.set('speed', speed);
  return query;
}
function updateModeLink(){
  $('#modeLink').href = `pv.html?${pvQuery(songIndex, !CHARACTER_PV)}`;
}
function changeSong(index){
  const query = pvQuery((index+SONGS.length)%SONGS.length, CHARACTER_PV);
  if(previewAudio && !previewAudio.paused) query.set('autoplay','1');
  location.search = query.toString();
}
async function init(){
  window.SpriteRig?.setCacheLimit?.(Math.max(MEMBERS.length,...(CHARACTER_PV?CHARACTER_GROUPS.map(g=>g.count):[])));
  if(RENDER) document.body.classList.add('render');
  const sel = $('#song');
  const order=SongOrder.group(SONGS.map((s,index)=>({title:s.title,index})));
  const position=order.findIndex(item=>item.index===songIndex);
  order.forEach(({index})=>{const s=SONGS[index];sel.add(new Option(`${s.title}（${s.ver}）`,index,false,s===song));});
  sel.onchange = () => changeSong(+sel.value);
  $('#prevSong').onclick = () => changeSong(order[(position-1+order.length)%order.length].index);
  $('#nextSong').onclick = () => changeSong(order[(position+1)%order.length].index);
  $('#prevSong').disabled = $('#nextSong').disabled = SONGS.length<2;
  const speed = $('#speed');
  const requestedSpeed = params.get('speed');
  if([...speed.options].some(option => option.value === requestedSpeed)) speed.value = requestedSpeed;
  updateModeLink();
  $('#modeLink').textContent=CHARACTER_PV ? '歌詞 PV' : '人物 PV';
  if(CHARACTER_PV) document.title='人物動畫 PV · '+song.title;
  msg('載入音訊與素材…');
  const loadImg = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('找不到 ' + src)); im.src = src; });
  const get = async (name, kind) => { const r = await fetch(encodeURIComponent(name)); if(!r.ok) throw new Error('找不到 ' + name); return r[kind](); };
  const [cover, srt, buf] = await Promise.all([loadImg(ART.src), get(song.subs, 'text'), get(song.audio, 'arrayBuffer')]);
  await Promise.all([jpFont(40), zhFont(40), `300 40px ${FONT.mincho}`, `40px ${FONT.maru}`, `italic 800 40px ${FONT.logo}`, `600 40px ${FONT.cond}`]
    .map(f => document.fonts.load(f, 'あ漢字ABC')));
  const castJson = await fetch('assets/ref/cast/cast.json').then(r => { if(!r.ok) throw new Error('找不到角色切圖，請先執行 node tools/cutout.mjs'); return r.json(); });
  if(song.art==='vwest') FACES.push(...castJson.vwest.map(m=>m.groupFace));
  await Promise.all(MEMBERS.map(async m => { m.meta = castJson[m.sheet][m.idx]; m.img = await loadImg('assets/ref/cast/' + m.meta.file); }));
  if(CHARACTER_PV) await Promise.all(CHARACTER_GROUPS.map(async group=>{
    if(castJson[group.sheet]?.length!==group.count) throw new Error(`${group.title}切圖未完成，請執行 node tools/cutout.mjs`);
    group.members=await Promise.all(castJson[group.sheet].map(async meta=>({meta,img:await loadImg('assets/ref/cast/'+meta.file)})));
    group.art=await loadImg(group.src);
    if(group.sheet==='stage') group.matte=await loadImg('assets/ref/stage9-matte.png');
    group.backdrop=mk(W,H);const ctx=group.backdrop.getContext('2d'),gradient=ctx.createLinearGradient(0,0,W,H);
    gradient.addColorStop(0,group.colors[0]);gradient.addColorStop(1,group.colors[1]);ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(7,12,34,.48)';ctx.fillRect(0,0,W,H);
  }));
  msg('分析節拍…');
  A = await analyse(buf);
  cues = parseSrt(srt);
  {
    let ja = 0, en = 0;
    for(const c of cues){
      if(/[ぁ-ゟ゠-ヿ]/.test(c.jp)) ja++;
      else if(LyricText.mainIsEnOrJa(c.jp)) en++;
    }
    songScript = ja * 2 >= cues.length ? 'ja' : en * 2 >= cues.length ? 'en' : 'cjk';
  }
  if(!cues.length) throw new Error('字幕是空的');
  cues.forEach((c, i) => {
    c.i = i; c.ju = tokenize(c.jp); c.zu = tokenize(c.zh || '');
    c.jW = c.ju.reduce((a, u) => a + u.w, 0) || 1;
    const tj = tapeUnits(c.ju), tz = tapeUnits(c.zu);
    c.jo = TJ.length; TJ.push({sep: i + 1}, ...tj); c.jn = tj.length;
    c.zo = TZ.length; TZ.push({sep: i + 1}, ...tz); c.zn = tz.length;
  });
  // 這首一句可能有兩段（「宝物みたいな時間　未来動かす小さな願い」中間隔了兩秒多），
  // 填色若只照字幕視窗線性跑，間奏時就會把後半句提前點亮；句尾多留的 0.45 秒也會讓最後幾個字慢半拍。
  // 這裡改用逐字量到的時間，每個字在自己的時間唱完，句中停頓就停在那裡。
  if(song.file === 'Forever＆ever'){
    cues.forEach((c, i) => {
      const spec = FOREVER_SYLLABLES[i];
      if(!spec) return;
      const times = spec.split(' ').map(Number);
      let k = 0, ok = true;
      const fill = [];
      for(const u of c.ju){
        if(u.sp) continue;
        const n = [...u.t].length;
        if(k + n > times.length){ ok = false; break; }
        if(u.latin && n > 1){
          // 英文字母在畫面上逐字填，時間也逐字給。
          for(let j = 0; j < n; j++) fill.push({w: u.cw + u.w*(j + 1)/n, t: times[k++]});
        } else {
          k += n;
          fill.push({w: u.cw + u.w, t: times[k - 1]});
        }
      }
      if(ok && k === times.length) c.fill = fill;
    });
  }
  sections = buildSections();
  shots = buildShots();
  prepare(cover);
  window.PV.ready=true;
  console.log(`BPM ${A.bpm.toFixed(2)} 拍點 ${A.beat0.toFixed(3)}s 段落`, sections.map(s => `${s.label}@${s.start.toFixed(1)}`).join(' '));
  msg('');
  if(RENDER) return renderAll();
  preview(buf);
}
async function renderAll(){
  const from = +(params.get('from') || 0), to = Math.min(A.dur, +(params.get('to') || A.dur));
  if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||from>=to) throw new Error('輸出時間範圍無效');
  const f0 = Math.round(from*FPS), f1 = Math.round(to*FPS);
  await post('meta', JSON.stringify({title: CHARACTER_PV ? song.title+' · 全曲人物動畫' : song.title, ver: song.ver, audio: song.audio, file: CHARACTER_PV ? `全曲人物動畫（${CHARACTER_GROUPS.length > 1 ? `${CHARACTER_GROUPS.length} 組造型` : CHARACTER_GROUPS[0].title}） - `+song.title : song.file, frames: f1 - f0, from, to, fps: FPS, bpm: A.bpm,
    shots: shots.map(s => `${s.type}${s.variant ? ':' + s.variant : ''}@${s.start.toFixed(2)}`).join(' ')}));
  for(let f = f0; f < f1; f++){
    render(f/FPS);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .92));
    const r = await post('frame', blob);
    if(!r.ok) throw new Error('輸出中斷');
  }
  await post('done', '');
}
function preview(buf){
  const audioURL=URL.createObjectURL(new Blob([buf],{type:'audio/mpeg'}));
  const audio = new Audio(audioURL);
  previewAudio = audio;
  PlayerVolume.bind(audio);
  const speed = $('#speed');
  const applySpeed = () => {
    const rate = Number(speed.value);
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
    updateModeLink();
  };
  speed.addEventListener('change', applySpeed);
  applySpeed();
  speed.disabled = false;
  addEventListener('pagehide',()=>URL.revokeObjectURL(audioURL),{once:true});
  const play = $('#play'), seek = $('#seek'), time = $('#time');
  let seekDragging = false;
  const releaseSeek = () => { seekDragging = false; };
  seek.addEventListener('pointerdown', () => { seekDragging = true; });
  for(const event of ['pointerup','pointercancel','blur']) addEventListener(event,releaseSeek);
  seek.addEventListener('blur',releaseSeek);
  const skip = delta => {
    window.PV.hold=false;
    audio.currentTime=clamp(audio.currentTime+delta,0,A.dur);
  };
  $('#rewind5').disabled = $('#forward5').disabled = false;
  $('#rewind5').onclick = () => skip(-5);
  $('#forward5').onclick = () => skip(5);
  const fmt = s => `${Math.floor(s/60)}:${pad(Math.floor(s % 60))}`;
  const startPlayback = () => audio.play().catch(e=>{
    msg(e.name==='NotAllowedError' ? '瀏覽器已暫停自動播放，請按「▶ 播放」開始。' : '播放失敗：'+e.message);
  });
  play.disabled = false; play.textContent = '▶ 播放';
  play.onclick = () => {
    window.PV.hold=false;
    if(audio.currentTime>=A.dur) audio.currentTime=0;
    audio.paused ? startPlayback() : audio.pause();
  };
  audio.onplay = () => { msg(''); play.textContent = '❚❚ 暫停'; };
  audio.onpause = () => { play.textContent = '▶ 播放'; };
  seek.oninput = () => { window.PV.hold=false;audio.currentTime = seek.value/1000*A.dur; };
  const start = clamp(+(params.get('t') || 0),0,A.dur);
  audio.addEventListener('loadedmetadata',()=>{
    audio.currentTime=start;
    if(params.get('autoplay')==='1') startPlayback();
  },{once:true});
  addEventListener('keydown', e => { if(e.code === 'Space' && e.target === document.body){ e.preventDefault(); play.click(); } });
  let idle = 0; addEventListener('pointermove', () => { idle = performance.now(); $('#ui').classList.remove('idle'); });
  const loop = () => {
    const t = Math.min(audio.readyState ? audio.currentTime : start,A.dur);
    if(audio.currentTime>=A.dur && !audio.paused) audio.pause();
    if(!window.PV.hold) render(Math.min(t, A.dur - 1/FPS));
    if(!seekDragging) seek.value = Math.round(t/A.dur*1000);
    time.textContent = `${fmt(t)} / ${fmt(A.dur)}`;
    $('#ui').classList.toggle('idle', !audio.paused && !$('#ui').contains(document.activeElement) && performance.now() - idle > 2500);
    requestAnimationFrame(loop);
  };
  loop();
}
window.PV = {ready:false,hold: false, render: t => {if(!A || !shots.length) throw new Error('PV 尚未載入'); window.PV.hold = true; render(t); }, get shots(){ return shots; }, get analysis(){ return A; }, get sections(){ return sections; },get groups(){return CHARACTER_GROUPS.map(({sheet,count,members})=>({sheet,count,loaded:members?.length||0}));}};
init().catch(e => { console.error(e); msg('錯誤：' + e.message); if(RENDER) post('error', String(e.stack || e)); });
})();

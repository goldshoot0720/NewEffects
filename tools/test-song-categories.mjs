#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pv=fs.readFileSync(path.join(root,'pv.js'),'utf8'),v2=fs.readFileSync(path.join(root,'v2.html'),'utf8');
const registry=(s,key)=>{const a=s.indexOf(`const ${key} = [`),b=s.indexOf('\n];',a);return vm.runInNewContext(s.slice(a,b+3)+`;${key}`);};
const SONGS=registry(pv,'SONGS'),DEFAULT_SONGS=registry(v2,'DEFAULT_SONGS');
const box={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'playlist-order.js'),'utf8'),box);
const {SongOrder}=box.window;
const entries=SONGS.map((s,index)=>({...s,index})),groups=SongOrder.categories(entries);
const playback=SongOrder.group(entries);
assert.equal(playback[0].title,'SUNRISE');
assert.deepEqual(Array.from(SongOrder.group(DEFAULT_SONGS),s=>s.audio),Array.from(playback,s=>s.audio||s.file+'.mp3'));
assert.deepEqual(Array.from(SongOrder.group(DEFAULT_SONGS),s=>s.subs),Array.from(playback,s=>s.subs));
for(const song of DEFAULT_SONGS){
  assert.ok(fs.statSync(path.join(root,'audio',song.audio)).isFile(),song.audio);
  assert.ok(fs.statSync(path.join(root,'subtitles',song.subs)).isFile(),song.subs);
}
const catalog=fs.readFileSync(path.join(root,'SONGS.md'),'utf8');
const linkedIndices=Array.from(catalog.matchAll(/pv\.html\?song=(\d+)\)/g),m=>Number(m[1]));
assert.deepEqual(linkedIndices,Array.from(playback,s=>s.index));
const resume=pv.slice(pv.indexOf('const LAST_SONG_KEY'),pv.indexOf('function rememberSong'))+';savedSong()';
for(const [stored,expected] of [[null,1],['',1],['bad',1],['999',1],['0',0],['76',76]]){
  const localStorage={getItem:()=>stored};
  assert.equal(vm.runInNewContext(resume,{SONGS,SongOrder,localStorage}),expected);
}
assert.equal(vm.runInNewContext(resume,{SONGS,SongOrder}),1);
const flat=groups.flatMap(g=>g.items.map(s=>s.index));
assert.equal(flat.length,SONGS.length);assert.equal(new Set(flat).size,SONGS.length);
for(const [label,count] of [['ローリング☆ガールズ',10],['逆境無頼カイジ',4],['[C] THE MONEY OF SOUL AND POSSIBILITY CONTROL',2],['Extreme Hearts',4],['グロウアップショウ ～ひまわりのサーカス団～',2]])assert.equal(groups.find(g=>g.label===label).items.length,count,label);
const growup=groups.find(g=>g.label==='グロウアップショウ ～ひまわりのサーカス団～');
assert.deepEqual(Array.from(growup.items,s=>s.index).sort((a,b)=>a-b),[8,52]);
assert.ok(!groups.some(g=>g.id==='song:yurariyureru'),'romanized audio filenames must not create their own category');
const memories=groups.find(g=>g.items.some(s=>s.index===46));
assert.equal(memories.kind,'game');
assert.equal(memories.label,'ゲーム「メモリーズオフ 双想 Break out of my shell」');
assert.equal(SongOrder.optionLabel(memories.items[0],memories),'Forever＆ever（彩音）');
assert.equal(SONGS[46].kicker,'ゲーム「メモリーズオフ 双想 Break out of my shell」オープニングテーマ');
assert.equal(SONGS[46].tv,undefined);
assert.equal(SongOrder.categories([{title:'Forever&ever'}])[0].kind,'game');
const major=groups.find(g=>g.label==='メジャー');
assert.deepEqual(Array.from(major.items,s=>s.index).sort((a,b)=>a-b),[13,71,72]);
assert.equal(groups.find(g=>g.items.some(s=>s.index===73)).label,'Memories Offシリーズ');
const ace=groups.find(g=>g.label==='逆転裁判');
assert.deepEqual(Array.from(ace.items,s=>[s.index,s.title,s.ver]),[[74,'逆転Winner','WEST.'],[75,'人生は素晴らしい','WEST.']]);
const million=groups.find(g=>g.items.some(s=>s.index===76));
assert.equal(million.kind,'radio');
assert.equal(million.label,'アイドルマスター ミリオンライブ！');
const vwest=DEFAULT_SONGS.find(s=>s.id==='GGWhqMmOC3E');
assert.equal(SONGS[13].title,'さらば碧き面影');
assert.equal(SONGS[13].tv,'メジャー');
assert.equal(SONGS[13].kicker,'第2シリーズ OP');
assert.equal(SONGS[13].originalArtist,'ロードオブメジャー');
assert.equal(vwest.originalArtist,SONGS[13].originalArtist);
for(const song of [SONGS[13],vwest]){
  const [category]=SongOrder.categories([song]);
  assert.equal(category.kind,'anime');
  assert.equal(category.label,'メジャー');
  assert.equal(SongOrder.optionLabel(song,category),'さらば碧き面影（原唱：ロードオブメジャー）');
}
const family=groups.find(g=>g.items.some(s=>s.index===18));
assert.equal(family.items.length,4);
assert.deepEqual(Array.from(family.items,s=>SongOrder.optionLabel(s,family)),['中文','英文','日文','粵文']);
const v2groups=SongOrder.categories(DEFAULT_SONGS,DEFAULT_SONGS);
for(const g of groups){
  const other=v2groups.find(x=>x.id===g.id);assert.ok(other,g.label);
  assert.equal(other.items.length,g.items.length,g.label);
}
assert.equal(SongOrder.categories([]).length,0);
assert.equal(SongOrder.categories([{id:'custom',title:'My own song'}])[0].items.length,1);
assert.equal(SongOrder.categories(DEFAULT_SONGS.filter(s=>s.id!=='rpg-sfp'),DEFAULT_SONGS).find(g=>g.label.startsWith('[C]')).items.length,1);
// Previously saved defaults must receive the new cast and default lead;
// custom records and explicitly removed defaults must be preserved.
{
  const stale={id:'mirai-bokura',title:'old',cast:'mirai',lead:0};
  const custom={id:'custom',title:'My song',cast:'custom-art'};
  let saves=0;
  const a=v2.indexOf('let metaChanged = false;'),b=v2.indexOf('const orderedSongs=',a);
  const state={DEFAULT_SONGS,songs:[stale,custom],removedSongs:['rpg-sfp'],saveSongs:()=>saves++};
  vm.runInNewContext(v2.slice(a,b),state);
  assert.equal(stale.cast,'kaiji');assert.equal(stale.lead,4);assert.equal(saves,1);
  assert.equal(custom.cast,'custom-art');assert.ok(!state.songs.some(s=>s.id==='rpg-sfp'));
}
// YouTube supplies the cover video's upload title when playback starts.
{
  const saved={...vwest};
  const state={songs:[saved],songTitle:saved.title,mediaKey:'yt:'+saved.id,cfgOf:()=>vwest,
    media:{kind:'yt',ready:true,yt:{getVideoData:()=>({video_id:saved.id,title:'後はやるだけ！'})}}};
  const start=v2.indexOf('function updateTitleFromYt()');
  vm.runInNewContext(v2.slice(start,v2.indexOf('function setTitle()',start))+';updateTitleFromYt();',state);
  assert.equal(state.songTitle,vwest.title);
  assert.equal(saved.title,vwest.title);
}
class Option{constructor(text,value,_default=false,selected=false){this.text=text;this.value=String(value);this.selected=selected;}}
class Element{
  constructor(){this.options=[];this.children=[];this.dataset={};this.classList={toggle(){}};this._value=undefined;}
  set innerHTML(_){this.options=[];this.children=[];this._value=undefined;}
  get value(){return this._value??this.options.find(o=>o.selected)?.value??this.options[0]?.value??'';}
  set value(v){this._value=String(v);}
  setAttribute(name,value){this[name]=value;}
  add(o){this.options.push(o);if(o.selected)this._value=o.value;}
  appendChild(e){this.children.push(e);}
  querySelector(){return {classList:{toggle(){}}};}
}
// Exercise the actual two-stage PV controls at every existing song URL.
const a=pv.indexOf("  const sel = $('#song');",pv.indexOf('async function init()'));
const b=pv.indexOf("  const speed = $('#speed');",a);
for(let songIndex=0;songIndex<SONGS.length;songIndex++){
  const els=new Map();const $=id=>{if(!els.has(id))els.set(id,new Element());return els.get(id);};const calls=[];
  vm.runInNewContext(pv.slice(a,b),{SongOrder,SONGS,songIndex,$,Option,changeSong:i=>calls.push(i)});
  assert.equal(+$('#song').value,songIndex);
  const group=groups.find(g=>g.id===$('#category').value);
  assert.equal($('#song').options.length,group.items.length);
  $('#nextSong').onclick();assert.ok(Number.isInteger(calls.pop()));
  const other=groups.find(g=>g.id!==group.id);$('#category').value=other.id;$('#category').onchange();
  assert.equal(+$('#song').value,other.items[0].index);
  assert.equal(calls.pop(),other.items[0].index,'switching PV categories plays the first song');
  $('#song').value=other.items[0].index;$('#song').onchange();assert.equal(calls.pop(),other.items[0].index);
}
// The second player filters its list and picker using the same category model.
{
 const els=new Map();const $=id=>{if(!els.has(id))els.set(id,new Element());return els.get(id);};const calls=[];
 const context={SongOrder,DEFAULT_SONGS,songs:DEFAULT_SONGS,curSong:'rolling-girls-friendly',selectedSongCategory:null,$,Option,document:{createElement:()=>new Element()},getLyricsData:()=>null,parse:()=>[],mediaKey:'yt:rolling-girls-friendly',cfgOf:id=>DEFAULT_SONGS.find(s=>s.id===id)||{},playSong:id=>calls.push(id),updateNeighborTitles(){}};
 const a=v2.indexOf('function renderSongs(){'),b=v2.indexOf("$('#songs').addEventListener",a);vm.createContext(context);vm.runInContext(v2.slice(a,b)+';renderSongs();',context);
 assert.equal($('#songChoice').options.length,10);assert.equal($('#songs').children.length,10);
 $('#songCategory').value=family.id;$('#songCategory').onchange();assert.equal($('#songs').children.length,4);assert.equal($('#songChoice').value,'');assert.equal(calls.length,0);
 const id=$('#songChoice').options[1].value;$('#songChoice').value=id;$('#songChoice').onchange();assert.equal(calls.pop(),id);
 context.songs=[];vm.runInContext('renderSongs()',context);assert.equal($('#songChoice').disabled,true);
}
console.log(`PASS: ${SONGS.length} song URLs, ${groups.length} categories, both two-stage pickers, language ordering and empty lists`);

#!/usr/bin/env node
// Compress full-song PVs to a decimal MB limit while preserving duration and dimensions.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
function option(name,fallback){
  const i=args.indexOf('--'+name);
  if(i<0)return fallback;
  if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('--'+name+' 缺少參數');
  const value=args[i+1];args.splice(i,2);return value;
}
const maxMB=Number(option('max-mb','100'));
const inputDir=path.resolve(root,option('in','pv/characters/full'));
const outputDir=path.resolve(root,option('out','pv/characters/under100mb'));
if(!Number.isFinite(maxMB)||maxMB<=0)throw new Error('--max-mb 必須大於 0');
if(args.length)throw new Error('不支援參數：'+args.join(' '));
if(inputDir===outputDir)throw new Error('輸出資料夾必須與原始影片分開');
const limit=Math.floor(maxMB*1_000_000),audioRate=128_000;

function run(command,argv,capture=false){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,argv,{stdio:['ignore',capture?'pipe':'ignore','pipe']});
    let stdout='',stderr='';
    child.stdout?.on('data',d=>stdout+=d);
    child.stderr.on('data',d=>stderr=(stderr+d).slice(-12000));
    child.on('error',reject);
    child.on('close',code=>code===0?resolve(stdout):reject(new Error(command+' 結束碼 '+code+'：'+stderr)));
  });
}
const probe=async file=>JSON.parse(await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],true));

async function compress(name){
  const input=path.join(inputDir,name),source=await probe(input);
  const video=source.streams.find(s=>s.codec_type==='video');
  const duration=Number(source.format.duration);
  if(!video||!Number.isFinite(duration)||duration<=0)throw new Error('無法讀取影片：'+name);
  let rate=Math.floor((limit*.95*8/duration-audioRate)/1000)*1000;
  if(rate<100_000)throw new Error('指定大小不足以保留全曲：'+name);
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'neweffects-compress-'));
  try{
    const encoded=path.join(temp,'compressed.mp4'),passlog=path.join(temp,'pass');
    for(let attempt=0;attempt<3;attempt++){
      console.log(`▶ ${name}：${(duration/60).toFixed(2)} 分鐘，影像 ${Math.round(rate/1000)} kbps，第一遍`);
      const base=['-hide_banner','-loglevel','error','-y','-i',input,'-map','0:v:0','-c:v','libx264','-preset','fast','-threads','4','-b:v',String(rate),'-pix_fmt','yuv420p','-passlogfile',passlog];
      await run('ffmpeg',[...base,'-pass','1','-an','-f','null','/dev/null']);
      console.log(`  ${name}：第二遍`);
      await run('ffmpeg',[...base,'-pass','2','-map','0:a:0','-c:a','aac','-b:a',String(audioRate),'-movflags','+faststart',encoded]);
      const size=(await fs.stat(encoded)).size;
      if(size>=limit){rate=Math.floor(rate*limit/size*.94/1000)*1000;continue;}
      const result=await probe(encoded),v=result.streams.find(s=>s.codec_type==='video'),a=result.streams.find(s=>s.codec_type==='audio');
      if(Math.abs(Number(result.format.duration)-duration)>.1||v.width!==video.width||v.height!==video.height||v.r_frame_rate!==video.r_frame_rate||!a)throw new Error('輸出影片長度或規格不符：'+name);
      await run('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',encoded,'-f','null','-']);
      const output=path.join(outputDir,name);
      await fs.copyFile(encoded,output);
      console.log(`✔ ${name}：${(size/1_000_000).toFixed(2)} MB，全曲解碼檢查通過`);
      return;
    }
    throw new Error('三次壓縮後仍超過大小限制：'+name);
  }finally{
    // Only this invocation's freshly created temporary directory is removed.
    await fs.rm(temp,{recursive:true,force:true});
  }
}
await fs.mkdir(outputDir,{recursive:true});
const files=(await fs.readdir(inputDir)).filter(f=>f.endsWith('.mp4')).sort();
if(!files.length)throw new Error('找不到 MP4：'+inputDir);
const results=await Promise.allSettled(files.map(compress));
for(const result of results)if(result.status==='rejected')console.error(result.reason.message);
if(results.some(r=>r.status==='rejected'))process.exitCode=1;

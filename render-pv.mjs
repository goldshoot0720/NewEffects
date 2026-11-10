#!/usr/bin/env node
// 把 PV 播放頁（pv.html）逐格渲染成 MP4：本機伺服器提供檔案並接收 JPEG 影格，無頭 Chrome 執行 pv.js，ffmpeg 編碼並合併音訊。
// 用法：node render-pv.mjs [歌曲編號…] [--mode lyrics|characters] [--from 秒] [--to 秒] [--out 資料夾] [--encoder libx264|h264_videotoolbox|h264_nvenc] [--jobs 數量]
//   不指定歌曲就輸出 pv.js 裡的全部歌曲，預設同時處理兩首。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf('--' + name); if(i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const from = opt('from'), to = opt('to');
const mode=opt('mode') || 'lyrics';
if(!['lyrics','characters'].includes(mode)){console.error('--mode 為 lyrics 或 characters');process.exit(1);}
const encoder=opt('encoder') || 'libx264';
if(!['libx264','h264_videotoolbox','h264_nvenc'].includes(encoder)){console.error('--encoder 為 libx264、h264_videotoolbox 或 h264_nvenc');process.exit(1);}
const concurrency=Number(opt('jobs') || 2);
if(!Number.isInteger(concurrency)||concurrency<1){console.error('--jobs 必須為正整數');process.exit(1);}
const videoArgs=encoder==='libx264' ? ['-c:v','libx264','-preset','medium','-crf','18','-threads',String(Math.max(1,Math.min(4,Math.floor(os.availableParallelism()/concurrency))))]
  : encoder==='h264_nvenc' ? ['-c:v','h264_nvenc','-preset','p5','-rc','vbr','-cq','21','-b:v','6M','-maxrate','10M','-bufsize','20M']
  : ['-c:v','h264_videotoolbox','-b:v','16M'];
if([from,to].some(v=>v!==null && (!Number.isFinite(+v)||+v<0)) || (from!==null && to!==null && +to<=+from)){
  console.error('--from / --to 必須為非負秒數，結束時間必須晚於開始時間');process.exit(1);
}
const outDir = path.resolve(ROOT, opt('out') || 'pv');
const pvSrc = fs.readFileSync(path.join(ROOT, 'pv.js'), 'utf8');
const songsBlock = pvSrc.match(/const SONGS = \[([\s\S]*?)\n\];/);
const songCount = songsBlock ? (songsBlock[1].match(/\{title:/g) || []).length : 0;
const songs = args.length ? [...new Set(args.map(Number))] : [...Array(songCount).keys()];
if(!songCount || songs.some(n => !Number.isInteger(n) || n < 0 || n >= songCount)){ console.error(`歌曲編號為 0–${Math.max(0, songCount - 1)}`); process.exit(1); }
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome',
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES,'Google/Chrome/Application/chrome.exe'),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe')]
  .filter(Boolean)
  .find(p => fs.existsSync(p));
if(!CHROME){ console.error('找不到 Google Chrome，可用 CHROME=路徑 指定'); process.exit(1); }
fs.mkdirSync(outDir, {recursive: true});

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.srt': 'text/plain; charset=utf-8', '.lrc': 'text/plain; charset=utf-8', '.json': 'application/json'};
const jobs = new Map();
const readBody = req => new Promise((ok, no) => { const parts = []; req.on('data', d => parts.push(d)); req.on('end', () => ok(Buffer.concat(parts))); req.on('error', no); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if(url.pathname.startsWith('/__pv/')){
    const job = jobs.get(url.searchParams.get('job')), body = await readBody(req);
    if(!job){ res.writeHead(404).end(); return; }
    const action = url.pathname.slice(6);
    try{
      if(action === 'meta') job.start(JSON.parse(body));
      else if(action === 'frame') await job.frame(body);
      else if(action === 'done') job.finish();
      else if(action === 'error') job.fail(new Error(body.toString()));
      res.writeHead(204).end();
    }catch(e){ res.writeHead(500).end(String(e)); job.fail(e); }
    return;
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/pv.html' : url.pathname));
  if(!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()){ res.writeHead(404).end(); return; }
  res.writeHead(200, {'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size});
  fs.createReadStream(file).pipe(res);
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const PORT = server.address().port;

const BASE_FLAGS = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--window-size=1920,1080', '--enable-unsafe-swiftshader'];
function checkProfile(dir){
  const absolute=path.resolve(dir),temp=path.resolve(os.tmpdir());
  if(!absolute.startsWith(temp+path.sep)||!/^pv-(probe|chrome)-/.test(path.basename(absolute))) throw new Error('非本次輸出的暫存目錄：'+dir);
  return absolute;
}
// 容器或受限環境裡 Chrome 無法初始化自己的 sandbox，會直接 FATAL 收場。
// 先探測一次，只有真的失敗才加上 --no-sandbox（一般本機仍保留 Chrome 沙箱）。
function needsNoSandbox(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-probe-'));
  try{
    const r = spawnSync(CHROME, [...BASE_FLAGS, `--user-data-dir=${dir}`, '--dump-dom', 'about:blank'],
      {timeout: 20000, encoding: 'utf8', windowsHide: true});
    return /sandbox initialization failed|GPU process isn't usable|Failed to initialize sandbox/i.test(r.stderr || '');
  }catch{ return true; }
  finally{ try{ fs.rmSync(checkProfile(dir), {recursive: true, force: true, maxRetries: 10, retryDelay: 200}); }catch(e){ console.warn('暫存目錄稍後可清理：'+dir); } }
}
const FLAGS = needsNoSandbox() ? [...BASE_FLAGS, '--no-sandbox'] : BASE_FLAGS;
if(FLAGS.includes('--no-sandbox')) console.log('（這個環境無法初始化 Chrome 沙箱，改用 --no-sandbox）');

function runJob(index){
  return new Promise((resolve, reject) => {
    const id = String(index), profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-chrome-'));
    let ff = null, meta = null, count = 0, done = false, t0 = Date.now(), lastLog = 0, outFile = '';
    const query = new URLSearchParams({song: index, render: 1, job: id});
    if(mode==='characters') query.set('mode','characters');
    if(from) query.set('from', from);
    if(to) query.set('to', to);
    const chrome = spawn(CHROME, [...FLAGS, `--user-data-dir=${profile}`, `http://127.0.0.1:${PORT}/pv.html?${query}`], {stdio: 'ignore', windowsHide: true});
    let cleaning;
    const cleanup = () => cleaning ||= (async () => {
      try{ chrome.kill(); }catch{}
      await new Promise(ok=>setTimeout(ok,500));
      try{ await fs.promises.rm(checkProfile(profile), {recursive:true,force:true,maxRetries:20,retryDelay:250}); }
      catch{ console.warn('暫存目錄稍後可清理：'+profile); }
    })();
    const job = {
      start(m){
        meta = m;
        const part = from || to ? ` (${m.from.toFixed(0)}-${m.to.toFixed(0)}s)` : '';
        outFile = path.join(outDir, `${m.file} PV${part}.mp4`);
        const audioArgs = ['-ss', String(m.from), '-t', String(m.to - m.from)];
        const fades=mode==='characters' ? ['-af',`afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0,m.to-m.from-2.4)}:d=2.4`] : [];
        ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(m.fps), '-c:v', 'mjpeg', '-threads','2','-i', 'pipe:0',
          ...audioArgs, '-i', path.join(ROOT, m.audio), '-map', '0:v', '-map', '1:a', ...videoArgs,
          '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',...fades, '-shortest', '-movflags', '+faststart', outFile], {stdio: ['pipe', 'inherit', 'inherit'], windowsHide: true});
        ff.on('error', e=>job.fail(e));
        ff.stdin.on('error', e=>job.fail(e));
        ff.on('close', async code => {
          await cleanup();
          if(code === 0 && done){ console.log(`✔ ${path.relative(ROOT, outFile)}  (${count} 格，${((Date.now() - t0)/1000).toFixed(0)} 秒)`); resolve(outFile); }
          else reject(new Error(`ffmpeg 結束碼 ${code}（${m.title}）`));
        });
        console.log(`▶ ${m.title}  BPM ${m.bpm.toFixed(1)}  ${m.frames} 格`);
      },
      frame(buf){
        if(!ff) throw new Error('尚未收到 meta');
        count++;
        if(Date.now() - lastLog > 10000){ lastLog = Date.now(); console.log(`  ${meta.title}: ${(count/meta.frames*100).toFixed(1)}%  (${(count/((Date.now() - t0)/1000)).toFixed(1)} fps)`); }
        return ff.stdin.write(buf) ? null : new Promise(ok => ff.stdin.once('drain', ok));
      },
      finish(){ done = true; ff.stdin.end(); },
      fail(e){ if(done) return; done = true; console.error(`✘ 歌曲 ${index}：${e.message}`); try{ ff?.stdin.destroy(); ff?.kill(); }catch{} cleanup().finally(()=>reject(e)); }
    };
    jobs.set(id, job);
    chrome.on('error', e=>job.fail(e));
    chrome.on('exit', code => { if(!done) job.fail(new Error(`Chrome 提早結束（${code}）`)); });
  });
}

const results=[];
let next=0;
await Promise.all(Array.from({length:Math.min(concurrency,songs.length)},async()=>{
  while(next<songs.length){
    const index=songs[next++];
    try{ results.push({status:'fulfilled',value:await runJob(index)}); }
    catch(reason){ results.push({status:'rejected',reason}); }
  }
}));
server.close();
const failed = results.filter(r => r.status === 'rejected');
process.exit(failed.length ? 1 : 0);

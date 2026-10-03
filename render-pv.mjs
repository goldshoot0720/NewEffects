#!/usr/bin/env node
// 把 PV 首頁（index.html）逐格渲染成 MP4：本機伺服器提供檔案並接收 JPEG 影格，無頭 Chrome 執行 pv.js，ffmpeg 編碼並合併音訊。
// 用法：node render-pv.mjs [歌曲編號…] [--from 秒] [--to 秒] [--out 資料夾]
//   不指定歌曲就輸出全部（0 大好きだよって叫ぶんだ、1 SUNRISE、2 HELLO HERO），三首同時進行。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf('--' + name); if(i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const from = opt('from'), to = opt('to');
const outDir = path.resolve(ROOT, opt('out') || 'pv');
const songs = args.length ? args.map(Number) : [0, 1, 2];
if(songs.some(n => !Number.isInteger(n) || n < 0 || n > 2)){ console.error('歌曲編號為 0–2'); process.exit(1); }
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome']
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
  const file = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if(!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()){ res.writeHead(404).end(); return; }
  res.writeHead(200, {'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size});
  fs.createReadStream(file).pipe(res);
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const PORT = server.address().port;

function runJob(index){
  return new Promise((resolve, reject) => {
    const id = String(index), profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-chrome-'));
    let ff = null, meta = null, count = 0, done = false, t0 = Date.now(), lastLog = 0, outFile = '';
    const query = new URLSearchParams({song: index, render: 1, job: id});
    if(from) query.set('from', from);
    if(to) query.set('to', to);
    const chrome = spawn(CHROME, ['--headless=new', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--mute-audio',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      '--window-size=1920,1080', '--enable-unsafe-swiftshader', `http://127.0.0.1:${PORT}/index.html?${query}`], {stdio: 'ignore'});
    const cleanup = () => { try{ chrome.kill(); }catch{} setTimeout(() => fs.rmSync(profile, {recursive: true, force: true}), 1500); };
    const job = {
      start(m){
        meta = m;
        const part = from || to ? ` (${m.from.toFixed(0)}-${m.to.toFixed(0)}s)` : '';
        outFile = path.join(outDir, `${m.file} PV${part}.mp4`);
        const audioArgs = from || to ? ['-ss', String(m.from), '-t', String(m.to - m.from)] : [];
        ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(m.fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
          ...audioArgs, '-i', path.join(ROOT, m.audio), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
          '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outFile], {stdio: ['pipe', 'inherit', 'inherit']});
        ff.on('exit', code => {
          cleanup();
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
      fail(e){ if(done) return; done = true; console.error(`✘ 歌曲 ${index}：${e.message}`); try{ ff?.stdin.destroy(); ff?.kill(); }catch{} cleanup(); reject(e); }
    };
    jobs.set(id, job);
    chrome.on('exit', code => { if(!done) job.fail(new Error(`Chrome 提早結束（${code}）`)); });
  });
}

const results = await Promise.allSettled(songs.map(runJob));
server.close();
const failed = results.filter(r => r.status === 'rejected');
process.exit(failed.length ? 1 : 0);

"""Audit recent song subtitles against saved ASR words.

This is a screening tool: unmatched/shifted words require review; a clean
structural result does not certify that all lyrics match the recording.
"""
import json,re,unicodedata,subprocess,os,datetime,argparse,pathlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
os.chdir(ROOT)
ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--since',default='24 hours ago')
ap.add_argument('--output',default='/tmp/neweffects-recent-sync.json')
args=ap.parse_args()
js="""const fs=require('fs'),vm=require('vm');const read=(file,key)=>{const s=fs.readFileSync(file,'utf8'),a=s.indexOf('const '+key+' = ['),b=s.indexOf('\\n];',a);return vm.runInNewContext(s.slice(a,b+3)+';'+key)};console.log(JSON.stringify({pv:read('pv.js','SONGS'),v2:read('v2.html','DEFAULT_SONGS')}));"""
R=json.loads(subprocess.check_output(['node','-e',js],text=True))
ADDED=set(subprocess.check_output(['git','-c','core.quotepath=false','log','--since='+args.since,'--diff-filter=A','--format=','--name-only'],text=True).splitlines())
REF=['rolling','mirai','makeinu','chase','abc','matryoshka','rpg','bakugeki','英雄にあこがれて','1000のバイオリン','脳天気','TRAIN-TRAIN','シャララ','STONES','夕暮れ','終わらない歌']
def norm(t):
 t=re.sub(r'([一-鿿々]+)[(（]([ぁ-ヿ]+)[)）]',r'\1',t)
 t=unicodedata.normalize('NFKC',t).lower()
 return ''.join(chr(ord(c)-0x60) if 'ァ'<=c<='ヺ' else c for c in t if not c.isspace() and unicodedata.category(c)[0] not in 'PS')
def parse(p):
 out=[]
 for block in open(p).read().strip().split('\n\n'):
  ls=block.splitlines(); m=re.search(r'(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)',ls[1]); v=list(map(int,m.groups()));ts=lambda v:v[0]*3600+v[1]*60+v[2]+v[3]/1000
  out.append(dict(start=ts(v[:4]),end=ts(v[4:]),text=ls[2],zh=ls[3] if len(ls)>3 else ''))
 return out

def align(chars,ls):
 n,m=len(chars),len(ls); prev=list(range(m+1));backs=[]
 for i,a in enumerate(chars):
  cur=[i+1]+[0]*m; back=bytearray(m+1)
  for j,b in enumerate(ls,1):
   penalty=.2 if not (b[2]-3<=a[1]<=b[3]+3) else 0
   d=prev[j-1]+(0 if a[0]==b[0] else 1)+penalty;u=prev[j]+1;l=cur[j-1]+1
   val,step=(d,0) if d<=u and d<=l else ((u,1) if u<=l else (l,2));cur[j]=val;back[j]=step
  prev=cur;backs.append(back)
 i,j=n,m;p=[]
 while i and j:
  s=backs[i-1][j]
  if s==0:
   if chars[i-1][0]==ls[j-1][0]:p.append((i-1,j-1))
   i-=1;j-=1
  elif s==1:i-=1
  else:j-=1
 return p[::-1]
out=[]
for index,s in enumerate(R['pv']):
 if s['file']+'.mp3' not in ADDED:continue
 
 if not 54<=index<=69: raise RuntimeError(f'No saved ASR mapping for new song: {s["title"]}')
 ref=REF[index-54]; ap=f'assets/ref/{ref}/asr-ja.json'; segs=json.load(open(ap));cues=parse(s['subs']);dur=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',s['file']+'.mp3'],text=True))
 chars=[]
 for seg in segs:
  for w in seg.get('words',[]):
   cs=norm(w['w']);n=len(cs)
   chars.extend((c,w['s']+(w['e']-w['s'])*k/n,w['s']+(w['e']-w['s'])*(k+1)/n) for k,c in enumerate(cs))
 lyr=[];offsets=[]
 for i,c in enumerate(cues):
  offsets.append(len(lyr));lyr.extend((ch,i,c['start'],c['end']) for ch in norm(c['text']))
 pairs=align(chars,lyr);hits={i:[] for i in range(len(cues))}
 for a,b in pairs:hits[lyr[b][1]].append((b-offsets[lyr[b][1]],chars[a]))
 rows=[]
 for i,c in enumerate(cues):
  h=hits[i];n=len(norm(c['text']));cover=len(h)/max(1,n);struct=[]
  if c['end']<=c['start'] or c['start']<0 or c['end']>dur+.05:struct.append('invalid bounds')
  if i and c['start']<cues[i-1]['end']-.001:struct.append('overlap')
  if not c['zh']:struct.append('missing translation')
  ds=round(h[0][1][1]-c['start'],3) if h else None;de=round(h[-1][1][2]-c['end'],3) if h else None
  edges=bool(h and h[0][0]<=1 and h[-1][0]>=n-2)
  status='matched' if cover>=.7 and edges and abs(ds)<=.45 and abs(de)<=.55 else 'review'
  rows.append(dict(i=i+1,**c,coverage=round(cover,3),edge_match=edges,start_delta=ds,end_delta=de,status=status,errors=struct))
 rec=dict(index=index,title=s['title'],ref=ref,cues=len(cues),duration=round(dur,3),matched=sum(x['status']=='matched' for x in rows),structural_errors=sum(bool(x['errors']) for x in rows),rows=rows);out.append(rec)
 print(f"{index} {s['title']}: {rec['matched']}/{len(cues)} ASR matched; structural {rec['structural_errors']}",flush=True)
report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'since':args.since,'songs':out,'meaning':'matched = saved ASR agrees within thresholds; review = inconclusive or shifted, not automatically an error'}
with open(args.output,'w') as f:json.dump(report,f,ensure_ascii=False,indent=1)
print(f"{len(out)} songs, {sum(s['cues'] for s in out)} cues; {sum(s['matched'] for s in out)} ASR matches; report: {args.output}")
if any(s['structural_errors'] for s in out):raise SystemExit(1)

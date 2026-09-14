from pathlib import Path
import sys, subprocess, re, json, hashlib
from PIL import Image, ImageDraw
TOOL_ROOT=Path(__file__).resolve().parent
WORKSPACE=TOOL_ROOT.parents[2]
ROOT=WORKSPACE/'06_整理工具与核验/审阅证据/2026-09-13'
ROOT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(TOOL_ROOT/'tooldeps'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
BASE=WORKSPACE/'04_素材资源/02_硬件演示视频'
names=['580ef6347bb554d4b8dd9eeadf7c36e5','7e1b180eb46f813f974978d5badc7550','22925470a70bc725dcb6982650e1a1e9']
meta=[]
for name in names:
 p=BASE/(name+'.mp4')
 probe=subprocess.run([FF,'-y','-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
 (ROOT/(name+'-metadata.txt')).write_text(probe,encoding='utf-8')
 m=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',probe)
 duration=int(m[1])*3600+int(m[2])*60+float(m[3])
 times=[round(i*(duration-.3)/11,2) for i in range(12)]
 sheet=Image.new('RGB',(1600,4*330),'#eeeeee');draw=ImageDraw.Draw(sheet)
 for i,t in enumerate(times):
  dest=ROOT/f'{name}-{i:02}.jpg'
  subprocess.run([FF,'-y','-hide_banner','-loglevel','error','-ss',str(t),'-i',str(p),'-frames:v','1','-q:v','2',str(dest)],check=True)
  im=Image.open(dest);im.thumbnail((530,300))
  x=(i%3)*533;y=(i//3)*330
  sheet.paste(im,(x+(530-im.width)//2,y));draw.text((x+8,y+302),f'{name[:8]} | {t:.2f}s',fill='black')
 sheet.save(ROOT/(name+'-contact.jpg'))
 meta.append({'file':str(p),'duration':duration,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sample_times':times,'audio_present':'Audio:' in probe})
(ROOT/'videos.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(meta,ensure_ascii=True,indent=2))

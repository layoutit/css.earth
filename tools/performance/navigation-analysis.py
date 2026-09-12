"""Correlate native presentation intervals, application phases and capture frames."""
import gzip, json, math, sys
from pathlib import Path

root = Path(sys.argv[1])
report = json.loads((root / 'report.json').read_text())
sync = json.loads((root / 'synchronization.json').read_text())
if not sync['valid']:
    raise SystemExit('INVALID capture: ' + json.dumps(sync))
recording = json.loads((root / ('cssearth-diagnostics-' + sync['recordingId'] + '.json')).read_text())
trace = []
wanted = {'thread_name','AnimationFrame::Presentation','ThreadControllerImpl::RunTask','RunTask','FireAnimationFrame','FunctionCall','EventDispatch','RunMicrotasks','TimerFire','UpdateLayoutTree','Layout','PrePaint','Paint','Layerize','RasterTask','GpuImageDecodeCache::DecodeImage','GPUTask','LayerTreeHost::WaitForCommitCompletion'}
with gzip.open(root/'trace.json.gz','rt') as source:
    for line in source:
        if not any(('\"name\":\"'+name+'\"') in line for name in wanted): continue
        try: event = json.loads(line.strip().rstrip(','))
        except ValueError: continue
        if event.get('name') in wanted: trace.append(event)
pid = sync['anchors'][0]['pid']
tid = next(e['tid'] for e in trace if e.get('name') == 'thread_name' and e['pid'] == pid and e['args']['name'] == 'CrRendererMain')
offset, origin = sync['anchors'][0]['offset'], sync['videoTimeOriginRecorderMs']
video_time = lambda timestamp: ((timestamp - offset) / 1000 - origin) / 1000
times = sorted(set(e['ts'] for e in trace if e.get('name') == 'AnimationFrame::Presentation' and e['pid'] == pid and e['tid'] == tid))
frames = [{'time': video_time(b), 'ms': (b-a)/1000, 'startUs': a, 'endUs': b} for a, b in zip(times, times[1:]) if recording['metadata']['startTime'] <= (b-offset)/1000 <= recording['stoppedAt']]
main = [e for e in trace if e['pid'] == pid and e['tid'] == tid and e.get('ph') == 'X' and e.get('dur', 0) > 0]
all_work = [e for e in trace if e.get('ph') == 'X' and e.get('dur', 0) > 0]
marks = {m['name']: (m['time']-origin)/1000 for m in report['milestones']}
def summary(values):
    values = sorted(values)
    return {'count': len(values), 'p95': values[math.ceil(len(values)*.95)-1], 'max': max(values), 'over25': sum(x>25 for x in values)}
def details(frame):
    lo, hi = frame['startUs'], frame['endUs']
    def intersect(e): return e['ts'] < hi and e['ts']+e['dur'] > lo
    def row(e): return {'name': e['name'], 'ms': round(e['dur']/1000, 3), 'overlapMs': round((min(hi,e['ts']+e['dur'])-max(lo,e['ts']))/1000, 3), 'time': round(video_time(e['ts']),4), 'args': e.get('args')}
    work = sorted((e for e in main if intersect(e)), key=lambda e: min(hi,e['ts']+e['dur'])-max(lo,e['ts']), reverse=True)
    gpu = sorted((e for e in all_work if e['name'] in ['RasterTask','GpuImageDecodeCache::DecodeImage','GPUTask','LayerTreeHost::WaitForCommitCompletion'] and intersect(e)), key=lambda e:e['dur'], reverse=True)
    return {**frame, 'main': [row(e) for e in work[:24]], 'rasterAndGpu': [row(e) for e in gpu[:12]]}
passes = []
for name in ['cold','warm']:
    lo, hi = marks[name+'-start'], marks[name+'-end']
    selected = [f for f in frames if lo <= f['time'] <= hi]
    phases = []
    for body in ['mars','earth','sun']:
        for kind in ['zoom-for','flight-to']:
            phase = f'{name}-{kind}-{body}'
            start,end = marks[phase+'-start'],marks[phase+'-end']
            phases.append({'body':body,'kind':kind,'start':start,'end':end,'summary':summary([f['ms'] for f in selected if start<=f['time']<=end])})
    passes.append({'name':name,'start':lo,'end':hi,'summary':summary([f['ms'] for f in selected]),'phases':phases,
                   'worst': [details(f) for f in sorted(selected,key=lambda f:f['ms'],reverse=True)[:4]]})
data = {'source':report['sourceHead'],'browser':report['browser'],'frames':frames,'passes':passes,'recorderSummary':recording['summary'],
        'limitations':sync['limitations'],'sync':{k:sync[k] for k in ['valid','clockDriftUs','maxPtsErrorMs']}}
(root/'analysis.json').write_text(json.dumps(data,indent=2))
print(json.dumps({'passes':[{k:p[k] for k in ['name','summary','phases','worst']} for p in passes],'recorder':recording['summary']},indent=2))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11})
fig, axes = plt.subplots(2,1,figsize=(15,7.5),layout='constrained')
fig.suptitle('Sun → Mars → Earth → Sun   |   Cold destinations, then cached navigation',fontsize=18,fontweight='bold')
colors = ['#2778ae','#ad4a2b']
maximum = max(f['ms'] for f in frames)*1.16
for ax,p,color in zip(axes,passes,colors):
    xs=[f['time']-p['start'] for f in frames if p['start']<=f['time']<=p['end']]
    ys=[f['ms'] for f in frames if p['start']<=f['time']<=p['end']]
    ax.vlines(xs,0,ys,color=color,linewidth=.75,alpha=.85)
    ax.axhline(16.667,color='#555555',ls='--',lw=.8)
    ax.text(.99,16.667/maximum+.015,'60 Hz budget · 16.7 ms',transform=ax.transAxes,ha='right',fontsize=9,color='#555555')
    for phase in p['phases']:
        if phase['kind']=='flight-to':
            a,b=phase['start']-p['start'],phase['end']-p['start'];ax.axvspan(a,b,color=color,alpha=.12)
            ax.text((a+b)/2,maximum*.94,phase['body'].title(),ha='center',va='top',fontsize=10)
    for f in p['worst'][:2]:
        x,y=f['time']-p['start'],f['ms'];ax.plot(x,y,'o',color=color,ms=4)
        ax.annotate(f'{y:.0f} ms',(x,y),xytext=(4,8),textcoords='offset points',fontsize=10)
    stats=p['summary'];ax.set_title(f"{p['name'].title()} · p95 {stats['p95']:.1f} ms · {stats['over25']}/{stats['count']} intervals above 25 ms",loc='left',fontsize=12)
    ax.set(xlim=(0,p['end']-p['start']),ylim=(0,maximum),ylabel='Presentation interval (ms)',xlabel='Elapsed journey time (s)')
    ax.spines[['top','right']].set_visible(False);ax.grid(axis='y',alpha=.2)
fig.savefig(root/'frame-times.png',dpi=150)
fig.savefig(root/'frame-times.svg')
manifest=json.loads((root/'video-chronological-frames.json').read_text())
fig,axes=plt.subplots(2,3,figsize=(15,7),layout='constrained')
fig.suptitle('What the worst recorded intervals looked like',fontsize=18,fontweight='bold')
for row,p in zip(axes,passes):
    f=p['worst'][0]
    targets=[f['time']-f['ms']/1000-.05, f['time']-.01, f['time']+.1]
    for ax,target,label in zip(row,targets,['Before','During','After']):
        frame=min(manifest,key=lambda v:abs((v['recorderMs']-origin)/1000-target))
        ax.imshow(Image.open(root/frame['file']));ax.axis('off')
        ax.set_title(f"{p['name'].title()} · {label} · video {(frame['recorderMs']-origin)/1000:.2f}s",fontsize=10)
fig.savefig(root/'worst-frame-strip.png',dpi=150)

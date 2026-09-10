"""Independent IR0650 vertical gradient families; stdlib, no image/model fit."""
from pathlib import Path
import hashlib,json,math,re,struct
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[5];OUT=Path(__file__).resolve().parent
NATIVE=ROOT/'output/b9-source-intake/phoebe/native';ident='1465670650_1';path=NATIVE/f'C{ident}_ir.cub'
pins={p['file']:p for p in json.loads((NATIVE/'download-receipts.json').read_text())}
raw=path.read_bytes();assert hashlib.sha256(raw).hexdigest()==pins[path.name]['sha256']
label=raw[:65536].decode('ascii').rstrip('\0')
integer=lambda name:int(re.search(r'^\s*'+name+r'\s*=\s*(\d+)',label,re.M).group(1))
w,h=integer('Samples'),integer('Lines');bb=re.search(r'Group = BandBin\n(.*?)End_Group',label,re.S).group(1)
waves=[float(x) for x in re.search(r'Center\s*=\s*\((.*?)\)',bb,re.S).group(1).split(',')]
bands=[min(range(len(waves)),key=lambda i:abs(waves[i]-t)) for t in (1.8,2.23)]
arrays=[struct.unpack_from('<'+'f'*(w*h),raw,65536+i*w*h*4) for i in bands]
assert all(math.isfinite(v) and abs(v)<1e30 for a in arrays for v in a)
backgrounds=[]
for a in arrays:
    vals=[a[y*w+x] for x in (w-2,w-1) for y in range(h)]
    diffs=[a[(y+1)*w+x]-a[y*w+x] for x in (w-2,w-1) for y in range(h-1)]
    backgrounds.append({'columnsZeroBased':[w-2,w-1],'maximumIf':max(vals),'maxPositiveDifference':max(diffs),'maxNegativeDifference':max(-d for d in diffs)})
families=[]
for sign,name in ((1,'top-rising'),(-1,'bottom-falling')):
    candidates=[];rejected=[]
    for x in range(w-2):
        locations=[];reason=None
        for a,bg in zip(arrays,backgrounds):
            values=[a[y*w+x] for y in range(h)];ds=[sign*(b-a) for a,b in zip(values,values[1:])];peak=max(ds)
            if values[0 if sign>0 else -1]>bg['maximumIf']:reason='source-boundary-at-frame-or-background-exceedance';break
            if peak<=bg['maxPositiveDifference' if sign>0 else 'maxNegativeDifference']:reason='source-gradient-within-background';break
            if ds.count(peak)!=1:reason='gradient-not-unique';break
            locations.append(ds.index(peak))
        if reason is None and locations[0]!=locations[1]:reason='continuum-bands-disagree'
        if reason:rejected.append({'sampleZeroBased':x,'reason':reason});continue
        candidates.append({'sampleZeroBased':x,'linePosition':locations[0]+.5})
    families.append({'name':name,'candidates':candidates,'rejected':rejected})
lo,hi=min(arrays[0]),max(arrays[0]);im=Image.new('RGB',(w,h));im.putdata([(g,g,g) for g in [round(255*(v-lo)/(hi-lo)) for v in arrays[0]]])
im=im.resize((w*16,h*16),Image.Resampling.NEAREST);d=ImageDraw.Draw(im)
for family,col in zip(families,('#19e4e8','#f04bd5')):
    for p in family['candidates']:
        x,y=p['sampleZeroBased'],p['linePosition'];d.line(((x+.1)*16,(y+.5)*16,(x+.9)*16,(y+.5)*16),fill=col,width=2)
panel=Image.new('RGB',(1100,550),'#171b22');draw=ImageDraw.Draw(panel);font,small=ImageFont.load_default(size=17),ImageFont.load_default(size=13)
draw.text((20,15),'IR1465670650: independent top/bottom gradient candidates',font=font,fill='white')
draw.text((20,42),'Cyan = strongest rising gradient; magenta = strongest falling gradient; exact continuum-band agreement.',font=small,fill='#bec8d2')
draw.text((20,64),'Left clipping does not automatically exclude top/bottom edges. Gradients can still be internal terrain or noise.',font=small,fill='#bec8d2')
panel.paste(im,(20,105));panel.save(OUT/'0650-vertical-candidates.png')
result={'scope':'Source-only feasibility check for a second observation-specific two-offset fit; no fit or registration acceptance.',
        'observationId':ident,'sourceSha256':pins[path.name]['sha256'],'bandsOneBased':[i+1 for i in bands], 'wavelengthsMicrometers':[waves[i] for i in bands],
        'selection':'Each column independently. Source background envelope from two visibly dark far-right columns. Retain unique strongest signed first difference above background only when two continuum bands agree exactly and the respective top/bottom endpoint is below background. No smoothing or model input.',
        'backgrounds':backgrounds,'families':families}
(OUT/'0650-vertical-candidates.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps([{'name':f['name'],'candidates':f['candidates']} for f in families],indent=2))

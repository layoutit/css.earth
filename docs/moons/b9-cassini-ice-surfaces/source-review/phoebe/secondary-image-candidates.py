"""Source-only untouched VIS rising edges and IR falling edges, without a fit."""
from pathlib import Path
import hashlib,json,math,re,struct
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[5]
OUT=Path(__file__).resolve().parent
NATIVE=ROOT/'output/b9-source-intake/phoebe/native'
pins={p['file']:p for p in json.loads((NATIVE/'download-receipts.json').read_text())}
result={'scope':'Additional source-only gradient candidates excluded from all fitting. IR falling gradients can be topographic shadows or albedo boundaries, not necessarily the geometric terminator. VIS is one clean band because its0.9um comparison has strong detector artifacts.',
        'selection':'Same empirical last-two-row background extrema, unique strongest signed horizontal difference. IR requires exact agreement between1.80374 and2.23295um; VIS uses0.70288um. Rising edge requires dark first sample; falling edge requires dark last sample. These rules govern feature fitting only and are not science-validity masks.',
        'observations':[]}
panel=Image.new('RGB',(1020,930),'#171b22');draw=ImageDraw.Draw(panel)
font,small=ImageFont.load_default(size=17),ImageFont.load_default(size=13)
draw.text((20,15),'Phoebe: source-only secondary features, never fitted',font=font,fill='white')
draw.text((20,42),'Cyan = VIS rising gradient. Magenta = IR falling gradient; falling gradients are not all terminators.',font=small,fill='#bec8d2')
for k,(ident,ch) in enumerate((('1465670650_1','vis'),('1465670650_1','ir'),('1465671822_1','vis'),('1465671822_1','ir'))):
    path=NATIVE/f'C{ident}_{ch}.cub';raw=path.read_bytes();assert hashlib.sha256(raw).hexdigest()==pins[path.name]['sha256']
    label=raw[:65536].decode('ascii').rstrip('\0')
    integer=lambda name:int(re.search(r'^\s*'+name+r'\s*=\s*(\d+)',label,re.M).group(1))
    w,h=integer('Samples'),integer('Lines')
    bb=re.search(r'Group = BandBin\n(.*?)End_Group',label,re.S).group(1)
    waves=[float(x) for x in re.search(r'Center\s*=\s*\((.*?)\)',bb,re.S).group(1).split(',')]
    targets=(.7,) if ch=='vis' else (1.8,2.23)
    bands=[min(range(len(waves)),key=lambda i:abs(waves[i]-target)) for target in targets]
    arrays=[struct.unpack_from('<'+'f'*(w*h),raw,65536+band*w*h*4) for band in bands]
    assert all(math.isfinite(v) and abs(v)<1e30 for a in arrays for v in a)
    sign=1 if ch=='vis' else -1
    backgrounds=[]
    for a in arrays:
        backgrounds.append({'maximumIf':max(a[(h-2)*w:]),'maximumSignedDifference':max(sign*(a[y*w+x+1]-a[y*w+x]) for y in (h-2,h-1) for x in range(w-1))})
    candidates=[];rejected=[]
    for y in range(h-2):
        indices=[];reason=None
        for a,bg in zip(arrays,backgrounds):
            row=a[y*w:(y+1)*w];ds=[sign*(b-a) for a,b in zip(row,row[1:])];peak=max(ds)
            if row[0 if sign>0 else -1]>bg['maximumIf']:reason='source-edge-touching-frame-or-background-exceedance';break
            if peak<=bg['maximumSignedDifference']:reason='source-gradient-within-background-envelope';break
            if ds.count(peak)!=1:reason='nonunique-source-gradient';break
            indices.append(ds.index(peak))
        if reason is None and len(set(indices))!=1:reason='source-bands-disagree-on-gradient-position'
        if reason:rejected.append({'lineZeroBased':y,'reason':reason});continue
        candidates.append({'lineZeroBased':y,'samplePosition':indices[0]+.5})
    low,high=min(arrays[0]),max(arrays[0]);im=Image.new('RGB',(w,h))
    im.putdata([(g,g,g) for g in [round(255*(v-low)/(high-low)) for v in arrays[0]]])
    im=im.resize((w*9,h*9),Image.Resampling.NEAREST);d=ImageDraw.Draw(im)
    for p in candidates:
        x,y=p['samplePosition'],p['lineZeroBased'];d.line(((x+.5)*9,(y+.1)*9,(x+.5)*9,(y+.9)*9),fill='#19e4e8' if sign>0 else '#f04bd5',width=2)
    x0,y0=20+(k%2)*500,110+(k//2)*370
    draw.text((x0,y0),f'{ident} {ch.upper()}: {len(candidates)} candidate gradients',font=font,fill='white');panel.paste(im,(x0,y0+36))
    result['observations'].append({'observationId':ident,'channel':ch,'gradientSign':sign,'bandsOneBased':[i+1 for i in bands], 'wavelengthsMicrometers':[waves[i] for i in bands],'backgrounds':backgrounds,'candidates':candidates,'rejectedRows':rejected})
panel.save(OUT/'secondary-image-candidates.png');(OUT/'secondary-image-candidates.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps([{k:v for k,v in o.items() if k in ('observationId','channel','candidates')} for o in result['observations']],indent=2))

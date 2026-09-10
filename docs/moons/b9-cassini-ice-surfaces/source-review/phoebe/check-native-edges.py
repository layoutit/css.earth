"""Small stdlib source-image holdout diagnostic; no fitting or numerical arrays.

Find strong positive native row gradients independently in two continuum bands.
The two visibly dark last rows supply an empirical background/noise envelope.
These candidates are image gradients, not assumed proven physical limb points.
"""
from pathlib import Path
import hashlib
import json
import math
import re
import statistics
import struct
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
INPUT = ROOT/'output/b9-source-intake/phoebe/native'
pins = {p['file']:p for p in json.loads((INPUT/'download-receipts.json').read_text())}
result = {'scope':'Independent source-only native row-gradient candidates against unfitted prediction. No thresholds or offsets fitted to prediction; no claim that strongest gradients must be the physical limb.',
          'selection':'Per band, derive empirical maximum I/F and maximum positive horizontal first difference from the two dark last rows. Retain a row only if its first sample is below that background maximum, its strongest positive first difference exceeds the background maximum difference in both bands, and both bands locate that strongest gradient at exactly the same sample pair. No smoothing. Reject exact ties.',
          'limits':'Last two rows are a source-image visual background selection, not a calibrated noise model. Gradients can be surface-albedo/terrain features. Empirical background extrema do not define confidence intervals. Native finite sampling and PSF prevent subpixel pointing inference. All candidates are independent of the source-model fit and no candidate adjusts any transform.',
          'observations':[]}
panel = Image.new('RGB',(1020,1030),'#171b22')
draw = ImageDraw.Draw(panel)
font,small=ImageFont.load_default(size=17),ImageFont.load_default(size=13)
draw.text((20,15),'Phoebe: independent source-gradient candidates',font=font,fill='white')
draw.text((20,42),'Native continuum band: magenta = source-only gradient; cyan = predicted first body hit in same row.',font=small,fill='#bec8d2')
draw.text((20,63),'No offsets fitted. Gradients can be terrain features; selection and every residual are recorded.',font=small,fill='#bec8d2')
for k,(ident,ch) in enumerate((('1465670650_1','vis'),('1465670650_1','ir'),('1465671822_1','vis'),('1465671822_1','ir'))):
    p=INPUT/f'C{ident}_{ch}.cub';raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==pins[p.name]['sha256']
    label=raw[:65536].decode('ascii').rstrip('\0')
    integer=lambda key:int(re.search(r'^\s*'+key+r'\s*=\s*(\d+)',label,re.M).group(1))
    w,h=integer('Samples'),integer('Lines')
    bb=re.search(r'Group = BandBin\n(.*?)End_Group',label,re.S).group(1)
    waves=[float(x) for x in re.search(r'Center\s*=\s*\((.*?)\)',bb,re.S).group(1).split(',')]
    indices=[min(range(len(waves)),key=lambda k:abs(waves[k]-v)) for v in ((.7,.9) if ch=='vis' else (1.8,2.23))]
    bands=[list(struct.unpack_from('<'+'f'*(w*h),raw,65536+i*w*h*4)) for i in indices]
    assert all(math.isfinite(v) and abs(v)<1e30 for band in bands for v in band)
    backgrounds=[]
    for band in bands:
        values=band[(h-2)*w:]
        diffs=[band[y*w+x+1]-band[y*w+x] for y in range(h-2,h) for x in range(w-1)]
        backgrounds.append({'rowsZeroBased':[h-2,h-1],'maximumIf':max(values),'maximumPositiveHorizontalDifference':max(diffs),'minimumIf':min(values)})
    candidates=[]; rejected=[]
    predicted=json.loads((OUT/f'native-prediction-{ident}-{ch}.json').read_text())
    for y in range(h-2):
        peaks=[];reason=None
        for band,bg in zip(bands,backgrounds):
            vals=band[y*w:(y+1)*w]
            ds=[b-a for a,b in zip(vals,vals[1:])];peak=max(ds)
            if vals[0]>bg['maximumIf']:reason='source-first-sample-above-background: potentially clipped';break
            if peak<=bg['maximumPositiveHorizontalDifference']:reason='source-gradient-not-above-empirical-background';break
            if ds.count(peak)!=1:reason='source-gradient-tie';break
            peaks.append(ds.index(peak))
        if reason is None and peaks[0]!=peaks[1]:reason='two-source-bands-disagree-on-strongest-gradient'
        if reason is not None:
            rejected.append({'lineZeroBased':y,'reason':reason});continue
        source_x=peaks[0]+.5
        body=[x for x in range(w) if predicted['predictedHit'][y*w+x]]
        expected=body[0]-.5 if body and body[0]>0 else None
        candidates.append({'lineZeroBased':y,'sourceGradientSample':source_x,'predictedFirstHitBoundarySample':expected,
                           'sourceMinusPredictionPixels':source_x-expected if expected is not None else None,
                           'qualification':'source gradient candidate; first-hit center-cell boundary has finite-sampling uncertainty'})
    values=bands[0];low,high=min(values),max(values)
    image=Image.new('RGB',(w,h));image.putdata([(g,g,g) for g in [round(255*(v-low)/(high-low)) for v in values]])
    image=image.resize((w*9,h*9),Image.Resampling.NEAREST)
    d=ImageDraw.Draw(image)
    for candidate in candidates:
        x,y=candidate['sourceGradientSample'],candidate['lineZeroBased']
        d.line(((x+.5)*9,(y+.1)*9,(x+.5)*9,(y+.9)*9),fill='#f54eda',width=2)
        x=candidate['predictedFirstHitBoundarySample']
        if x is not None:d.line(((x+.5)*9,(y+.1)*9,(x+.5)*9,(y+.9)*9),fill='#14eafa',width=2)
    x0,y0=20+(k%2)*500,110+(k//2)*430
    draw.text((x0,y0),f'{ident} {ch.upper()}: {waves[indices[0]]:.5f}/{waves[indices[1]]:.5f}um',font=font,fill='white')
    panel.paste(image,(x0,y0+36))
    residuals=[x['sourceMinusPredictionPixels'] for x in candidates if x['sourceMinusPredictionPixels'] is not None]
    summary={'count':len(residuals),'medianSignedPixels':statistics.median(residuals),'maxAbsolutePixels':max(map(abs,residuals))} if residuals else {'count':0}
    draw.text((x0,y0+270),f'Candidates {len(candidates)}; measurable {len(residuals)}; median {summary.get("medianSignedPixels")}; max abs {summary.get("maxAbsolutePixels")}',font=small,fill='#bec8d2')
    result['observations'].append({'observationId':ident,'channel':ch,'sourceSha256':pins[p.name]['sha256'],'bandsOneBased':[i+1 for i in indices],'wavelengthsMicrometers':[waves[i] for i in indices],'backgrounds':backgrounds,'candidates':candidates,'rejectedRows':rejected,'residualSummary':summary})
panel.save(OUT/'native-gradient-holdouts.png')
(OUT/'native-gradient-holdouts.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps([{k:v for k,v in o.items() if k in ('observationId','channel','residualSummary')} for o in result['observations']],indent=2))

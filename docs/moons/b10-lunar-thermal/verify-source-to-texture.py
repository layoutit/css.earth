"""Independent byte probes: original float32 -> compact values -> encoded atlas.

Does not import the converter or JS sampler. PDS product labels establish the
0-degree native west edge, whereas the displayed flat map starts at -180.
"""
import hashlib
import json
import math
from pathlib import Path
import struct

import numpy as np
from PIL import Image
import rasterio
from rasterio.windows import Window

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'src/planets/moon/source'
OUT=ROOT/'docs/moons/b10-lunar-thermal/evidence'
OUT.mkdir(parents=True,exist_ok=True)
views={'midnight-temperature':'tbol_m','heat-anomalies':'tbol_anom','rock-abundance':'ra_sam'}
raster=json.loads((SOURCE/'preparation/raster.json').read_text())
manifest=json.loads((SOURCE/'manifest.json').read_text())
runtime_manifest=json.loads((ROOT/'src/planets/moon/runtime-assets.json').read_text())

def sha(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def color(value,lens):
    fraction=min(1,max(0,(value-lens['minimum'])/(lens['maximum']-lens['minimum'])))
    # The shared preparer has a 1024-entry color table; Python computes it
    # independently using round-half-up, matching the documented JS convention.
    fraction=math.floor(fraction*1023+.5)/1023
    colors=[tuple(int(c[i:i+2],16) for i in (1,3,5)) for c in lens['colors']]
    t=fraction*(len(colors)-1);index=min(len(colors)-2,math.floor(t));f=t-index
    return tuple(math.floor(a+(b-a)*f+.5) for a,b in zip(colors[index],colors[index+1]))

range_check=json.loads((ROOT/'docs/moons/b10-lunar-thermal/source-review/ra-orientation-range-check.json').read_text())
with (SOURCE/'science/diviner-ghrm/dghrm_ra_sam_70s70n_img.img').open('rb') as original:
    for probe in range_check['samples']:
        original.seek(probe['offset'])
        assert original.read(4).hex()==probe['bytesHex'],probe
print('Independent HTTP range anchors: 8 exact byte matches',flush=True)
reports=[]
for view,product in views.items():
    entry=next(v for v in raster['lenses'] if v['id']==view);lens=entry['scientific']
    plan=json.loads((SOURCE/f'science/diviner-ghrm/prepare-{product}.json').read_text())
    original=SOURCE/'science/diviner-ghrm'/plan['input'];compact=SOURCE/entry['input']
    atlas=ROOT/f'public/scenes/moon/moon-{view}@2x.webp'
    original_pin=next(x for x in manifest['inputs'] if x['path']==str(original.relative_to(SOURCE)))
    compact_pin=next(x for x in manifest['inputs'] if x['path']==entry['input'])
    atlas_pin=next(x for x in runtime_manifest['assets'] if x['filename']==atlas.name)
    original_hash,compact_hash,atlas_hash=sha(original),sha(compact),sha(atlas)
    assert original.stat().st_size==original_pin['expectedBytes']==3303014400
    assert original_hash==plan['sha256']==original_pin['expectedSha256']
    assert compact.stat().st_size==compact_pin['expectedBytes']
    assert compact_hash==compact_pin['expectedSha256']
    assert atlas.stat().st_size==atlas_pin['bytes'] and atlas_hash==atlas_pin['sha256']
    image=Image.open(atlas).convert('RGB');w,h=image.size
    assert (w,h)==(plan['width'],plan['height'])==(4096,2048)
    probes=[]
    # Distributed longitudes, both hemispheres, the seam and polar coverage.
    points=[(x,y) for x in [0,1,512,1024,1536,2048,2560,3072,3584,4094,4095]
            for y in [0,112,227,228,256,512,768,1024,1280,1536,1792,1819,1820,1935,2047]]
    for lon,lat in [(312.5,23.7),(348.64,-43.31),(30.763,20.16),(30.731,20.195)]:
        points.append((math.floor(((lon+180)%360)/360*w),math.floor((90-lat)/180*h)))
    with original.open('rb') as raw,rasterio.open(compact) as grid:
        assert grid.shape==(h,w);assert grid.nodata==-32768
        for x,y in points:
            lon=-180+(x+.5)*360/w;lat=90-(y+.5)*180/h
            expected=None
            if -70<lat<70:
                native_x=math.floor((lon%360)*128);native_y=math.floor((70-lat)*128)
                raw.seek(4*(native_y*46080+native_x));value=struct.unpack('<f',raw.read(4))[0]
                valid=math.isfinite(value) and (0<=value<=1 if product=='ra_sam' else value>=0 if product=='tbol_m' else True)
                if valid:expected=value
            dn=int(grid.read(1,window=Window(x,y,1,1))[0,0])
            assert (dn==-32768)==(expected is None),(view,x,y,dn,expected)
            ay=(y//(h//16))*(h//16)+(h//16)-1-y%(h//16)
            pixel=image.getpixel((x,ay))
            row={'pixel':[x,y],'longitude':lon,'latitude':lat,'nativeValue':expected,'compactDN':dn,'atlasPixel':[x,ay],'rgb':pixel}
            if expected is not None:
                reconstructed=dn*plan['encoding']['scale']+plan['encoding']['offset']
                assert abs(reconstructed-expected)<=plan['encoding']['scale']/2+1e-10,row
                display=reconstructed*(100 if product=='ra_sam' else 1)
                assert pixel==color(display,lens),(view,row,color(display,lens))
                row.update(reconstructedValue=reconstructed,quantizationError=abs(reconstructed-expected))
            else:
                assert min(pixel)>=80 and max(pixel)<=116 and max(pixel)-min(pixel)<=4,('Missing cell lost neutral treatment',view,row)
            probes.append(row)
    flat=np.asarray(image).copy()
    for b in range(16):flat[b*(h//16):(b+1)*(h//16)]=flat[b*(h//16):(b+1)*(h//16)][::-1].copy()
    # This is a flat rendering of the same encoded atlas, not an independent photo.
    Image.fromarray(flat).resize((1024,512),Image.Resampling.NEAREST).save(OUT/f'{view}-flat.png')
    reports.append({'view':view,'status':'PASS','probes':probes,'originalSha256':original_hash,
                    'compactSha256':compact_hash,'atlasSha256':atlas_hash,'atlasBytes':atlas.stat().st_size,
                    'assertions':'Independent PDS cell addressing, coverage, physical validity, quantization, palette and latitude-band orientation'})
    print(view,len(probes),'probes PASS',flush=True)
(OUT/'source-to-texture.json').write_text(json.dumps({'status':'PASS','independentHttpRangeAnchors':len(range_check['samples']),'views':reports},indent=2)+'\n')

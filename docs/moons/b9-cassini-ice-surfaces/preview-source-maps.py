"""Inspect final pinned source maps and their authored display interpretation."""
import hashlib,json
from pathlib import Path
import numpy as np
import rasterio
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'docs/moons/b9-cassini-ice-surfaces/source-review'
font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',21)
small=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',15)
canvas=Image.new('RGB',(1120,1110),'#101722');draw=ImageDraw.Draw(canvas)
draw.text((24,16),'Cassini VIMS — mapped measurements on fixed body coordinates',font=font,fill='white')
draw.text((24,48),'False-color infrared at left · continuum-relative ice absorption at right · gray marks unsupported data',font=small,fill='#bdcddd')
receipts=[]
for row,body in enumerate(['tethys','iapetus','phoebe']):
 root=ROOT/'src/planets'/body/'source/cassini-ice';recipe=json.loads((root/'prepare.json').read_text());prep=json.loads((root.parent/'preparation/terrestrial.json').read_text());scalar=next(x for x in prep['raster']['scientific'] if x['id']=='ice-absorption')
 for col,kind in enumerate(['rgbDisplay','depth']):
  p=root/recipe['outputs'][kind]
  with rasterio.open(p) as d:raw=d.read()
  if kind=='rgbDisplay':
   rgb=np.roll(np.moveaxis(raw[:3],0,-1),recipe['width']//2,axis=1)* (255/65535);valid=np.roll(raw[3]>0,recipe['width']//2,axis=1)
  else:
   valid=raw[0]!=-9999;v=np.clip((raw[0]-scalar['minimum'])/(scalar['maximum']-scalar['minimum']),0,1)
   colors=np.array([[int(c[i:i+2],16) for i in [1,3,5]] for c in scalar['colors']]);rgb=np.stack([np.interp(v,np.linspace(0,1,len(colors)),colors[:,c]) for c in range(3)],axis=-1)
  rgb[~valid]=[58,64,74];panel=Image.fromarray(np.rint(rgb).astype('uint8')).resize((512,256),Image.Resampling.NEAREST)
  x,y=24+552*col,115+330*row
  draw.text((x,y-27),body.title()+(' · infrared false color' if col==0 else f" · ice absorption {scalar['minimum']}–{scalar['maximum']}"),font=font,fill='white');canvas.paste(panel,(x,y))
  for at,label,anchor in [(0,'180°W','la'),(256,'0°','ma'),(512,'180°E','ra')]:draw.text((x+at,y+260),label,font=small,fill='#bdcddd',anchor=anchor)
  receipts.append({'body':body,'kind':kind,'file':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
canvas.save(OUT/'source-maps.png');(OUT/'source-maps.json').write_text(json.dumps({'inputs':receipts,'imageSha256':hashlib.sha256((OUT/'source-maps.png').read_bytes()).hexdigest(),'interpretation':'Source raster diagnostic, not a mounted browser capture. Longitude -180 to180 east; latitude90 to-90. Measured source resolution is coarser than the output grid.'},indent=2)+'\n')
print(OUT/'source-maps.png')

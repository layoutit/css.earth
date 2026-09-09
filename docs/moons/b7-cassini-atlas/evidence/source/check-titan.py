"""Small independent polygon-center probes, with even-odd ring crossings."""
from pathlib import Path
import json,argparse
import numpy as np
import shapefile,rasterio
from rasterio.windows import Window
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo-root',type=Path,default=Path.cwd())
parser.add_argument('--output-dir',type=Path,default=Path('output/b7-source-review'))
args=parser.parse_args();args.output_dir.mkdir(parents=True,exist_ok=True)
root=args.repo_root/'src/planets/titan/source/geology';plan=json.loads((root/'prepare-grid.json').read_text())
probes=[(x,y) for y in [0,12,65,255,512,767,958,1011,1023] for x in [0,1,150,511,900,1023,1024,1300,1800,2046,2047]]
coords=[(-180+(x+.5)*360/2048,90-(y+.5)*180/1024) for x,y in probes]
owners=[set() for p in probes];metadata=[]
for layer in plan['layers']:
 with shapefile.Reader(str(root/layer['shapePath'])) as source:
  metadata.append({'path':layer['shapePath'],'records':len(source),'bounds':list(source.bbox),'fields':source.fields[1:]})
  for feature in source.iterShapeRecords():
   category=next(i for i,c in enumerate(plan['categories']) if c['value']==feature.record[plan['field']])
   candidates=[i for i,(x,y) in enumerate(coords) if feature.shape.bbox[0]<=x<=feature.shape.bbox[2] and feature.shape.bbox[1]<=y<=feature.shape.bbox[3]]
   inside={i:False for i in candidates}
   starts=list(feature.shape.parts)+[len(feature.shape.points)]
   for first,last in zip(starts,starts[1:]):
    ring=np.array(feature.shape.points[first:last],dtype='float64')
    if len(ring)<3:continue
    xmin,ymin=ring.min(axis=0);xmax,ymax=ring.max(axis=0)
    active=[i for i in candidates if xmin<=coords[i][0]<=xmax and ymin<=coords[i][1]<=ymax]
    if not active:continue
    xx=ring[:,0];yy=ring[:,1];px=np.roll(xx,1);py=np.roll(yy,1)
    for i in active:
     x,y=coords[i];crossing=(yy>y)!=(py>y)
     position=(px[crossing]-xx[crossing])*(y-yy[crossing])/(py[crossing]-yy[crossing])+xx[crossing]
     inside[i]^=bool(np.count_nonzero(x<position)%2)
   for i,value in inside.items():
    if value:owners[i].add(category)
records=[]
with rasterio.open(root/'titan-geologic-units.tif') as image:
 for (x,y),(lon,lat),owner in zip(probes,coords,owners):
  expected=next(iter(owner)) if len(owner)==1 else -32768
  value=int(image.read(1,window=Window(x,y,1,1))[0,0]);assert value==expected,(x,y,expected,value,owner)
  records.append({'pixel':[x,y],'longitudeEast':lon,'latitude':lat,'owners':sorted(owner),'value':value})
result={'status':'PASS','count':len(probes),'layers':metadata,'probes':records}
(args.output_dir/'titan-source-proof.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':'PASS','count':len(probes),'layers':[{k:v for k,v in x.items() if k!='fields'} for x in metadata]}))

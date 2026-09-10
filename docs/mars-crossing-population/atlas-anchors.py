"""Delivered raster anchors verified with existing independent full-source projection.
Reads actual retained matrices. No product source sampler or color painter imports.
"""
import sys,json,re,hashlib,importlib.util
sys.dont_write_bytecode=True
from pathlib import Path
import numpy as np
from PIL import Image
spec=importlib.util.spec_from_file_location('independent','docs/mars-crossing-population/independent-counted-source.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
base=Path('output/mars-crossing-population')

def rounded(x):return np.floor(np.array(x)+.5).astype(int)
def expected_color(hit,lens):
 value=hit['radius']*lens['valueTransform']['scale']+lens['valueTransform']['offset']
 t=float(np.clip((value-lens.get('minimum',lens.get('min')))/(lens.get('maximum',lens.get('max'))-lens.get('minimum',lens.get('min'))),0,1));idx=int(np.floor(t*1023+.5));q=idx/1023*(len(lens['colors'])-1);i=min(len(lens['colors'])-2,int(q));fraction=q-i
 colors=[np.array([int(c[n:n+2],16) for n in (1,3,5)])for c in lens['colors']];rgb=rounded(colors[i]*(1-fraction)+colors[i+1]*fraction)
 point=np.array(hit['point']);normal=np.array(hit['normal']);up=point/np.linalg.norm(point);h=np.linalg.norm(point[:2]);east=np.array([-point[1]/h,point[0]/h,0])if h else np.array([0,1,0]);north=np.cross(up,east);relief=lens.get('relief');bright=1
 if relief:
  le,ln,lu=relief['lightDirection'];sun=east*le+north*ln+up*lu;ambient=relief['ambient'];bright=(ambient+(1-ambient)*max(0,float(normal@sun)))/(ambient+(1-ambient)*lu)
 return value,idx,np.clip(rounded(rgb*bright),0,255)

for id in sys.argv[1:] or [x['id'] for x in json.loads(Path('docs/mars-crossing-population/inputs.json').read_text())]:
 root=Path('src/planets')/id;out=base/id;v,f,cfg,sha=mod.read_mesh(id);lens=cfg['raster']['scientific'][0];terrain=json.loads((root/'prepared/terrain.json').read_text());scene=json.loads((root/'prepared/scene.json').read_text());out.mkdir(parents=True,exist_ok=True);faces=np.array([x['vertices'] for x in terrain['faces']]);scale=cfg['geometry']['radiusKm']*1000/cfg['geometry']['radius'];centers=faces.mean(axis=1)
 selected={0,len(faces)//4,len(faces)//2,3*len(faces)//4,int(np.argmin(np.linalg.norm(centers,axis=1))),int(np.argmax(np.linalg.norm(centers,axis=1)))}
 for a in range(3):selected|={int(np.argmin(centers[:,a])),int(np.argmax(centers[:,a]))}
 # Include source multiple-ray facets by the nearest retained center.
 independent=out/'scalar-independent.json'
 if independent.exists():
  for q in json.loads(independent.read_text())['checks']:
   if q['kind']=='multiple-ray-source-centroid':selected.add(int(np.argmin(np.linalg.norm(centers*scale-np.array(q['query']),axis=1))))
 sun=np.array(json.loads((out/'body-fixed-sun.json').read_text()));paths=[Path('public/scenes')/id/f'{id}-elevation-{suffix}@2x.webp'for suffix in ['surface','shadow']];images=[Image.open(p).convert('RGB')for p in paths];results=[]
 pinned=next(x for x in json.loads((root/'prepared/surfaces.json').read_text())['surfaces'] if x['id']=='elevation')
 for p,key in zip(paths,['surface','shadowSurface']):
  assert hashlib.sha256(p.read_bytes()).hexdigest()==pinned[key]['sha256']
  assert p.stat().st_size==pinned[key]['bytes']
 for faceid in sorted(selected):
  row=scene['bodyLeaves'][faceid];m=np.array([float(x) for x in re.search(r'matrix3d\(([^)]+)\)',row['style'])[1].split(',')]).reshape((4,4),order='F');face=faces[faceid];target=centers[faceid];css=np.array([target[1],target[0],target[2]])*50;xy=np.linalg.lstsq(m[:3,:2],css-m[:3,3],rcond=None)[0];pixel=np.floor(xy).astype(int)
  for kind,px,py in [('interior',int(pixel[0]),int(pixel[1])),('bleed',2,126)]:
   assert 0<=px<128 and 0<=py<128
   css=m@np.array([px+.5,py+.5,0,1]);point=css[:3]/css[3];point=np.array([point[1],point[0],point[2]])/50
   clamped=mod.closest(face,np.array([[0,1,2]]),point)['point'];query=np.array(clamped)*scale;hit=mod.closest(v,f,query);allow=lens['surfaceSampling']['maximumDistanceMeters'];offset=[faceid%16*128+px,faceid//16*128+py]
   item={'retainedFace':faceid,'kind':kind,'pixel':offset,'sourceQueryMeters':query.tolist(),'sourceFace':hit['sourceFace'],'sourcePointMeters':hit['point'],'sourceDistanceMeters':hit['distanceMeters'],'accepted':hit['distanceMeters']<=allow}
   if item['accepted']:
    value,index,rgb=expected_color(hit,lens);directional=rounded(rgb*(.12+.88*max(0,float(np.array(hit['normal'])@sun))));expected=[rgb,directional];observed=[np.array(i.getpixel(tuple(offset)))for i in images];errors=[int(np.max(np.abs(a-b)))for a,b in zip(expected,observed)]
    item.update(value=value,paletteIndex=index,expectedRgb=[x.tolist()for x in expected],decodedRgb=[x.tolist()for x in observed],maximumChannelError=errors)
   results.append(item)
 checked=[x for x in results if x['accepted'] and x['kind']=='interior'];maxerror=max(max(x['maximumChannelError'])for x in checked);report={'id':id,'sourceSha256':sha,'terrainSha256':hashlib.sha256((root/'prepared/terrain.json').read_bytes()).hexdigest(),'sceneSha256':hashlib.sha256((root/'prepared/scene.json').read_bytes()).hexdigest(),'configurationSha256':hashlib.sha256((root/'source/preparation/terrestrial.json').read_bytes()).hexdigest(),'method':'Actual retained matrices and pixel centers; independent NumPy full-source planar/edge projection; authored scalar conversion, 1024-step palette and relief evaluated independently; decoded WebP flood and shadow RGB.','atlasSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in paths},'acceptedInteriorAnchors':len(checked),'bleedRgbQualification':'Reported diagnostically only: incident facet normals are nonunique at shared source vertices/edges and lossy WebP mixes atlas-boundary colors. Bleed closest coordinates/scalars are checked separately; no single boundary RGB oracle is claimed.','maximumChannelError':maxerror,'tolerance':12,'passed':maxerror<=12,'checks':results};(out/'atlas-anchors.json').write_text(json.dumps(report,indent=2)+'\n');print(id,len(checked),'anchors',maxerror,'maxRGBerror',report['passed']);assert report['passed']

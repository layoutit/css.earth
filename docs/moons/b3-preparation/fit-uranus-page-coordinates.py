from pathlib import Path
import json,fiona,numpy as np
from PIL import Image
from shapely.geometry import shape
from shapely.ops import unary_union
from scipy import ndimage as ndi
from scipy.optimize import least_squares
configs={'titania':{'initial':[109.5,109.5,-19.5,636.3], 'units':{'PhLinework_FeatureToPolygon':[137,90,68],'Pm':[112,68,137],'c2cratersshp':[205,170,102]}},'miranda':{'initial':[123,123,-1,716], 'units':{'heavilymantledcrateredterrain':[205,170,102],'darkmaterial':[0,92,230],'lightlymantledcrateredterrain':[255,170,0],'northernridgedplains':[76,0,115]}}}
for body,config in configs.items():
 d=Path('/tmp/b3-uranus-gis')/body;im=np.array(Image.open(next(d.glob('Screenshot*.png'))).convert('RGB')).astype(float);gdb=next((d/'extracted').rglob('*.gdb'))
 samples=[];fields=[]
 for layer,color in config['units'].items():
  mask=np.linalg.norm(im-np.array(color),axis=2)<28
  mask=ndi.binary_closing(mask,iterations=2);mask=ndi.binary_fill_holes(mask)
  edge=mask ^ ndi.binary_erosion(mask)
  distances=ndi.distance_transform_edt(~edge)
  with fiona.open(gdb,layer=layer) as src: geoms=[shape(f.geometry) for f in src]
  for geom in geoms:
   for polygon in geom.geoms if geom.geom_type=='MultiPolygon' else [geom]:
    ring=polygon.exterior
    if polygon.area<.002:continue
    points=np.array([ring.interpolate(t,normalized=True).coords[0][:2] for t in np.linspace(0,1,max(20,int(ring.length*80)),endpoint=False)])
    samples.append(points);fields.append(distances)
 def residual(p):
  sx,sy,tx,ty=p
  return np.concatenate([ndi.map_coordinates(field,np.array([ty-pts[:,1]*sy,tx+pts[:,0]*sx]),order=1,mode='constant',cval=100) for pts,field in zip(samples,fields)])
 fit=least_squares(residual,config['initial'],loss='soft_l1',f_scale=2,max_nfev=300,diff_step=1e-5)
 errs=residual(fit.x)
 result=dict(body=body,transform=fit.x.tolist(),samples=len(errs),rms=float(np.sqrt(np.mean(errs**2))),median=float(np.median(errs)),p90=float(np.percentile(errs,90)),max=float(max(errs)),units=config['units'],interpretation='Exploratory polygon-to-release-screenshot affine fit, not yet geographic registration.')
 (d/'fit.json').write_text(json.dumps(result,indent=2));print(result)

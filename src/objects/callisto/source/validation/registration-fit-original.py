from pathlib import Path
import json
import numpy as np
import rasterio
from rasterio.enums import Resampling
from PIL import Image
from scipy.ndimage import map_coordinates,gaussian_filter
from scipy.optimize import minimize
root=Path('/Users/ekrof/fed/cssEarth-pluto-small-moons')
image=np.array(Image.open('/tmp/b3-callisto/PIA03456-usgs.png')).astype(float)
photo=image[:,:,:3]@np.array([.299,.587,.114]);hh,ww=photo.shape
with rasterio.open(root/'src/planets/callisto/source/callisto-global-1km.tif') as f:
 ref=f.read(1,out_shape=(1536,3072),resampling=Resampling.bilinear).astype(float)
# Photometry differs: match spatial brightness variation, never transfer the
# reference map's brightness or texture into the color observation.
ref=gaussian_filter(ref,3);photo=gaussian_filter(photo,2)
y,x=np.mgrid[50:hh-50:3,50:ww-50:3];valid=((x-ww/2)**2+(y-hh/2)**2)<(ww*.39)**2
train=valid&(((x<ww/2)&(y<hh/2))|((x>ww/2)&(y>hh/2)))
xt,yt=x[train],y[train];observed=photo[yt,xt]
ratio=739976.3/2410.3

def sample(p,x,y):
 lat,lon,roll,cx,cy,r=p;lat,lon,roll=np.radians([lat,lon,roll]);dx=(x-cx)/(r*ratio);dy=(y-cy)/(r*ratio)
 a=1+dx*dx+dy*dy;disc=ratio*ratio-a*(ratio*ratio-1);t=(ratio-np.sqrt(np.maximum(0,disc)))/a
 xe=t*(dx*np.cos(roll)+dy*np.sin(roll));yn=t*(dx*np.sin(roll)-dy*np.cos(roll));z=ratio-t
 observer=np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)])
 east=np.array([-np.sin(lon),np.cos(lon),0]);north=np.cross(observer,east)
 xyz=observer[:,None]*z.ravel()+east[:,None]*xe.ravel()+north[:,None]*yn.ravel()
 lons=np.degrees(np.arctan2(xyz[1],xyz[0]))%360;lats=np.degrees(np.arctan2(xyz[2],np.hypot(xyz[0],xyz[1])))
 val=map_coordinates(ref,np.array([(90-lats)/180*ref.shape[0]-.5,lons/360*ref.shape[1]-.5]),order=1,mode='wrap').reshape(x.shape)
 return val

def corr(a,b):
 a=a-a.mean();b=b-b.mean();return float(a@b/np.sqrt(a@a*(b@b)))
def cost(p):return 1-corr(observed,sample(p,xt,yt))
start=np.array([-.164,145.041,0,ww/2,hh/2,318.])
coarse=[]
for roll in range(0,360,2):
 p=start.copy();p[2]=roll;coarse.append((cost(p),roll))
coarse.sort();start[2]=coarse[0][1];print('coarse',coarse[:5],flush=True)
bounds=[(-4,4),(141,149),(start[2]-15,start[2]+15),(ww/2-9,ww/2+9),(hh/2-9,hh/2+9),(308,328)]
fit=minimize(cost,start,method='Powell',bounds=bounds,options={'maxiter':100,'xtol':1e-5,'ftol':1e-8});p=fit.x;print('fit',p.tolist(),1-fit.fun,fit.success,flush=True)
rows=[]
for label,sx,sy in [('upper-right',1,0),('lower-left',0,1)]:
 q=valid&((x>ww/2)if sx else(x<ww/2))&((y>hh/2)if sy else(y<hh/2));hx,hy=x[q],y[q];a=photo[hy,hx];scores=[]
 for dy in range(-8,9):
  for dx in range(-8,9):scores.append((corr(a,sample(p,hx+dx,hy+dy)),dx,dy))
 best=max(scores);rows.append(dict(region=label,samples=int(q.sum()),unshiftedCorrelation=corr(a,sample(p,hx,hy)),bestDiagnosticCorrelation=best[0],diagnosticOffsetPixels=list(best[1:]),searchBoundary=max(abs(best[1]),abs(best[2]))==8))
print(rows,flush=True)
yy,xx=np.mgrid[:hh,:ww];values=sample(p,xx,yy);lo,hi=np.percentile(values[((xx-ww/2)**2+(yy-hh/2)**2)<250**2],[1,99]);out=np.uint8(np.clip((values-lo)/(hi-lo)*255,0,255));Image.fromarray(out).save('/tmp/b3-callisto/predicted.png')
Path('/tmp/b3-callisto/registration-exploratory.json').write_text(json.dumps(dict(parameters=p.tolist(),parameterNames=['observerLatitude','observerEastLongitude','northAzimuthDegrees','centerSample','centerLine','projectedRadiusPixels'],trainCorrelation=1-fit.fun,holdouts=rows,method='Two opposite quadrants fitted against controlled USGS mosaic, two disjoint quadrants withheld. High-pass brightness correlation; no source color change.',status='exploratory'),indent=2)+'\n')

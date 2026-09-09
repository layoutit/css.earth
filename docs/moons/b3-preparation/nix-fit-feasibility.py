from pathlib import Path
import gzip,re,json,numpy as np,math,time,os
from PIL import Image,ImageDraw
import sys
root=Path(sys.argv[1]);start=time.time()
# Original80,000-triangle STL vertices, fixed0.5km/source-unit; no scale fit.
b=gzip.decompress((root/'nix.stl').read_bytes()).decode();v=np.array([list(map(float,r.split())) for r in re.findall(r'\bvertex\s+([^\n]+)',b)])*.5;v=np.unique(v,axis=0);print('vertices',len(v),flush=True)
rng=np.random.default_rng(72311);dd=rng.normal(size=(768,3));dd/=np.linalg.norm(dd,axis=1)[:,None];ext=[]
for block in np.array_split(dd,24):ext.extend(np.argmax(v@block.T,axis=0))
small=v[np.unique(ext)];print('coarse extreme points',len(small),flush=True)
unit=lambda a:a/np.linalg.norm(a)
def rot(axis,a):
 axis=unit(np.array(axis));x,y,z=axis;c=np.cos(a);s=np.sin(a);C=1-c;return np.array([[x*x*C+c,x*y*C-z*s,x*z*C+y*s],[y*x*C+z*s,y*y*C+c,y*z*C-x*s],[z*x*C-y*s,z*y*C+x*s,z*z*C+c]])
angles=np.arange(0,360,5);u=np.column_stack([np.cos(np.deg2rad(angles)),np.sin(np.deg2rad(angles))]);fit=((angles//45)%2)==0;hold=~fit
pole=np.array([np.cos(np.deg2rad(42))*np.cos(np.deg2rad(350)),np.cos(np.deg2rad(42))*np.sin(np.deg2rad(350)),np.sin(np.deg2rad(42))])
frames=[]
for stem,bbox in [('lor_0299174134_0x636_sci',(0,420,182,680)),('lor_0299167039_0x630_sci',(196,545,456,805))]:
 h=json.loads((root/(stem+'-header.json')).read_text());f=np.load(root/(stem+'.npz'));a=f['data'];good=(f['quality']==0)&np.isfinite(a)&np.isfinite(f['sigma']);x0,y0,x1,y1=bbox;sky=float(np.median(a[good]));c=a[y0:y1,x0:x1];g=good[y0:y1,x0:x1];threshold=sky+.2*(float(np.percentile(c[g],80))-sky)
 # Use20% of actual bright-disc interior, not whole-crop80percentile (mostly sky).
 sigma=1.4826*float(np.median(np.abs(a[good]-sky))); bright=c[g&(c>sky+10*sigma)]; threshold=sky+float(os.environ.get('NIX_CONTOUR_FRACTION','.2'))*(float(np.percentile(bright,70))-sky)
 m=g&(c>threshold);seen=np.zeros(m.shape,dtype=bool);comps=[]
 for y,x in zip(*np.where(m)):
  if seen[y,x]:continue
  todo=[(int(y),int(x))];seen[y,x]=True;items=[]
  for yy,xx in todo:
   items.append((xx+x0,yy+y0))
   for dy,dx in [(1,0),(-1,0),(0,1),(0,-1)]:
    Y,X=yy+dy,xx+dx
    if 0<=Y<m.shape[0] and 0<=X<m.shape[1] and m[Y,X] and not seen[Y,X]:seen[Y,X]=True;todo.append((Y,X))
  comps.append(items)
 pts=np.array(max(comps,key=len),float);support=(pts@u.T).max(axis=0); witness=pts[np.argmax(pts@u.T,axis=0)]; validDirections=(witness[:,0]>3)&(witness[:,0]<1020)&(witness[:,1]>3)&(witness[:,1]<1020); centre=pts.mean(axis=0)
 ra,dec=np.deg2rad([h['CRVAL1'],h['CRVAL2']]);east=np.array([-np.sin(ra),np.cos(ra),0]);north=np.array([-np.sin(dec)*np.cos(ra),-np.sin(dec)*np.sin(ra),np.cos(dec)]);X=unit(east*h['CD1_1']+north*h['CD2_1']);Y=unit(east*h['CD1_2']+north*h['CD2_2']);Z=np.cross(X,Y);C=np.array([X,Y,Z]);scale=h['SPCTRANG']*np.deg2rad(np.hypot(h['CD1_1'],h['CD2_1']));jd=float(h['SPCTTGJD'].split()[-1]);frames.append({'stem':stem,'header':h,'camera':C,'kmPerPixel':scale,'jd':jd,'points':pts,'support':support,'thresholdDN':threshold,'bbox':bbox,'skyDN':sky,'centre':centre,'validDirections':validDirections});print(stem, 'scale',scale,'threshold',threshold,'targetpixels',len(pts),'centre',centre,flush=True)
fit &= frames[0]['validDirections'];hold &= frames[0]['validDirections'];t0=frames[0]['jd'];D=[f['camera']@rot(pole,(f['jd']-t0)*2*np.pi/1.829) for f in frames];e=[np.eye(3)[i] for i in range(3)]
def calc(R,vertices=small,full=False):
 results=[]
 for i,f in enumerate(frames):
  xy=(vertices@(D[i]@R).T)[:,:2]/f['kmPerPixel'];p=(xy@u.T).max(axis=0)
  # Only first-frame fit sectors determine attitude; second-frame translation is a nuisance pointing parameter.
  use=fit if i==0 else f['validDirections'];tr=np.linalg.lstsq(u[use],f['support'][use]-p[use],rcond=None)[0];r=p+u@tr-f['support'];results.append((r,tr,xy))
 return results
# Random proper rotations cover both pole signs and meridians; deterministic seeds.
seeds=[]
for i in range(1200):
 q=rng.normal(size=4);q/=np.linalg.norm(q);w,x,y,z=q;R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]);r=calc(R)[0][0];seeds.append((float(np.mean(r[fit]**2)),R))
seeds.sort(key=lambda t:t[0]);solutions=[]
for seed,(cost,R) in enumerate(seeds[:24]):
 for step in [12,6,3,1.5,.75,.375,.1875,.09375]:
  for iteration in range(18):
   trials=[(cost,R)]
   for axis in e:
    for sign in [-1,1]:
     RR=rot(axis,np.deg2rad(step*sign))@R;rr=calc(RR)[0][0];trials.append((float(np.mean(rr[fit]**2)),RR))
   cost2,R2=min(trials,key=lambda t:t[0])
   if cost2>=cost-1e-9:break
   cost,R=cost2,R2
 if all(np.arccos(np.clip((np.trace(R@r['rotation'].T)-1)/2,-1,1))>np.deg2rad(8) for r in solutions):
  res=calc(R,v);metrics=[]
  for i,(r,tr,xy) in enumerate(res):
   metrics.append({'id':frames[i]['stem'],'translationPixels':tr.tolist(),'fitRmsPixels':float(np.sqrt(np.mean(r[fit]**2))),'heldRmsPixels':float(np.sqrt(np.mean(r[hold]**2))),'heldMaximumPixels':float(np.max(np.abs(r[hold]))),'allRmsPixels':float(np.sqrt(np.mean(r[frames[i]['validDirections']]**2))),'residualsPixels':r.tolist()})
  solutions.append({'seed':seed,'rotation':R,'metrics':metrics});print('solution',seed,[(m['fitRmsPixels'],m['heldRmsPixels']) for m in metrics],flush=True)
solutions.sort(key=lambda s:s['metrics'][0]['fitRmsPixels']);result={'schema':'cssearth-nix-bounded-fit@1','method':'Original full mesh fixed0.5km/source unit. Convex-support silhouette outer constraints at5degree image directions.20percent bright-interior contour; quality-zero finite values only. First image alternating45degree sectors fit attitude+pointing; remaining sectors reserved. Second entire image is an independent shape holdout after fitting only its2D pointing offset. One rigid orientation propagated by historical2016 pole350/42 and1.829day period through actual FITS tangent camera bases. No pixels or texture mapping accepted. Orthographic approximation and phase-dependent limb are acknowledged feasibility limits.','elapsedSeconds':time.time()-start,'fullVertexCount':len(v),'coarseExtremeVertexCount':len(small),'frames':[{k:f[k] for k in ['stem','kmPerPixel','jd','thresholdDN','skyDN','bbox']} for f in frames],'fitDirectionDegrees':angles[fit].tolist(),'heldDirectionDegrees':angles[hold].tolist(),'solutions':[{**s,'rotation':s['rotation'].tolist()} for s in solutions]};(root/('fit-results-'+os.environ.get('NIX_CONTOUR_FRACTION','.2')+'.json')).write_text(json.dumps(result,indent=2)+'\n')
for j,s in enumerate(solutions[:4]):
 res=calc(s['rotation'],v)
 for i,(r,tr,xy) in enumerate(res):
  f=frames[i];a=np.load(root/(f['stem']+'.npz'))['data'];x0,y0,x1,y1=f['bbox'];c=a[y0:y1,x0:x1];image=Image.fromarray(np.uint8(np.clip((c-f['skyDN'])/(5*f['thresholdDN']),0,1)*255)).convert('RGB').resize(((x1-x0)*3,(y1-y0)*3),Image.Resampling.NEAREST);draw=ImageDraw.Draw(image)
  # Eachsupport extreme is an exact released vertex; connecting them is a convex-outline diagnostic only.
  idx=np.argmax(xy@u.T,axis=0);pp=xy[idx]+tr;pix=[((x-x0)*3,(y-y0)*3) for x,y in pp];draw.line(pix+[pix[0]],fill=(255,50,50),width=2);image.save(root/f'fit-{os.environ.get("NIX_CONTOUR_FRACTION",".2")}-{j}-view-{i}.png')
print('done',result['elapsedSeconds'],flush=True)

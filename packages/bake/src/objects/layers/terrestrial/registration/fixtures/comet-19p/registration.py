from pathlib import Path
import sys
# Requires NumPy and SciPy; no runtime or preparation dependency.
import numpy as np,json
from scipy.optimize import least_squares
from scipy.ndimage import distance_transform_edt,map_coordinates
p=Path('src/objects/comet-19p/source');u=np.loadtxt(p/'shape/usgsdem.tab');d=np.loadtxt(p/'shape/dlrdem.tab');mn=u[:,:2].min(0);wh=((u[:,:2].max(0)-mn)/16).astype(int)+1
z=np.full(wh[::-1],np.nan);coords=((u[:,:2]-mn)/16).astype(int);z[coords[:,1],coords[:,0]]=u[:,2];mask=np.isfinite(z);dist,inds=distance_transform_edt(~mask,return_indices=True);filled=z[tuple(inds)];center=(d[:,:2].min(0)+d[:,:2].max(0))/2;dc=d[:,:2]-center
record=json.loads((p/'reference/registration.json').read_text());reference=record['parameters'];results=[]
def transform(v,pts):
 s,a,x,y,_=v;c,ss=np.cos(a),np.sin(a);return pts@np.array([[c,ss],[ss,-c]])*s+[x,y]
def values(v,selected):
 xy=transform(v,dc[selected]);ij=((xy-mn)/16).T[::-1];uz=map_coordinates(filled,ij,order=1,mode='nearest');outside=map_coordinates(dist,ij,order=1,mode='nearest')*16;edge=np.maximum(mn-xy,0)+np.maximum(xy-(mn+(wh-1)*16),0);valid=map_coordinates(mask.astype(float),ij,order=1,mode='constant')>.99999
 return uz-d[selected,2]-v[4],outside,edge,valid
for phase in range(13):
 train=np.arange(len(d))%13==phase;held=~train
 def residual(v):
  delta,outside,edge,_=values(v,train);return np.concatenate([delta,outside*3,edge.ravel()*3])
 sol=least_squares(residual,reference,bounds=([50,-.1,-1500,-1500,-500],[60,.1,500,500,500]),max_nfev=300,loss='soft_l1',f_scale=150)
 delta,outside,_,valid=values(sol.x,held);sample=delta[valid];r=dict(phase=phase,fitPosts=int(train.sum()),holdoutPosts=int(held.sum()),holdoutOverlap=int(valid.sum()),parameters=sol.x.tolist(),holdoutMeanMeters=float(sample.mean()),holdoutRmsMeters=float(np.sqrt(np.mean(sample**2))),holdoutStdMeters=float(sample.std()),holdoutP95Meters=float(np.percentile(abs(sample),95)),holdoutMaxMeters=float(abs(sample).max()),deltaFromReferenceXYMaxMeters=float(np.linalg.norm(transform(sol.x,dc)-transform(reference,dc),axis=1).max()));results.append(r);print(json.dumps(r),flush=True)
output=Path(sys.argv[1] if len(sys.argv)>1 else 'output/borrelly/registration-validation.json');output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(results,indent=2)+'\n')

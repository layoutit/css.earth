from pathlib import Path
import sys
# Requires NumPy and SciPy. Run from the repository root.
import numpy as np
from scipy.optimize import least_squares
from scipy.ndimage import distance_transform_edt,map_coordinates
import json
p=Path('src/planets/comet-19p/source');u=np.loadtxt(p/'shape/usgsdem.tab');d=np.loadtxt(p/'shape/dlrdem.tab');mn=u[:,:2].min(0);wh=((u[:,:2].max(0)-mn)/16).astype(int)+1
z=np.full(wh[::-1],np.nan);coords=((u[:,:2]-mn)/16).astype(int);z[coords[:,1],coords[:,0]]=u[:,2]
mask=np.isfinite(z);dist,inds=distance_transform_edt(~mask,return_indices=True);filled=z[tuple(inds)];center=(d[:,:2].min(0)+d[:,:2].max(0))/2;dc=d[:,:2]-center
results=[];keep=np.arange(len(d))%13==0
for flip in [1,-1]:
 for turn in range(4):
  theta=turn*np.pi/2
  def transform(params,pts):
   scale,angle,tx,ty,z0=params;c,s=np.cos(angle),np.sin(angle);return pts@np.array([[c,s],[-s*flip,c*flip]])*scale+[tx,ty]
  def residual(params,selected):
   xy=transform(params,dc[selected]);ij=((xy-mn)/16).T[::-1];uz=map_coordinates(filled,ij,order=1,mode='nearest');out=map_coordinates(dist,ij,order=1,mode='nearest')*16;outside=np.maximum(mn-xy,0)+np.maximum(xy-(mn+(wh-1)*16),0)
   return np.concatenate([(uz-d[selected,2]-params[4]),out*3,outside.ravel()*3])
  init=[55,theta,*u[:,:2].mean(0),300];sol=least_squares(lambda v:residual(v,keep),init,bounds=([40,theta-.4,-5000,-5000,-1500],[65,theta+.4,5000,5000,1500]),max_nfev=300,loss='soft_l1',f_scale=150)
  xy=transform(sol.x,dc);ij=((xy-mn)/16).T[::-1];sample=map_coordinates(filled,ij,order=1,mode='nearest');valid=map_coordinates(mask.astype(float),ij,order=1,mode='constant')>.99999;delta=sample-d[:,2]-sol.x[4]
  result=dict(flip=flip,quarterTurn=turn,parameters=sol.x.tolist(),dlrCenter=center.tolist(),covered=int(valid.sum()),rms=float(np.sqrt(np.mean(delta[valid]**2))),std=float(np.std(delta[valid])),cost=sol.cost)
  results.append(result);print(json.dumps(result),flush=True)
output=Path(sys.argv[1] if len(sys.argv)>1 else 'output/borrelly/registration-trial.json');output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(results,indent=2)+'\n')

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
// Native HEALPix interpolation stays with healpy/NumPy, as in the repository's other astronomy preparation owners.
const python = String.raw`
import json,os,time
from pathlib import Path
import numpy as np,healpy as hp,requests
W=Path('.local'); output=Path('src/objects/milky-way-pleiades-dust/source/inputs'); C=np.array(json.loads((output/'wide-science-grid.json').read_text())['centerGalacticPc'])
rad=np.frombuffer((W/'ranges/edenhofer-3246405120-2064.bin').read_bytes(),'>f4').astype(float)
lo=np.array([-140.,-100.,-100.]); hi=np.array([50.,100.,100.]); step=1.
corners=np.array(np.meshgrid(*[(C[a]+lo[a],C[a]+hi[a]) for a in range(3)],indexing='ij')).reshape(3,-1).T
end=int(np.searchsorted(rad,np.linalg.norm(corners,axis=1).max()))+2
row=786432*4; path=W/'edenhofer-wide-native-mean.f32'; expected=end*row
if not path.exists():
  with path.open('wb') as f:f.truncate(expected)
done=set(json.loads((W/'wide-native-completed.json').read_text()) if (W/'wide-native-completed.json').exists() else [])
# Reuse the original full-sky shell block, without acquiring or inventing another dust product.
old=W/'ranges/edenhofer-239081088-261095424.bin'; first=(239081088-5760)//row; oldcount=261095424//row
if old.exists() and 'original' not in done:
  with path.open('r+b') as f:f.seek(first*row);f.write(old.read_bytes())
  done.add('original')
session=requests.Session(); fetched=0; started=time.monotonic()
chunks=[(a,min(a+16,end,first)) for a in range(0,first,16)]+[(a,min(a+16,end)) for a in range(first+oldcount,end,16)]
for a,b in chunks:
  key=f'{a}:{b}'
  if a>=b or key in done:continue
  start=5760+a*row; size=(b-a)*row
  assert fetched+size<800_000_000
  response=session.get('https://zenodo.org/records/10658339/files/mean_and_std_healpix.fits',headers={'Range':f'bytes={start}-{start+size-1}'},timeout=(15,60))
  response.raise_for_status(); assert response.status_code==206 and response.headers.get('Content-Range','').startswith(f'bytes {start}-')
  assert len(response.content)==size
  with path.open('r+b') as f:f.seek(a*row);f.write(response.content)
  done.add(key);(W/'wide-native-completed.json').write_text(json.dumps(sorted(done)))
  fetched+=size;print('NATIVE_ROWS_READY',a,b,'newBytes',fetched,'seconds',round(time.monotonic()-started,1),flush=True)
raw=np.memmap(path,dtype='>f4',mode='r',shape=(end,786432))
shape=np.rint((hi-lo)/step).astype(int)+1
target=np.memmap(output/'edenhofer-wide-density.f32',dtype='<f4',mode='w+',shape=tuple(shape))
yy,zz=np.meshgrid(C[1]+np.arange(shape[1])*step+lo[1],C[2]+np.arange(shape[2])*step+lo[2],indexing='ij')
minimum=1.;maximum=0.
for x in range(shape[0]):
  p=np.column_stack([np.full(yy.size,C[0]+lo[0]+x*step),yy.ravel(),zz.ravel()]); r=np.linalg.norm(p,axis=1)
  assert r.min()>=rad[0] and r.max()<rad[end-1]
  pixels,weights=hp.get_interp_weights(256,np.rad2deg(np.arctan2(p[:,1],p[:,0])),np.rad2deg(np.arcsin(p[:,2]/r)),nest=True,lonlat=True)
  i=np.searchsorted(rad,r)-1; f=(r-rad[i])/(rad[i+1]-rad[i])
  a=raw[i[None,:],pixels].astype(float);b=raw[i[None,:]+1,pixels].astype(float)
  assert np.all(a>0) and np.all(b>0)
  value=np.exp((1-f)*np.sum(np.log(a)*weights,axis=0)+f*np.sum(np.log(b)*weights,axis=0))*2.8/(2.5/np.log(10))
  target[x]=value.reshape(yy.shape);minimum=min(minimum,float(value.min()));maximum=max(maximum,float(value.max()))
  if x%32==0:print('NATIVE_GRID_READY',x,int(shape[0]),flush=True)
target.flush()
record={'source':'Edenhofer v1.0.2 native mean_and_std_healpix.fits','quantity':'V optical depth per pc','originGalacticPc':(C+lo).tolist(),'centerGalacticPc':C.tolist(),'boundsUnits':{'min':lo.tolist(),'max':hi.tolist()},'stepPc':step,'shape':shape.tolist(),'angularInterpolation':'healpy HEALPix NEST log-density; linear between native radial coordinates','minTauVPerPc':minimum,'maxTauVPerPc':maximum,'newlyAcquiredBytes':fetched,'seconds':time.monotonic()-started}
(output/'wide-science-grid.json').write_text(json.dumps(record,indent=2));print('WIDE_NATIVE_GRID_COMPLETE',json.dumps(record),flush=True)
`;
const child = spawn(resolve('.local/science-env/bin/python'), ['-u', '-c', python], { stdio: 'inherit' });
const status = await new Promise<number | null>((done, reject) => { child.once('error', reject);child.once('exit', done); });
if (status !== 0) throw new Error(`Native acquisition exited ${status}.`);

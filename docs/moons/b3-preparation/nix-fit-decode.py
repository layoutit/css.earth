from pathlib import Path
import numpy as np,json
from PIL import Image
import sys
root=Path(sys.argv[1])
def read(p):
 b=p.read_bytes();off=0;out=[]
 while off<len(b):
  h={};start=off
  while True:
   c=b[off:off+80].decode('ascii');off+=80;k=c[:8].strip()
   if k=='END':break
   if c[8:10]=='= ':
    v=c[10:].split('/')[0].strip();
    try:v=float(v.replace('D','E'))
    except:v=v.strip("'").strip()
    h[k]=v
  off=start+((off-start+2879)//2880)*2880;n=int(h['NAXIS1']*h['NAXIS2']);dtype={-32:'>f4',16:'>i2',8:'u1'}[int(h['BITPIX'])];a=np.frombuffer(b,dtype=dtype,count=n,offset=off).astype(float).reshape(int(h['NAXIS2']),int(h['NAXIS1']));a=a*h.get('BSCALE',1)+h.get('BZERO',0);out.append((h,a,off));off+=((n*np.dtype(dtype).itemsize+2879)//2880)*2880
 return out
for p in root.glob('*.fit'):
 planes=read(p);a=planes[0][1];q=planes[2][1];good=(q==0)&np.isfinite(a);yy,xx=np.where(good&(a>np.percentile(a[good],99.95)));print(p.name,[(h.get('BITPIX'),h.get('BZERO'),off) for h,a,off in planes]);print('range',np.percentile(a[good],[0,50,99,99.9,99.99,100]),'mask',np.unique(q,return_counts=True),'brightbbox',xx.min(),xx.max(),yy.min(),yy.max())
 # Bright target region is contiguous and dominates highest values; this is only initial crop.
 x=int(np.median(xx));y=int(np.median(yy));lo,hi=max(0,x-130),min(1024,x+130);bot,top=max(0,y-130),min(1024,y+130);v=a[bot:top,lo:hi];v=np.uint8(np.clip((v-np.median(a[good]))/(np.percentile(a[good],99.95)-np.median(a[good])),0,1)*255)
 Image.fromarray(v).resize((780,780),Image.Resampling.NEAREST).save(root/(p.stem+'-crop.png'));np.savez(root/(p.stem+'.npz'),data=a,sigma=planes[1][1],quality=q);(root/(p.stem+'-header.json')).write_text(json.dumps(planes[0][0],indent=2));print('cropbounds',lo,bot,hi,top)

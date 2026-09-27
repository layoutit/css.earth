"""Verify archived Galileo camera controls against the pinned Thomas mosaic.

No camera fit or pixel correction. All four image patches are checks, withheld
from the published camera solution. Uses the existing bounded DoG/ZNCC method.
Requires numpy, scipy, astropy, Pillow, and Node; downloads nothing.
Usage: python verify-catalog-camera.py src/objects/ida/source OUTPUT_DIRECTORY
"""
from pathlib import Path
import argparse,hashlib,json,subprocess
import numpy as np
from scipy.ndimage import gaussian_filter
from scipy.signal import fftconvolve
from astropy.io import fits
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('output',type=Path)
p.add_argument('--frame');p.add_argument('--profile',default='reference/calibrated-registration.json')
a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
if Path(a.profile).is_absolute() or '..' in Path(a.profile).parts:raise ValueError('Registration profile must be inside its source package')
config=json.loads((a.source/'preparation/terrestrial.json').read_text());profile=json.loads((a.source/a.profile).read_text());frames=next(l for l in config['raster']['surfaceObservations'] if l['id']=='calibrated')['frames']
frame=next(f for f in frames if f['id']==a.frame) if a.frame else frames[0]
reference=a.output/'reference.f32'
subprocess.run(['node',str(Path(__file__).with_name('catalog-camera-reference.mts')),str(a.source),str(reference),frame['id']],check=True)
r=np.fromfile(reference,'<f4').reshape(800,800).astype(float);original=fits.getdata(a.source/frame['path']).astype(float)
# Source special values are not radiance. This is correlation preprocessing,
# never a modification to retained observations or their production eligibility.
s=np.where(np.isfinite(original)&(original>=0)&(original<1e10),original,0)
lo,hi=profile['dogSigmaPixels'];s=gaussian_filter(s,lo)-gaussian_filter(s,hi);rfiltered=gaussian_filter(r,lo)-gaussian_filter(r,hi)
checks=[];pad=profile['searchRadiusPixels']
for rectangle in profile['checkRectangles']:
 x,y,x1,y1=rectangle;t=rfiltered[y:y1,x:x1];im=s[y-pad:y1+pad,x-pad:x1+pad];t=t-t.mean();ones=np.ones(t.shape);n=t.size
 sums=fftconvolve(im,ones,mode='valid');sq=fftconvolve(im*im,ones,mode='valid');cov=fftconvolve(im,t[::-1,::-1],mode='valid')
 cc=cov/np.sqrt(np.maximum(1e-30,(sq-sums*sums/n)*np.sum(t*t)));iy,ix=np.unravel_index(cc.argmax(),cc.shape);offset=[int(ix-pad),int(iy-pad)]
 if ix in (0,2*pad) or iy in (0,2*pad):raise ValueError('Correlation reached the search boundary')
 correlation=float(cc[iy,ix]);residual=float(np.linalg.norm(offset))
 if correlation<profile['minimumCorrelation'] or residual>profile['maximumResidualPixels']:raise ValueError(f'Unqualified archived camera check: {rectangle}, {offset}, {correlation}')
 checks.append(dict(rectangle=rectangle,offsetPixels=offset,correlation=correlation,residualPixels=residual))
maximum=max(c['residualPixels'] for c in checks);rms=float(np.sqrt(np.mean([c['residualPixels']**2 for c in checks])))
paths=[frame['path'],frame['labelPath'],frame['quality']['rawPath'],frame['quality']['rawLabelPath'],frame['quality']['badDataPath'],frame['quality']['badDataLabelPath'],frame['cameraCatalog']['path'],frame['cameraCatalog']['labelPath'],frame['cameraCatalog']['instrumentPath'],config['geometry']['radialTerrain']['path'],'preparation/terrestrial.json',a.profile]
manifest=json.loads((a.source/'manifest.json').read_text());paths.append(next(i['path'] for i in manifest['inputs'] if i.get('lensId')=='normal'))
report=dict(method='Archived Thomas camera, no local fitting; DoG and bounded zero-mean normalized cross-correlation against the published Thomas mosaic.',interpretation='Checks of the archived image-to-shape registration; the mosaic shares these Galileo observations and is not independent absolute ground truth.',fitCount=0,checkCount=len(checks),rmsResidualPixels=rms,maximumResidualPixels=maximum,limits=profile,checks=checks,provenance=[dict(path=str(path),sha256=hashlib.sha256((a.source/path).read_bytes()).hexdigest()) for path in paths])
(a.output/'registration.json').write_text(json.dumps(report,indent=2)+'\n')
canvas=Image.new('RGB',(1600,800));canvas.paste(Image.fromarray((np.clip(np.nan_to_num(original,nan=0)/.12,0,1)*255).astype('uint8')),(0,0));canvas.paste(Image.fromarray(np.clip(r,0,255).astype('uint8')),(800,0));draw=ImageDraw.Draw(canvas)
for c in checks:
 for dx in (0,800):
  x,y,x1,y1=c['rectangle'];draw.rectangle((x+dx,y,x1+dx,y1),outline=(255,180,40),width=1)
canvas.save(a.output/'source-and-registered-mosaic.png')
print(json.dumps(dict(object=config['namespace'],fitCount=0,checkCount=len(checks),rmsResidualPixels=rms,maximumResidualPixels=maximum)))

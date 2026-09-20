/** Independent analytic ray/ellipsoid reference; no PolyCSS geometry is used to draw it. */
import { execFileSync } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { astroqueryToolchain } from '../astronomy-packages/toolchain.mts';
import { verifiedProduct } from './projection.mts';
import { sphereViewTransform } from './sphere.mts';
export const ORACLE_PYTHON=String.raw`
import json,sys,re
from pathlib import Path
import numpy as np
from astropy.io import fits
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=json.load(sys.stdin);out=Path(r['out']);html=Path(r['html']).read_text()
prepared=json.loads(re.search(r'<script id="prepared" type="application/json">(.*?)</script>',html).group(1))
product=json.loads(Path(r['map'],'map.fits.body-map.json').read_text())
nav=json.loads(Path(r['map'],'navigation.json').read_text());a,b,c=nav['radiiKm']; radii=np.array([a,b,c]);scale=240/a
# Recover actual prepared leaf transforms, not declarations about their geometry.
max_error=0.;checked=0;mutations={'vertical-flip':0.,'horizontal-flip':0.,'flat-depth':0.}
for index,leaf in enumerate(prepared['leaves'][1:-1]):
 band=index//72+1;column=index%72;style=leaf['style']
 matrix=np.array(list(map(float,re.search(r'matrix3d\(([^)]+)',style).group(1).split(',')))).reshape(4,4,order='F')
 w=float(re.search(r'--polycss-atlas-width:([0-9.e+-]+)',style).group(1));h=float(re.search(r'--polycss-atlas-height:([0-9.e+-]+)',style).group(1))
 for x,y,lon,lat in [(0,0,column*5,-90+(band+1)*5),(w,0,(column+1)*5,-90+(band+1)*5),(w,h,(column+1)*5,-90+band*5),(0,h,column*5,-90+band*5)]:
  lon,lat=np.radians([lon,lat]);n=np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)])
  point=n/np.sqrt(np.sum((n/radii)**2));expected=point[[1,0,2]]*scale
  found=matrix@np.array([x,y,0,1]);found=found[:3]/found[3]
  max_error=max(max_error,float(np.max(abs(found-expected))));checked+=1
  for name,mx,my in [('vertical-flip',x,h-y),('horizontal-flip',w-x,y),('flat-depth',x,y)]:
   wrong=matrix@np.array([mx,my,0,1]);wrong=wrong[:3]/wrong[3]
   if name=='flat-depth':wrong[2]=0
   mutations[name]=max(mutations[name],float(np.max(abs(wrong-expected))))
# Independent sky basis: east is right, north is up, observer is toward the viewer.
for case in r['views']:
 lon,lat=np.radians([case['longitude'],case['latitude']]);east=np.array([-np.sin(lon),np.cos(lon),0]);north=np.array([-np.sin(lat)*np.cos(lon),-np.sin(lat)*np.sin(lon),np.cos(lat)]);eye=np.cross(east,north)
 angles=list(map(float,re.findall(r'rotate[ZX]\(([-+0-9.e]+)deg\)',case['transform'])));rx,rz=np.radians(angles)
 mx=np.array([[1,0,0],[0,np.cos(rx),-np.sin(rx)],[0,np.sin(rx),np.cos(rx)]]);mz=np.array([[np.cos(rz),-np.sin(rz),0],[np.sin(rz),np.cos(rz),0],[0,0,1]])
 actual=mx@mz@np.array([[0,1,0],[1,0,0],[0,0,1]])
 np.testing.assert_allclose(actual,np.stack([east,-north,eye]),atol=1e-12)
# PolyCSS conservatively extends image edges by 0.6 CSS px. Match the existing
# independent volume orientation oracle's 1.25 px bound, rather than asserting
# exact geometric edges for intentionally extended raster leaves.
if max_error>1.25:raise AssertionError(f'Prepared geometry differs from analytic ellipsoid: {max_error} pixels')
assert all(error>12.5 for error in mutations.values()), 'Oracle must reject the old orientation and depth defects'
# Orthographic ray/ellipsoid intersection gives an independently drawn reference.
lon,lat=np.radians([prepared['longitude'],prepared['latitude']]);east=np.array([-np.sin(lon),np.cos(lon),0]);north=np.array([-np.sin(lat)*np.cos(lon),-np.sin(lat)*np.sin(lon),np.cos(lat)]);eye=np.cross(east,north)
n=600;lim=max(radii)*1.05;coord=(np.arange(n)+.5)/n*2*lim-lim;x,y=np.meshgrid(coord,coord[::-1]);q=x[...,None]*east+y[...,None]*north
A=np.sum((eye/radii)**2);B=2*np.sum(q*eye/radii**2,axis=-1);C=np.sum((q/radii)**2,axis=-1)-1;discriminant=B*B-4*A*C;hit=discriminant>=0
z=(-B+np.sqrt(np.maximum(discriminant,0)))/(2*A);p=q+z[...,None]*eye
lon=np.mod(np.degrees(np.arctan2(p[:,:,1],p[:,:,0])),360);lat=np.degrees(np.arctan2(p[:,:,2],np.hypot(p[:,:,0],p[:,:,1])))
with fits.open(Path(r['map'],'map.fits')) as f:values=np.asarray(f['VALUE'].data);errors=np.asarray(f['SIGMA'].data);emission=np.asarray(f['EMISSION'].data)
assert np.array_equal(np.isfinite(values),np.isfinite(errors));assert np.nanmax(emission[np.isfinite(values)])<=product['mask']['maximumEmissionDegrees']
with fits.open(r['measurement']) as f:
 original=f[0].data;uncertainty=f['ERR'].data
 pairs=set(zip(original[np.isfinite(original)].tolist(),uncertainty[np.isfinite(original)].tolist()))
 assert all(pair in pairs for pair in zip(values[np.isfinite(values)].tolist(),errors[np.isfinite(values)].tolist()))
h,w=values.shape;row=np.clip(((90-lat)*h/180).astype(int),0,h-1);col=np.mod((lon*w/360).astype(int),w)
cmap=matplotlib.colormaps['viridis'].copy();cmap.set_bad('#333941');norm=plt.Normalize(nav['normalization']['minimum'],nav['normalization']['maximum']);rgba=cmap(norm(np.ma.masked_invalid(values[row,col])));rgba[~hit]=[24/255,27/255,31/255,1]
plt.rcParams.update({'figure.facecolor':'#181b1f','axes.facecolor':'#181b1f','text.color':'#d5d7dc','axes.labelcolor':'#d5d7dc','xtick.color':'#b8bbc4','ytick.color':'#b8bbc4'})
fig,ax=plt.subplots(figsize=(7,7),layout='constrained');ax.imshow(rgba,extent=(-lim,lim,-lim,lim));ax.set(xlabel='East (km)',ylabel='North (km)',title=product['frame']['body']+' · independent sphere reference\n'+product['definition']['quantity']+'; grey = unobserved');fig.colorbar(matplotlib.cm.ScalarMappable(norm=norm,cmap=cmap),ax=ax,shrink=.7,label=product['definition']['units']);fig.savefig(out/'sphere-reference.png',dpi=160);plt.close(fig)
json.dump({'oracle':'Analytic orthographic ray intersection with pinned triaxial ellipsoid; NumPy / Matplotlib','preparedCornersChecked':checked,'maximumCornerErrorPixelsAt480Diameter':max_error,'cornerTolerancePixels':1.25,'cameraCases':len(r['views']),'rejectedMutationsMaximumErrorPixels':mutations,'samplePairsPreserved':True,'emissionMaskVerified':True,'pixelComparison':'not run: browser file URL blocked; reference is not an HTML screenshot','versions':{'numpy':np.__version__,'matplotlib':matplotlib.__version__}},sys.stdout)
`;
export async function sphereOracle(mapRecord:string,sphereRecord:string,measurement:string,out:string){
 const map=await verifiedProduct(mapRecord),sphere=await verifiedProduct(sphereRecord),tc=await astroqueryToolchain();await mkdir(out,{recursive:true});
 const views=[{longitude:0,latitude:0},{longitude:90,latitude:0},{longitude:359.9,latitude:45},{longitude:120,latitude:-60},{longitude:270,latitude:90}].map(v=>({...v,transform:sphereViewTransform(v.longitude,v.latitude)}));
 const result=execFileSync(tc.python,['-c',ORACLE_PYTHON],{env:{...process.env,...tc.env},input:JSON.stringify({map:map.root,html:resolve(sphere.root,'sphere.html'),measurement:resolve(measurement),out:resolve(out),views}),encoding:'utf8',maxBuffer:2**20});
 const report={...JSON.parse(result),inputs:{map:map.pin,sphere:sphere.pin},source:'tools/objects/telescopes/sphere-oracle.mts'};await writeFile(resolve(out,'sphere-oracle.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(await sphereOracle(...process.argv.slice(2) as [string,string,string,string]));

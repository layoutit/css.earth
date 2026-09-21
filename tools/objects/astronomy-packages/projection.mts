/** PlanetMapper owns navigation and resampling; no interactive viewer is started. */
import { spawn } from 'node:child_process';
import { astroqueryToolchain } from './toolchain.mts';
import { requireRecord } from '../../source-values.mts';

export const PROJECTION_PYTHON = String.raw`
import json,sys,warnings
from pathlib import Path
import numpy as np
import astropy,planetmapper,spiceypy,pyproj,matplotlib
from astropy.io import fits
from astropy.time import Time
from astropy import units as u
from astropy.visualization import ImageNormalize,LinearStretch
from PIL import Image
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=json.load(sys.stdin); out=Path(r['directory']); g=r['geometry']
spiceypy.kclear()
for kernel in g['kernels']:spiceypy.furnsh(kernel['file'])
with fits.open(r['image']) as f:
 values=np.asarray(f[0].data,dtype=float); header=f[0].header.copy()
 if values.ndim!=2 or values.size>1000000:raise ValueError('Projection needs a bounded two-dimensional measurement')
 if 'ERR' not in f:raise ValueError('A body map requires supplied uncertainty; aggregate independent-sample uncertainty must be explicitly requested upstream')
 sigma=np.asarray(f['ERR'].data,dtype=float)
 if sigma.shape!=values.shape:raise ValueError('Uncertainty grid differs from the measurement')
 if 'MASK' in f:values[np.asarray(f['MASK'].data)!=0]=np.nan
 unit=u.Unit(header['BUNIT'])
 if unit!=u.dimensionless_unscaled and not any(base==u.sr and power<0 for base,power in zip(unit.bases,unit.powers)):
  raise ValueError('Surface projection accepts intensive values (dimensionless or per steradian), not flux per pixel')
with fits.open(r['source'],memmap=True) as f:
 primary=f[0].header
 if str(primary.get('TARGNAME','')).strip().casefold()!=r['target'].casefold():raise ValueError('Source target does not match the delivery; an explicit target association is required')
 if str(primary.get('TELESCOP','')).strip().casefold()!=g['observer'].casefold():raise ValueError('Observer differs from the source telescope')
 start=Time(primary['DATE-BEG'],format='isot',scale='utc'); end=Time(primary['DATE-END'],format='isot',scale='utc')
 if end<start:raise ValueError('Invalid observation interval')
 middle=start+(end-start)/2
 instrument=str(primary['INSTRUME']); observation=str(primary.get('FILENAME',Path(r['source']).name))
notices=[]
with warnings.catch_warnings(record=True) as caught:
 warnings.simplefilter('always')
 obs=planetmapper.Observation(data=values,header=header,target=r['target'],utc=middle.isot,observer=g['observer'],auto_load_kernels=False)
 # The constructor can silently center a disc when WCS is absent. Never accept that fallback.
 obs.disc_from_wcs(validate=True,use_header_offsets=False,distortion_warning_threshold=0.25)
 notices=[str(n.message) for n in caught]
 if any('distortion' in n.lower() for n in notices):raise ValueError('WCS distortion exceeds the supported tangent-plane navigation; rectify with the instrument owner first')
if g['registration']['method']=='disc':
 obs.set_disc_params(*g['registration']['parameters'])
x0,y0,r0,rotation=map(float,obs.get_disc_params())
if r0<1.5 or not (-r0<x0<values.shape[1]+r0 and -r0<y0<values.shape[0]+r0):raise ValueError('The target disc is unresolved or outside the measurement')
w,h=g['width'],g['height']; lon,lat=np.meshgrid((np.arange(w)+.5)*360/w,90-(np.arange(h)+.5)*180/h)
# Body-map latitude is planetocentric, longitude east-positive. PlanetMapper's
# map coordinates are planetographic and may use west-positive longitude.
graphic_lon,graphic_lat=obs.centric2graphic_lonlat(lon,lat)
mapping=dict(projection='manual',lon_coords=graphic_lon,lat_coords=graphic_lat)
mapped=obs.map_img(values,interpolation='nearest',**mapping)
error=obs.map_img(sigma,interpolation='nearest',**mapping)
emission=obs.get_emission_angle_map(**mapping)
valid=np.isfinite(mapped)&np.isfinite(error)&(error>=0)&np.isfinite(emission)&(emission<=g['maximumEmissionDegrees'])
mapped[~valid]=np.nan;error[~valid]=np.nan
if not valid.any():raise ValueError('No supported surface samples within the emission limit')
hdr=fits.Header({'BUNIT':header['BUNIT'],'CTYPE1':'LON','CTYPE2':'LAT','CUNIT1':'deg','CUNIT2':'deg','CRPIX1':1.,'CRPIX2':1.,'CRVAL1':180/w,'CRVAL2':90-90/h,'CDELT1':360/w,'CDELT2':-180/h})
hdr['HISTORY']='Planetocentric latitude; east-positive longitude; nearest source pixel; repeated map cells are correlated'
fits.HDUList([fits.PrimaryHDU(),fits.ImageHDU(mapped,header=hdr,name='VALUE'),fits.ImageHDU(error,header=hdr,name='SIGMA'),fits.ImageHDU(emission,name='EMISSION')]).writeto(out/'map.fits',checksum=True)
lo,hi=float(np.nanmin(mapped)),float(np.nanmax(mapped)); norm=ImageNormalize(vmin=lo,vmax=hi,stretch=LinearStretch())
cmap=matplotlib.colormaps['viridis'].copy();cmap.set_bad('#333941')
rgba=cmap(norm(np.ma.masked_invalid(mapped)),bytes=True);Image.fromarray(rgba).save(out/'texture.png')
# Prepared polar plates use the same sample lookup and colour scale as the map.
n=128; yy,xx=np.mgrid[:n,:n]; xx=(xx+.5)/n*2-1;yy=(yy+.5)/n*2-1
rho=np.hypot(xx,yy); angle=np.mod(np.degrees(np.arctan2(yy,xx)),360); polar=[]
for sign in [1,-1]:
 latitude=sign*np.degrees(np.arccos(np.minimum(rho*np.sin(np.pi/36),1)))
 rows=np.clip(((90-latitude)/180*h).astype(int),0,h-1);cols=np.mod((angle/360*w).astype(int),w)
 pixels=rgba[rows,cols].copy();pixels[rho>1,3]=0;polar.append(pixels)
Image.fromarray(np.concatenate(polar,axis=1)).save(out/'poles.png')
plt.rcParams.update({'figure.facecolor':'#181b1f','axes.facecolor':'#333941','text.color':'#d5d7dc','axes.labelcolor':'#d5d7dc','xtick.color':'#b8bbc4','ytick.color':'#b8bbc4'})
fig,ax=plt.subplots(figsize=(10,5),layout='constrained')
im=ax.imshow(np.ma.masked_invalid(mapped),extent=(0,360,-90,90),origin='upper',cmap=cmap,norm=norm,interpolation='nearest')
ax.set(xlabel='East longitude (degrees)',ylabel='Planetocentric latitude (degrees)',title=r['target']+' — '+r['quantity']+'\n'+g['registration']['method']+' registration; nearest sample; grey = unobserved')
fig.colorbar(im,ax=ax,label=header['BUNIT']);fig.savefig(out/'figure.png',dpi=160,transparent=True,bbox_inches='tight',pad_inches=.12);plt.close(fig)
observer_lon,observer_lat=obs.graphic2centric_lonlat(obs.subpoint_lon,obs.subpoint_lat)
west=float(-observer_lon)%360
result={'units':header['BUNIT'],'bodyCode':int(obs.target_body_id),'radiusKm':float(obs.r_eq),'radiiKm':list(map(float,obs.radii)),
 'instrument':instrument,'observation':observation,'midTimeJd':float(middle.jd),'startTimeJd':float(start.jd),'endTimeJd':float(end.jd),'startIso':start.isot+'Z','endIso':end.isot+'Z','exposureSeconds':float((end-start).sec),
 'rangeKm':float(obs.target_distance),'subObserver':{'latitudeDegrees':float(observer_lat),'westLongitudeDegrees':west},
 'disc':{'x':x0,'y':y0,'radius':r0,'rotation':rotation},'samplingArcsec':float(obs.target_diameter_arcsec/(2*r0)),'registration':g['registration'],'warnings':notices,
 'interpolation':'nearest','uncertainty':'Same source standard deviation; repeated output cells are correlated. Navigation, beam and temporal smearing errors are not included.',
 'shape':'SPICE reference ellipsoid; not terrain','coverageCells':int(valid.sum()),'normalization':{'minimum':lo,'maximum':hi,'colormap':'viridis','missing':'#333941'},
 'software':{'PlanetMapper':planetmapper.__version__,'SpiceyPy':spiceypy.__version__,'pyproj':pyproj.__version__,'PROJ':pyproj.proj_version_str,'Astropy':astropy.__version__,'Matplotlib':matplotlib.__version__}}
(out/'navigation.json').write_text(json.dumps(result,indent=2)+'\n');json.dump(result,sys.stdout)
`;

export async function projectWithPlanetMapper(request:Record<string,unknown>):Promise<Record<string,unknown>> {
  const tc=await astroqueryToolchain();
  return new Promise((accept,reject)=>{
    const child=spawn(tc.python,['-c',PROJECTION_PYTHON],{env:{...process.env,...tc.env},stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.on('error',reject);child.on('close',code=>{if(code!==0)reject(new Error(stderr.slice(-5000)||`PlanetMapper exited ${code}`));else{try{accept(requireRecord(JSON.parse(stdout)));}catch(error){reject(error);}}});
    child.stdin.on('error',reject);child.stdin.end(JSON.stringify(request));
  });
}

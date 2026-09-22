/** Astropy owns scientific serialization and axes; Matplotlib owns static rendering. */
import { spawn } from 'node:child_process';
import { astroqueryToolchain } from './toolchain.mts';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
export const PLOT_PYTHON = String.raw`
import csv,json,sys,warnings
from pathlib import Path
import numpy as np
import astropy
from astropy import units as u
from astropy.io import fits
from astropy.table import QTable,MaskedColumn
from astropy.wcs import WCS
from astropy.wcs.utils import wcs_to_celestial_frame
from astropy.visualization import ImageNormalize,LinearStretch,quantity_support
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=json.load(sys.stdin); data=r['data']; out=Path(r['directory']); kind=data['kind']
if 'arrays' in data:
 values=np.load(out/'arrays'/data['arrays']['values'],mmap_mode='r');sigma=np.load(out/'arrays'/data['arrays']['sigma'],mmap_mode='r')
else:values=np.asarray(data['values'],dtype=float);sigma=np.asarray(data['sigma'],dtype=float)
if not np.isfinite(values).any(): raise ValueError('The requested output contains no usable samples')
if sigma.shape!=values.shape: raise ValueError('Uncertainty shape mismatch')
unit=u.Unit(data['unit']) if data['unit'] else None
unit_label=('dimensionless' if unit==u.dimensionless_unscaled else unit.to_string('latex_inline')) if unit is not None else 'unit not stated'
metadata={'kind':kind,'definition':data.get('definition','Native sampled values'),
 'selection':r['selection'],'uncertainty':data.get('uncertaintyPolicy','recorded'),
 'mask':'Non-finite values are missing; no interpolation',
 'source_file':Path(r['source']).name,'source_hdu':r['selection']['hdu'],
 'provenance':'output.product.json'}
presentation={'coordinates':{'kind':'pixel','reason':'No celestial WCS supplied'},'warnings':[]}
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'figure.facecolor':'#181b1f','axes.facecolor':'#181b1f','text.color':'#d5d7dc','axes.labelcolor':'#d5d7dc','xtick.color':'#b8bbc4','ytick.color':'#b8bbc4','axes.edgecolor':'#626770','svg.hashsalt':'cssearth-telescope-output'})
files=['figure.png','figure.svg','values.csv']
with (out/'values.csv').open('w',newline='') as file:
 writer=csv.writer(file)
 number=lambda n:float(n) if np.isfinite(n) else ''
 if kind in ('image','band-image','feature-map'):
  if values.ndim!=2:raise ValueError('Expected a two-dimensional image')
  spatial=None
  with warnings.catch_warnings(record=True) as notices:
   warnings.simplefilter('always')
   with fits.open(r['source'],memmap=True) as source:
    hdu=source[r['selection']['hdu']]
    if tuple(hdu.shape[-2:])!=values.shape:raise ValueError('Output grid differs from source WCS grid')
    wcs=WCS(hdu.header,source)
    if wcs.has_celestial:
     used=np.flatnonzero(wcs.axis_correlation_matrix[[wcs.wcs.lng,wcs.wcs.lat]].any(axis=0))
     if np.array_equal(used,[0,1]):
      spatial=wcs.celestial
      presentation['coordinates']={'kind':'celestial','frame':str(wcs_to_celestial_frame(spatial)),
       'physicalTypes':spatial.world_axis_physical_types,'grid':'native; no reprojection'}
     else:presentation['coordinates']['reason']='Celestial coordinates depend on axes beyond the exported image; no 2D WCS asserted'
    product=spatial.to_fits(relax=True) if spatial is not None else fits.HDUList([fits.PrimaryHDU()])
   presentation['warnings']=[str(n.message) for n in notices]
  product[0].data=values
  header=product[0].header
  if unit is not None:header['BUNIT']=unit.to_string('fits') or '1'
  header['HIERARCH CSSEARTH KIND']=kind
  header['HIERARCH CSSEARTH UNCERTAINTY']=metadata['uncertainty']
  header['HISTORY']=metadata['definition']
  header['HISTORY']='Derived product; selection and source evidence are in output.product.json'
  mask=fits.ImageHDU((~np.isfinite(values)).astype('uint8'),name='MASK')
  mask.header['HISTORY']='1 = missing output value; 0 = usable. Not original DQ bits.'
  product.append(mask)
  if np.isfinite(sigma).any():
   err=fits.ImageHDU(sigma,name='ERR')
   if unit is not None:err.header['BUNIT']=unit.to_string('fits') or '1'
   err.header['HISTORY']='Standard deviation; NaN means unavailable. See uncertainty policy in primary header.'
   product.append(err)
  product.writeto(out/'image.fits',checksum=True);product.close();files.append('image.fits')
  fig,ax=plt.subplots(figsize=(8,5),layout='constrained',subplot_kw={'projection':spatial} if spatial is not None else {})
  lo,hi=float(np.nanmin(values)),float(np.nanmax(values))
  if kind=='feature-map':hi=max(abs(lo),abs(hi));lo=-hi
  norm=ImageNormalize(vmin=lo,vmax=hi,stretch=LinearStretch(),clip=False)
  cmap='RdBu_r' if kind=='feature-map' else 'viridis'
  presentation['normalization']={'owner':'astropy.visualization.ImageNormalize','stretch':'linear','minimum':lo,'maximum':hi,'colormap':cmap,'missing':'transparent'}
  stride=max(1,int(np.ceil(max(values.shape)/1600)))
  preview=values[::stride,::stride]
  presentation['preview']={'method':'nearest sample','stride':stride,'shape':list(preview.shape),'numericProducts':'full native grid; no downsampling'}
  # Preserve source pixel centers, including the last partial stride, for WCSAxes.
  shown=ax.imshow(np.ma.masked_invalid(preview),origin='lower',interpolation='nearest',cmap=cmap,norm=norm,
   extent=(-stride/2,(preview.shape[1]-.5)*stride,-stride/2,(preview.shape[0]-.5)*stride))
  ax.set_xlim(-.5,values.shape[1]-.5);ax.set_ylim(-.5,values.shape[0]-.5)
  fig.colorbar(shown,ax=ax,label=unit_label)
  presentation['normalization'].update(minimum=float(norm.vmin),maximum=float(norm.vmax))
  if spatial is not None:
   ax.coords.grid(color='#b8bbc4',alpha=.25,linestyle=':')
   for index,physical in enumerate(spatial.world_axis_physical_types):
    label={'pos.eq.ra':'Right ascension','pos.eq.dec':'Declination'}.get(physical)
    if label:ax.coords[index].set_axislabel(label)
  else:ax.set_xlabel('Image x (zero-based pixel)');ax.set_ylabel('Image y (zero-based pixel)')
  title=r['target']+' — '+kind
  if data['plane'] is not None:title+=f"; plane {data['plane']} ({data['wavelengthsMicrometres'][data['plane']]:.5g} µm)"
  if kind!='image':title+=f"; {data['selection']['band'][0]:g}–{data['selection']['band'][1]:g} µm\n"+data['definition'].split(';')[0]
  ax.set_title(title,fontsize=10);writer.writerow(['x_pixel','y_pixel','value','standard_deviation'])
  for y in range(values.shape[0]):
   for x in range(values.shape[1]):writer.writerow([x,y,number(values[y,x]),number(sigma[y,x])])
 elif kind in ('spectrum','aperture-spectrum'):
  wave=np.asarray(data['wavelengthsMicrometres'],dtype=float)
  if values.ndim!=1 or wave.shape!=values.shape or not np.isfinite(wave).all():raise ValueError('Spectrum coordinate mismatch')
  table=QTable(meta=metadata)
  table['wavelength']=wave*u.um
  table['value']=MaskedColumn(values,mask=~np.isfinite(values),unit=unit)
  table['standard_deviation']=MaskedColumn(sigma,mask=~np.isfinite(sigma),unit=unit)
  table.write(out/'spectrum.ecsv',format='ascii.ecsv');files.append('spectrum.ecsv')
  presentation['coordinates']={'kind':'spectral','owner':'astropy.visualization.quantity_support','wavelengthUnit':'um','valueUnit':data['unit']}
  with quantity_support():
   fig,ax=plt.subplots(figsize=(8,5),layout='constrained')
   plotted_values=values*unit if unit is not None else values
   ax.plot(wave*u.um,plotted_values,color='#d5d7dc',lw=1)
   if np.isfinite(sigma).any():
    low=(values-sigma)*unit if unit is not None else values-sigma
    high=(values+sigma)*unit if unit is not None else values+sigma
    ax.fill_between(wave*u.um,low,high,color='#d5d7dc',alpha=.2,label=data.get('uncertaintyLabel','Recorded ±1σ'));ax.legend(frameon=False,labelcolor='#d5d7dc')
  title=f"{r['target']} — pixel ({data['x']}, {data['y']})" if kind=='spectrum' else f"{r['target']} — aperture {data['selection']['aperture']}\n{data['definition']}"
  ax.set_xlabel('Wavelength ('+u.um.to_string('latex_inline')+')');ax.set_ylabel(unit_label);ax.set_title(title,fontsize=10)
  if kind=='aperture-spectrum' and data['uncertaintyPolicy']=='omit':ax.text(.01,.02,data['uncertaintyLabel'],transform=ax.transAxes,fontsize=8)
  writer.writerow(['wavelength_um','value','standard_deviation'])
  for w,v,e in zip(wave,values,sigma):writer.writerow([w,number(v),number(e)])
 else:raise ValueError('Unknown plot kind')
background=r['selection'].get('figureBackground','transparent')
if background not in ('transparent','opaque'): raise ValueError('figureBackground must be transparent or opaque')
presentation['png']={'background':background,'bounds':'tight','gutterInches':0.12}
fig.savefig(out/'figure.png',dpi=160,transparent=background=='transparent',bbox_inches='tight',pad_inches=.12,metadata={'Software':'Astropy / Matplotlib; css.earth telescope selections'})
fig.savefig(out/'figure.svg',transparent=background=='transparent',bbox_inches='tight',pad_inches=.12,metadata={'Date':None,'Creator':'Astropy / Matplotlib; css.earth telescope selections'})
plt.close(fig)
json.dump({'astropy':astropy.__version__,'matplotlib':matplotlib.__version__,'files':files,'presentation':presentation,'usable':int(np.isfinite(values).sum())},sys.stdout)
`;
export async function plotProduct(directory:string,target:string,data:Record<string,unknown>,source:string,selection:Readonly<Record<string,unknown>>):Promise<Record<string,unknown>> {
  const tc=await astroqueryToolchain();
  return new Promise((accept,reject)=>{
    const child=spawn(tc.python,['-c',PLOT_PYTHON],{env:{...process.env,...tc.env,MPLBACKEND:'Agg'},stdio:['pipe','pipe','pipe']});
    let out='',err='';child.stdout.setEncoding('utf8').on('data',text=>{out+=text;});child.stderr.setEncoding('utf8').on('data',text=>{err+=text;});
    child.on('error',reject);child.on('close',code=>{
      if(code!==0)return reject(new Error(`Plot failed: ${err.slice(-2000)}`));
      try{const result=requireRecord(JSON.parse(out));if(requireString(result.matplotlib)!=='3.11.2'||requireString(result.astropy)!=='8.0.1')throw new Error('Unexpected plotting package version');accept(result);}catch(error){reject(error);}
    });child.stdin.end(JSON.stringify({directory,target,data,source,selection}));
  });
}

/**
 * The compact family views below are deliberately limited to the four native
 * numeric shapes that the Telescope API already exposes.  Astropy supplies
 * units and Matplotlib owns the rendered figure; callers retain selection,
 * calibration and scientific interpretation in their family receipts.
 */
/** Figure background for PNG and SVG outputs: transparent, or opaque in the figure's own face colour. */
export type FigureBackground='transparent'|'opaque';
export interface FigureOptions {readonly figureBackground?:FigureBackground}
export function figureBackground(value:unknown):FigureBackground{if(value!=='transparent'&&value!=='opaque')throw new TypeError('figureBackground must be transparent or opaque.');return value;}
/** A point with an optional 2×2 covariance packed as [xx, xy, yy] in the squared axis unit. */
export interface EllipsePoint {readonly x:number;readonly y:number;readonly label?:string;readonly covariance?:readonly [number,number,number]}
/** One drawn contour: k times the 1σ covariance ellipse, full axis lengths, major-axis angle in degrees from +x toward +y. */
export interface DrawnEllipse {readonly label:string;readonly sigma:number;readonly x:number;readonly y:number;readonly width:number;readonly height:number;readonly angleDeg:number}
export type NumericPreview =
  | { readonly kind:'series'; readonly title:string; readonly xLabel:string; readonly yLabel:string; readonly series:readonly {readonly label:string;readonly x:readonly number[];readonly y:readonly number[];readonly uncertainty?:readonly (number|null)[];readonly upperLimit?:readonly boolean[]}[] }
  | { readonly kind:'scatter'; readonly title:string; readonly xLabel:string; readonly yLabel:string; readonly points:readonly {readonly x:number;readonly y:number;readonly label?:string}[] }
  | { readonly kind:'scatter-ellipses'; readonly title:string; readonly xLabel:string; readonly yLabel:string; readonly points:readonly EllipsePoint[]; readonly origin?:{readonly label:string;readonly covariance?:readonly [number,number,number]}; readonly sigmaLevels?:readonly number[]; readonly invertX?:boolean }
  | { readonly kind:'histogram'; readonly title:string; readonly xLabel:string; readonly yLabel:string; readonly edges:readonly number[]; readonly counts:readonly number[] }
  | { readonly kind:'raster'; readonly title:string; readonly xLabel:string; readonly yLabel:string; readonly width:number; readonly height:number; readonly values:readonly number[]; readonly colorLabel:string };

const NUMERIC_PREVIEW_PYTHON=String.raw`
import json,sys
from pathlib import Path
import numpy as np
import astropy
from astropy import units as u
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

r=json.load(sys.stdin); d=r['preview']; out=Path(r['directory']); background=r['figureBackground']
if background not in ('transparent','opaque'): raise ValueError('figureBackground must be transparent or opaque')
out.mkdir(parents=True,exist_ok=True)
kind=d['kind']; fig,ax=plt.subplots(figsize=(8,5),layout='constrained')
if kind=='series':
 for s in d['series']:
  x=np.asarray(s['x'],dtype=float); y=np.asarray(s['y'],dtype=float)
  if x.ndim!=1 or y.shape!=x.shape or not np.isfinite(x).all(): raise ValueError('Series coordinates are invalid')
  valid=np.isfinite(y); ax.plot(x[valid],y[valid],lw=1,label=s['label'])
  if 'uncertainty' in s:
   e=np.asarray([np.nan if v is None else v for v in s['uncertainty']],dtype=float)
   if e.shape!=x.shape or np.any(e[np.isfinite(e)]<0): raise ValueError('Series uncertainty is invalid')
   ax.fill_between(x[valid],(y-e)[valid],(y+e)[valid],alpha=.18)
  if 'upperLimit' in s:
   limits=np.asarray(s['upperLimit'],dtype=bool)
   if limits.shape!=x.shape: raise ValueError('Series upper-limit shape is invalid')
   ax.scatter(x[limits & valid],y[limits & valid],marker='v',s=20)
 if len(d['series'])>1: ax.legend(frameon=False)
elif kind=='scatter':
 p=d['points']; x=np.asarray([q['x'] for q in p],dtype=float); y=np.asarray([q['y'] for q in p],dtype=float)
 if x.shape!=y.shape or not np.isfinite(x).all() or not np.isfinite(y).all(): raise ValueError('Scatter coordinates are invalid')
 ax.scatter(x,y,s=16,alpha=.8)
elif kind=='scatter-ellipses':
 from matplotlib.patches import Ellipse
 from matplotlib.lines import Line2D
 levels=np.asarray(d.get('sigmaLevels',[1,2,3]),dtype=float)
 if levels.ndim!=1 or not levels.size or not np.isfinite(levels).all() or np.any(levels<=0) or np.any(np.diff(levels)<=0): raise ValueError('Sigma levels must be positive and increasing')
 alphas=np.linspace(1,.35,len(levels))
 def contour(label,x,y,c):
  c=np.asarray(c,dtype=float)
  if c.shape!=(3,) or not np.isfinite(c).all() or c[0]<=0 or c[2]<=0 or c[0]*c[2]-c[1]**2<=0: raise ValueError('Covariance of '+label+' is not a positive-definite 2x2 block')
  w,v=np.linalg.eigh(np.array([[c[0],c[1]],[c[1],c[2]]])); angle=float(np.degrees(np.arctan2(v[1,1],v[0,1])))
  for k,alpha in zip(levels,alphas):
   width=float(2*k*np.sqrt(w[1])); height=float(2*k*np.sqrt(w[0]))
   ax.add_patch(Ellipse((x,y),width,height,angle=angle,fill=False,lw=1.2,color='C0',alpha=alpha))
   drawn.append({'label':label,'sigma':float(k),'x':x,'y':y,'width':width,'height':height,'angleDeg':angle})
 drawn=[]; p=d['points']; x=np.asarray([q['x'] for q in p],dtype=float); y=np.asarray([q['y'] for q in p],dtype=float)
 if x.shape!=y.shape or not np.isfinite(x).all() or not np.isfinite(y).all(): raise ValueError('Scatter coordinates are invalid')
 origin=d.get('origin')
 if origin is not None:
  ax.axhline(0,ls=':',lw=.8,color='0.45',zorder=1); ax.axvline(0,ls=':',lw=.8,color='0.45',zorder=1)
  if 'covariance' in origin: contour(origin['label'],0.,0.,origin['covariance'])
  ax.scatter([0],[0],marker='*',s=180,color='C1',edgecolors='0.2',linewidths=.6,zorder=4)
  ax.annotate(origin['label'],(0,0),xytext=(7,-13),textcoords='offset points',fontsize=8)
 for q in p:
  if 'covariance' in q: contour(q.get('label',''),float(q['x']),float(q['y']),q['covariance'])
 ax.scatter(x,y,s=22,color='C3',edgecolors='0.2',linewidths=.6,zorder=4)
 for q in p:
  if q.get('label'): ax.annotate(q['label'],(q['x'],q['y']),xytext=(6,5),textcoords='offset points',fontsize=8)
 ax.set_aspect('equal',adjustable='datalim')
 if d.get('invertX'): ax.invert_xaxis()
 if drawn: ax.legend(handles=[Line2D([],[],color='C0',alpha=alpha,label=f'{k:g}σ') for k,alpha in zip(levels,alphas)],frameon=False,fontsize=8)
elif kind=='histogram':
 edges=np.asarray(d['edges'],dtype=float); counts=np.asarray(d['counts'],dtype=float)
 if len(edges)!=len(counts)+1 or not np.isfinite(edges).all() or np.any(np.diff(edges)<=0) or np.any(counts<0): raise ValueError('Histogram bins are invalid')
 ax.stairs(counts,edges,fill=True,alpha=.35)
elif kind=='raster':
 width=int(d['width']); height=int(d['height']); values=np.asarray(d['values'],dtype=float)
 if width<1 or height<1 or values.size!=width*height: raise ValueError('Raster shape is invalid')
 shown=ax.imshow(np.ma.masked_invalid(values.reshape((height,width))),origin='lower',interpolation='nearest',cmap='viridis')
 fig.colorbar(shown,ax=ax,label=d['colorLabel'])
else: raise ValueError('Unknown numeric preview kind')
ax.set_title(d['title'],fontsize=10);ax.set_xlabel(d['xLabel']);ax.set_ylabel(d['yLabel'])
fig.savefig(out/'preview.png',dpi=160,transparent=background=='transparent',bbox_inches='tight',pad_inches=.12,metadata={'Software':'Astropy / Matplotlib; css.earth telescope family preview'})
fig.savefig(out/'preview.svg',transparent=background=='transparent',bbox_inches='tight',pad_inches=.12,metadata={'Date':None,'Creator':'Astropy / Matplotlib; css.earth telescope family preview'})
plt.close(fig)
json.dump({'astropy':astropy.__version__,'matplotlib':matplotlib.__version__,'files':['preview.png','preview.svg'],'kind':kind,'figureBackground':background,**({'ellipses':drawn} if kind=='scatter-ellipses' else {})},sys.stdout)
`;

export async function plotNumericPreview(directory:string,preview:NumericPreview,options:FigureOptions={}):Promise<{readonly astropy:string;readonly matplotlib:string;readonly files:readonly string[];readonly kind:NumericPreview['kind'];readonly figureBackground:FigureBackground;readonly ellipses?:readonly DrawnEllipse[]}> {
  const background=figureBackground(options.figureBackground??'transparent');
  const tc=await astroqueryToolchain();
  return new Promise((accept,reject)=>{
    const child=spawn(tc.python,['-c',NUMERIC_PREVIEW_PYTHON],{env:{...process.env,...tc.env,MPLBACKEND:'Agg'},stdio:['pipe','pipe','pipe']});
    let out='',err='';child.stdout.setEncoding('utf8').on('data',text=>{out+=text;});child.stderr.setEncoding('utf8').on('data',text=>{err+=text;});
    child.on('error',reject);child.on('close',code=>{
      if(code!==0)return reject(new Error(`Numeric preview failed: ${err.slice(-2000)}`));
      try{
        const result=requireRecord(JSON.parse(out));
        if(requireString(result.matplotlib)!=='3.11.2'||requireString(result.astropy)!=='8.0.1')throw new Error('Unexpected plotting package version');
        const files=requireArray(result.files).map((value,index)=>requireString(value,`plot file ${index}`));
        const number=(value:unknown,label:string)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${label} must be finite.`);return value;};
        const ellipses=result.ellipses===undefined?undefined:requireArray(result.ellipses).map((value,index)=>{const row=requireRecord(value);return{label:requireString(row.label,`ellipse ${index} label`),sigma:number(row.sigma,'ellipse sigma'),x:number(row.x,'ellipse x'),y:number(row.y,'ellipse y'),width:number(row.width,'ellipse width'),height:number(row.height,'ellipse height'),angleDeg:number(row.angleDeg,'ellipse angle')};});
        accept({astropy:requireString(result.astropy),matplotlib:requireString(result.matplotlib),files,kind:preview.kind,figureBackground:figureBackground(result.figureBackground),...(ellipses?{ellipses}:{})});
      }catch(error){reject(error);}
    });
    child.stdin.end(JSON.stringify({directory,preview,figureBackground:background}));
  });
}

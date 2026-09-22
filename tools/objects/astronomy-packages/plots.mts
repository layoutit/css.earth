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
export interface EllipsePoint {readonly x:number;readonly y:number;readonly label?:string;readonly covariance?:readonly [number,number,number];
  /** A measured position is drawn as a filled point with bold ellipses; a candidate as an open circle with thin ellipses. */
  readonly role?:'measurement'|'candidate';
  /** Short text drawn inside a candidate's disc in the publication layout, such as a planet's letter. */
  readonly mark?:string;
  /** Ties this point to a body so its colour matches that body's orbit and prediction. */
  readonly series?:string}
/** A polyline drawn behind the points, such as a predicted orbit; it never sets the plot limits. */
export interface PreviewTrack {readonly label:string;readonly points:readonly (readonly [number,number])[];
  /** Ties this line to a body so its colour matches that body's points; several lines may share one series. */
  readonly series?:string}
/** One drawn contour: k times the 1σ covariance ellipse, full axis lengths, major-axis angle in degrees from +x toward +y. */
export interface DrawnEllipse {readonly label:string;readonly sigma:number;readonly x:number;readonly y:number;readonly width:number;readonly height:number;readonly angleDeg:number}
export type NumericPreview =
  | { readonly kind:'series'; readonly title:string; readonly xLabel:string; readonly yLabel:string; readonly series:readonly {readonly label:string;readonly x:readonly number[];readonly y:readonly number[];readonly uncertainty?:readonly (number|null)[];readonly upperLimit?:readonly boolean[]}[] }
  | { readonly kind:'scatter'; readonly title:string; readonly xLabel:string; readonly yLabel:string; readonly points:readonly {readonly x:number;readonly y:number;readonly label?:string}[] }
  | { readonly kind:'scatter-ellipses'; readonly title:string; readonly xLabel:string; readonly yLabel:string; readonly points:readonly EllipsePoint[]; readonly origin?:{readonly label:string;readonly covariance?:readonly [number,number,number]}; readonly sigmaLevels?:readonly number[]; readonly invertX?:boolean; readonly tracks?:readonly PreviewTrack[];
      /** 'publication' draws the layout astrometry papers print; the default is the compact preview. */
      readonly layout?:'preview'|'publication'; readonly measurementLabel?:string }
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

def publication(d):
 # The layout astrometry papers print: square equal-scale axes, a heavy frame with inward ticks on every side, no title,
 # the reference as a star, each body in its own colour for both its orbit draws and its predicted disc, measurements with
 # k-sigma ellipses, and a frameless legend.
 from matplotlib.patches import Ellipse
 from matplotlib.lines import Line2D
 from matplotlib.ticker import AutoMinorLocator
 W,H,L,B,AW,AH=640.,620.,108.,88.,510.,510.
 plt.rcParams.update({'font.family':'DejaVu Sans','mathtext.fontset':'dejavusans'})
 fig=plt.figure(figsize=(W/72,H/72)); fig.patch.set_facecolor('white'); ax=fig.add_axes([L/W,B/H,AW/W,AH/H])
 levels=np.asarray(d.get('sigmaLevels',[1,2,3]),dtype=float); alphas=[1,.55,.3,.2,.15][:len(levels)]
 palette=['#1f77b4','#2ca02c','#ff7f0e','#d62728','#9467bd','#8c564b','#17becf','#7f7f7f']
 order=[]
 for item in list(d.get('tracks',[]))+list(d['points']):
  key=item.get('series')
  if key and key not in order: order.append(key)
 colour={key:palette[index%len(palette)] for index,key in enumerate(order)}
 navy='#000080'; handles=[]; labels=[]; extent=[]
 def half_width(c,k): det=c[0]*c[2]-c[1]**2; return k*np.sqrt(det/c[2])
 def ellipse(x,y,c,k,**kw):
  c=np.asarray(c,dtype=float)
  if c.shape!=(3,) or not np.isfinite(c).all() or c[0]<=0 or c[2]<=0 or c[0]*c[2]-c[1]**2<=0: raise ValueError('Covariance is not a positive-definite 2x2 block')
  w,v=np.linalg.eigh(np.array([[c[0],c[1]],[c[1],c[2]]])); ang=float(np.degrees(np.arctan2(v[1,1],v[0,1])))
  ax.add_patch(Ellipse((x,y),2*k*np.sqrt(w[1]),2*k*np.sqrt(w[0]),angle=ang,fill=False,**kw))
  reach=k*np.sqrt(max(w)); extent.append((x-reach,x+reach,y-reach,y+reach))
  drawn.append({'label':'','sigma':float(k),'x':x,'y':y,'width':float(2*k*np.sqrt(w[1])),'height':float(2*k*np.sqrt(w[0])),'angleDeg':ang})
 bundle={}
 for t in d.get('tracks',[]): bundle[t.get('series') or t['label']]=bundle.get(t.get('series') or t['label'],0)+1
 for t in d.get('tracks',[]):
  q=np.asarray(t['points'],dtype=float)
  if q.ndim!=2 or q.shape[1]!=2 or not np.isfinite(q).all(): raise ValueError('Track '+t['label']+' is not a finite list of points')
  key=t.get('series'); count=bundle.get(key or t['label'],1)
  ax.plot(q[:,0],q[:,1],lw=1.4 if count==1 else 1.1,color=colour.get(key,'0.6'),alpha=1 if count==1 else max(.18,.9/np.sqrt(count)),zorder=1,solid_capstyle='round')
 origin=d.get('origin')
 if origin is not None:
  ax.axhline(0,ls=':',lw=1.5,color='k',zorder=1); ax.axvline(0,ls=':',lw=1.5,color='k',zorder=1)
  ax.plot([0],[0],ls='',marker='*',ms=19.7,mfc='#6baed6',mec='k',mew=1,zorder=6)
 measured=[q for q in d['points'] if q.get('role')!='candidate']
 for q in d['points']:
  x,y=float(q['x']),float(q['y']); face=colour.get(q.get('series'),'#800000' if q.get('role')=='candidate' else navy); extent.append((x,x,y,y))
  if q.get('role')=='candidate':
   if 'covariance' in q:
    for k,a in zip(levels,alphas): ellipse(x,y,q['covariance'],k,lw=1,color=face,alpha=a*.8,zorder=3)
   ax.plot([x],[y],ls='',marker='o',ms=13,mfc=face,mec='0.15',mew=1,zorder=7)
   if q.get('mark'): ax.text(x,y,q['mark'],ha='center',va='center',fontsize=9,fontweight='bold',color='white',zorder=8)
  else:
   if 'covariance' in q:
    for k,a in zip(levels,alphas):
     ellipse(x,y,q['covariance'],k,lw=2 if len(measured)<=2 else 1,color=face,alpha=a,zorder=4)
     # Sigma labels are for a chart of one or two measurements; a run of epochs would bury the figure in them.
     if len(measured)<=2: labels.append((k,a,x-half_width(q['covariance'],k),y,2*half_width(q['covariance'],k),face))
   ax.plot([x],[y],ls='',marker='D',ms=5.5,mfc=face,mec='k',mew=.8,zorder=9)
 ax.set_aspect('equal',adjustable='datalim'); ax.autoscale_view()
 # A square frame on whole ticks around what was drawn, so the reader lands on round numbers.
 # The frame holds the measured and predicted positions; orbit draws are context behind them and never set it,
 # so one badly constrained draw cannot push the bodies into a speck at the middle.
 if extent:
  x0=min(e[0] for e in extent); x1=max(e[1] for e in extent); y0=min(e[2] for e in extent); y1=max(e[3] for e in extent)
 else:
  bounds=ax.dataLim; x0,x1,y0,y1=bounds.x0,bounds.x1,bounds.y0,bounds.y1
 centred=d.get('origin') is not None
 cx,cy=(0.,0.) if centred else ((x0+x1)/2,(y0+y1)/2)
 half=max(abs(x0-cx),abs(x1-cx),abs(y0-cy),abs(y1-cy))*1.12
 magnitude=10**np.floor(np.log10(half)); step=next(v*magnitude for v in (.25,.5,1,2,2.5,5,10) if v*magnitude>=half/2.2)
 half=np.ceil(half/step)*step
 ax.set_xlim(cx-half,cx+half); ax.set_ylim(cy-half,cy+half)
 ax.xaxis.set_major_locator(plt.MultipleLocator(step)); ax.yaxis.set_major_locator(plt.MultipleLocator(step))
 ax.grid(True,which='major',color='0.85',lw=.8,zorder=0)
 if d.get('invertX'): ax.invert_xaxis()
 if d.get('compass',True):
  # North up, east left, drawn where the sky convention is read from.
  ax.annotate('',xy=(.93,.20),xytext=(.93,.075),xycoords='axes fraction',arrowprops=dict(arrowstyle='-|>',color='k',lw=1.6))
  ax.annotate('',xy=(.80,.075),xytext=(.93,.075),xycoords='axes fraction',arrowprops=dict(arrowstyle='-|>',color='k',lw=1.6))
  ax.annotate('N',(.93,.215),xycoords='axes fraction',fontsize=12,ha='center',va='bottom')
  ax.annotate('E',(.785,.075),xycoords='axes fraction',fontsize=12,ha='right',va='center')
 span=max(abs(ax.get_xlim()[1]-ax.get_xlim()[0]),1e-9)
 for k,a,lx,ly,width,face in labels:
  # A contour narrower than a fiftieth of the frame has no room for its own label; the legend still names the levels.
  if width>span/50: ax.annotate(f'{k:g}$\sigma$',(lx,ly),xytext=(4,0),textcoords='offset points',fontsize=11,color=face,alpha=a,va='center',ha='left')
 for key in order: handles.append(Line2D([],[],ls='-',lw=1.2,marker='o',ms=8,mfc=colour[key],mec='k',color=colour[key],label=key))
 if any(q.get('role')!='candidate' for q in d['points']): handles.append(Line2D([],[],ls='',marker='D',ms=5.5,mfc='0.35',mec='k',label=d.get('measurementLabel','measured, with 1–3σ ellipses')))
 if origin is not None: handles.append(Line2D([],[],ls='',marker='*',ms=13,mfc='#6baed6',mec='k',label=origin['label']))
 for side in ax.spines.values(): side.set_linewidth(1.2); side.set_color('0.25')
 ax.xaxis.set_minor_locator(AutoMinorLocator(4)); ax.yaxis.set_minor_locator(AutoMinorLocator(4))
 ax.tick_params(which='major',direction='out',length=6,width=1,top=False,right=False,labelsize=13,pad=5,colors='0.25')
 ax.tick_params(which='minor',direction='out',length=3,width=.8,top=False,right=False,colors='0.25')
 ax.set_xlabel(d['xLabel'],fontsize=16); ax.set_ylabel(d['yLabel'],fontsize=16)
 if handles: ax.legend(handles=handles,frameon=True,framealpha=.9,edgecolor='0.8',fontsize=11,loc='lower left')
 return fig,ax
kind=d['kind']; drawn=[]; published=kind=='scatter-ellipses' and d.get('layout')=='publication'
if published: fig,ax=publication(d)
else: fig,ax=plt.subplots(figsize=(8,5),layout='constrained')
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
elif published: pass
elif kind=='scatter-ellipses':
 from matplotlib.patches import Ellipse
 from matplotlib.lines import Line2D
 levels=np.asarray(d.get('sigmaLevels',[1,2,3]),dtype=float)
 if levels.ndim!=1 or not levels.size or not np.isfinite(levels).all() or np.any(levels<=0) or np.any(np.diff(levels)<=0): raise ValueError('Sigma levels must be positive and increasing')
 alphas=np.linspace(1,.35,len(levels))
 def contour(label,x,y,c,role=None):
  c=np.asarray(c,dtype=float)
  if c.shape!=(3,) or not np.isfinite(c).all() or c[0]<=0 or c[2]<=0 or c[0]*c[2]-c[1]**2<=0: raise ValueError('Covariance of '+label+' is not a positive-definite 2x2 block')
  w,v=np.linalg.eigh(np.array([[c[0],c[1]],[c[1],c[2]]])); angle=float(np.degrees(np.arctan2(v[1,1],v[0,1])))
  for k,alpha in zip(levels,alphas):
   width=float(2*k*np.sqrt(w[1])); height=float(2*k*np.sqrt(w[0]))
   ax.add_patch(Ellipse((x,y),width,height,angle=angle,fill=False,lw=.8 if role=='candidate' else 1.2,color='C3' if role=='candidate' else 'C0',alpha=alpha))
   drawn.append({'label':label,'sigma':float(k),'x':x,'y':y,'width':width,'height':height,'angleDeg':angle})
 drawn=[]; p=d['points']; x=np.asarray([q['x'] for q in p],dtype=float); y=np.asarray([q['y'] for q in p],dtype=float)
 if x.shape!=y.shape or not np.isfinite(x).all() or not np.isfinite(y).all(): raise ValueError('Scatter coordinates are invalid')
 origin=d.get('origin')
 if origin is not None:
  ax.axhline(0,ls=':',lw=.8,color='0.45',zorder=1); ax.axvline(0,ls=':',lw=.8,color='0.45',zorder=1)
  if 'covariance' in origin: contour(origin['label'],0.,0.,origin['covariance'])
  ax.scatter([0],[0],marker='*',s=180,color='C1',edgecolors='0.2',linewidths=.6,zorder=4)
  ax.annotate(origin['label'],(0,0),xytext=(-9,-14),textcoords='offset points',fontsize=8,ha='right')
 for q in p:
  if 'covariance' in q: contour(q.get('label',''),float(q['x']),float(q['y']),q['covariance'],q.get('role'))
 roles=np.asarray([q.get('role','') for q in p])
 cand=roles=='candidate'; meas=roles=='measurement'; plain=~(cand|meas)
 if cand.any(): ax.scatter(x[cand],y[cand],s=60,facecolors='C3',edgecolors='0.15',linewidths=.8,zorder=4)
 if meas.any(): ax.scatter(x[meas],y[meas],s=26,color='C0',edgecolors='0.15',linewidths=.6,zorder=5)
 if plain.any(): ax.scatter(x[plain],y[plain],s=22,color='C3',edgecolors='0.2',linewidths=.6,zorder=4)
 for q in p:
  if q.get('label'):
   below=q.get('role')=='measurement'
   ax.annotate(q['label'],(q['x'],q['y']),xytext=(-8,-12) if below else (8,6),textcoords='offset points',fontsize=8,ha='right' if below else 'left',color='C0' if below else '0.1')
 ax.set_aspect('equal',adjustable='datalim')
 tracks=d.get('tracks',[])
 if tracks:
  ax.autoscale_view(); xl,yl=ax.get_xlim(),ax.get_ylim(); pad=.12*max(xl[1]-xl[0],yl[1]-yl[0])
  for t in tracks:
   q=np.asarray(t['points'],dtype=float)
   if q.ndim!=2 or q.shape[1]!=2 or not np.isfinite(q).all(): raise ValueError('Track '+t['label']+' is not a finite list of points')
   ax.plot(q[:,0],q[:,1],lw=.7,color='0.55',zorder=1)
  ax.set_xlim(xl[0]-pad,xl[1]+pad); ax.set_ylim(yl[0]-pad,yl[1]+pad)
 if d.get('invertX'): ax.invert_xaxis()
 handles=[Line2D([],[],color='C0',alpha=alpha,label=f'{k:g}σ') for k,alpha in zip(levels,alphas)] if drawn else []
 if meas.any(): handles.append(Line2D([],[],ls='',marker='o',ms=5,color='C0',markeredgecolor='0.15',label='measured, with its 1–3σ ellipses'))
 if cand.any(): handles.append(Line2D([],[],ls='',marker='o',ms=7,color='C3',markeredgecolor='0.15',label='predicted, with ephemeris 1–3σ'))
 if tracks: handles.append(Line2D([],[],color='0.55',lw=.7,label='predicted orbit'))
 if handles: ax.legend(handles=handles,frameon=False,fontsize=8,loc='best')
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
if not published: ax.set_title(d['title'],fontsize=10);ax.set_xlabel(d['xLabel']);ax.set_ylabel(d['yLabel'])
tight={} if published else {'bbox_inches':'tight','pad_inches':.12}
if published and background=='transparent': ax.set_facecolor('none')
fig.savefig(out/'preview.png',dpi=d.get('canvas',{}).get('dpi',160),transparent=background=='transparent',**tight,metadata={'Software':'Astropy / Matplotlib; css.earth telescope family preview'})
fig.savefig(out/'preview.svg',transparent=background=='transparent',**tight,metadata={'Date':None,'Creator':'Astropy / Matplotlib; css.earth telescope family preview'})
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

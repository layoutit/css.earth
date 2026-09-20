/** Matplotlib owns static scientific figures; the telescope API owns their inputs and receipts. */
import { spawn } from 'node:child_process';
import { astroqueryToolchain } from './toolchain.mts';
import { requireRecord, requireString } from '../../source-values.mts';
export const PLOT_PYTHON = String.raw`
import csv,json,sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import CenteredNorm
r=json.load(sys.stdin); data=r['data']; out=Path(r['directory']); kind=data['kind']
values=np.asarray(data['values'],dtype=float); sigma=np.asarray(data['sigma'],dtype=float)
if not np.isfinite(values).any(): raise ValueError('The requested output contains no usable samples')
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'figure.facecolor':'#181b1f','axes.facecolor':'#181b1f','text.color':'#d5d7dc','axes.labelcolor':'#d5d7dc','xtick.color':'#b8bbc4','ytick.color':'#b8bbc4','axes.edgecolor':'#626770','svg.hashsalt':'cssearth-telescope-output'})
fig,ax=plt.subplots(figsize=(8,5),layout='constrained')
unit=data['unit'] or 'unit not stated'
with (out/'values.csv').open('w',newline='') as file:
 writer=csv.writer(file)
 number=lambda n:float(n) if np.isfinite(n) else ''
 if kind in ('image','band-image','feature-map'):
  if values.ndim!=2:raise ValueError('Expected a two-dimensional image')
  style={'cmap':'RdBu_r','norm':CenteredNorm(vcenter=0)} if kind=='feature-map' else {'cmap':'viridis'}
  shown=ax.imshow(values,origin='lower',interpolation='nearest',**style)
  fig.colorbar(shown,ax=ax,label=unit);ax.set_xlabel('Image x (zero-based pixel)');ax.set_ylabel('Image y (zero-based pixel)')
  title=r['target']+' — '+kind
  if data['plane'] is not None:title+=f"; plane {data['plane']} ({data['wavelengthsMicrometres'][data['plane']]:.5g} µm)"
  if kind!='image':title+=f"; {data['selection']['band'][0]:g}–{data['selection']['band'][1]:g} µm\n"+data['definition'].split(';')[0]
  ax.set_title(title,fontsize=10);writer.writerow(['x_pixel','y_pixel','value','standard_deviation'])
  for y in range(values.shape[0]):
   for x in range(values.shape[1]):writer.writerow([x,y,number(values[y,x]),number(sigma[y,x])])
 elif kind in ('spectrum','aperture-spectrum'):
  wave=np.asarray(data['wavelengthsMicrometres'],dtype=float)
  if values.ndim!=1 or wave.shape!=values.shape:raise ValueError('Spectrum coordinate mismatch')
  ax.plot(wave,values,color='#d5d7dc',lw=1)
  if np.isfinite(sigma).any():ax.fill_between(wave,values-sigma,values+sigma,color='#d5d7dc',alpha=.2,label=data.get('uncertaintyLabel','Recorded ±1σ'));ax.legend(frameon=False,labelcolor='#d5d7dc')
  title=f"{r['target']} — pixel ({data['x']}, {data['y']})" if kind=='spectrum' else f"{r['target']} — aperture {data['selection']['aperture']}\n{data['definition']}"
  ax.set_xlabel('Wavelength (µm)');ax.set_ylabel(unit);ax.set_title(title,fontsize=10)
  if kind=='aperture-spectrum' and data['uncertaintyPolicy']=='omit':ax.text(.01,.02,data['uncertaintyLabel'],transform=ax.transAxes,fontsize=8)
  writer.writerow(['wavelength_um','value','standard_deviation'])
  for w,v,e in zip(wave,values,sigma):writer.writerow([w,number(v),number(e)])
 else:raise ValueError('Unknown plot kind')
fig.savefig(out/'figure.png',dpi=160,metadata={'Software':'css.earth telescope / Matplotlib'})
fig.savefig(out/'figure.svg',metadata={'Date':None,'Creator':'css.earth telescope / Matplotlib'})
plt.close(fig)
json.dump({'matplotlib':matplotlib.__version__,'files':['figure.png','figure.svg','values.csv'],'usable':int(np.isfinite(values).sum())},sys.stdout)
`;
export async function plotProduct(directory:string,target:string,data:Record<string,unknown>):Promise<Record<string,unknown>> {
  const tc=await astroqueryToolchain();
  return new Promise((accept,reject)=>{
    const child=spawn(tc.python,['-c',PLOT_PYTHON],{env:{...process.env,...tc.env,MPLBACKEND:'Agg'},stdio:['pipe','pipe','pipe']});
    let out='',err='';child.stdout.setEncoding('utf8').on('data',text=>{out+=text;});child.stderr.setEncoding('utf8').on('data',text=>{err+=text;});
    child.on('error',reject);child.on('close',code=>{
      if(code!==0)return reject(new Error(`Plot failed: ${err.slice(-2000)}`));
      try{const result=requireRecord(JSON.parse(out));if(requireString(result.matplotlib)!=='3.11.2')throw new Error('Unexpected Matplotlib version');accept(result);}catch(error){reject(error);}
    });child.stdin.end(JSON.stringify({directory,target,data}));
  });
}

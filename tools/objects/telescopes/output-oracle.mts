/** Test-only, independently implemented references. Never calls the production cube reducer. */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { requireRecord } from '../../source-values.mts';
export const ORACLE_PYTHON=String.raw`
import json,sys,hashlib,csv
from pathlib import Path
import numpy as np
import astropy, specutils, photutils
from astropy import units as u
from astropy.io import fits
from astropy.wcs import WCS
from specutils import Spectrum
from specutils.analysis import line_flux
from photutils.aperture import RectangularAperture, aperture_photometry
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=json.load(sys.stdin); directory=Path(r['directory']); out=Path(r['out'])
record=json.loads((directory/'output.product.json').read_text()); selection=record['parameters']['selection']; kind=selection['kind']
for item in record['outputs']:
    if hashlib.sha256((directory/item['path']).read_bytes()).hexdigest()!=item['sha256']: raise ValueError('Output pin mismatch')
delivery=next(i for i in record['inputs'] if i['role']=='delivery'); path=Path(delivery['identity'])
if hashlib.sha256(path.read_bytes()).hexdigest()!=delivery['sha256']: raise ValueError('Delivery pin mismatch')
d=json.loads(path.read_text()); source=path.parent/d['product']; pin=next(i for i in d['files'] if i['path']==d['product'])
if hashlib.sha256(source.read_bytes()).hexdigest()!=pin['sha256']: raise ValueError('Source pin mismatch')
with fits.open(source) as hdus:
    h=hdus[selection['hdu']]; data=np.array(h.data,dtype=float); header=h.header
    if data.ndim!=3: raise ValueError('This oracle currently checks three-dimensional FITS cubes')
    unit=u.Unit(header['BUNIT']); mask=~np.isfinite(data)
    if 'DQ' in hdus: mask|=hdus['DQ'].data!=0
    if 'ERR' in hdus: mask|=~np.isfinite(hdus['ERR'].data)|(hdus['ERR'].data<0)
    w=WCS(header,hdus,fix=False); sw=w.wcs.spec
    if sw!=2 or not str(w.wcs.ctype[sw]).startswith('WAVE') or '-TAB' in str(w.wcs.ctype[sw]): raise ValueError('Oracle requires a separable wavelength WCS with bin edges')
    n=data.shape[0]
    def wave(p):
        coordinates=np.tile(w.wcs.crpix-1,(len(p),1)); coordinates[:,2]=p
        return (w.all_pix2world(coordinates,0)[:,sw]*u.Unit(w.world_axis_units[sw])).to_value(u.um)
    centers=wave(np.arange(n)); edges=wave(np.arange(n+1)-.5)
descending=edges[0]>edges[-1]
if descending: data=data[::-1];mask=mask[::-1];centers=centers[::-1];edges=edges[::-1]

def integrate(array,interval,unit):
    # Supply explicit clipped edges to specutils, without its mask interpolation.
    a,b=interval; chosen=(edges[:-1]<b)&(edges[1:]>a); indices=np.flatnonzero(chosen)
    if not len(indices) or a<edges[0] or b>edges[-1]: raise ValueError('Oracle interval outside source')
    clipped=np.clip(edges[indices[0]:indices[-1]+2],a,b)
    flux=np.moveaxis(np.where(np.isfinite(array[chosen]),array[chosen],0),0,-1)*unit
    # line_flux sums every flux dimension: call it on each one-dimensional spectrum.
    result=np.array([line_flux(Spectrum(flux=vector,spectral_axis=clipped*u.um,bin_specification='edges')).value for vector in flux.reshape(-1,flux.shape[-1])]).reshape(flux.shape[:-1])
    return result,mask[chosen].any(axis=0)

if kind=='image':
    plane=selection['plane']; plane=data.shape[0]-1-plane if descending else plane
    reference=data[plane];bad=mask[plane];expected_unit=unit;owner='Direct Astropy FITS plane'
elif kind=='spectrum':
    x,y=selection['pixel'];reference=data[:,y,x];bad=mask[:,y,x];expected_unit=unit;owner='Direct Astropy FITS pixel spectrum'
elif kind=='band-image':
    reference,bad=integrate(data,selection['band'],unit);reference/=np.diff(selection['band'])[0];expected_unit=unit;owner='specutils.line_flux / band width'
elif kind=='feature-map':
    a,b,c,d=selection['continuum']; low,high=selection['band']
    left,lbad=integrate(data,[a,b],unit);left/=b-a
    right,rbad=integrate(data,[c,d],unit);right/=d-c
    coordinate=centers[:,None,None]
    xleft,_=integrate(coordinate,[a,b],u.dimensionless_unscaled);xleft/=b-a
    xright,_=integrate(coordinate,[c,d],u.dimensionless_unscaled);xright/=d-c
    # Evaluate the continuum independently on the entire cube, then integrate its residual.
    baseline=left+(right-left)*(coordinate-xleft)/(xright-xleft)
    reference,bad=integrate(data-baseline,[low,high],unit);bad|=lbad|rbad
    expected_unit=unit*u.um;owner='specutils.line_flux of continuum-subtracted spectra'
elif kind=='aperture-spectrum':
    def aperture(box):
        x0,y0,x1,y1=box; region=RectangularAperture(((x0+x1-1)/2,(y0+y1-1)/2),x1-x0,y1-y0)
        values=[float(aperture_photometry(np.where(np.isfinite(plane),plane,0),region,method='center')['aperture_sum'][0])/region.area for plane in data]
        return np.array(values),mask[:,y0:y1,x0:x1].any(axis=(1,2))
    reference,bad=aperture(selection['aperture'])
    if selection['background']!='none':
        background,bgmask=aperture(selection['background']);reference-=background;bad|=bgmask
    expected_unit=unit;owner='Photutils rectangular aperture sums / areas'
else: raise ValueError('Unknown output for oracle')
reference=np.where(bad,np.nan,reference)
rows=list(csv.DictReader((directory/'values.csv').open()))
actual=np.array([float(row['value']) if row['value'] else np.nan for row in rows]).reshape(reference.shape)
# CSV follows the original channel order, including descending wavelength cubes.
if kind in ('spectrum','aperture-spectrum') and len(rows)>1 and float(rows[0]['wavelength_um'])>float(rows[-1]['wavelength_um']): actual=actual[::-1]
mask_equal=bool(np.array_equal(np.isfinite(actual),np.isfinite(reference)))
valid=np.isfinite(actual)&np.isfinite(reference)
if not valid.any(): raise ValueError('No comparable valid samples')
delta=actual-reference; maximum=float(np.max(np.abs(delta[valid])));scale=max(float(np.max(np.abs(reference[valid]))),1e-30)
units_equal=u.Unit(record['parameters'].get('measurement',{}).get('unit',record['parameters']['metadata']['units']['value']))==expected_unit
passed=mask_equal and units_equal and maximum<=1e-10*scale
report={'passed':passed,'kind':kind,'reference':owner,'sourceSha256':pin['sha256'],'comparedSamples':int(valid.sum()),'maskEqual':mask_equal,'unitsEqual':bool(units_equal),'maxAbsoluteError':maximum,'maxErrorOverPeak':maximum/scale,'toleranceOverPeak':1e-10,'versions':{'specutils':specutils.__version__,'photutils':photutils.__version__,'astropy':astropy.__version__},'limits':['Independent extraction arithmetic; FITS/WCS decoding still shares Astropy.','This compares values, units and masks, not calibration accuracy or feature significance.','Uncertainty propagation is separately checked against analytic fixtures; this comparison does not validate unknown covariance.']}
plt.rcParams.update({'font.size':10})
if actual.ndim==2:
    fig,axes=plt.subplots(1,3,figsize=(12,4),layout='constrained')
    vmin=float(np.nanmin(reference));vmax=float(np.nanmax(reference))
    for ax,array,title in zip(axes,[actual,reference,delta],['Telescope API',owner,'API − reference']):
        image=ax.imshow(array,origin='lower',interpolation='nearest',cmap='RdBu_r' if title=='API − reference' else 'viridis',**({'vmin':vmin,'vmax':vmax} if title!='API − reference' else {}));fig.colorbar(image,ax=ax,shrink=.65);ax.set_title(title,fontsize=9);ax.set_xlabel('x pixel');ax.set_ylabel('y pixel')
else:
    fig,axes=plt.subplots(2,1,figsize=(9,6),layout='constrained',sharex=True)
    axes[0].plot(centers,actual,label='Telescope API');axes[0].plot(centers,reference,'--',label=owner);axes[0].legend(fontsize=8);axes[0].set_ylabel(str(expected_unit))
    axes[1].plot(centers,delta);axes[1].set_ylabel('API − reference');axes[1].set_xlabel('Wavelength (µm)')
fig.suptitle(f"{kind}: independent arithmetic comparison\nmax |difference| = {maximum:.3g} {expected_unit}")
fig.savefig(out/'comparison.png',dpi=150);plt.close(fig)
(out/'comparison.json').write_text(json.dumps(report,indent=2)+'\n')
json.dump(report,sys.stdout)
if not passed: sys.exit(1)
`;
export async function compareOutput(directory:string,python:string,out:string):Promise<Record<string,unknown>>{
  await mkdir(out,{recursive:true});
  return requireRecord(JSON.parse(execFileSync(python,['-c',ORACLE_PYTHON],{input:JSON.stringify({directory:resolve(directory),out:resolve(out)}),encoding:'utf8',maxBuffer:4*1024*1024})));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [directory,python,out]=process.argv.slice(2);if(!directory||!python||!out)throw new Error('Usage: output-oracle.mts OUTPUT_DIRECTORY ORACLE_PYTHON REPORT_DIRECTORY');
 console.log(JSON.stringify(await compareOutput(directory,python,out)));
}

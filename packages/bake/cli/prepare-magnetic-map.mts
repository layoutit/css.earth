/** Evaluate the published model with its upstream library, then write an existing scalar-map format.
 * node packages/bake/cli/prepare-magnetic-map.mts <source/preparation/magnetic.json> --python=<interpreter>
 * The interpreter needs the versions in magnetic-toolchain.json. PSH is fetched unchanged into output/toolchains. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {requireRecord,requireString,requireFiniteNumber} from '@cssearth/core';
import {sha256} from '@cssearth/core/node';
import {toolchainPython} from '@cssearth/telescope/node';

const root=resolve(import.meta.dirname,'../../..');
const script=String.raw`
import importlib.metadata, importlib.util, json, sys
import numpy as np
from astropy.io import fits
recipe, pins, source, upstream = json.loads(sys.argv[1]), json.loads(sys.argv[2]), sys.argv[3], sys.argv[4]
for name, version in pins['packages'].items():
    if importlib.metadata.version(name) != version: raise ValueError('Install '+name+'=='+version)
if recipe['model'] == 'langlais2019':
    import pyshtools
    coefficients = pyshtools.SHMagCoeffs.from_file(source+'/'+recipe['coefficients'], lmax=134,
        skip=4, r0=3393.5e3, header=False, file_units='nT', units='nT', encoding='utf-8')
    # DH2 with lmax=179 has 0.5-degree nodes, including the duplicated seam and both poles.
    field = coefficients.expand(a=recipe['radiusMeters'], lmax=179, lmax_calc=134, sampling=2, extend=True).rad.data
    rows, columns = field.shape
    lon, lat = np.meshgrid(np.linspace(0,360,columns), np.linspace(-90,90,rows))
    np.savetxt(source+'/'+recipe['output'], np.column_stack((lon.ravel(),lat.ravel(),field[::-1].ravel())),
        header='VARIABLES = "Longitude" "Latitude" "Br (nT)"\nZONE I='+str(columns)+', J='+str(rows)+'\nDATAPACKING=POINT', comments='', fmt='%.10g')
else:
    module = importlib.util.spec_from_file_location('psh',upstream)
    psh = importlib.util.module_from_spec(module); module.loader.exec_module(psh)
    width, height = 720, 360
    lon, beta = np.meshgrid((np.arange(width)+.5)*2*np.pi/width, np.pi/2-(np.arange(height)+.5)*np.pi/height)
    # The shared mesh parameter is beta. Evaluate at the very same ellipsoid points, in System III east longitude.
    a, b = recipe['equatorialRadiusKm'], recipe['polarRadiusKm']
    rho, z = a*np.cos(beta), b*np.sin(beta)
    radius, colat = np.hypot(rho,z)/71492., np.arctan2(rho,z)
    field = psh.jovian_jrm33_order13_internal_rtp(radius.ravel(),colat.ravel(),lon.ravel())[:,0].reshape(height,width)/1e5
    hdu = fits.PrimaryHDU(field.astype('>f4'))
    hdu.header['MODEL']='JRM33'; hdu.header['LMAX']=13; hdu.header['BUNIT']='gauss'; hdu.header['LATTYPE']='PARAMETRIC'
    hdu.header['RADIUS_A']=a; hdu.header['RADIUS_B']=b; hdu.header['LONDIR']='EAST'; hdu.header['QUANTITY']='RADIAL FIELD'
    hdu.writeto(source+'/'+recipe['output'],overwrite=True)
if not np.isfinite(field).all(): raise ValueError('The model returned non-finite values')
print(json.dumps({'model':recipe['model'],'shape':list(field.shape),'minimum':float(field.min()),'maximum':float(field.max())}))
`;

export async function prepareMagneticMap(path:string,python:string){
  const recipe=requireRecord(JSON.parse(await readFile(path,'utf8'))), source=resolve(dirname(path),'..');
  const model=requireString(recipe.model);
  if(!['langlais2019','jrm33'].includes(model))throw new Error('Unknown published magnetic model.');
  const local=(value:unknown)=>{const p=requireString(value);if(!p||p.startsWith('/')||p.includes('\\')||p.split('/').includes('..'))throw new Error('Magnetic map path must stay inside source.');return p;};
  const output=local(recipe.output);
  if(model==='langlais2019'){local(recipe.coefficients);if(requireFiniteNumber(recipe.radiusMeters)!==3393500)throw new Error('Langlais Figure 6 uses the 3393.5 km reference sphere.');}
  else for(const key of ['equatorialRadiusKm','polarRadiusKm'])if(!(requireFiniteNumber(recipe[key])>0))throw new Error('Positive ellipsoid radii required.');
  const pins=requireRecord(JSON.parse(await readFile(resolve(root,'packages/telescope/toolchains/magnetic-toolchain.json'),'utf8')));
  const psh=requireRecord(pins.psh), cache=resolve(root,'output/toolchains/magnetic');await mkdir(cache,{recursive:true});
  const upstream=resolve(cache,'jovian_jrm33_order13_internal_rtp.py');
  if(model==='jrm33'){
    let bytes=await readFile(upstream).catch(()=>null);
    if(!bytes){const response=await fetch(requireString(psh.url));if(!response.ok)throw new Error('PSH download failed: '+response.status);bytes=Buffer.from(await response.arrayBuffer());}
    if(sha256(bytes)!==requireString(psh.sha256))throw new Error('PSH toolchain digest differs.');
    await writeFile(upstream,bytes);
  }
  await mkdir(dirname(resolve(source,output)),{recursive:true});
  const result=await toolchainPython({python,env:{PYTHONNOUSERSITE:'1'}},root,script,[JSON.stringify(recipe),JSON.stringify(pins),source,upstream],resolve(cache,model+'.log'));
  const report=requireRecord(JSON.parse(result.lastLine));requireFiniteNumber(report.minimum);requireFiniteNumber(report.maximum);
  console.log(JSON.stringify(report));return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const path=process.argv[2],python=process.argv.find(arg=>arg.startsWith('--python='))?.slice(9);
  if(!path||!python)throw new Error('Usage: prepare-magnetic-map.mts <recipe> --python=<interpreter>');
  await prepareMagneticMap(resolve(path),resolve(python));
}

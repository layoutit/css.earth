/** Decode through the existing format owners, then hand arrays to Astropy/Matplotlib. */
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pdsPackages } from '../astronomy-packages/pds-client.mts';
import { astroqueryToolchain } from '../astronomy-packages/toolchain.mts';
import { decodeIsis3Core } from '../terrestrial-layers/isis3-raster.mts';
import { isisMetadata,pdsMetadata } from './native-metadata.mts';
import { requireRecord,requireArray,requireString } from '../../source-values.mts';
import type { delivery } from './outputs.mts';
const CONVERT=String.raw`
import json,sys
from pathlib import Path
import numpy as np
from astropy.io import fits
from astropy import units as u
r=json.load(sys.stdin);meta=r['metadata'];path=Path(r['directory'])
a=np.load(path/r['array'],mmap_mode='r') if r['encoding']=='npy' else np.memmap(path/r['array'],mode='r',dtype='<f4',shape=tuple(r['shape']))
h=fits.PrimaryHDU(a);hdus=[h]
def fits_unit(text):
 aliases={'I/F':'1','DIMENSIONLESS':'1','DN':'adu','METER':'m','METERS':'m','W/M**2/SR/NM':'W m-2 sr-1 nm-1'}
 try:return u.Unit(aliases.get(text,text)).to_string('fits') or '1'
 except (ValueError,TypeError):return None
if meta.get('units'):
 unit=fits_unit(meta['units']['value'])
 if unit:h.header['BUNIT']=unit
for companion in r.get('companions',[]):
 b=np.load(path/companion['array'],mmap_mode='r')
 if b.shape!=a.shape:raise ValueError('Native companion shape mismatch')
 if companion['kind']=='DQ':
  finite=np.isfinite(b)
  if np.any(finite & ((b<0)|(b!=np.floor(b)))):raise ValueError('Native quality flags must be nonnegative integers')
  # MASK is explicitly conservative, not a claim to preserve original DQ bits.
  b=(~finite | (b!=0)).astype('uint8')
 c=fits.ImageHDU(b,name='MASK' if companion['kind']=='DQ' else companion['kind'])
 if companion['kind']=='ERR':
  unit=fits_unit(companion.get('unit'))
  if unit:c.header['BUNIT']=unit
 else:c.header['HISTORY']='Conservative quality policy: only finite zero flags are usable; all nonzero flags are excluded.'
 hdus.append(c)
h.header['HISTORY']='Decoded native product. Coordinate/uncertainty limitations and original labels remain in the product record.'
if a.ndim==3 and meta.get('spectral'):
 wave=np.asarray(meta['spectral']['centersMicrometres'])
 if len(wave)!=a.shape[0]:raise ValueError('Native spectral coordinates do not match the leading array axis')
 for key,value in {'CTYPE3':'WAVE-TAB','CUNIT3':'um','CRPIX3':1.,'CRVAL3':1.,'CDELT3':1.,'PS3_0':'WCS-TAB','PS3_1':'WAVE','PV3_1':1,'PV3_3':1}.items():h.header[key]=value
 column=fits.Column(name='WAVE',format=str(len(wave))+'D',dim='(1,'+str(len(wave))+')',array=wave.reshape(1,len(wave),1))
 table=fits.BinTableHDU.from_columns([column],name='WCS-TAB');table.header['EXTVER']=1;hdus.append(table)
fits.HDUList(hdus).writeto(path/'native.fits',checksum=True)
`;
export async function nativeFigureInput(d:Awaited<ReturnType<typeof delivery>>,directory:string,structure?:string){
  if(/\.fits?$/iu.test(d.file)){if(structure)throw new Error('FITS inputs use --hdu');return {file:d.file};}
  const observation=requireRecord(d.producing.parameters.observation),decoder=requireString(observation.decoder);
  const originalLabel=requireString(observation.labelPath);
  const matches=d.files.filter(f=>f.path===originalLabel||f.path.endsWith('/'+originalLabel));
  if(matches.length!==1)throw new Error('Native label is not uniquely pinned in this delivery');
  const label=resolve(d.directory,matches[0].path);
  await mkdir(directory,{recursive:true});let array:string,encoding:string,shape:readonly number[]|undefined,metadata;
  const companions:{kind:string;array:string;unit?:unknown}[]=[];let packages:Record<string,string>={};
  if(decoder==='isis3'){
    if(structure&&structure!=='IsisCube')throw new Error('ISIS structure is IsisCube');
    const labelBytes=await readFile(label),core=decodeIsis3Core(await readFile(d.file),labelBytes);
    const threshold=Buffer.from('faff7fff','hex').readFloatLE();
    for(let i=0;i<core.data.length;i++)if(core.data[i]<threshold)core.data[i]=NaN;
    array='native.f32';encoding='f32';shape=core.bands===1?[core.height,core.width]:[core.bands,core.height,core.width];
    const bytes=Buffer.alloc(core.data.length*4);for(let i=0;i<core.data.length;i++)bytes.writeFloatLE(core.data[i],i*4);
    await writeFile(resolve(directory,array),bytes);metadata=isisMetadata(labelBytes,core.bands).nativeMetadata!;
  }else if(decoder==='pds-product'){
    const answer=await pdsPackages({operation:'decode-product',labelPath:label,arrayDirectory:directory});
    const decoded=requireRecord(answer.decoded),arrays=requireArray(decoded.structures).map(v=>requireRecord(v)).filter(v=>v.arrayFile!==undefined);
    const primary=arrays.filter(v=>v.name==='IMAGE');
    const standardImage=primary.length===1&&arrays.every(v=>['IMAGE','SIGMA_MAP_IMAGE','QUALITY_MAP_IMAGE'].includes(String(v.name)));
    const selected=structure?arrays.filter(v=>v.name===structure):standardImage?primary:arrays;
    packages={pdr:answer.pdr};
    if(selected.length===1&&selected[0].name==='IMAGE')for(const [name,kind] of [['SIGMA_MAP_IMAGE','ERR'],['QUALITY_MAP_IMAGE','DQ']]){
      const found=arrays.filter(v=>v.name===name);if(found.length>1)throw new Error('Ambiguous native companion '+name);
      if(found.length===1)companions.push({kind,array:requireString(found[0].arrayFile),unit:requireRecord(found[0].nativeMetadata).unit});
    }
    if(selected.length!==1)throw new Error('Select one native array with --structure: '+arrays.map(v=>v.name).join(', '));
    array=requireString(selected[0].arrayFile);if(!/^native-\d+\.npy$/.test(array))throw new Error('Invalid decoded array path');
    encoding='npy';metadata=pdsMetadata({...decoded,structures:selected}).nativeMetadata!;
  }else throw new Error(`No native figure reader for ${decoder}`);
  const tc=await astroqueryToolchain();
  execFileSync(tc.python,['-c',CONVERT],{input:JSON.stringify({directory,array,encoding,shape,metadata,companions}),env:{...process.env,...tc.env},maxBuffer:1024*1024});
  return {file:resolve(directory,'native.fits'),native:{decoder,structure:metadata.structure,metadata,packages,companions,qualityPolicy:'IMAGE associates SIGMA_MAP_IMAGE as standard deviation and QUALITY_MAP_IMAGE as flags; finite zero flags only. Other structures require explicit selection.',coordinates:'Pixel coordinates; native planetary projection is not converted to celestial WCS.',conversion:'Decoded values and masked special constants; no recalibration. Spectral centers preserved as WAVE-TAB; edges are not inferred.'}};
}

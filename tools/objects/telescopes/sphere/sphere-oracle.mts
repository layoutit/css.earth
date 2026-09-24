/** Independent analytic ray/ellipsoid reference; no PolyCSS geometry is used to draw it. */
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { sha256 } from '../../../../src/platform/sha256.mts';
import { requireRecord, requireArray } from '../../../sources/source-values.mts';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { astroqueryToolchain } from '../../astronomy-packages/toolchain.mts';
import { verifiedProduct } from '../verified-product.mts';
import { parseHTML } from 'linkedom';
import { parsePreparedObjectRuntime, createWorldContextObjectRuntime, parsePreparedWorldContext, worldCameraOf } from '../../../../src/renderers/css/dist/index.js';
import { parsePreparedWorldCameraFrame } from '../../../../src/renderers/css/dist/navigation.js';
export const ORACLE_PYTHON=String.raw`
import json,sys,re,html as html_parser
from pathlib import Path
import numpy as np
from astropy.io import fits
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=json.load(sys.stdin);out=Path(r['out']);html=Path(r['html']).read_text()
prepared=json.loads(html_parser.unescape(re.search(r'<template id="prepared">(.*?)</template>',html).group(1)))
product=json.loads(Path(r['map'],'map.fits.body-map.json').read_text())
nav=json.loads(Path(r['map'],'navigation.json').read_text());a,b,c=nav['radiiKm']; radii=np.array([a,b,c]);scale=240/a
# Orthographic ray/ellipsoid intersection gives an independently drawn reference.
lon,lat=np.radians([(360-product['observations'][0]['subObserver']['westLongitudeDegrees'])%360,product['observations'][0]['subObserver']['latitudeDegrees']]);east=np.array([-np.sin(lon),np.cos(lon),0]);north=np.array([-np.sin(lat)*np.cos(lon),-np.sin(lat)*np.sin(lon),np.cos(lat)]);eye=np.cross(east,north)
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
json.dump({'oracle':'Analytic orthographic ray intersection with pinned triaxial ellipsoid; NumPy / Matplotlib','purpose':'independent projection reference; the HTML uses the existing standard sphere, not this ellipsoid renderer','samplePairsPreserved':True,'emissionMaskVerified':True,'pixelComparison':'not run: reference is not an HTML screenshot','versions':{'numpy':np.__version__,'matplotlib':matplotlib.__version__}},sys.stdout)
`;
export async function sphereOracle(mapRecord:string,sphereRecord:string,measurement:string,out:string){
 const map=await verifiedProduct(mapRecord),sphere=await verifiedProduct(sphereRecord),tc=await astroqueryToolchain();await mkdir(out,{recursive:true});
 const html=await readFile(resolve(sphere.root,'sphere.html'),'utf8');
 const {document}=parseHTML(html);
 const embedded=document.querySelector<HTMLTemplateElement>('template#prepared');
 if(!embedded)throw new Error('Sphere has no prepared object');
 const data=requireRecord(JSON.parse([...embedded.content.childNodes].map(node=>node.textContent??'').join(''))),definition=parsePreparedObjectRuntime(data.definition);
 const frame=parsePreparedWorldCameraFrame(data.worldFrame);
 assert.ok(frame,'Sphere must supply its physical frame');
 createWorldContextObjectRuntime({definition,context:worldCameraOf(parsePreparedWorldContext(data.context)),frame});
 assert.throws(()=>createWorldContextObjectRuntime({definition,context:undefined,frame}));
 const contextPin=sphere.record.inputs.find(input=>input.identity.endsWith('/prepared/world-context.json'));
 assert.ok(contextPin,'Sphere must pin the shared camera context');
 const contextBytes=await readFile(contextPin.identity);
 assert.equal(contextBytes.length,contextPin.bytes);
 assert.deepEqual(data.context,JSON.parse(contextBytes.toString()));
 // The exported document already contains the standard scene; no mount script or JS control binding exists.
 const stage=document.getElementById('stage');
 assert.ok(stage,'Sphere must provide its prepared stage');
 assert.equal(document.querySelectorAll('script').length,0,'No scripts may be exported, including inert script payloads');
 assert.equal(stage.querySelectorAll('[data-prepared-node]').length,definition.tree.nodes.length);
 assert.ok(document.querySelector('.native-drag-sensor'));
 assert.ok(html.includes("script-src 'none'"));
 const controlBinding={nativeResize:true,nativeScroll:true,scripts:0};
 const css=/<style>(.*?)<\/style>/s.exec(html)?.[1]??'';
 assert.ok(css.length>0,'Portable sphere must contain its CSS');
 assert.doesNotMatch(html,/<(?:script|img)\b[^>]*\bsrc\s*=|<link\b[^>]*\brel=["']stylesheet/i);
 assert.doesNotMatch(css,/@import\b/i);
 for(const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))assert.match(match[1],/^data:image\//);
 const assets=requireRecord(definition.assets),images=requireRecord(data.embeddedAssets);
 if(!Array.isArray(assets.entries))throw new Error('Sphere has no resource entries');
 for(const input of assets.entries){const entry=requireRecord(input);assert.match(String(images[String(entry.url)]),/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/);}
 assert.ok(html.includes("connect-src 'none'"),'Document must forbid external network requests');
 const originalPin=sphere.record.inputs.find(input=>input.identity.endsWith('/prepared/runtime.json'));
 if(!originalPin)throw new Error('Sphere does not pin its existing standard runtime');
 const originalBytes=await readFile(originalPin.identity);assert.equal(originalBytes.length,originalPin.bytes);
 const original=requireRecord(JSON.parse(originalBytes.toString()));
 const expectedTree=structuredClone(requireRecord(original.tree));
 const kept=new Set(assets.entries.map(input=>requireRecord(input).key));
 const excluded=requireArray(requireRecord(original.assets).entries).map(input=>requireRecord(input)).filter(entry=>!kept.has(entry.key)).map(entry=>String(entry.url));
 const inactive:string[]=[];
 expectedTree.properties=requireArray(expectedTree.properties).map(input=>{
  const property=requireRecord(input),value=String(property.value);
  const stripped=value.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g,(match,_quote,url:string)=>excluded.includes(url.trim())?'none':match);
  if(stripped!==value)inactive.push(String(property.name));return {...property,value:stripped};
 });
 assert.deepEqual(definition.tree,expectedTree,'Only inactive image URLs may change; geometry and node identity remain exact');
 assert.deepEqual(requireRecord(requireRecord(data.metadata).renderer).inactiveImageProperties??[],inactive);
 for(const key of ['camera','facing','depthPartitions','surfaceHit','sky'] as const)assert.deepEqual(definition[key],original[key],`Standard sphere ${key} changed`);
 const rejected=structuredClone(definition.tree);requireRecord(rejected).camera=-1;
 assert.notDeepEqual(rejected,expectedTree,'Parity check must detect a changed camera owner');
 const sceneParity={runtimeSha256:sha256(originalBytes),contextSha256:sha256(contextBytes),physicalCameraMountValidated:true,missingContextRejected:true,inactiveImageProperties:inactive,unchanged:['tree except inactive image bindings','camera','facing','depthPartitions','surfaceHit','sky'],treeSha256:sha256(JSON.stringify(definition.tree)),mutationRejected:true};
 const result=execFileSync(tc.python,['-c',ORACLE_PYTHON],{env:{...process.env,...tc.env},input:JSON.stringify({map:map.root,html:resolve(sphere.root,'sphere.html'),measurement:resolve(measurement),out:resolve(out)}),encoding:'utf8',maxBuffer:2**20});
 const report={...JSON.parse(result),sceneParity,controlBinding,selfContained:{inlineCss:true,inlineJavaScript:false,embeddedImages:assets.entries.length,networkForbidden:true},inputs:{map:map.pin,sphere:sphere.pin},source:'tools/objects/telescopes/sphere/sphere-oracle.mts'};await writeFile(resolve(out,'sphere-oracle.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(await sphereOracle(...process.argv.slice(2) as [string,string,string,string]));

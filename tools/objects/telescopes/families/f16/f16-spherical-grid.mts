/** Archive spherical physical grids -> the existing cssEarth density-volume package. */
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { astroqueryToolchain } from '@cssearth/telescope/node';
import { sha256 } from '@cssearth/core/node';
import { encodeDensityKtx2 } from '../../../../../src/preparation/volume/acquisition.ts';
import type { FamilyHandler, FamilyOperation } from '../../family-handlers.mts';
import type { DescriptorMember, ProductDescriptor } from '../../product-descriptor.mts';
import { descriptor, stable } from '../common.mts';
import { physicalVolumeEncoding, type PhysicalGridTransfer, type PinnedGridFile } from './f16-cartesian-grid.mts';
import { STEREO_COR1_F16_PROFILE } from '../../observation-families.mts';

export interface SphericalGridContext {
  readonly profileId: typeof STEREO_COR1_F16_PROFILE;
  readonly frame: string;
  readonly frameBasis: string;
  readonly sourceUrl: string;
  readonly citation: string;
  readonly license: string;
  readonly quantity: string;
  readonly unit: string;
  readonly hdu: number;
}
export interface SphericalGridInspection {
  readonly shape: readonly [number, number, number];
  readonly axes: readonly { readonly id: 'radius' | 'latitude' | 'longitude'; readonly length: number; readonly unit: string; readonly first: number; readonly last: number }[];
  readonly validSamples: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly seamMaximumDifference: number;
  readonly dateAverageUtc: string;
  readonly epochJdTt: number;
  readonly metresPerSolarRadius: number;
  readonly astropy: string;
  readonly scipy: string;
}
export interface SphericalDisplayWeight {
  readonly kind: 'radial-smoothstep';
  readonly unit: 'solRad';
  readonly inner: readonly [number, number];
  readonly outer: readonly [number, number];
}
export interface SphericalDisplayFill {
  readonly kind: 'nearest-inner-shell';
  readonly unit: 'solRad';
  readonly innerRadius: number;
  readonly measuredRadius: 1.5;
}
export interface SphericalVolumeResult {
  readonly object: string;
  readonly prepared: string;
  readonly native: string;
  readonly files: readonly string[];
  readonly inspection: SphericalGridInspection;
  readonly resampling: { readonly method: 'trilinear'; readonly size: number; readonly validSamples: number; readonly invalidSamples: number; readonly boundsSolarRadii: readonly [readonly [number, number, number], readonly [number, number, number]] };
  readonly transfer: PhysicalGridTransfer;
  readonly displayWeight?: SphericalDisplayWeight & { readonly path: string; readonly sha256: string; readonly fullSamples: number; readonly partialSamples: number; readonly zeroSamples: number };
  readonly displayFill?: SphericalDisplayFill & { readonly filledSamples: number };
  readonly frame: unknown;
}

const CONTEXT_PREFIX = 'cssearth-spherical-grid-context@1 ';
const python = String.raw`import json,sys,numpy as np,astropy,scipy
from astropy.io import fits
from astropy.time import Time
from scipy.interpolate import RegularGridInterpolator
r=json.load(sys.stdin); h=fits.open(r['path'],memmap=True); ctx=r['context']; image=h[ctx['hdu']]; a=np.asarray(image.data,dtype=np.float64); hdr=image.header
expected={'NAXIS':3,'NAXIS1':361,'NAXIS2':181,'NAXIS3':51,'CTYPE1':'CRLN','CTYPE2':'CRLT','CTYPE3':'HECR','CUNIT1':'deg','CUNIT2':'deg','CUNIT3':'solRad','BUNIT':'cm^-3','INSTRUME':'SECCHI'}
for key,value in expected.items():
 if hdr.get(key)!=value:raise ValueError('STEREO COR1 spherical-grid profile requires %s=%s'%(key,value))
if a.shape!=(51,181,361):raise ValueError('STEREO COR1 array order must be radius, latitude, longitude')
def axis(i,n):return float(hdr['CRVAL%d'%i])+(np.arange(n)+1-float(hdr['CRPIX%d'%i]))*float(hdr['CDELT%d'%i])
lon=axis(1,361); lat=axis(2,181); radius=axis(3,51)
if not np.allclose(lon,np.arange(361)) or not np.allclose(lat,np.arange(-90,91)) or not np.allclose(radius,np.linspace(1.5,4.0,51)):raise ValueError('STEREO COR1 coordinate samples differ from the archive profile')
if not np.all(np.isfinite(a)) or np.any(a<0):raise ValueError('Electron-density samples must be finite and nonnegative')
seam=float(np.max(np.abs(a[:,:,0]-a[:,:,-1])))
if seam!=0:raise ValueError('Longitude 0/360 seam is not periodic')
date=str(hdr.get('DATE-AVG','')).strip()
if not date:raise ValueError('STEREO COR1 profile requires DATE-AVG')
# FITS 4.0: absent TIMESYS defaults to UTC. Convert the retained archive midpoint to TT for the renderer frame.
scale=str(hdr.get('TIMESYS','UTC')).strip().lower()
if scale!='utc':raise ValueError('STEREO COR1 profile currently requires UTC/default-UTC DATE-AVG')
epoch=float(Time(date,format='fits',scale='utc').tt.jd)
inspection={'shape':[51,181,361],'axes':[{'id':'radius','length':51,'unit':'solRad','first':float(radius[0]),'last':float(radius[-1])},{'id':'latitude','length':181,'unit':'deg','first':float(lat[0]),'last':float(lat[-1])},{'id':'longitude','length':361,'unit':'deg','first':float(lon[0]),'last':float(lon[-1])}],'validSamples':int(a.size),'minimum':float(a.min()),'maximum':float(a.max()),'seamMaximumDifference':seam,'dateAverageUtc':date+'Z','epochJdTt':epoch,'metresPerSolarRadius':float(__import__('astropy.units').units.Unit('solRad').to('m')),'astropy':astropy.__version__,'scipy':scipy.__version__}
if r['operation']=='inspect':json.dump(inspection,sys.stdout);raise SystemExit
n=int(r['size'])
if n<32 or n>192:raise ValueError('Cartesian resampling size must be between 32 and 192')
t=r['transfer']; lo=float(t['range'][0]); hi=float(t['range'][1])
if not lo<hi:raise ValueError('Display range must increase')
rmax=float(radius[-1]); step=2*rmax/n; xyz=-rmax+(np.arange(n)+.5)*step
interpolator=RegularGridInterpolator((radius,lat,lon),a,method='linear',bounds_error=False,fill_value=np.nan)
cart=np.empty((n,n,n),dtype=np.float32)
xx,yy=np.meshgrid(xyz,xyz,indexing='xy')
for zi,z in enumerate(xyz):
 rr=np.sqrt(xx*xx+yy*yy+z*z); latitude=np.degrees(np.arcsin(np.divide(z,rr,out=np.zeros_like(rr),where=rr>0))); longitude=np.mod(np.degrees(np.arctan2(yy,xx)),360.0)
 points=np.column_stack((rr.ravel(),latitude.ravel(),longitude.ravel()));cart[zi]=interpolator(points).reshape(n,n).astype(np.float32)
valid=np.isfinite(cart); display=cart.copy(); rr3=np.sqrt(xyz[None,None,:]**2+xyz[None,:,None]**2+xyz[:,None,None]**2); display_fill=None
if r.get('displayFill') is not None:
 d=r['displayFill']; fill=(rr3>=d['innerRadius'])&(rr3<float(d['measuredRadius']))
 zindex,yindex,xindex=np.where(fill); fill_radius=rr3[fill]; fill_latitude=np.degrees(np.arcsin(np.divide(xyz[zindex],fill_radius,out=np.zeros_like(fill_radius),where=fill_radius>0))); fill_longitude=np.mod(np.degrees(np.arctan2(xyz[yindex],xyz[xindex])),360.0)
 display[fill]=interpolator(np.column_stack((np.full(fill_radius.size,float(d['measuredRadius'])),fill_latitude,fill_longitude)))
 display_fill={'kind':'nearest-inner-shell','unit':'solRad','innerRadius':float(d['innerRadius']),'measuredRadius':float(d['measuredRadius']),'filledSamples':int(np.isfinite(display[fill]).sum())}
display_valid=np.isfinite(display); scaled=np.zeros_like(display,dtype=np.float64)
if t['kind']=='log10':
 if lo<=0:raise ValueError('Log10 display range must be positive')
 positive=display_valid&(display>0);scaled[positive]=np.clip((np.log10(display[positive])-np.log10(lo))/(np.log10(hi)-np.log10(lo)),0,1)
else:
 scaled[display_valid]=np.clip((display[display_valid]-lo)/(hi-lo),0,1)
 if t['kind']=='sqrt':scaled[display_valid]=np.sqrt(scaled[display_valid])
weight=np.where(display_valid,1.,0.).astype(np.float32); display_weight=None
if r.get('displayWeight') is not None:
 d=r['displayWeight']
 def smoothstep(edge0,edge1,x):
  q=np.clip((x-edge0)/(edge1-edge0),0.,1.);return q*q*(3.-2.*q)
 weight=(smoothstep(d['inner'][0],d['inner'][1],rr3)*(1.-smoothstep(d['outer'][0],d['outer'][1],rr3))).astype(np.float32)
 weight[~display_valid]=0.
 wh=out.copy() if 'out' in locals() else fits.Header()
 wh['CTYPE1']='X';wh['CTYPE2']='Y';wh['CTYPE3']='Z';wh['CUNIT1']='solRad';wh['CUNIT2']='solRad';wh['CUNIT3']='solRad';wh['CRPIX1']=1.;wh['CRPIX2']=1.;wh['CRPIX3']=1.;wh['CRVAL1']=float(xyz[0]);wh['CRVAL2']=float(xyz[0]);wh['CRVAL3']=float(xyz[0]);wh['CDELT1']=step;wh['CDELT2']=step;wh['CDELT3']=step;wh['BUNIT']='1';wh['EXTNAME']='DISPLAY_OPACITY_WEIGHT';wh['HIERARCH CSSEARTH ROLE']='display-only radial boundary taper';fits.PrimaryHDU(weight,header=wh).writeto(r['displayWeightPath'],overwrite=False)
 display_weight={'kind':'radial-smoothstep','unit':'solRad','inner':d['inner'],'outer':d['outer'],'fullSamples':int((weight==1).sum()),'partialSamples':int(((weight>0)&(weight<1)).sum()),'zeroSamples':int((weight==0).sum())}
# shared-opacity integrates channel 0 as emission; channel 3 is not consulted by that transfer.
# Apply the display-only boundary weight to the encoded emission while retaining the untapered
# floating-point reconstruction in cartesian-grid.fits.
raw=np.zeros(cart.shape+(4,),dtype=np.uint8);raw[...,0]=np.floor(scaled*weight*255+.5).astype(np.uint8);raw[...,3]=np.floor(weight*255+.5).astype(np.uint8);raw.tofile(r['raw'])
out=fits.Header();out['CTYPE1']='X';out['CTYPE2']='Y';out['CTYPE3']='Z';out['CUNIT1']='solRad';out['CUNIT2']='solRad';out['CUNIT3']='solRad';out['CRPIX1']=1.;out['CRPIX2']=1.;out['CRPIX3']=1.;out['CRVAL1']=float(xyz[0]);out['CRVAL2']=float(xyz[0]);out['CRVAL3']=float(xyz[0]);out['CDELT1']=step;out['CDELT2']=step;out['CDELT3']=step;out['BUNIT']='cm^-3';out['HIERARCH CSSEARTH SOURCE']='STEREO COR1 spherical grid';out['HIERARCH CSSEARTH METHOD']='SciPy trilinear spherical-to-Cartesian';fits.PrimaryHDU(cart,header=out).writeto(r['native'],overwrite=False)
json.dump({'inspection':inspection,'resampling':{'method':'trilinear','size':n,'validSamples':int(valid.sum()),'invalidSamples':int(valid.size-valid.sum()),'boundsSolarRadii':[[-rmax,-rmax,-rmax],[rmax,rmax,rmax]]},'dimensions':[n,n,n],**({'displayWeight':display_weight} if display_weight is not None else {}),**({'displayFill':display_fill} if display_fill is not None else {})},sys.stdout)`;

function validateContext(context: SphericalGridContext): SphericalGridContext {
  if (context.profileId !== STEREO_COR1_F16_PROFILE || context.hdu !== 0) throw new TypeError('Unsupported spherical-grid archive profile.');
  for (const [name, value] of Object.entries(context)) if (name !== 'hdu' && typeof value !== 'string') throw new TypeError(`Spherical-grid ${name} must be explicit.`);
  if (new URL(context.sourceUrl).protocol !== 'https:') throw new TypeError('Spherical-grid source URL must be HTTPS.');
  return context;
}
function validateDisplayWeight(value: SphericalDisplayWeight | undefined): SphericalDisplayWeight | undefined {
  if (value === undefined) return undefined;
  const finitePair = (pair: readonly number[]) => pair.length === 2 && pair.every(Number.isFinite) && pair[0]! < pair[1]!;
  if (value.kind !== 'radial-smoothstep' || value.unit !== 'solRad' || !finitePair(value.inner) || !finitePair(value.outer) || value.inner[0] < 1 || value.inner[1] > value.outer[0] || value.outer[1] > 4) throw new TypeError('Spherical display weight must be ordered radial smoothsteps inside 1.0–4.0 solRad.');
  return value;
}
function validateDisplayFill(value: SphericalDisplayFill | undefined): SphericalDisplayFill | undefined {
  if (value === undefined) return undefined;
  if (value.kind !== 'nearest-inner-shell' || value.unit !== 'solRad' || !Number.isFinite(value.innerRadius) || value.innerRadius < 1 || value.innerRadius >= 1.5 || value.measuredRadius !== 1.5) throw new TypeError('Spherical display fill must extend the measured 1.5 solRad shell inward from a finite radius at or above the photosphere.');
  return value;
}
async function run(pin: PinnedGridFile, context: SphericalGridContext, operation: 'inspect' | 'resample', options?: { readonly size: number; readonly transfer: PhysicalGridTransfer; readonly raw: string; readonly native: string; readonly displayWeight?: SphericalDisplayWeight; readonly displayWeightPath?: string; readonly displayFill?: SphericalDisplayFill }): Promise<any> {
  context = validateContext(context);
  const toolchain = await astroqueryToolchain();
  return new Promise((accept, reject) => { const child = spawn(toolchain.python, ['-c', python], { env: { ...process.env, ...toolchain.env }, stdio: ['pipe', 'pipe', 'pipe'] }); let output = '', error = '';
    child.stdout.setEncoding('utf8').on('data', value => output += value); child.stderr.setEncoding('utf8').on('data', value => error += value); child.on('error', reject);
    child.on('close', code => { if (code !== 0) return reject(new Error(`Astropy/SciPy spherical-grid owner failed: ${error.slice(-1500)}`)); try { accept(JSON.parse(output)); } catch (cause) { reject(cause); } });
    child.stdin.end(JSON.stringify({ path: pin.path, context, operation, ...options })); });
}
export async function inspectPhysicalSphericalGrid(pin: PinnedGridFile, context: SphericalGridContext): Promise<SphericalGridInspection> { return run(pin, context, 'inspect'); }
export function contextFromSphericalGridDescriptor(product: ProductDescriptor): SphericalGridContext { const component = product.components.find(value => value.id === 'electron-density'), encoded = component?.calibration.basis.find(value => value.startsWith(CONTEXT_PREFIX)); if (!encoded) throw new TypeError('Spherical-grid descriptor is missing retained source context.'); return validateContext(JSON.parse(encoded.slice(CONTEXT_PREFIX.length))); }
export function describePhysicalSphericalGrid(input: { readonly id: string; readonly member: DescriptorMember; readonly context: SphericalGridContext; readonly inspection: SphericalGridInspection; readonly producingRecord: string; readonly target: string }): ProductDescriptor {
  const context = validateContext(input.context), sampleCount = input.inspection.shape.reduce((a, b) => a * b, 1);
  const axes = input.inspection.axes.map((axis, index) => ({ id: axis.id, index, length: axis.length, role: `physical-${axis.id}`, unit: axis.unit, coordinates: { kind: 'linear' as const, referenceValue: axis.first, referenceIndex: 0, increment: (axis.last - axis.first) / (axis.length - 1) }, frame: context.frame }));
  return descriptor({ schema: 'cssearth-telescope-product-descriptor@1', dataset: { id: stable(input.id, 'spherical grid id'), target: input.target, acquisition: { kind: 'archive', identity: context.sourceUrl }, producingRecord: input.producingRecord, sourceClassifications: [{ term: '3D tomographic coronal electron density on a spherical physical grid', vocabulary: 'STEREO/SECCHI COR1 N3D FITS', version: '2025-05-06', status: 'source' }], families: ['F16'], profiles: [{ handlerId: 'f16-spherical-grid', profileId: STEREO_COR1_F16_PROFILE }] }, members: [input.member], components: [{ id: 'electron-density', name: 'tomographic coronal electron density', families: ['F16'], locations: [{ memberId: input.member.id, hdu: context.hdu }], representation: { kind: 'physical-field', topology: 'grid', samples: sampleCount }, axes, columns: [], quantity: { name: context.quantity, unit: context.unit, semantics: 'Archive reconstruction on Carrington longitude, latitude, and heliocentric-radius coordinates.' }, calibration: { state: 'reconstructed', basis: ['Archive FITS axes, units, periodic seam, finite samples, and default UTC time convention validated by Astropy.', CONTEXT_PREFIX + JSON.stringify(context)] }, uncertainty: { form: 'none-supplied', basis: 'The archive product contains no associated uncertainty array.' }, flags: [{ id: 'finite-nonnegative', meaning: 'Every retained source sample is finite and nonnegative.' }], time: { scale: 'UTC', format: 'FITS DATE-AVG', referenceEpoch: input.inspection.dateAverageUtc, exposure: 'Tomographic reconstruction interval; not an instantaneous exposure.' }, frame: { kind: 'physical', name: context.frame, referencePosition: 'Sun center', epoch: `JD_TT ${input.inspection.epochJdTt}` }, dependencyIds: [] }], dependencies: [], issues: [{ scope: 'component', identity: 'electron-density-uncertainty', state: 'missing', reason: 'No uncertainty array is supplied; interpolation does not create one.' }, { scope: 'dataset', identity: 'archive-observatory-header', state: 'conflicting', reason: 'The COR1A archive path and release README identify COR1-A while this FITS header reports OBSRVTRY=STEREO_B; telescope identity is not inferred from that conflicting card.' }] });
}
async function files(root: string): Promise<string[]> { return (await Promise.all((await readdir(root, { recursive: true })).map(async path => typeof path === 'string' && (await stat(resolve(root, path))).isFile() ? path : undefined))).filter((path): path is string => path !== undefined).sort(); }
export async function preparePhysicalSphericalVolume(input: { readonly id: string; readonly pin: PinnedGridFile; readonly context: SphericalGridContext; readonly size: number; readonly transfer: PhysicalGridTransfer; readonly displayWeight?: SphericalDisplayWeight; readonly displayFill?: SphericalDisplayFill; readonly destination: string }): Promise<SphericalVolumeResult> {
  const destination = resolve(input.destination), source = resolve(destination, 'source'); await mkdir(source, { recursive: true });
  const displayWeight = validateDisplayWeight(input.displayWeight), displayFill = validateDisplayFill(input.displayFill), rawPath = resolve(source, 'density.rgba'), native = resolve(source, 'cartesian-grid.fits'), displayWeightPath = resolve(source, 'display-weight.fits'), result = await run(input.pin, input.context, 'resample', { size: input.size, transfer: input.transfer, raw: rawPath, native, ...(displayWeight === undefined ? {} : { displayWeight, displayWeightPath }), ...(displayFill === undefined ? {} : { displayFill }) });
  const raw = await readFile(rawPath), dimensions = result.dimensions as [number, number, number]; if (raw.length !== dimensions.reduce((a, b) => a * b, 4)) throw new Error('Spherical-grid resampler emitted an invalid RGBA byte count.');
  const ktx = encodeDensityKtx2({ width: dimensions[0], height: dimensions[1], depth: dimensions[2], encodedRgba: raw }, 9); await writeFile(resolve(source, 'density.ktx2'), ktx);
  const bounds = { min: result.resampling.boundsSolarRadii[0], max: result.resampling.boundsSolarRadii[1] }, context = validateContext(input.context), transferBytes = Buffer.from(JSON.stringify({ schema: 'cssearth-physical-grid-transfer@1', quantity: context.quantity, unit: context.unit, ...input.transfer, source: 'STEREO COR1 electron density resampled by SciPy trilinear interpolation', ...(displayFill === undefined ? {} : { displayFill: result.displayFill }) }, null, 2) + '\n'); await writeFile(resolve(source, 'transfer.json'), transferBytes);
  const provenanceWeightRecord = displayWeight === undefined ? undefined : { ...result.displayWeight, path: 'display-weight.fits', sha256: sha256(await readFile(displayWeightPath)) };
  const provenanceBytes = Buffer.from(JSON.stringify({ schema: 'cssearth-physical-grid-provenance@1', source: { url: context.sourceUrl, citation: context.citation, license: context.license }, meaning: { frame: context.frame, frameBasis: context.frameBasis, quantity: context.quantity, unit: context.unit, sourceGrid: result.inspection.axes }, resampling: result.resampling, transfer: { path: 'transfer.json', sha256: sha256(transferBytes) }, ...(provenanceWeightRecord === undefined ? {} : { displayWeight: provenanceWeightRecord }), ...(displayFill === undefined ? {} : { displayFill: result.displayFill }), limitations: ['Trilinear resampling changes sampling geometry but does not add physical resolution or uncertainty.', 'Voxels outside the measured 1.5–4.0 solar-radius shell are transparent in cartesian-grid.fits.', ...(displayFill === undefined ? [] : ['The display-only inner bridge copies the nearest measured 1.5 solRad angular shell into the coronagraph blind zone; it is visualization continuity, not a measurement.']), ...(provenanceWeightRecord === undefined ? [] : ['The recorded radial smoothstep field modifies display opacity only; cartesian-grid.fits retains the untapered float reconstruction.']), 'RGBA8/KTX2 is a display approximation; cartesian-grid.fits retains resampled float values and NaNs.'] }, null, 2) + '\n'); await writeFile(resolve(source, 'provenance.json'), provenanceBytes);
  const recipe = { schema: 'cssearth-volume-recipe@1', grid: { path: 'density.ktx2', sha256: sha256(ktx), decodedSha256: sha256(raw), dimensions, encoding: physicalVolumeEncoding(input.transfer), bounds }, material: { emission: [{ channel: 0, color: input.transfer.color, strength: input.transfer.strength }], absorption: [], intensityScale: 1, stepScale: 1, exposureGain: 1, emissionTransfer: 'shared-opacity' }, bake: { sliceCounts: { x: 32, y: 32, z: 32 }, unitsPerSourceUnit: 1, imageWidth: dimensions[0], samplesPerSlab: 1, cropTransparent: true, opticalWeight: 1, imageEncoding: { format: 'png' } }, anchors: [], provenance: { path: 'provenance.json', sha256: sha256(provenanceBytes) } }; const recipeBytes = Buffer.from(JSON.stringify(recipe, null, 2) + '\n'); await writeFile(resolve(source, 'volume.json'), recipeBytes);
  const frame = { referenceFrame: context.frame, epochJdTt: result.inspection.epochJdTt, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: result.inspection.metresPerSolarRadius, boundsUnits: bounds }, objectPath = resolve(destination, 'object.json'); await writeFile(objectPath, JSON.stringify({ schema: 'cssearth-object@1', id: stable(input.id, 'spherical volume id'), type: 'density-volume', properties: { volume: frame, preparation: { source: 'source/volume.json' } } }, null, 2) + '\n');
  const { prepareDensityVolumeObject } = await import('#preparation/prepare-volume'), { loadPreparedCssVolume } = await import('@cssearth/renderer/universe'); await prepareDensityVolumeObject({ objectDirectory: destination }); const object = JSON.parse(await readFile(objectPath, 'utf8')); await loadPreparedCssVolume(object, { read: async path => { const bytes = await readFile(resolve(destination, path)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; } });
  const displayWeightRecord = provenanceWeightRecord === undefined ? undefined : { ...provenanceWeightRecord, path: 'source/display-weight.fits' };
  return { object: objectPath, prepared: resolve(destination, 'prepared/volume.json'), native, files: await files(destination), inspection: result.inspection, resampling: result.resampling, transfer: input.transfer, ...(displayWeightRecord === undefined ? {} : { displayWeight: displayWeightRecord }), ...(displayFill === undefined ? {} : { displayFill: result.displayFill }), frame };
}

const out = { id: 'out', option: '--out', kind: 'output-directory' as const, required: true, description: 'New output directory.' };
const operation = (id: 'spherical-grid-inspect' | 'spherical-grid-prepare-volume', label: string, parameters: FamilyOperation['parameters']): FamilyOperation => ({ id, label, handlerId: 'f16-spherical-grid', componentId: 'electron-density', owner: { module: 'tools/objects/telescopes/families/f16/f16-spherical-grid.mts', export: id === 'spherical-grid-inspect' ? 'inspectPhysicalSphericalGrid' : 'preparePhysicalSphericalVolume' }, available: true, reason: 'Astropy validates the archive spherical grid; SciPy resamples it to Cartesian voxels for the existing cssEarth volume preparer.', fixedArguments: {}, parameters: [...parameters, out], limitations: ['The volume is a trilinear display resampling of the reconstructed density field; it does not add uncertainty or physical resolution.'] });
export const F16_SPHERICAL_GRID_HANDLER: FamilyHandler = { id: 'f16-spherical-grid', families: ['F16'], profiles: [{ id: STEREO_COR1_F16_PROFILE, format: 'STEREO/SECCHI COR1 N3D spherical FITS', version: '2025-05-06', families: ['F16'], evidence: [{ path: 'tools/objects/telescopes/families/f16/f16-spherical-grid.test.mts', establishes: 'Real archive FITS validation, spherical-to-Cartesian resampling, standard volume preparation, and loader readback.', status: 'complete' }] }], recognizes: () => [], operations: () => [operation('spherical-grid-inspect', 'Inspect spherical physical grid', []), operation('spherical-grid-prepare-volume', 'Prepare interactive density volume', [{ id: 'size', option: '--size', kind: 'integer', required: true, minimum: 32, description: 'Cartesian cube side length, 32–192.' }, { id: 'transfer', option: '--transfer', kind: 'input-path', required: true, description: 'Explicit linear, sqrt, or log10 display transfer.' }, { id: 'displayWeight', option: '--display-weight', kind: 'input-path', required: false, description: 'Optional typed display-only radial opacity weight; the float science cube remains unchanged.' }, { id: 'displayFill', option: '--display-fill', kind: 'input-path', required: false, description: 'Optional typed display-only bridge across the coronagraph blind zone; the float science cube remains unchanged.' }])] };

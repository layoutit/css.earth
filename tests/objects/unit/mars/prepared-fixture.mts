import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validatePreparedCubicSky} from '../../../../src/platform/cubic-sky-contract.mts';
import {validateDirectionalSunPlan} from '../../../../src/platform/directional-sun-contract.mts';
import {requirePreparedData} from '../../../../src/platform/prepared-presentation-contract.mts';
import {parsePreparedObjectRuntime,requireControls} from '../../../../src/renderers/css/dist/index.js';
import {preparePhotographicAtmosphere} from '../../../../tools/objects/terrestrial-layers/photographic-atmosphere.mts';
import {createEllipsoidGeometry} from '../../../../tools/objects/terrestrial-layers/ellipsoid-geometry.mts';
import {parseEllipsoidProfile} from '../../../../tools/objects/terrestrial-layers/ellipsoid-geometry.mts';
import {parsePhotographicAtmosphere} from '../../../../tools/objects/terrestrial-layers/photographic-atmosphere-source.mts';
import {requireFiniteNumber,requireRecord} from '../../../../tools/source-values.mts';
const sourceDirectory=fileURLToPath(new URL('../../../../src/planets/mars/source/',import.meta.url));
const read=async (path:string):Promise<unknown>=>{const value:unknown=JSON.parse(await readFile(new URL('../../../../src/planets/mars/'+path,import.meta.url),'utf8'));requirePreparedData(value,`Mars fixture ${path}`);return value;};
type MarsAuditScene={readonly retainedDom:{readonly totalLeafCount:number}};
type MarsAuditCamera={readonly stateCount:number|undefined;readonly zoomStateCount:number|undefined;readonly materialDepthContract:Record<string,unknown>};
type MarsAuditLighting={readonly banks:Readonly<Record<string,{readonly transport:Record<string,unknown>}>>};
function requireMarsScene(value:unknown):MarsAuditScene{const scene=requireRecord(value,'Mars prepared body'),retainedDom=requireRecord(scene.retainedDom,'Mars retained DOM');return {retainedDom:{totalLeafCount:requireFiniteNumber(retainedDom.totalLeafCount,'Mars retained leaf count')}};}
function requireMarsCamera(value:unknown):MarsAuditCamera{const camera=requireRecord(value,'Mars prepared camera'),materialDepthContract=requireRecord(camera.materialDepthContract,'Mars material depth contract');const count=(field:string)=>camera[field]===undefined?undefined:requireFiniteNumber(camera[field],`Mars camera ${field}`);return {stateCount:count('stateCount'),zoomStateCount:count('zoomStateCount'),materialDepthContract};}
function requireMarsLighting(value:unknown):MarsAuditLighting{const lighting=requireRecord(value,'Mars prepared lighting'),banks=requireRecord(lighting.banks,'Mars lighting banks');return {banks:Object.fromEntries(Object.entries(banks).map(([density,entry])=>[density,{transport:requireRecord(requireRecord(entry,`Mars lighting bank ${density}`).transport,`Mars lighting bank ${density} transport`)}]))};}
export const runtimeDefinition=parsePreparedObjectRuntime(await read('prepared/runtime.json'));
const checkedControls=(value:unknown)=>{requireControls(value);return value;};
export const objectControls=checkedControls(await read('prepared/controls.json'));
export const PREPARED_MARS_SCENE=requireMarsScene(await read('prepared/body.json')),PREPARED_MARS_CAMERA=requireMarsCamera(await read('prepared/camera.json'));
export const PREPARED_MARS_LIGHTING=requireMarsLighting(await read('prepared/lighting.json')),PREPARED_MARS_LENSES=requireRecord(await read('prepared/surface-lenses.json'),'Mars prepared lenses');
export const PREPARED_MARS_SKY_SUN=validateDirectionalSunPlan(await read('prepared/sun.json')),PREPARED_MARS_STARFIELD=validatePreparedCubicSky(await read('prepared/sky.json'),{requireSun:false});
const preparedContent=requireRecord(await read('prepared/content.json'),'Mars prepared content'),sourceContent=requireRecord(await read('source/content/object.json'),'Mars source content');
export const PREPARED_MARS_TITLE=requireRecord(preparedContent.title,'Mars prepared title'),PREPARED_MARS_PANEL=requireRecord(sourceContent.panel,'Mars source panel');
const shape=parseEllipsoidProfile(await read('source/preparation/ellipsoid.json')),profile=parsePhotographicAtmosphere(await read('source/preparation/atmosphere.json'));
const a=await preparePhotographicAtmosphere({sourceDirectory,profile,geometry:{...shape,...createEllipsoidGeometry(shape)}});
export const MARS_ATMOSPHERE_COLOR=a.ATMOSPHERE_COLOR,MARS_ATMOSPHERE_PROFILE=a.ATMOSPHERE_PROFILE,MARS_ATMOSPHERE_RESPONSE=a.ATMOSPHERE_RESPONSE;
export const MARS_MATERIAL_COVERAGE_SCALE=a.MATERIAL_COVERAGE_SCALE,MARS_MATERIAL_CONTENT_SCALE=a.MATERIAL_CONTENT_SCALE;
export const MARS_PUBLISHED_ATMOSPHERE_REFERENCE=a.PUBLISHED_ATMOSPHERE_REFERENCE;
export const prepareMarsMaterialFrame=a.prepareMaterialFrame,prepareMarsAtmosphereFrame=a.prepareAtmosphereFrame;
export const MARS_MATERIAL_OUTER_RADIUS=a.MATERIAL_OUTER_RADIUS,MARS_SURFACE_REFERENCE_COLOR=a.SURFACE_REFERENCE_COLOR;
export const applyMarsLinearLight=a.applyLinearLight,measurePublishedMarsAtmosphereReference=a.measurePublishedAtmosphereReference;
export const prepareMarsProjectedSilhouette=a.prepareProjectedSilhouette;

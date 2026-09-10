import {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import {parseRadialLoaderConfig} from './radial-source.mts';
// Preparation-only source-model image for archived-camera registration.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadRadialTerrain,requireTerrainMesh} from './radial-terrain.mts';
import {decodeOsirisReflectance,attachSourceGeometry} from './archived-camera.mts';
const [sourceDirectory,cameraPath,imagePath,output] = process.argv.slice(2);
if (!sourceDirectory || !cameraPath || !imagePath || !output || process.argv.length !== 6) throw new TypeError('Usage: camera-reference.mts <source-directory> <camera.json> <image> <output>');
const config=parseRadialLoaderConfig(JSON.parse(await readFile(resolve(sourceDirectory,'preparation/terrestrial.json'),'utf8')));
const camera: unknown=JSON.parse(await readFile(cameraPath,'utf8'));
const source=await createSourceManifest({planetId:config.namespace,planetName:config.displayName ?? config.namespace,sourceRoot:sourceDirectory});
const radial=await loadRadialTerrain({config,sourceDirectory,source});
if (!radial) throw new TypeError("Camera reference requires a source mesh.");
const frame=attachSourceGeometry(decodeOsirisReflectance(await readFile(imagePath),camera,true),requireTerrainMesh(radial.grid));
const pixels=Buffer.alloc(frame.width*frame.height*4);
for(let i=0;i<frame.width*frame.height;i++) {
  const ci=Math.cos(frame.planes.INCIDENCE_ANGLE_IMAGE[i]),ce=Math.cos(frame.planes.EMISSION_ANGLE_IMAGE[i]);
  // Published Lutetia Minnaert term, at this observation's phase. This diagnostic
  // supplies relief for correlation; it never supplies the photographic texture.
  const k=.5505+.005*frame.planes.PHASE_ANGLE_IMAGE[i]*180/Math.PI;
  pixels.writeFloatLE(frame.valid(i)&&ci>0&&ce>0?ci**k*ce**(k-1):0,i*4);
}
await writeFile(output,pixels);

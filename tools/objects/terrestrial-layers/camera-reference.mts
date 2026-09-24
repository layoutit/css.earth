import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { parseRadialLoaderConfig } from './radial-source.mts';
// Preparation-only source-model image for archived-camera registration.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadRadialTerrain } from './radial-terrain.mts';
import { requireTerrainMesh } from './radial-mesh.mts';
import { decodeOsirisReflectance } from './archived-camera.mts';
import { matrixCamera } from '../surface-observations/cameras.mts';
import { castSourceRays } from '../surface-observations/geometry.mts';
const [sourceDirectory,cameraPath,imagePath,output] = process.argv.slice(2);
if (!sourceDirectory || !cameraPath || !imagePath || !output || process.argv.length !== 6) throw new TypeError('Usage: camera-reference.mts <source-directory> <camera.json> <image> <output>');
const config=parseRadialLoaderConfig(JSON.parse(await readFile(resolve(sourceDirectory,'preparation/terrestrial.json'),'utf8')));
const camera: unknown=JSON.parse(await readFile(cameraPath,'utf8'));
const source=await createSourceManifest({objectId:config.namespace,objectName:config.displayName ?? config.namespace,sourceRoot:sourceDirectory});
const radial=await loadRadialTerrain({config,sourceDirectory,source});
if (!radial) throw new TypeError("Camera reference requires a source mesh.");
const decoded=decodeOsirisReflectance(await readFile(imagePath),camera,true),frame=castSourceRays(matrixCamera('archived-closure',decoded.camera),requireTerrainMesh(radial.grid),decoded.width,decoded.height);
const pixels=Buffer.alloc(decoded.width*decoded.height*4);
for(let i=0;i<decoded.width*decoded.height;i++) {
  const ci=Math.cos(frame.incidence(i)),ce=Math.cos(frame.emission(i));
  // Published Lutetia Minnaert term, at this observation's phase. This diagnostic
  // supplies relief for correlation; it never supplies the photographic texture.
  const k=.5505+.005*(frame.phase(i)??NaN)*180/Math.PI;
  pixels.writeFloatLE(frame.reject(i)===null&&ci>0&&ce>0?ci**k*ce**(k-1):0,i*4);
}
await writeFile(output,pixels);

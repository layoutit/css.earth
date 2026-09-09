// Preparation-only source-model image for archived-camera registration.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadRadialTerrain} from './radial-terrain.mjs';
import {decodeOsirisReflectance,attachSourceGeometry} from './archived-camera.mjs';
const [sourceDirectory,cameraPath,imagePath,output] = process.argv.slice(2);
const config=JSON.parse(await readFile(resolve(sourceDirectory,'preparation/terrestrial.json')));
const camera=JSON.parse(await readFile(cameraPath));
const radial=await loadRadialTerrain({config,sourceDirectory,source:{validatePath:async()=>{},manifest:{inputs:[]}}});
const frame=attachSourceGeometry(decodeOsirisReflectance(await readFile(imagePath),camera,true),radial.grid);
const pixels=Buffer.alloc(frame.width*frame.height*4);
for(let i=0;i<frame.width*frame.height;i++) {
  const ci=Math.cos(frame.planes.INCIDENCE_ANGLE_IMAGE[i]),ce=Math.cos(frame.planes.EMISSION_ANGLE_IMAGE[i]);
  // Published Lutetia Minnaert term, at this observation's phase. This diagnostic
  // supplies relief for correlation; it never supplies the photographic texture.
  const k=.5505+.005*frame.planes.PHASE_ANGLE_IMAGE[i]*180/Math.PI;
  pixels.writeFloatLE(frame.valid(i)&&ci>0&&ce>0?ci**k*ce**(k-1):0,i*4);
}
await writeFile(output,pixels);

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { newHorizonsCamera, multiplyCameraMatrices, inverseCameraMatrix } from '@cssearth/bake/objects/layers/terrestrial';
import { array, number, optional, shape, text } from '@cssearth/core';

const source = resolve(process.argv[2] ?? 'src/objects/arrokoth/source');
const path = 'preparation/photography.json';
const profile = shape({mesh:text,references:array(text),frames:array(shape({id:text,image:text,output:text,
  bodyToJ2000:array(array(number)),offsetPixels:array(number)})),
  mvic:optional(shape({image:text,referenceCamera:text,output:text,startTime:text,imageTransform:array(array(number)),references:array(text)}))})(JSON.parse(await readFile(resolve(source,path),'utf8')));
// A cited paper or archive document is named by its URL; a file in the package by its path.
const cite = (path:string) => /^https:\/\//u.test(path) ? {url:path} : {path};
for (const frame of profile.frames) {
  const camera = newHorizonsCamera(await readFile(resolve(source,frame.image)),frame);
  const provenance = [profile.mesh,path,...profile.references].map(cite);
  await writeFile(resolve(source,frame.output),JSON.stringify({...camera,provenance},null,2)+'\n');
}
if (profile.mvic) {
  const mvic=profile.mvic,reference=JSON.parse(await readFile(resolve(source,mvic.referenceCamera),'utf8'));
  const original=shape({matrix:array(array(number)),rayMatrix:array(array(number)),positionKm:array(number),sunDirection:array(number)})(reference);
  const matrix=multiplyCameraMatrices(mvic.imageTransform,original.matrix);
  const provenance=[profile.mesh,path,mvic.referenceCamera,...mvic.references].map(cite);
  await writeFile(resolve(source,mvic.output),JSON.stringify({schema:'cssearth-archived-camera@1',width:300,height:300,startTime:mvic.startTime,
    provenance,matrix,rayMatrix:inverseCameraMatrix(matrix.map(row=>row.slice(0,3))),
    positionKm:original.positionKm,sunDirection:original.sunDirection,referenceCamera:reference,imageTransform:mvic.imageTransform},null,2)+'\n');
}

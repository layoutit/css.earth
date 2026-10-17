/** Preserve accepted pre-slice floats in independently restorable gzip chunks. */
import {createReadStream,createWriteStream,existsSync,mkdirSync,statSync} from 'node:fs';
import {dirname} from 'node:path';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';

export async function packGalaxyInput(source:string,destination:string):Promise<readonly string[]> {
 const size=statSync(source).size,chunk=16*1024*1024,files:string[]=[];
 for(let offset=0,index=0;offset<size;offset+=chunk,index++) {
  const file=size<=chunk?destination:destination.replace(/\.f32\.gz$/u,`-part16m-${String(index).padStart(3,'0')}.f32.gz`);
  mkdirSync(dirname(file),{recursive:true});
  if(!existsSync(file))await pipeline(createReadStream(source,{start:offset,end:Math.min(size,offset+chunk)-1}),createGzip(),createWriteStream(file));
  files.push(file);
  console.log('PACKED GALAXY INPUT',file,statSync(file).size);
 }
 return files;
}

if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]) {
 const [source,destination]=process.argv.slice(2);
 if(!source||!destination)throw new TypeError('Usage: pack-inputs.mts <accepted.f32> <source.f32.gz>');
 await packGalaxyInput(source,destination);
}

import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
export async function writeAtomic(path: string, bytes: Uint8Array | string) {
  await mkdir(dirname(path), {recursive:true});
  const temporary = `${path}.${process.pid}.tmp`;
  try { await writeFile(temporary,bytes); await rename(temporary,path); }
  finally { await rm(temporary,{force:true}); }
}

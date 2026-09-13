import { readdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareNebulaObject } from '../delivery/nebula-objects.js';
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--if-missing')) throw new TypeError('Usage: prepare-nebula-objects [--if-missing]');
const root = process.cwd(), objects = resolve(root,'src/objects');
const results = [];
for (const name of (await readdir(objects)).sort()) {
  const directory = resolve(objects,name);
  try { await access(resolve(directory,'source/delivery.json')); }
  catch(error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue; throw error; }
  results.push(await prepareNebulaObject(root,directory,args.includes('--if-missing')));
}
console.log(`NEBULA_OBJECTS_COMPLETE ${JSON.stringify(results)}`);

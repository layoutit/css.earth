import { readdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareNebulaObject } from '../delivery/nebula-objects.js';
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--research' && arg !== '--if-missing' && !/^--object=[a-z][a-z0-9-]*$/.test(arg)) || args.filter(arg => arg.startsWith('--object=')).length > 1)
  throw new TypeError('Usage: prepare-nebula-objects [--if-missing] [--research] [--object=<id>]');
const selected = args.find(arg => arg.startsWith('--object='))?.slice(9);
const root = process.cwd(), objects = resolve(root,'src/objects');
const results = [];
// The objects folder also holds its guide; only folders can be objects.
for (const name of (await readdir(objects,{ withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
  if (selected && name !== selected) continue;
  const directory = resolve(objects,name);
  try { await access(resolve(directory,'source/delivery.json')); }
  catch(error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue; throw error; }
  results.push(await prepareNebulaObject(root,directory,args.includes('--if-missing'), args.includes('--research')));
}
if (selected && results.length === 0) throw new TypeError(`No nebula delivery is registered for ${selected}.`);
console.log(`NEBULA_OBJECTS_COMPLETE ${JSON.stringify(results)}`);

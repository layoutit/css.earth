/** Explicit export of a delivered and already inspected research result. Does not bake or publish. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { exportCompactCompiler } from '../delivery/compact-compiler-export.js';
import { exportCompactSampled } from '../delivery/compact-sampled.js';
import { exportCompactSymmetry } from '../delivery/compact-symmetry.js';
import { readNebulaDelivery } from '../delivery/nebula-objects.js';
const [argument, ...extra] = process.argv.slice(2);
if (!argument || !/^--object=[a-z0-9][a-z0-9-]*$/.test(argument) || extra.length) throw new TypeError('Usage: export-compact-nebula --object=<id>');
const root = process.cwd(), id = argument.slice(9);
const recipe = readNebulaDelivery(JSON.parse(await readFile(resolve(root, `src/objects/${id}/source/delivery.json`), 'utf8')));
const receipt: unknown = JSON.parse(await readFile(resolve(root, `src/objects/${id}/prepared/delivery.json`), 'utf8'));
if (!receipt || typeof receipt !== 'object' || !('sourceResult' in receipt) || typeof receipt.sourceResult !== 'string' || !/^[a-z0-9-]+$/.test(receipt.sourceResult)) throw new TypeError('Missing delivered research result.');
let pin;
if (recipe.method === 'axial-symmetry') {
  if (!recipe.symmetryDirectory) throw new TypeError('Missing symmetry owner.');
  pin = await exportCompactSymmetry(root, recipe.symmetryDirectory, `src/objects/${id}/source/compact`);
} else if (recipe.compactMethod === 'sampled') {
  pin = await exportCompactSampled(root, receipt.sourceResult, `src/objects/${id}/source/compact`);
} else pin = await exportCompactCompiler(root, id);
console.log(`COMPACT_INPUTS_EXPORTED ${JSON.stringify(pin)}`);
console.log('Inspect the diff and verify replay before updating the delivery input pin.');

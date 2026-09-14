import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareCelestialAssets } from './index.js';

const [id] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: celestial <object-id>.');
const root = process.cwd(); const sourceDirectory = resolve(root, 'src/objects', id, 'source');
const config = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/celestial.json'), 'utf8'));
const result = await prepareCelestialAssets({ sourceDirectory, publicDirectory: resolve(root, '.local/full-json-migration/staged-public', id), outputDirectory: resolve(root, '.local/full-json-migration/staged', id), config });
console.log(JSON.stringify({ id, sky: result.sky.schema, sun: result.sun?.schema ?? null }));

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promoteVolumeLenses } from '../reconstruction/volume-lens-promotion.js';
const [recipe, destination] = process.argv.slice(2);
if (!recipe || !destination) throw new Error('Usage: run.ts promote-volume-lenses <recipe.json> <destination-object-directory>');
console.log(JSON.stringify(await promoteVolumeLenses(process.cwd(), JSON.parse(await readFile(resolve(recipe), 'utf8')), resolve(destination)), null, 2));

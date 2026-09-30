import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promoteVolumeDatasets } from '../../server/workflows/density/volume-dataset-promotion.ts';
const [recipe, destination] = process.argv.slice(2);
if (!recipe || !destination) throw new Error('Usage: run.ts promote-volume-datasets <recipe.json> <destination-object-directory>');
console.log(JSON.stringify(await promoteVolumeDatasets(process.cwd(), JSON.parse(await readFile(resolve(recipe), 'utf8')), resolve(destination)), null, 2));

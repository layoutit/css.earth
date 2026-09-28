/**
 * Write the compact Diviner GCP grids a recipe names (noon and maximum bolometric temperature for the Moon) and their
 * receipt. Usage: node packages/bake/cli/diviner-gcp-grid.mts <recipe.json>; the recipe's paths are relative to its folder.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { convertDivinerGcp, parseGcpRecipe } from '@cssearth/bake/objects/acquisition';

const [recipePath] = process.argv.slice(2);
if (!recipePath) throw new Error('Usage: node packages/bake/cli/diviner-gcp-grid.mts <recipe.json>');
const path = resolve(recipePath);
const receipt = await convertDivinerGcp(dirname(path), parseGcpRecipe(JSON.parse(await readFile(path, 'utf8'))));
console.log(JSON.stringify(receipt.outputs, null, 1));

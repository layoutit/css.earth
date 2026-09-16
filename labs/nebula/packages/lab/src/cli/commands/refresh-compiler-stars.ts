import { mkdir, writeFile, rename } from 'node:fs/promises';
import { refreshCompilerStars } from '../../server/workflows/compiler/refresh-stars.ts';
const [recipePath, previousResultPath, extra] = process.argv.slice(2);
if (!recipePath || !previousResultPath || extra) throw new TypeError('Usage: refresh-compiler-stars <compiler-recipe.json> <existing-result.json>');
const { result, publication, receipt } = await refreshCompilerStars(process.cwd(), recipePath, previousResultPath);
const directory = '.local/nebula-lab/compiler-published'; await mkdir(directory, { recursive: true });
const path = `${directory}/${recipePath.split('/').at(-2)}.json`;
await writeFile(`${path}.pending`, JSON.stringify(publication, null, 2)); await rename(`${path}.pending`, path);
console.log(JSON.stringify({ status: 'CATALOGUE_STARS_READY', id: result.id, selected: receipt.selectedCount, cloud: result.scene.volumeId, publication: path }));

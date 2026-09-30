/**
 * Print a body's registration block, or write it between the markers in the body README. The block and the markers are
 * `registrationBlockFor` and `withRegistrationBlock` in `@cssearth/bake/objects/layers/terrestrial`.
 *
 *   node packages/bake/cli/report-registration.mts <object-id>          print the block
 *   node packages/bake/cli/report-registration.mts <object-id> --write  write it between the markers in the body README
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { registrationBlockFor, withRegistrationBlock } from '@cssearth/bake/objects/layers/terrestrial';

const invoked = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invoked) {
  const [objectId, flag] = process.argv.slice(2);
  if (!objectId || (flag !== undefined && flag !== '--write')) { console.error('usage: node packages/bake/cli/report-registration.mts <object-id> [--write]'); process.exit(2); }
  const directory = resolve(import.meta.dirname, '../../../src/objects', objectId), block = await registrationBlockFor(directory);
  if (block === null) { console.log(`${objectId}: no dataset carries a registration stage.`); process.exit(0); }
  console.log(block);
  if (flag === '--write') {
    const path = resolve(directory, 'README.md'), { readme, replaced } = withRegistrationBlock(await readFile(path, 'utf8'), block);
    if (!replaced) throw new Error(`${objectId}/README.md carries no registration-report markers.`);
    await writeFile(path, readme);
    console.log(`Wrote the block into ${objectId}/README.md.`);
  }
}

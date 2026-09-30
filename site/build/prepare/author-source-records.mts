// Entry script: node site/build/prepare/author-source-records.mts <object-id>. Binds an object's inputs to the source catalogue
// (`authorSourceRecords` in @cssearth/bake/sources), then writes the volume packages' presentations again when a volume's
// manifest changed, since each dataset preview credits its manifest input.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { authorSourceRecords } from '@cssearth/bake/sources';
import { RUNTIME_ASSET_ORIGIN } from '@cssearth/bake/objects/sources';
import { writeVolumePresentations } from './prepare-volume-presentation.mts';

const ids = process.argv.slice(2);
if (ids.length !== 1 || ids[0].startsWith('--')) throw new TypeError('Usage: author-source-records <object-id>');
const root = process.cwd(), manifestPath = resolve(root, 'src/objects', ids[0], 'source/manifest.json'), before = await readFile(manifestPath);
console.log(JSON.stringify(await authorSourceRecords({ root, objectId: ids[0] }), null, 1));
const presentation = await readFile(resolve(root, 'src/objects', ids[0], 'source/presentation.json'), 'utf8').then(text => JSON.parse(text) as { schema?: unknown }, () => null);
if (!before.equals(await readFile(manifestPath)) && presentation?.schema === 'cssearth-volume-presentation-source@2') {
  const results = await writeVolumePresentations({ root, mirrorOrigin: RUNTIME_ASSET_ORIGIN });
  console.log(`Volume presentations written again for the changed manifest: ${results.length} volume packages.`);
}

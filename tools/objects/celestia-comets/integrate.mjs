// Register the reviewed batch in its own object and astronomy records.
import { readFile, writeFile } from 'node:fs/promises';
import { readBodyRecords, writeBodyRecord, prepareBodyRecords } from '../../../packages/astronomy/tools/body-records.mjs';
import { prepareCatalog } from '../../prepare-catalog.mjs';
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const intake = await read('output/celestia-comets/intake.json');
const records = new Map((await readBodyRecords()).map(record => [record.id, record]));
for (const candidate of intake) {
  const directory = `src/planets/${candidate.id}`;
  const model = await read(`${directory}/source/shape/model.json`);
  const content = await read(`${directory}/source/content/object.json`);
  const descriptor = await read(`${directory}/object.json`);
  descriptor.properties.catalog ??= {
    name: content.displayName, classification: 'comet', color: '#b8b6b2', distanceAu: candidate.distanceAu,
    systemName: 'Solar System', description: `${candidate.designation}: ${content.panel.introduction} Illustrative nucleus at Celestia’s catalog scale.`, context: {},
  };
  await writeFile(`${directory}/object.json`, JSON.stringify(descriptor, null, 2) + '\n');
  if (!records.has(candidate.id)) await writeBodyRecord({
    id: candidate.id, classification: 'comet', physical: {
      name: `${candidate.designation} ${content.displayName}`, horizonsCode: candidate.command,
      meanRadiusKm: model.volumeEquivalentRadiusKm, gravitationalParameterKm3PerS2: 0, parent: 'sun',
    },
    physicalNotes: 'Illustrative nucleus at the source catalogue scale; no measured mass.',
    acquisition: { heliocentric: { target: candidate.command, model: 'comet' } },
    comet: candidate.record, cometFixture: candidate.fixture,
  });
}
await prepareBodyRecords();
await prepareCatalog();
console.log(`Registered ${intake.length} comets. Prepare their bodies and navigation images next.`);

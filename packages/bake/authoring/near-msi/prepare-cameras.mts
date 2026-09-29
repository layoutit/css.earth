import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { array, number, shape, text } from '@cssearth/core';
import { mathildeImageCamera, decodeNearMsi } from '@cssearth/bake/objects/layers/terrestrial';
import { pds4Field } from '@cssearth/telescope';

const source = resolve(process.argv[2] ?? 'src/objects/mathilde/source');
const profilePath = 'preparation/near-msi.json';
const profile = shape({ mesh: text, imageGeometry: text, references: array(text), frames: array(shape({
  met: number, filter: text, image: text, raw: text, label: text, output: text,
})) })(JSON.parse(await readFile(resolve(source, profilePath), 'utf8')));
const bytes = (path: string) => readFile(resolve(source, path));
const table = (await bytes(profile.imageGeometry)).toString('utf8');
for (const frame of profile.frames) {
  const label = (await bytes(frame.label)).toString('utf8');
  const startTime = pds4Field(label, 'start_date_time');
  if (!Number.isFinite(Date.parse(startTime)) || pds4Field(label, 'file_name') !== frame.image.split('/').at(-1)) throw new Error('NEAR MSI label does not identify the selected observation.');
  const identity = { met: frame.met, filter: frame.filter, startTime };
  decodeNearMsi(await bytes(frame.image), await bytes(frame.raw), identity);
  const paths = [profile.mesh, profilePath, profile.imageGeometry, frame.image, frame.raw, frame.label, ...profile.references];
  const provenance = paths.map(path => ({ path }));
  const closure = { ...mathildeImageCamera(table, frame.met), ...identity, provenance };
  await writeFile(resolve(source, frame.output), JSON.stringify(closure, null, 2) + '\n');
  console.log(frame.output);
}

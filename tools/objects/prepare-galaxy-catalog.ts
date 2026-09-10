import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePreparedGalaxyCatalog } from '@cssearth/catalog';
import { parseGalaxyRecipe, record, text } from '../../src/preparation/galaxy-catalog/config.js';
import { prepareGalaxyCatalog } from '../../src/preparation/galaxy-catalog/prepare.js';
import { parseGalaxyCsv, parseMembershipTable, readAuthorMetadata } from '../../src/preparation/galaxy-catalog/source.js';
import { verifiedBytes, sha256 } from '../../src/preparation/volume/source.js';
import type { GalaxySource } from '../../src/preparation/galaxy-catalog/types.js';

export async function prepareGalaxyCatalogObject(options: { objectDirectory: string; outputDirectory?: string }) {
  const objectDirectory = resolve(options.objectDirectory), sourceDirectory = resolve(objectDirectory, 'source');
  const recipe = parseGalaxyRecipe(JSON.parse(await readFile(resolve(sourceDirectory, 'catalogue.json'), 'utf8')) as unknown);
  const provenance = record(JSON.parse((await verifiedBytes(sourceDirectory, recipe.provenance)).toString('utf8')) as unknown, 'Catalogue provenance');
  if (!Array.isArray(provenance.sources)) throw new TypeError('Catalogue provenance must list sources.');
  const sources: GalaxySource[] = [];
  for (const value of provenance.sources) {
    const s = record(value, 'Catalogue source');
    const path = text(s.path, 'Source path'), hash = text(s.sha256, 'Source hash');
    const bytes = await verifiedBytes(sourceDirectory, { path, sha256: hash });
    if (bytes.length !== s.bytes) throw new TypeError(`Source byte-count mismatch: ${path}`);
    sources.push({ id: text(s.id, 'Source id'), path, sha256: hash, bytes: bytes.length, url: text(s.url, 'Source URL'), citation: text(s.citation, 'Source citation') });
  }
  const read = async (pin: { path: string; sha256: string; bytes: number }) => {
    const bytes = await verifiedBytes(sourceDirectory, pin);
    if (bytes.length !== pin.bytes) throw new TypeError(`Pinned byte-count mismatch: ${pin.path}`);
    return bytes;
  };
  const rows = parseGalaxyCsv((await read(recipe.catalogue)).toString('utf8'));
  const metadata = readAuthorMetadata(await read(recipe.archive), recipe.archiveInputPrefix, recipe.eligibleTables);
  const membership = parseMembershipTable((await read(recipe.membershipTable)).toString('utf8'));
  const data = prepareGalaxyCatalog(rows, metadata, membership, recipe, sources);
  parsePreparedGalaxyCatalog(data);
  const bytes = Buffer.from(JSON.stringify(data) + '\n');
  const outputDirectory = resolve(options.outputDirectory ?? resolve(objectDirectory, 'prepared')), path = resolve(outputDirectory, 'catalogue.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, bytes); await rename(`${path}.tmp`, path);
  const receipt = { schema: data.schema, path: 'catalogue.json', sha256: sha256(bytes), bytes: bytes.length,
    sourceRows: rows.length, objects: data.objects.length, exclusions: data.exclusions.length,
    localGroup: data.objects.filter(row => row.membership.group === 'local-group').length,
    confirmedLocalGroup: data.objects.filter(row => row.membership.group === 'local-group' && row.status === 'confirmed').length };
  await writeFile(resolve(outputDirectory, 'manifest.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`PREPARED GALAXY CATALOGUE: ${JSON.stringify(receipt)}`);
  return data;
}
if (process.argv[1] && /(?:^|[/\\])prepare-galaxy-catalog\.(?:ts|js|mjs)$/.test(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2] || process.argv[3]) throw new TypeError('Usage: prepare-galaxy-catalog <object-directory>');
  await prepareGalaxyCatalogObject({ objectDirectory: process.argv[2] });
}

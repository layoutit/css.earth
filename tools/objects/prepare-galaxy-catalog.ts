import { parseGalaxyDisplaySampling, prepareGalaxyDisplaySample } from '../../src/preparation/galaxy-catalog/display-sample.js';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePreparedGalaxyCatalog, spatialPublicationId } from '@cssearth/catalog';
import { parseGalaxyRecipe, record, text } from '../../src/preparation/galaxy-catalog/config.js';
import { prepareGalaxyCatalog } from '../../src/preparation/galaxy-catalog/prepare.js';
import { parseGalaxyCsv, parseMembershipTable, readAuthorMetadata } from '../../src/preparation/galaxy-catalog/source.js';
import { verifiedBytes, sha256 } from '@cssearth/volume-bake/compact-inputs/density-grid';
import type { GalaxySource } from '../../src/preparation/galaxy-catalog/types.js';
import { readBibliography } from '../../src/preparation/galaxy-catalog/bibliography.js';

export async function prepareGalaxyCatalogObject(options: { objectDirectory: string; outputDirectory?: string }) {
  const objectDirectory = resolve(options.objectDirectory), sourceDirectory = resolve(objectDirectory, 'source');
  const recipeBytes = await readFile(resolve(sourceDirectory, 'catalogue.json'));
  const recipe = parseGalaxyRecipe(JSON.parse(recipeBytes.toString('utf8')) as unknown);
  const presentation = record(JSON.parse(await readFile(resolve(sourceDirectory, 'presentation.json'), 'utf8')) as unknown, 'Galaxy presentation');
  const sampling = parseGalaxyDisplaySampling(presentation.sampling);
  const provenance = record(JSON.parse((await verifiedBytes(sourceDirectory, recipe.provenance)).toString('utf8')) as unknown, 'Catalogue provenance');
  if (!Array.isArray(provenance.sources)) throw new TypeError('Catalogue provenance must list sources.');
  const sources: GalaxySource[] = [];
  for (const value of provenance.sources) {
    const s = record(value, 'Catalogue source');
    const path = text(s.path, 'Source path'), hash = text(s.sha256, 'Source hash');
    const bytes = await verifiedBytes(sourceDirectory, { path, sha256: hash });
    if (bytes.length !== s.bytes) throw new TypeError(`Source byte-count mismatch: ${path}`);
    const references = path.endsWith('.bib') ? [...readBibliography(bytes.toString('utf8')).values()] : s.references;
    if (references !== undefined && !Array.isArray(references)) throw new TypeError('Source references must be an array.');
    sources.push({ id: text(s.id, 'Source id'), path, sha256: hash, bytes: bytes.length, url: text(s.url, 'Source URL'), citation: text(s.citation, 'Source citation'),
      ...(references ? { references: references.map(value => { const r = record(value, 'Source reference'); return { id: text(r.id, 'Reference id'), catalogueId: spatialPublicationId(text(r.id, 'Reference id')), url: text(r.url, 'Reference URL'), citation: text(r.citation, 'Reference citation') }; }) } : {}) });
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
  const used = new Set(data.objects.flatMap(object => [object.skyPosition.sourceRef, object.distance.sourceRef, object.halfLightRadius?.sourceRef, object.membership.sourceRef]));
  for (const source of sources) if (source.references) source.references = source.references.filter(reference => used.has(reference.id));
  parsePreparedGalaxyCatalog(data);
  const bytes = Buffer.from(JSON.stringify(data) + '\n');
  const outputDirectory = resolve(options.outputDirectory ?? resolve(objectDirectory, 'prepared')), path = resolve(outputDirectory, 'catalogue.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, bytes); await rename(`${path}.tmp`, path);
  const displayBytes = Buffer.from(JSON.stringify(prepareGalaxyDisplaySample(data, sampling), null, 2) + '\n');
  await writeFile(resolve(outputDirectory, 'display-sample.json'), displayBytes);
  const receipt = { schema: data.schema, path: 'catalogue.json', sha256: sha256(bytes), bytes: bytes.length,
    outputs: [{ path: 'catalogue.json', sha256: sha256(bytes), bytes: bytes.length },
      { path: 'display-sample.json', sha256: sha256(displayBytes), bytes: displayBytes.length }],
    sourceRows: rows.length, objects: data.objects.length, exclusions: data.exclusions.length,
    localGroup: data.objects.filter(row => row.membership.group === 'local-group').length,
    confirmedLocalGroup: data.objects.filter(row => row.membership.group === 'local-group' && row.status === 'confirmed').length };
  // The receipt is the context's tracked output inventory and lives beside object.json; nothing under prepared/ is tracked.
  await writeFile(resolve(outputDirectory, '..', 'prepared-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  if (outputDirectory === resolve(objectDirectory, 'prepared')) {
    const descriptor = { schema: 'cssearth-object@1', id: basename(objectDirectory), type: 'galaxy-catalog',
      properties: { preparation: { source: 'source/catalogue.json', sha256: sha256(recipeBytes) } },
      prepared: { format: data.schema, url: 'prepared/catalogue.json', sha256: sha256(bytes) } };
    await writeFile(resolve(objectDirectory, 'object.json'), JSON.stringify(descriptor, null, 2) + '\n');
  }
  console.log(`PREPARED GALAXY CATALOGUE: ${JSON.stringify(receipt)}`);
  return data;
}
if (process.argv[1] && /(?:^|[/\\])prepare-galaxy-catalog\.(?:ts|js|mjs)$/.test(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2] || process.argv[3]) throw new TypeError('Usage: prepare-galaxy-catalog <object-directory>');
  await prepareGalaxyCatalogObject({ objectDirectory: process.argv[2] });
}

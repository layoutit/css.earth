/** One guarded registered-image boundary shared by detection and shape preview jobs. */
import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { readStructureCatalogue, readReviewMap } from '../../../features/observations/models/structures-model.ts';
import { geometryRecord as record, geometryLocalPath } from '../../../features/geometry/jobs-model.ts';

export async function readGeometryLocal(root: string, path: string): Promise<Buffer> {
  if (!geometryLocalPath(path)) throw new TypeError('Invalid local registered resource.');
  const actual = await realpath(resolve(root, path)), offset = relative(await realpath(root), actual);
  if (offset.startsWith('../') || offset === '..' || isAbsolute(offset)) throw new TypeError('Registered resource leaves the repository.');
  return readFile(actual);
}
export async function readGeometryPin(root: string, pin: { path: string }): Promise<Buffer> {
  return readGeometryLocal(root, pin.path);
}
export async function readRegisteredGeometrySource(root: string, cataloguePath: string, imageId: string) {
  const registry: unknown = JSON.parse(await readFile(resolve(root, 'labs/nebula/packages/lab/src/state/processing-subjects.json'), 'utf8'));
  if (!Array.isArray(registry) || !registry.some(row => record(row) && record(row.emissionExperiment) && row.emissionExperiment.observationStructures === cataloguePath))
    throw new TypeError('The structure catalogue is not configured for a lab object.');
  const catalogue = readStructureCatalogue(JSON.parse((await readGeometryLocal(root, cataloguePath)).toString()));
  const image = catalogue.images.find(candidate => candidate.id === imageId);
  if (!image) throw new TypeError('The registered source is no longer in this catalogue.');
  const raw: unknown = JSON.parse((await readGeometryPin(root, { path: `${image.directory}/map.json` })).toString());
  readReviewMap(raw, image);
  if (!record(raw) || !Array.isArray(raw.panels)) throw new TypeError('Registered source panel is missing.');
  const panel = raw.panels.find(item => record(item) && item.id === 'source');
  if (!record(panel) || typeof panel.file !== 'string') throw new TypeError(`Structure map ${image.directory}/map.json names no source panel file.`);
  const source = { path: `${image.directory}/${panel.file}` };
  const bytes = await readGeometryPin(root, source);
  return { image, source, bytes };
}

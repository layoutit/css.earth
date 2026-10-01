import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parsePreparedGalaxyCatalog } from '@cssearth/catalog';
import { parsePreparedClusterCatalog } from '@cssearth/catalog';
import { parsePreparedNebulaCatalog } from '@cssearth/catalog';
import type { PreparedCatalogObject } from '@cssearth/catalog';
import { isHostedDescriptor, parseNavigationDistance } from '@cssearth/objects';
import { isRecord, hasErrorCode } from '@cssearth/core';

const AU_M = 149597870700, PC_M = 3.085677581491367e16;
/** One tenth of a parsec, about 20,000 AU: the far edge of the Oort cloud. */
const PARSEC_THRESHOLD_M = PC_M / 10;
export function prepareSceneDistance(descriptor: unknown) {
  const frame = isRecord(descriptor) && isRecord(descriptor.properties) ? descriptor.properties.worldFrame : null;
  if (!isRecord(frame) || frame.referenceFrame !== 'sun-icrf' || typeof frame.epochJdTt !== 'number' ||
      !Array.isArray(frame.originM) || frame.originM.length !== 3 || !frame.originM.every(value => typeof value === 'number' && Number.isFinite(value))) {
    throw new TypeError('Navigation distance requires a prepared Sun-centred world frame.');
  }
  const meters = Math.hypot(...frame.originM);
  // A package the world's host draws (a galaxy, a cluster, a nebula) sits where its catalogued distance puts it: that distance
  // has no epoch, and may be another subject's (a reflection nebula placed at its star cluster's).
  if (isHostedDescriptor(descriptor)) {
    const catalog = isRecord(descriptor) && isRecord(descriptor.properties) ? descriptor.properties.catalog : null;
    const subject = isRecord(catalog) ? catalog.distanceSubject : undefined;
    return parseNavigationDistance({ ...(subject === undefined ? {} : { subject }), meters, value: meters / PC_M, unit: 'pc', quantity: 'catalogue', referencePoint: 'observer', epochJdTt: null });
  }
  // A body beyond the Solar System is read in parsecs; astronomical units stop meaning anything past the Oort cloud.
  const parsecs = meters >= PARSEC_THRESHOLD_M;
  return parseNavigationDistance({ meters, value: meters / (parsecs ? PC_M : AU_M), unit: parsecs ? 'pc' : 'AU', quantity: 'geometric', referencePoint: 'heliocentre', epochJdTt: frame.epochJdTt });
}

/** Every row of every spatial catalogue (galaxies, clusters, nebulae), in folder order. */
export async function readPreparedCatalogObjects(objectsDirectory: string) {
  const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));
  const objects: PreparedCatalogObject[] = [];
  // Every folder's two catalogue files, read in parallel and parsed below in folder order.
  const names = (await readdir(objectsDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  const files = await Promise.all(names.flatMap(name => ['prepared/catalogue.json', 'source/nebula.json'].map(async path => {
    try { return { path, value: await read(resolve(objectsDirectory, name, path)) }; }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) return null; throw error; }
  })));
  for (const file of files) {
    if (file === null) continue;
    const { path, value } = file;
    if (!isRecord(value)) throw new TypeError('Invalid spatial catalogue.');
    if (value.schema === 'cssearth-galaxy-catalog@1') objects.push(...parsePreparedGalaxyCatalog(value).objects);
    else if (value.schema === 'cssearth-cluster-catalog@1') objects.push(...parsePreparedClusterCatalog(value).objects);
    else if (path === 'source/nebula.json') objects.push(...parsePreparedNebulaCatalog(value).objects);
  }
  return objects;
}

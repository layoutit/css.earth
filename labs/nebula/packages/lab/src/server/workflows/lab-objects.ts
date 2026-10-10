/** The objects the lab opens, as the object commands (`research`, `model`, `stars`) name them: each a `src/objects/<id>`
 * folder a lab subject shows, with the subject's method and solvers. Read from `subjects.json`; derived datasets (a
 * subject with a `sourceSubjectId`) are folders of their own and count once each. */
import { isRecord } from '@cssearth/core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface LabObjectSolvers { kinematics?: string; jointFit?: { recipe: string; structures: string; observations: string }; symmetry?: string }
export interface LabObject {
  /** The `src/objects` folder name. */
  id: string; object: string; kind: 'plates' | 'volume' | 'density';
  /** The subject's configured method (`plates`, `symmetry`, `inference`, `density`). */
  workflow: string; subject: string; name: string;
  /** The subject this dataset belongs to, when it is a second dataset of another nebula. */
  parent?: string; solvers: LabObjectSolvers;
}

export function configuredLabObjects(root: string): LabObject[] {
  const records: unknown = JSON.parse(readFileSync(resolve(root, 'labs/nebula/packages/lab/src/state/subjects.json'), 'utf8'));
  if (!Array.isArray(records)) throw new TypeError('Lab subjects must be a list.');
  const objects = new Map<string, LabObject>();
  for (const record of records) {
    if (!isRecord(record) || typeof record.id !== 'string' || typeof record.workflow !== 'string') continue;
    const owner = isRecord(record.plates) ? record.plates : isRecord(record.siteVolume) ? record.siteVolume : null;
    const object = owner && typeof owner.object === 'string' ? owner.object : typeof record.directory === 'string' ? record.directory : null;
    if (!object || !/^src\/objects\/[a-z0-9][a-z0-9-]*$/.test(object) || objects.has(object)) continue;
    const kind = isRecord(record.plates) ? 'plates' : isRecord(record.siteVolume) ? 'volume' : 'density';
    objects.set(object, { id: object.slice('src/objects/'.length), object, kind, workflow: record.workflow, subject: record.id,
      name: typeof record.name === 'string' ? record.name : record.id,
      ...(typeof record.sourceSubjectId === 'string' ? { parent: record.sourceSubjectId } : {}),
      solvers: isRecord(record.solvers) ? record.solvers as LabObjectSolvers : {} });
  }
  return [...objects.values()];
}
/** One configured object by its folder name; an unknown name lists the known ones. */
export function labObject(root: string, id: string | undefined, usage: string): LabObject {
  if (!id || id.startsWith('-')) throw new TypeError(`Usage: ${usage}`);
  const objects = configuredLabObjects(root), found = objects.find(item => item.id === id);
  if (!found) throw new TypeError(`${id} is not a lab object. Known: ${objects.map(item => item.id).join(', ')}.`);
  return found;
}
/** The site nebulae: every object a subject opens first (its own picker entry), not a second dataset of another. */
export const siteNebulae = (root: string) => configuredLabObjects(root).filter(item => !item.parent);

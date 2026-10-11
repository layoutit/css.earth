import { parseObjectDescriptor } from './parse.js';
import type { ObjectDescriptor } from './descriptor.js';
import { parseDensityVolumeFrame } from './density-volume.js';
import type { DensityVolumeFrame } from './density-volume.js';
import { GALAXY_BACKING_SCHEMA } from './prepared-data/catalogue/galaxy-backing.js';

/** A package that is only one prepared picture on a plane around a body: no page of its own. It draws a zone of its
 * host's system, such as a star's habitable zone laid in the plane of its planets' orbits, while a dataset of the host
 * shows it. The picture is a drawing of published numbers, never imagery of the host. */
export interface PlaneBankDescriptor extends ObjectDescriptor {
  readonly type: 'plane-bank';
  /** The prepared plane, a `cssearth-galaxy-backing@1` payload, relative to the package. */
  readonly url: string;
  /** The body whose system the plane belongs to. */
  readonly host: string;
  /** Where the plane lies: its origin is the host, and the picture is in the frame's XY plane. */
  readonly frame: DensityVolumeFrame;
  /** The opacity the world's orbit lines take while the plane shows whole, when its picture would compete with them. */
  readonly orbitOpacity?: number;
}

export function parsePlaneBankDescriptor(input: unknown): PlaneBankDescriptor {
  const descriptor = parseObjectDescriptor(input);
  const at = `src/objects/${descriptor.id}/object.json`;
  if (descriptor.type !== 'plane-bank') throw new TypeError(`${at}: type is ${descriptor.type}, not plane-bank.`);
  const unknown = Object.keys(descriptor.properties).filter(key => key !== 'preparation' && key !== 'host' && key !== 'frame' && key !== 'orbitOpacity');
  if (unknown.length) throw new TypeError(`${at} properties: unknown ${unknown.join(', ')}; a plane bank has preparation, host, frame and orbitOpacity.`);
  if (descriptor.prepared?.format !== GALAXY_BACKING_SCHEMA) throw new TypeError(`${at}: a plane bank names its prepared ${GALAXY_BACKING_SCHEMA} plane.`);
  const host = descriptor.properties.host;
  if (typeof host !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(host)) throw new TypeError(`${at} properties.host: expected the id of the body the plane surrounds, got ${JSON.stringify(host)}.`);
  const orbitOpacity = descriptor.properties.orbitOpacity;
  if (orbitOpacity !== undefined && !(typeof orbitOpacity === 'number' && orbitOpacity > 0 && orbitOpacity < 1)) throw new TypeError(`${at} properties.orbitOpacity: expected an opacity between 0 and 1, got ${JSON.stringify(orbitOpacity)}.`);
  return Object.freeze({ ...descriptor, type: 'plane-bank', url: descriptor.prepared.url, host, frame: parseDensityVolumeFrame(descriptor.properties.frame),
    ...(orbitOpacity === undefined ? {} : { orbitOpacity }) });
}

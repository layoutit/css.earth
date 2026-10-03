import { parseObjectDescriptor } from './parse.js';
import type { ObjectDescriptor } from './descriptor.js';

/** A package that is only a published catalogue point bank: no page, one dot for each of its points. */
export interface CataloguePointBankDescriptor extends ObjectDescriptor {
  readonly type: 'catalogue-point-bank';
  /** The prepared bank, relative to the package. */
  readonly url: string;
  /** The body whose system the bank belongs to. With a host the dots draw while the host, or a body that orbits it, is
   * selected; without one they draw while the catalogue row that details to the package is. */
  readonly host?: string;
  /** The classification of its host's bodies that the map draws as plain dots and this bank holds: their world rows are in
   * its file, and their places are its dots (the asteroids with a page and no map marker). */
  readonly plainDots?: string;
}

export function parseCataloguePointBankDescriptor(input: unknown): CataloguePointBankDescriptor {
  const descriptor = parseObjectDescriptor(input);
  const at = `src/objects/${descriptor.id}/object.json`;
  if (descriptor.type !== 'catalogue-point-bank') throw new TypeError(`${at}: type is ${descriptor.type}, not catalogue-point-bank.`);
  const unknown = Object.keys(descriptor.properties).filter(key => key !== 'preparation' && key !== 'host' && key !== 'plainDots');
  if (unknown.length) throw new TypeError(`${at} properties: unknown ${unknown.join(', ')}; a catalogue point bank has preparation, host and plainDots.`);
  if (!descriptor.prepared) throw new TypeError(`${at}: a catalogue point bank names its prepared dots.`);
  const host = descriptor.properties.host;
  if (host !== undefined && (typeof host !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(host))) {
    throw new TypeError(`${at} properties.host: expected an object id, got ${JSON.stringify(host)}.`);
  }
  const plainDots = descriptor.properties.plainDots;
  if (plainDots !== undefined && (typeof plainDots !== 'string' || !/^[a-z][a-z-]*$/u.test(plainDots) || host === undefined)) {
    throw new TypeError(`${at} properties.plainDots: expected a classification of its host's bodies, got ${JSON.stringify(plainDots)}${host === undefined ? ' and no host' : ''}.`);
  }
  return Object.freeze({ ...descriptor, type: 'catalogue-point-bank', url: descriptor.prepared.url, ...(host === undefined ? {} : { host }), ...(plainDots === undefined ? {} : { plainDots }) });
}

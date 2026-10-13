/** Pack-time search facts, read without treating writable user state as a checkout. */
import { INVESTIGATION_STATUSES } from '@cssearth/objects';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { SITE_DATA_ROOT } from '../paths.mts';
import type { ChandraObject, SpitzerObject, NamedShippedObject, ReadMark } from './site-target-contracts.mts';

const strings = (value: unknown): string[] => requireArray(value).map(v => requireString(v));
const position = (value: unknown) => {
  const p = requireRecord(value, 'archive sky position');
  return { raDeg: requireFiniteNumber(p.raDeg), decDeg: requireFiniteNumber(p.decDeg), radiusDeg: requireFiniteNumber(p.radiusDeg) };
};
export async function loadSiteTargets(path = resolve(SITE_DATA_ROOT, 'site-targets.json')): Promise<{
  ids: string[]; named: NamedShippedObject[]; sky: ChandraObject[]; chandra: ChandraObject[]; spitzer: SpitzerObject[];
  hosts: Record<string, string[]>; marks: Record<string, [string, ReadMark][]>; opensOn: Record<string, string>;
}> {
  const raw = requireRecord(JSON.parse(await readFile(path, 'utf8')), 'shipped archive search facts');
  const chandra = (value: unknown): ChandraObject[] => requireArray(value).map(v => {
    const o = requireRecord(v), id = requireString(o.id), source = requireString(o.source);
    return { id, source, ...(o.raDeg === undefined ? {} : { raDeg: requireFiniteNumber(o.raDeg), decDeg: requireFiniteNumber(o.decDeg) }) };
  });
  return {
    ids: strings(raw.ids),
    named: requireArray(raw.named).map(v => {
      const o = requireRecord(v);
      return { id: requireString(o.id), names: strings(o.names), ...(o.position === undefined ? {} : { position: position(o.position) }) };
    }),
    sky: chandra(raw.sky), chandra: chandra(raw.chandra),
    spitzer: requireArray(raw.spitzer).map((v): SpitzerObject => {
      const o = requireRecord(v), q = requireRecord(o.query);
      const query: SpitzerObject['query'] = q.kind === 'naif' ? { kind: 'naif', naifId: requireFiniteNumber(q.naifId) }
        : q.kind === 'position' ? { kind: 'position', ...position(q) }
        : q.kind === 'none' ? { kind: 'none', reason: requireString(q.reason) }
        : (() => { throw new TypeError('Invalid shipped Spitzer search kind.'); })();
      return { id: requireString(o.id), name: requireString(o.name), classification: requireString(o.classification), query };
    }),
    marks: Object.fromEntries(Object.entries(requireRecord(raw.marks)).map(([id, values]) => [id, requireArray(values).map((v): [string, ReadMark] => {
      const pair = requireArray(v), mark = requireRecord(pair[1]);
      const status = INVESTIGATION_STATUSES.find(s => s === mark.status);
      if (!status) throw new TypeError('Invalid shipped investigation status.');
      return [requireString(pair[0]), { status, entry: requireString(mark.entry) }];
    })])),
    opensOn: Object.fromEntries(Object.entries(requireRecord(raw.opensOn)).map(([id, value]) => [id, requireString(value)])),
    hosts: Object.fromEntries(Object.entries(requireRecord(raw.hosts)).map(([id, names]) => [id, strings(names)])),
  };
}

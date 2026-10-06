import { isRecord } from '@cssearth/core';
import records from '../prepared/prepared-hosted-banks.json' with { type: 'json' };

/** A bank the world draws only for the bodies that hold it (prepare-catalog.mts `readHostedContextBanks`), as an object
 * entry carries it: its descriptor, and its files when it has no list of its own (`/world/context-assets/<id>.json`). */
export interface HostedBank { readonly descriptor: unknown; readonly files?: Readonly<Record<string, string>> }
interface HostedBankRecord extends HostedBank { readonly carriers: readonly string[] }

function parseRecords(value: unknown): ReadonlyMap<string, HostedBankRecord> {
  const path = 'site/prepared/prepared-hosted-banks.json';
  if (!isRecord(value)) throw new TypeError(`${path}: expected banks by id; run pnpm prepare:catalog.`);
  return new Map(Object.entries(value).map(([id, record]) => {
    if (!isRecord(record) || !Array.isArray(record.carriers) || !record.carriers.every(carrier => typeof carrier === 'string')
      || !isRecord(record.descriptor) || record.descriptor.id !== id || record.files !== undefined && !(isRecord(record.files)
        && Object.values(record.files).every(url => typeof url === 'string'))) {
      throw new TypeError(`${path} ${id}: expected its carriers, its descriptor and its files, not ${JSON.stringify(record)}.`);
    }
    return [id, { carriers: record.carriers as string[], descriptor: record.descriptor,
      ...(record.files === undefined ? {} : { files: record.files as Record<string, string> }) }] as const;
  }));
}
const HOSTED = parseRecords(records);

/** The hosted banks object `id`'s entry carries: those it carries itself (its own, the ones attached to it and the ones its
 * datasets show), and the catalogue dots of `centreId`, the body it orbits, which the world draws while `id` is selected
 * (universe-catalog-banks.ts `publishPoints`). Empty for an object that carries none. */
export function hostedBanksOf(id: string, centreId?: string): readonly HostedBank[] {
  const banks: HostedBank[] = [];
  for (const record of HOSTED.values()) {
    const { descriptor } = record;
    const host = isRecord(descriptor) && descriptor.type === 'catalogue-point-bank' && isRecord(descriptor.properties) ? descriptor.properties.host : undefined;
    if (!record.carriers.includes(id) && !(centreId !== undefined && host === centreId)) continue;
    banks.push({ descriptor, ...(record.files ? { files: record.files } : {}) });
  }
  return banks;
}

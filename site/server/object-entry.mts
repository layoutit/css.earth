import { isRecord } from '@cssearth/core';
import { OBJECTS } from '../directory/objects.mts';
import { CATALOGUE_ENTRIES } from '../prepared/prepared-catalogue.mjs';

const entryId = (entry: unknown) => !isRecord(entry) ? undefined : isRecord(entry.descriptor) ? entry.descriptor.id : entry.id;
const ENTRIES = new Map<unknown, unknown>(CATALOGUE_ENTRIES.map(entry => [entryId(entry), entry]));

/** One navigable object's prepared catalogue entry, as `/objects/<id>/entry.json` serves it to the page's object directory
 * (`object-directory.mts`). The registry (`objects.mts`) decodes every object from these same entries. */
export function objectEntry(id: string): unknown | null {
  return ENTRIES.get(id) ?? null;
}
export const OBJECT_ENTRY_IDS = OBJECTS.map(object => object.id);

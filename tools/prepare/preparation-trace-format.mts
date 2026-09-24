// The record format shared by the preparation trace (tools/prepare/preparation-trace.mts) and the preparation cache.
// Keep this module free of project imports: the trace loads it before it starts recording, so anything it
// imported would be missing from every record.
import { sha256 } from '../../src/platform/sha256.mts';
import { createHash } from 'node:crypto';
import { isRecord } from '../../src/platform/records.mts';

export const PREPARATION_TRACE_VARIABLE = 'CSSEARTH_PREPARATION_TRACE';
export const PREPARATION_TRACE_SCHEMA = 'cssearth-preparation-trace@1';

/** read: file contents; load: a module; probe: existence; list: directory names; tree: a copied directory; write: created, changed or removed. */
export type PreparationAccess = 'read' | 'load' | 'probe' | 'list' | 'tree' | 'write';
export type DescriptorView = 'registry' | 'recipe' | 'pins';
/** What the path held when the process first touched it: size and modification time, whether it was a directory, or absence. */
export interface TracedState { size?: number; modified?: number; directory?: true; missing?: true; views?: Record<DescriptorView, string> }
export interface TracedFile { accesses: PreparationAccess[]; first: TracedState }
export interface TracedCommand { command: string; args: string[]; cwd: string; shell: boolean }
export interface PreparationTrace {
  schema: typeof PREPARATION_TRACE_SCHEMA; pid: number; argv: string[]; files: Record<string, TracedFile>;
  commands: TracedCommand[]; catalogImporters: string[]; unsupported: string[];
}

export const DESCRIPTOR_PATH = /(?:^|\/)src\/objects\/([a-z][a-z0-9-]*)\/object\.json$/u;
export const CATALOG_MODULE = 'site/prepared-object-catalog.mts';
export const REGISTRY_MODULE = 'site/objects.mts';

const without = (value: unknown, key: string) => isRecord(value) ? Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)) : value;

/**
 * object.json has three owners. Authors own the recipe and the catalogue entry; prepare:text owns the card
 * (catalog.description); the body's own preparation writes worldFrame, page.metadata and prepared.
 * registry: the fields site/objects.mts exposes for another body, without the card.
 * recipe: everything the body's authors own, without the card or the preparation pins.
 * pins: what the body's preparation writes.
 */
export function descriptorView(value: unknown, view: DescriptorView): unknown {
  if (!isRecord(value)) return value;
  const properties = isRecord(value.properties) ? value.properties : {};
  if (view === 'registry') return { schema: value.schema, id: value.id, catalog: without(properties.catalog, 'description'), worldFrame: properties.worldFrame };
  if (view === 'pins') return { worldFrame: properties.worldFrame, page: isRecord(properties.page) ? properties.page.metadata : undefined, prepared: value.prepared };
  const recipe = Object.fromEntries(Object.entries(properties).filter(([name]) => name !== 'worldFrame')
    .map(([name, field]) => [name, name === 'catalog' ? without(field, 'description') : name === 'page' ? without(field, 'metadata') : field]));
  return { ...without(value, 'prepared') as Record<string, unknown>, properties: recipe };
}

export function descriptorDigest(text: string, view: DescriptorView): string {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return sha256(text); }
  return createHash('sha256').update(JSON.stringify(descriptorView(value, view)) ?? '').digest('hex');
}

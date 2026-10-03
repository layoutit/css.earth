import { readFile } from 'node:fs/promises';
import { systemViewFile, systemViewOwner } from '@cssearth/objects';
import { APPLICATION_WORLD_CONTEXT } from '../world-context-plan.mts';

const boundTo = new Map(APPLICATION_WORLD_CONTEXT.bodies.flatMap(body => body.boundTo ? [[body.id, body.boundTo.hostId] as const] : []));
/** A host's prepared system view, read from the package of the system that owns it (systemViewOwner). */
export async function readSystemViewFile(host: string): Promise<unknown> {
  const owner = systemViewOwner(host, id => boundTo.get(id));
  return JSON.parse(await readFile(new URL(`../../src/objects/${owner}/prepared/${systemViewFile(host)}`, import.meta.url), 'utf8'));
}

import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';

export interface DistantWorld {
  id: string;
  name: string;
  aliases: string[];
  classification: string;
  fullAxesKm: number[];
  radiusKm: number;
}

function requiredBody(value: unknown, index: number): DistantWorld {
  const body = requireRecord(value, `Audit body ${index}`);
  return {
    id: requireString(body.id, `Audit body ${index} id`),
    name: requireString(body.name, `Audit body ${index} name`),
    aliases: body.aliases === undefined ? [] : requireArray(body.aliases, `Audit body ${index} aliases`).map((alias, aliasIndex) => requireString(alias, `Audit body ${index} alias ${aliasIndex}`)),
    classification: requireString(body.classification, `Audit body ${index} classification`),
    fullAxesKm: requireArray(body.fullAxesKm, `Audit body ${index} axes`).map((axis, axisIndex) => requireFiniteNumber(axis, `Audit body ${index} axis ${axisIndex}`)),
    radiusKm: requireFiniteNumber(body.radiusKm, `Audit body ${index} radius`),
  };
}

const input = process.env.CSSEARTH_AUDIT_INPUTS ?? 'tools/objects/source-authoring/distant-worlds/inputs.json';
export const bodies = requireArray(requireRecord(JSON.parse(await readFile(input, 'utf8'))).bodies).map(requiredBody);
export const ids = bodies.map(body => body.id);
if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !/^[a-z][a-z0-9-]*$/.test(id))) {
  throw new Error('Audit inputs require unique object ids.');
}
export const reportDirectory = resolve(process.env.CSSEARTH_AUDIT_OUTPUT ?? 'output/distant-worlds');
export const captureDirectory = resolve(process.env.CSSEARTH_AUDIT_CAPTURES ?? 'output/playwright/distant-worlds');
export const runtimeDirectory = resolve(process.env.CSSEARTH_AUDIT_RUNTIME_ROOT ?? resolve(reportDirectory, 'fresh-runtime'));
await mkdir(reportDirectory, { recursive: true });

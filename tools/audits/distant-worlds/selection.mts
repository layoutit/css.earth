import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireArray, requireString } from '../../source-values.mts';

const input = process.env.CSSEARTH_AUDIT_INPUTS ?? 'tools/objects/source-authoring/distant-worlds/inputs.json';
export const bodies = requireArray(requireRecord(JSON.parse(await readFile(input, 'utf8'))).bodies).map(value => { const body = requireRecord(value); return {...body, id: requireString(body.id)}; });
export const ids = bodies.map(body => body.id);
if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !/^[a-z][a-z0-9-]*$/.test(id))) {
  throw new Error('Audit inputs require unique object ids.');
}
export const reportDirectory = resolve(process.env.CSSEARTH_AUDIT_OUTPUT ?? 'output/distant-worlds');
export const captureDirectory = resolve(process.env.CSSEARTH_AUDIT_CAPTURES ?? 'output/playwright/distant-worlds');
export const runtimeDirectory = resolve(process.env.CSSEARTH_AUDIT_RUNTIME_ROOT ?? resolve(reportDirectory, 'fresh-runtime'));
await mkdir(reportDirectory, { recursive: true });

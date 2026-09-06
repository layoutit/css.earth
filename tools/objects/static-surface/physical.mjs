import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Pinned JSON and provider table facts, interpreted only during preparation. */
export async function readPhysicalFacts({ sourceDirectory, config }) {
  const inputs = Object.fromEntries(await Promise.all(config.inputs.map(async input => [input.id, await readFile(resolve(sourceDirectory, input.path), 'utf8')])));
  return parsePhysicalFacts(inputs, config);
}

export function parsePhysicalFacts(inputs, config) {
  if (config.schema !== 'cssearth-physical-facts@1') throw new TypeError('Unsupported physical fact source.');
  const decoded = {};
  for (const input of config.inputs) {
    const text = inputs[input.id];
    if (typeof text !== 'string') throw new TypeError(`Physical source ${input.id} is missing.`);
    decoded[input.id] = input.format === 'json' ? JSON.parse(text) : text;
    for (const [path, expected] of Object.entries(input.identity ?? {})) if (field(decoded[input.id], path) !== expected) throw new TypeError(`Physical source identity drifted: ${input.id}.${path}`);
    const evidence = input.textPath ? String(field(decoded[input.id], input.textPath)).replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ') : text;
    for (const anchor of input.anchors ?? []) if (!evidence.includes(anchor)) throw new TypeError(`Physical source lost required evidence: ${anchor}`);
    if (input.tableRow) {
      const row = text.match(new RegExp(`<tr>\\s*<td><b>${input.tableRow}</b></td>([\\s\\S]*?)</tr>`, 'u'))?.[1];
      if (!row) throw new TypeError('Provider physical parameter row is missing.');
      const values = [...row.matchAll(/<td[^>]*>\s*([-\d.]+)/gu)].map(match => Number(match[1]));
      if (JSON.stringify(values.slice(0, input.expectedColumns.length)) !== JSON.stringify(input.expectedColumns)) throw new TypeError('Provider physical parameter columns drifted.');
      decoded[input.id] = values;
    }
  }
  const facts = { ...config.constants };
  for (const [name, binding] of Object.entries(config.fields)) facts[name] = field(decoded[binding.source], binding.path);
  return facts;
}
function field(object, path) { return String(path).split('.').reduce((value, key) => value?.[key], object); }

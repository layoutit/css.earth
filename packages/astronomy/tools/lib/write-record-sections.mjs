import { writeFileSync } from 'node:fs';

// Keep generated records intact while separating independently maintained systems.
// Both generators call this writer; formatting a checked-in payload uses exactly
// the same path as a fresh scientific-data fetch.
export function writeRecordSections(destination, source, kind) {
  const symbol = kind === 'satellites' ? 'SATELLITE_ELEMENTS' : 'HORIZONS';
  const declaration = new RegExp(`^export const ${symbol}[^\\n]*= \\{\\n`, 'm');
  const match = declaration.exec(source);
  if (!match) throw new Error(`Missing generated ${symbol} declaration`);
  const start = match.index + match[0].length;
  const end = source.indexOf('\n}', start);
  if (end < 0) throw new Error(`Missing generated ${symbol} terminator`);
  const body = source.slice(start, end);
  const records = [...body.matchAll(/^  ([\w]+): \{[\s\S]*?^  },?$/gm)];
  if (!records.length || records.map(record => record[0]).join('\n').trim() !== body.trim()) {
    throw new Error(`Generated ${symbol} records do not partition exactly`);
  }
  const sections = new Map();
  for (const record of records) {
    const group = kind === 'satellites' ? /parent: '([^']+)'/.exec(record[0])?.[1]
      : /^(sun|mercury|venus|emb|marsBary|jupiterBary|saturnBary|uranusBary|neptuneBary|earthFrom|jupiterFrom|saturnFrom)/.test(record[1])
        ? 'planetary' : 'moons-and-small-bodies';
    if (!group) throw new Error(`Missing system for ${record[1]}`);
    if (!sections.has(group)) sections.set(group, []);
    sections.get(group).push(record[0]);
  }
  const base = destination.pathname.split('/').at(-1).replace(/\.ts$/, '');
  const imports = [], spreads = [];
  const type = kind === 'satellites' ? 'SatelliteRecord' : 'HorizonsFixture';
  for (const [group, records] of sections) {
    const name = `${symbol}_${group.replaceAll('-', '_').toUpperCase()}`;
    const file = `${base}.${group}.ts`;
    const header = source.slice(0, source.indexOf('import type'));
    const text = `${header}import type { ${type} } from './${base}.js'\n\n` +
      `export const ${name} = {\n${records.join('\n')}\n} as const satisfies Record<string, ${type}>\n`;
    if (text.trimEnd().split('\n').length > 600) throw new Error(`Generated section ${file} exceeds 600 lines`);
    writeFileSync(new URL(file, destination), text);
    imports.push(`import { ${name} } from './${file.replace(/\.ts$/, '.js')}'`);
    spreads.push(`  ...${name},`);
  }
  const output = `${imports.join('\n')}\n\n${source.slice(0, start)}${spreads.join('\n')}${source.slice(end)}`;
  if (output.trimEnd().split('\n').length > 600) throw new Error(`Generated ${base} index exceeds 600 lines`);
  writeFileSync(destination, output);
}

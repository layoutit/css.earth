import { sha256 } from '../../src/platform/sha256.mts';
import { readFile, writeFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';

const documents = [
  { id: 'discovery', url: 'https://ssd.jpl.nasa.gov/sats/discovery.html', path: 'output/jpl-satellite-discoveries.html' },
  { id: 'elements', url: 'https://ssd.jpl.nasa.gov/sats/elem/', path: 'output/jpl-satellite-elements.html' },
];
const inputs = await Promise.all(documents.map(async source => {
  let bytes: Buffer;
  if (process.argv.includes('--refresh')) {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`JPL catalogue request failed: ${response.status}`);
    bytes = Buffer.from(await response.text());
  } else bytes = await readFile(source.path);
  return { ...source, bytes, document: parseHTML(bytes.toString()).document };
}));
const cells = (row: Element) => [...row.querySelectorAll('th,td')].map(cell => cell.textContent?.replace(/\s+/gu, ' ').trim() ?? '');
const key = (value: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/gu, '');
  // These two spellings appear in JPL's mean-element table; discovery names own display text.
  return normalized === 'magaclite' ? 'megaclite' : normalized === 'philophrosyn' ? 'philophrosyne' : normalized;
};
const id = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
const finite = (value: string) => {
  const result = Number(value);
  if (!value || !Number.isFinite(result)) throw new TypeError(`Invalid JPL number: ${value}`);
  return result;
};
interface Elements {
  code: string; frame: string; epoch: string; semiMajorAxisKm: number; eccentricity: number;
  argumentOfPeriapsisDeg: number; meanAnomalyDeg: number; inclinationDeg: number; ascendingNodeDeg: number;
  periodDays: number; poleRightAscensionDeg: number | null; poleDeclinationDeg: number | null;
}
const byIdentity = new Map<string, Elements>();
for (const row of inputs[1].document.querySelectorAll('#sat_elem tbody tr')) {
  const c = cells(row);
  if (c.length !== 20) throw new TypeError('JPL element table shape changed.');
  byIdentity.set(`${c[1].toLowerCase()}:${key(c[2])}`, { code: c[3], frame: c[5], epoch: c[6],
    semiMajorAxisKm: finite(c[7]), eccentricity: finite(c[8]), argumentOfPeriapsisDeg: finite(c[9]),
    meanAnomalyDeg: finite(c[10]), inclinationDeg: finite(c[11]), ascendingNodeDeg: finite(c[12]), periodDays: finite(c[13]),
    poleRightAscensionDeg: c[16] ? finite(c[16]) : null, poleDeclinationDeg: c[17] ? finite(c[17]) : null });
}
interface Moon { id: string; name: string; provisionalDesignation: string | null; elements: Elements | null; }
interface System { id: string; count: number; moons: Moon[]; }
const systems: System[] = [{ id: 'mercury', count: 0, moons: [] }, { id: 'venus', count: 0, moons: [] },
  { id: 'earth', count: 1, moons: [{ id: 'moon', name: 'Moon', provisionalDesignation: null, elements: byIdentity.get('earth:moon') ?? null }] }];
let system: System | undefined;
for (const row of inputs[0].document.querySelectorAll('table tr')) {
  const c = cells(row), header = c[0]?.match(/^Satellites of\s+(?:Dwarf Planet )?(\w+):\s*(\d+)$/u);
  if (header) { system = { id: header[1].toLowerCase(), count: finite(header[2]), moons: [] }; systems.push(system); continue; }
  if (!system || c.length !== 6 || row.querySelector('th')) continue;
  const name = c[1] || c[2];
  if (!name) throw new TypeError('JPL moon identity is missing.');
  const identities = [c[1], ...c[2].split(/\s*=\s*/u)].filter(Boolean);
  const elements = identities.map(value => byIdentity.get(`${system!.id}:${key(value)}`)).find(Boolean) ?? null;
  system.moons.push({ id: id(name), name, provisionalDesignation: c[2] || null, elements });
}
for (const system of systems) {
  if (system.moons.length !== system.count || new Set(system.moons.map(moon => moon.id)).size !== system.count) {
    throw new TypeError(`JPL moon identities/count do not match for ${system.id}.`);
  }
}
if (systems.length !== 9) throw new TypeError('Expected the eight planets and Pluto.');
const snapshot = { schema: 'cssearth-moon-catalogues@1', retrievedAt: new Date().toISOString(),
  sources: Object.fromEntries(inputs.map(source => [source.id, { url: source.url, sha256: sha256(source.bytes) }])),
  qualification: 'Confirmed names and counts from JPL; Earth is included from the mean-element table. Mercury and Venus have no moons. Mean elements describe approximate orbits, not precision ephemerides.',
  systems };
await writeFile('site/source/moon-catalogues.json', `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify(systems.map(system => ({ planet: system.id, moons: system.count, withElements: system.moons.filter(moon => moon.elements).length }))));

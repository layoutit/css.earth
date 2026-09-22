import { sha256 } from '../../src/platform/sha256.mts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import catalogue from '../../site/source/moon-catalogues.json' with { type: 'json' };
import world from '../../src/objects/sun/prepared/world-context.json' with { type: 'json' };
import { hasProperMoonName, prepareBodyMoons } from '../../site/prepare-body-moons.mts';
import { sourceArray, sourceObject, sourceText } from '../../src/platform/source-catalog.mts';


const centerCodes: Readonly<Record<string, string>> = { jupiter: '599', saturn: '699', uranus: '799', neptune: '899' };
const epoch = world.frame.epochJdTt;
// The discovery/element table lists this new moon, but its code currently
// resolves to asteroid 75052 in Horizons. Keep the failed reply as evidence.
const unavailableHorizonsIds = new Set(['s-2025-u1']);
const parameters = { format: 'json', EPHEM_TYPE: 'VECTORS', TIME_TYPE: 'TT', TLIST: String(epoch),
  REF_PLANE: 'FRAME', REF_SYSTEM: 'ICRF', OUT_UNITS: 'KM-S', VEC_TABLE: '2', VEC_CORR: 'NONE', CSV_FORMAT: 'YES', OBJ_DATA: 'NO' };

export function parseMoonVector(input: unknown, code: string, center: string, epochJdTt: number) {
  const response = sourceObject(input);
  if (typeof response.result !== 'string' || !response.result.trim()) throw new TypeError('Missing Horizons result.');
  const result = response.result;
  if (response.error || !new RegExp(`Target body name:.*\\(${code}\\)`).test(result) || !new RegExp(`Center body name:.*\\(${center}\\)`).test(result) ||
      !/Reference frame\s*:\s*ICRF/u.test(result) || !/Output units\s*:\s*KM-S/u.test(result) || !result.includes('JDTT') || !result.includes('GEOMETRIC cartesian states')) {
    throw new TypeError(`Horizons target/frame mismatch for ${code}.`);
  }
  const block = result.split('$$SOE')[1]?.split('$$EOE')[0]?.trim().split('\n');
  if (block?.length !== 1) throw new TypeError(`Expected one Horizons state for ${code}.`);
  const row = block[0].split(',').map(cell => cell.trim());
  const position = row.slice(2, 5).map(Number);
  if (Number(row[0]) !== epochJdTt || position.length !== 3 || row.slice(2, 5).some(cell => !cell) || !position.every(Number.isFinite)) throw new TypeError('Invalid Horizons position/epoch.');
  const ephemeris = result.match(/Target body name:.*\{source: ([^}]+)\}/u)?.[1];
  if (!ephemeris) throw new TypeError('Horizons ephemeris is missing.');
  return { positionKm: position, ephemeris };
}

if (import.meta.main) {
  const path = 'site/source/moon-horizons.json.gz';
  if (process.argv.includes('--refresh')) {
    await mkdir('output/moon-horizons', { recursive: true });
    const responses: { id: string; parentId: string; code: string; query: string; response: unknown }[] = [];
    for (const system of catalogue.systems) {
      const unavailable = new Set(prepareBodyMoons(system.id).filter(moon => !moon.object).map(moon => moon.id));
      for (const moon of system.moons.filter(moon => unavailable.has(moon.id) && moon.elements)) {
        const code = moon.elements!.code, center = centerCodes[system.id];
        if (!center) throw new TypeError(`Unknown Horizons center ${system.id}.`);
        const query = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
        for (const [key, value] of Object.entries({ ...parameters, COMMAND: code, CENTER: `500@${center}` })) query.searchParams.set(key, key === 'format' ? value : `'${value}'`);
        const cache = `output/moon-horizons/${moon.id}-${epoch}.json`;
        let response: unknown;
        try { response = JSON.parse(await readFile(cache, 'utf8')); }
        catch {
          // JPL requires sequential requests. Preserve each reply so a retry resumes.
          const reply = await fetch(query, { signal: AbortSignal.timeout(30000) });
          if (!reply.ok) throw new Error(`Horizons HTTP ${reply.status}: ${moon.id}`);
          response = await reply.json();
          await writeFile(cache, `${JSON.stringify(response)}\n`);
        }
        if (!unavailableHorizonsIds.has(moon.id)) parseMoonVector(response, code, center, epoch);
        responses.push({ id: moon.id, parentId: system.id, code, query: query.href, response });
        if (responses.length % 40 === 0) console.log(`${responses.length} moon positions acquired`);
      }
    }
    await writeFile(path, gzipSync(JSON.stringify({ schema: 'cssearth-moon-horizons@1', retrievedAt: new Date().toISOString(), responses })));
  }
  const bytes = await readFile(path);
  const source = sourceObject(JSON.parse(gunzipSync(bytes).toString()));
  if (source.schema !== 'cssearth-moon-horizons@1') throw new TypeError('Unknown moon position source.');
  const responses = sourceArray(source.responses, input => {
    const record = sourceObject(input), parentId = sourceText(record.parentId), code = sourceText(record.code);
    const id = sourceText(record.id);
    if (unavailableHorizonsIds.has(id)) return null;
    return { id, parentId, ...parseMoonVector(record.response, code, centerCodes[parentId], epoch) };
  });
  const moons = catalogue.systems.flatMap(system => {
    const parent = world.bodies.find(body => body.id === system.id);
    if (!parent) return [];
    const unavailable = new Set(prepareBodyMoons(system.id).filter(moon => !moon.object).map(moon => moon.id));
    // A position is not editorial significance. Only proper names from the
    // source catalogue qualify for these extra, noninteractive scene captions.
    // Curated, explorable bodies retain the existing shared label policy.
    return system.moons.filter(moon => unavailable.has(moon.id) && hasProperMoonName(moon)).map(moon => {
      const state = responses.find(response => response?.id === moon.id && response.parentId === system.id);
      return { id: moon.id, name: moon.name, parentId: system.id,
        positionM: state ? state.positionKm.map((value, axis) => parent.positionM[axis] + value * 1000) : null,
        parentDistanceM: state ? Math.hypot(...state.positionKm) * 1000 : null };
    });
  });
  await writeFile('site/moon-labels.prepared.json', `${JSON.stringify({ schema: 'cssearth-moon-labels@1',
    referenceFrame: world.frame.referenceFrame, epochJdTt: epoch,
    sourceSha256: sha256(bytes), worldSha256: sha256(await readFile('src/objects/sun/prepared/world-context.json')),
    qualification: 'Properly named catalogue moons only; provisional designations stay in the full sidebar catalogue. Horizons geometric ICRF vectors at the prepared world epoch, relative to each planet. No fabricated positions: moons without Horizons states remain in the sidebar only.', moons }, null, 2)}\n`);
  console.log(`${moons.filter(moon => moon.positionM).length} positioned labels; ${moons.filter(moon => !moon.positionM).length} without positions.`);
}

import { readFile } from 'node:fs/promises';
import { validateRedClumpCalibration } from '@cssearth/nebula-reconstruction/registration/red-clump-distance';
function record(v: unknown): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid recipe object');
    return Object.fromEntries(Object.entries(v));
}
export async function readVmcRecipe(path = 'labs/nebula/models/smc/vmc/recipe.json') {
    const root = record(JSON.parse(await readFile(path, 'utf8')));
    if (root.schema !== 'cssearth-red-clump-intake@1') throw Error('Unsupported intake recipe');
    const a = record(root.acquisition), c = record(root.calibration);
    const str = (r: Record<string, unknown>, key: string) => { const v = r[key]; if (typeof v !== 'string' || !v) throw Error(`Invalid ${key}`); return v; };
    const num = (r: Record<string, unknown>, key: string) => { const v = r[key]; if (typeof v !== 'number' || !Number.isFinite(v)) throw Error(`Invalid ${key}`); return v; };
    const tiles = a.tiles;
    if (!Array.isArray(tiles) || !tiles.length || !tiles.every((t: unknown) => typeof t === 'string' && /^\d+_\d+$/.test(t))) throw Error('Invalid tile names');
    const table = str(a, 'table'), fieldPrefix = str(a, 'fieldPrefix');
    if (!/^\w+$/.test(table) || !/^\w+$/.test(fieldPrefix)) throw Error('Invalid ADQL identifier');
    const magnitudeMin = num(a, 'magnitudeMin'), magnitudeMax = num(a, 'magnitudeMax'), colorMin = num(a, 'colorMin'), colorMax = num(a, 'colorMax');
    const maxRowsPerTile = num(a, 'maxRowsPerTile'), timeoutMs = num(a, 'timeoutMs');
    if (magnitudeMin >= magnitudeMax || colorMin >= colorMax || !Number.isInteger(maxRowsPerTile) || maxRowsPerTile <= 0 || timeoutMs <= 0) throw Error('Invalid query bounds');
    const endpoint = str(a, 'endpoint');
    if (new URL(endpoint).protocol !== 'https:') throw Error('Expected HTTPS endpoint');
    return { localDirectory: str(root, 'localDirectory'), receiptPath: str(root, 'receiptPath'), calibration: validateRedClumpCalibration(c), intrinsicColorMag: num(c, 'intrinsicColorMag'), acquisition: { endpoint, table, fieldPrefix, tiles: tiles.map(String), magnitudeMin, magnitudeMax, colorMin, colorMax, maxRowsPerTile, timeoutMs } };
}

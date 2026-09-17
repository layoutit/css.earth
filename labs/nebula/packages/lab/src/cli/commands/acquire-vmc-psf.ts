import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readVmcRecipe } from './vmc-recipe.ts';
const recipe = await readVmcRecipe();
const a = recipe.acquisition;
const directory = `${recipe.localDirectory}/photometry`;
await fs.mkdir(directory, { recursive: true });
const pins = new Map<string, string>();
try {
    const receipt: unknown = JSON.parse(await fs.readFile(recipe.receiptPath, 'utf8'));
    if (!receipt || typeof receipt !== 'object' || !('sources' in receipt) || !Array.isArray(receipt.sources)) throw Error('Invalid source receipt');
    for (const source of receipt.sources) {
        if (!source || typeof source !== 'object' || !('path' in source) || !('sha256' in source) || typeof source.path !== 'string' || typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)) throw Error('Invalid source pin');
        pins.set(source.path, source.sha256);
    }
} catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error;
}
function validateSource(text: string, tile: string): number {
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || !('data' in data) || !Array.isArray(data.data) || data.data.length === 0 || data.data.length >= a.maxRowsPerTile) throw Error(`Failed or truncated tile ${tile}`);
    return data.data.length;
}
function verifyPin(path: string, bytes: Uint8Array) {
    const expected = pins.get(path);
    if (expected && createHash('sha256').update(bytes).digest('hex') !== expected) throw Error(`Source hash mismatch: ${path}`);
}
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < a.tiles.length) {
        const tile = a.tiles[next++];
        const path = `${directory}/${tile}.json`;
        let cached: Buffer | undefined;
        try { cached = await fs.readFile(path); }
        catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error; }
        if (cached) {
            verifyPin(path, cached);
            validateSource(cached.toString(), tile!);
            console.log(tile, 'verified cached source');
            continue;
        }
        const query = `SELECT PSFSOURCEID,FIELDNAME,RA2000,DEC2000,YPSFMAG,KSPSFMAG,KSPSFMAGERR,YPSFMAGERR,KSSHARP,STARPROB,PRIORSEC,LCOMPKS,SYSERRKS FROM ${a.table} WHERE FIELDNAME='${a.fieldPrefix}${tile}' AND KSPSFMAG BETWEEN ${a.magnitudeMin} AND ${a.magnitudeMax} AND YPSFMAG-KSPSFMAG BETWEEN ${a.colorMin} AND ${a.colorMax}`;
        const url = new URL(a.endpoint);
        url.search = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'json', QUERY: query, MAXREC: String(a.maxRowsPerTile) }).toString();
        const response = await fetch(url, { signal: AbortSignal.timeout(a.timeoutMs) });
        if (!response.ok) throw Error(`ESO HTTP ${response.status} for ${tile}`);
        const text = await response.text();
        const count = validateSource(text, tile!);
        verifyPin(path, Buffer.from(text));
        await fs.writeFile(path, text);
        await fs.writeFile(path + '.query.txt', query + '\n');
        console.log(tile, count, text.length);
    }
}));

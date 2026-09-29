import fs from 'node:fs/promises';
import { readVmcRecipe } from './vmc-recipe.ts';
const recipe = await readVmcRecipe();
const a = recipe.acquisition;
const directory = `${recipe.localDirectory}/photometry`;
await fs.mkdir(directory, { recursive: true });
function validateSource(text: string, tile: string): number {
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || !('data' in data) || !Array.isArray(data.data) || data.data.length === 0 || data.data.length >= a.maxRowsPerTile) throw Error(`Failed or truncated tile ${tile}`);
    return data.data.length;
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
        await fs.writeFile(path, text);
        await fs.writeFile(path + '.query.txt', query + '\n');
        console.log(tile, count, text.length);
    }
}));

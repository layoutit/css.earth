import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute } from 'astro';
import { resolveWorldBillboards } from '../../asset-origin.mts';
import { worldAnywhereFiles } from '../../world-places.mts';

// The files every page reads at startup, root first, in one response: each object's own `prepared/members.json` whose
// bodies the map draws from anywhere (the Solar System's planets, the Milky Way's featured stars, the galaxies), whole and
// named by its object. One response compresses them together: as 22 responses they were 32.1 KB gzipped, as one 26.1 KB
// (2026-10-03). Each billboard carries its published address (asset-origin.mts).
export const GET: APIRoute = async () => {
  // Astro renders from the project root; a relative module URL would point into the bundled build instead.
  const files = await Promise.all(worldAnywhereFiles().map(async id => `{"id":${JSON.stringify(id)},"value":${
    (await resolveWorldBillboards(await readFile(resolve(process.cwd(), `src/objects/${id}/prepared/members.json`), 'utf8'))).trim()}}`));
  return new Response(`{"files":[${files.join(',')}]}`, { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  } });
};

import type { APIRoute, GetStaticPaths } from 'astro';
import { readSharedBankBytes, listSharedBanks } from '../../../object-page-data.mts';
import { isSharedBankKind } from '../../../../src/platform/prepared-shared.mts';

// Content-addressed shared banks (planet point photometry, the retained star
// catalogue, heliocentric labels). Every prepared object references them, so
// the browser fetches each one once and caches it forever.
export const getStaticPaths: GetStaticPaths = async () => (await listSharedBanks()).map(({ kind, sha256 }) => ({ params: { kind, sha256 } }));

export const GET: APIRoute = async ({ params }) => {
  if (!isSharedBankKind(params.kind) || !/^[0-9a-f]{64}$/u.test(params.sha256 ?? '')) return new Response('Not found', { status: 404 });
  const bytes = await readSharedBankBytes({ kind: params.kind, sha256: params.sha256! });
  if (!bytes) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=31536000, immutable',
  } });
};

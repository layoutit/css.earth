import { parseObjectDescriptor } from '@cssearth/objects';
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { OBJECTS } from '../../../objects.mts';
import { readPreparedObjectBytes } from '../../../object-page-data.mts';

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = [];
  for (const { id } of OBJECTS) {
    const descriptor = parseObjectDescriptor(JSON.parse(await readFile(resolve('src/objects', id, 'object.json'), 'utf8')));
    if (!descriptor.prepared) throw new TypeError(`Object ${id} has no prepared data.`);
    paths.push({ params: { id, sha256: descriptor.prepared.sha256 } });
  }
  return paths;
};

export const GET: APIRoute = async ({ params }) => {
  if (typeof params.id !== 'string' || !OBJECTS.some(object => object.id === params.id) || !/^[0-9a-f]{64}$/u.test(params.sha256 ?? '')) {
    return new Response('Not found', { status: 404 });
  }
  const { descriptor, bytes } = await readPreparedObjectBytes(params.id);
  if (descriptor.prepared?.sha256 !== params.sha256) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=31536000, immutable',
  } });
};

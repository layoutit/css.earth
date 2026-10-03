import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SURFACE_GRID_SCHEMA, parseGriddedShellMesh } from './mesh.ts';
import { requireRecord } from '@cssearth/core';

const root = new URL('../../../../', import.meta.url);
test('preserved IBEX extraction and the actual grid conform to the bake sample reader', () => {
  const directory = new URL('src/objects/heliosphere/source/ibex/', root);
  const python = readFileSync(new URL('extract.py', directory), 'utf8');
  const literals = [...python.matchAll(/(['"])(cssearth-surface-grid@[0-9]+)\1/gu)].map(match => match[2]);
  assert.deepEqual(literals, [SURFACE_GRID_SCHEMA]);
  const grid = requireRecord(JSON.parse(readFileSync(new URL('heliopause-grid.json', directory), 'utf8')));
  assert.equal(grid.schema, SURFACE_GRID_SCHEMA);
  assert.equal(parseGriddedShellMesh(grid).triangles.length, 120);
  assert.throws(() => parseGriddedShellMesh({ ...grid, schema: 'cssearth-surface-grid@999' }),
    /Gridded surface needs a bounded rectangular sample array/);
});

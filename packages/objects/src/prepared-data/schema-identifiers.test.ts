import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { preparedObjectTransport } from '@cssearth/objects/node';
import { AUTHORED_OBJECT_SCHEMA, SOURCE_MANIFEST_SCHEMA, PREPARED_CATALOGUE_STARS_SCHEMA, COMPILER_BAKE_SCHEMA, COMPILER_STAR_SPRITES_SCHEMA, JOINT_FIT_VOLUME_SCHEMA, LAYER_OPTIMIZATION_SCHEMA, PREPARED_LMC_STARS_SCHEMA, NEBULA_PHYSICAL_EVIDENCE_SCHEMA, OBJECT_PAGE_SCHEMA, OBJECT_SCHEMA, PREPARED_OBJECT_SCHEMA, VOLUME_LAYER_PLAN_SCHEMA, VOLUME_RECIPE_SCHEMA } from '@cssearth/objects';
import { SOURCE_CATALOG_SCHEMA } from '@cssearth/objects/sources';
import { PREPARED_EXPLORATION_SCHEMA, PREPARED_SOURCES_SCHEMA } from '@cssearth/objects/provenance';

test('shared schema exports preserve the serialized identifiers', () => {
  assert.equal(AUTHORED_OBJECT_SCHEMA, 'cssearth-authored-object@2');
  assert.equal(SOURCE_MANIFEST_SCHEMA, 'cssearth-authoritative-sources@3');
  assert.equal(PREPARED_CATALOGUE_STARS_SCHEMA, 'cssearth-catalogue-stars@2');
  assert.equal(COMPILER_BAKE_SCHEMA, 'cssearth-compiler-bake@2');
  assert.equal(COMPILER_STAR_SPRITES_SCHEMA, 'cssearth-compiler-star-sprites@1');
  assert.equal(JOINT_FIT_VOLUME_SCHEMA, 'cssearth-joint-fit-volume@1');
  assert.equal(LAYER_OPTIMIZATION_SCHEMA, 'cssearth-layer-optimization@1');
  assert.equal(PREPARED_LMC_STARS_SCHEMA, 'cssearth-lmc-stars@1');
  assert.equal(NEBULA_PHYSICAL_EVIDENCE_SCHEMA, 'cssearth-nebula-physical-evidence@1');
  assert.equal(OBJECT_PAGE_SCHEMA, 'cssearth-object-page@1');
  assert.equal(OBJECT_SCHEMA, 'cssearth-object@2');
  assert.equal(PREPARED_EXPLORATION_SCHEMA, 'cssearth-prepared-exploration@3');
  assert.equal(PREPARED_OBJECT_SCHEMA, 'cssearth-prepared-object@1');
  assert.equal(PREPARED_SOURCES_SCHEMA, 'cssearth-prepared-sources@1');
  assert.equal(SOURCE_CATALOG_SCHEMA, 'cssearth-source-catalog@1');
  assert.equal(VOLUME_LAYER_PLAN_SCHEMA, 'cssearth-volume-layer-plan@1');
  assert.equal(VOLUME_RECIPE_SCHEMA, 'cssearth-volume-recipe@1');
});

test('unbuilt tooling and preserved Python use the objects source-manifest identifier', () => {
  const root = new URL('../../../../', import.meta.url);
  for (const path of ['.github/scripts/checks/check-body-references.mts', 'packages/bake/authoring/distant-worlds/author.py']) {
    const source = readFileSync(new URL(path, root), 'utf8');
    const literals = [...source.matchAll(/(['"])(cssearth-authoritative-sources@[0-9]+)\1/gu)].map(match => match[2]);
    assert.ok(literals.length > 0, `${path} must retain a manifest schema check`);
    for (const literal of literals) assert.equal(literal, SOURCE_MANIFEST_SCHEMA, path);
  }
});

test('prepared object transport preserves its serialized envelope bytes', () => {
  const descriptor = { id: 'probe', type: 'density-volume', prepared: { format: 'density-volume@1', url: 'prepared/volume.json' } };
  assert.equal(preparedObjectTransport(descriptor, '{"value":1}'),
    '{"schema":"cssearth-prepared-object@1","id":"probe","type":"density-volume","format":"density-volume@1","data":{"value":1}}');
});

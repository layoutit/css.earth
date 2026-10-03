/** Literal/retained-fixture conformance only: scientific processing is tested by its native owners. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireRecord } from '@cssearth/core';
import { projectRoot } from '@cssearth/core/node';
import { pathToFileURL } from 'node:url';

const root = pathToFileURL(projectRoot(import.meta.url) + '/');
const lab = 'labs/nebula/packages/lab/src/';
const reconstruction = 'labs/nebula/packages/reconstruction/src/';
const models = 'labs/nebula/models/lmc/';
function pin(path: string, name: string, schema: string, count: number): void {
  const source = readFileSync(new URL(path, root), 'utf8');
  const literals = [...source.matchAll(new RegExp(`(['"])(cssearth-${name}@[0-9]+)\\1`, 'gu'))].map(match => match[2]);
  assert.equal(literals.length, count, `${path}: schema declarations/checks must remain present`);
  for (const literal of literals) assert.equal(literal, schema, path);
}
function fixture(path: string, schema: string): Record<string, unknown> {
  const record = requireRecord(JSON.parse(readFileSync(new URL(path, root), 'utf8')));
  assert.equal(record.schema, schema, path);
  return record;
}

test('independent fixed-WCS audit writers and the preserved receipt use the same protocol', () => {
  const schema = 'cssearth-fixed-wcs-catalogue-direction-gate@1';
  pin(reconstruction + 'registration/fixed-catalogue.ts', 'fixed-wcs-catalogue-direction-gate', schema, 1);
  pin(models + 'candidates/source/wise-registration/check-wise-catalogue.py', 'fixed-wcs-catalogue-direction-gate', schema, 1);
  const receipt = fixture(models + 'candidates/source/wise-direction-gate.json', schema);
  assert.equal(typeof receipt.pass, 'boolean');
  requireRecord(receipt.gates);
});

test('original and pinned Python image registration preserve every gate/failure schema', () => {
  const schema = 'cssearth-image-direction-gate@1';
  for (const path of [reconstruction + 'registration/validate-image-registration.py',
    models + 'candidates/source/wise-registration/validate-image-registration.pinned.py'])
    pin(path, 'image-direction-gate', schema, 4);
  const receipt = fixture(models + 'candidates/source/vista-direction-gate.json', schema);
  assert.ok(['pass', 'fail'].includes(String(receipt.status)));
  requireRecord(receipt.gates);
});

test('native removal request and output schema checks agree at every Python/TS boundary', () => {
  const requestSchema = 'cssearth-star-removal@1', outputSchema = 'cssearth-nox-output@1';
  for (const [path, count] of [
    [lab + 'server/services/star-removal.ts', 3],
    [lab + 'server/workflows/emission-inference/native-source.ts', 1],
    [reconstruction + 'star-removal/native.ts', 1],
    [reconstruction + 'star-removal/star-removal.py', 1],
  ] as const) pin(path, 'star-removal', requestSchema, count);
  for (const path of [lab + 'server/services/star-removal.ts', lab + 'server/workflows/compiler/images.ts',
    lab + 'server/workflows/emission-inference/native-source.ts', reconstruction + 'star-removal/star-removal.py'])
    pin(path, 'nox-output', outputSchema, 1);
  // These existing injected-worker fixtures exercise the TS readers without a NOX model.
  for (const path of [lab + 'server/services/star-removal.test.ts', lab + 'server/workflows/compiler/images.test.ts',
    lab + 'server/workflows/compiler/optical-composite-preparation.test.ts', lab + 'server/workflows/observations/native-cache.test.ts'])
    pin(path, 'nox-output', outputSchema, 1);
});

test('native separation recipes and receipts conform across both languages and retained fixtures', () => {
  const recipeSchema = 'cssearth-star-separation@1', receiptSchema = 'cssearth-star-separation-receipt@1';
  for (const path of [lab + 'server/services/star-removal.ts', lab + 'server/workflows/star-removal/process-image-candidates.py',
    reconstruction + 'star-removal/star-separation.py']) pin(path, 'star-separation', recipeSchema, 1);
  for (const path of [lab + 'server/services/star-removal.ts', lab + 'cli/commands/prepare-overlay-variants.ts',
    lab + 'server/workflows/star-removal/process-image-candidates.py', reconstruction + 'star-removal/star-separation.py'])
    pin(path, 'star-separation-receipt', receiptSchema, 1);
  for (const id of ['horalek-widefield', 'vista-infrared', 'wise-wide-infrared']) {
    const recipe = fixture(models + `star-separation/${id}.json`, recipeSchema);
    const receipt = fixture(models + `star-separation/receipts/${id}.json`, receiptSchema);
    const source = requireRecord(recipe.source), receivedSource = requireRecord(receipt.source);
    assert.equal(receivedSource.path, source.path);
    assert.equal(requireRecord(receipt.verification).maximumReconstructionErrorCodeValues, 0);
  }
});

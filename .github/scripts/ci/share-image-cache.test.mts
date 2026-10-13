import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from 'yaml';
import { requireArray, requireRecord } from '@cssearth/core';

const source = await readFile(new URL('../../workflows/deploy.yml', import.meta.url), 'utf8');
const steps = requireArray(requireRecord(requireRecord(requireRecord(parse(source)).jobs).deploy).steps).map(value => requireRecord(value));
const pin = '0057852bfaa89a56745cba8c7296529d2fc39830';

function assertShareCache(steps: readonly Record<string, unknown>[]): void {
  const restoreAt = steps.findIndex(step => step.id === 'share-images-cache'), restore = requireRecord(steps[restoreAt]);
  const saveAt = steps.findIndex(step => step.name === 'Save validated share images'), save = requireRecord(steps[saveAt]);
  const buildAt = steps.findIndex(step => step.name === 'Build the site');
  const validationAt = steps.findIndex(step => step.name === 'Check the build output');
  const publishAt = steps.findIndex(step => step.name === 'Publish the prebuilt site to Cloudflare');
  assert.ok(restoreAt > steps.findIndex(step => step.name === 'Install dependencies') && restoreAt < buildAt);
  assert.ok(saveAt > validationAt && saveAt < publishAt && validationAt > buildAt);
  assert.equal(restore.uses, `actions/cache/restore@${pin}`); assert.equal(save.uses, `actions/cache/save@${pin}`);
  assert.equal(save.if, undefined, 'Default success condition keeps failed validation out of the saved cache.');
  const inputs = requireRecord(restore.with), saved = requireRecord(save.with);
  assert.equal(inputs.path, 'output/share-image-cache'); assert.equal(saved.path, inputs.path);
  assert.equal(inputs.key, 'share-images-v1-${{ runner.os }}-${{ runner.arch }}-${{ github.run_id }}-${{ github.run_attempt }}');
  assert.equal(inputs['restore-keys'], 'share-images-v1-${{ runner.os }}-${{ runner.arch }}-');
  assert.equal(saved.key, '${{ steps.share-images-cache.outputs.cache-primary-key }}');
}

test('deploy restores only generated share cards and saves the same unique key after validation before publication', () => {
  assertShareCache(steps);
});

test('cache deletion, broader paths, nonunique keys and premature saves fail the workflow contract', () => {
  for (const name of ['Restore generated share images', 'Save validated share images']) assert.throws(() => assertShareCache(steps.filter(step => step.name !== name)));
  for (const name of ['Restore generated share images', 'Save validated share images']) {
    const changed = steps.map(step => step.name === name ? { ...step, with: { ...requireRecord(step.with), path: 'output/' } } : step);
    assert.throws(() => assertShareCache(changed));
  }
  const restore = steps.find(step => step.id === 'share-images-cache'); assert.ok(restore);
  for (const key of ['share-images-v1-${{ runner.os }}-${{ runner.arch }}-', 'share-images-v1-${{ github.run_id }}']) {
    assert.throws(() => assertShareCache(steps.map(step => step === restore ? { ...step, with: { ...requireRecord(step.with), key } } : step)));
  }
  const save = steps.find(step => step.name === 'Save validated share images'); assert.ok(save);
  const premature = steps.filter(step => step !== save); premature.splice(premature.findIndex(step => step.name === 'Build the site'), 0, save);
  assert.throws(() => assertShareCache(premature));
  assert.throws(() => assertShareCache(steps.map(step => step === save ? { ...step, if: 'always()' } : step)));
});

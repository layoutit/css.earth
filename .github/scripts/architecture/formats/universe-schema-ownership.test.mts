import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repositoryFiles } from '../import-graph/graph.mts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const pattern = /cssearth-(catalogue-points|galaxy-backing|image-mesh|dataset-billboards)@1|cssearth-catalogue-points-bin@2|CSBANK01/u;

test('Universe schema identifiers and the prepared bank magic are owned only by objects', () => {
  const paths = repositoryFiles(root);
  const findings = [...new Set(paths)].filter(path => /\.(?:ts|mts|js|mjs|astro)$/u.test(path)
    && !path.startsWith('packages/objects/') && !path.includes('.test.') && !path.startsWith('untangle/') && !path.startsWith('output/'))
    .flatMap(path => readFileSync(resolve(root, path), 'utf8').split('\n')
      .flatMap((line, index) => pattern.test(line) ? [`${path}:${index + 1}: ${line}`] : []));
  assert.deepEqual(findings, [], `Universe format literals outside objects:\n${findings.join('\n')}`);
});

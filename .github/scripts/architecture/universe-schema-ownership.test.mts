import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const pattern = /cssearth-(catalogue-points(-bin)?|galaxy-backing|image-mesh|dataset-billboards)@1|CSCPTS01/u;

test('Universe schema identifiers and catalogue binary magic are owned only by objects', () => {
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.ts', '*.mts', '*.js', '*.mjs', '*.astro'], { cwd: root, encoding: 'utf8' }).split('\0');
  const findings = [...new Set(paths)].filter(path => /\.(?:ts|mts|js|mjs|astro)$/u.test(path)
    && !path.startsWith('packages/objects/') && !path.includes('.test.') && !path.startsWith('untangle/') && !path.startsWith('output/'))
    .flatMap(path => readFileSync(resolve(root, path), 'utf8').split('\n')
      .flatMap((line, index) => pattern.test(line) ? [`${path}:${index + 1}: ${line}`] : []));
  assert.deepEqual(findings, [], `Universe format literals outside objects:\n${findings.join('\n')}`);
});

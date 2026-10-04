/** Root test-lane names are repository policy; generic quoted-glob collection belongs to core. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scriptTestFiles } from '@cssearth/core/node';

export function testLaneFiles(root: string): Readonly<Record<'packages' | 'site', readonly string[]>> {
  const manifest: unknown = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const files = scriptTestFiles(root, manifest, ['test:packages', 'test:site']);
  return { packages: files.get('test:packages')!, site: files.get('test:site')! };
}

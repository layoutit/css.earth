import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Fresh module evaluation for build-owned JSON readers, with offline data and inherited coverage capture. */
export function importWithJson(subject: URL, dependency: URL, value: unknown, inspect = '') {
  const directory = mkdtempSync(join(tmpdir(), 'cssearth-json-import-'));
  try {
    const script = join(directory, 'import.mts');
    writeFileSync(script, `import { mock } from 'node:test';
const revive = value => {
  if (value && typeof value === 'object' && 'nonfinite' in value) return Number(value.nonfinite);
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revive(item)]));
  return value;
};
mock.module(${JSON.stringify(dependency.href)}, { defaultExport: revive(${JSON.stringify(value, (_key, item: unknown) => typeof item === 'number' && !Number.isFinite(item) ? { nonfinite: String(item) } : item)}) });
const loaded = await import(${JSON.stringify(subject.href)});
${inspect}
console.log('IMPORT_OK');\n`);
    const result = spawnSync(process.execPath, ['--experimental-test-module-mocks', script], {
      encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status === null) throw new Error(`JSON import subprocess terminated: ${result.signal}.`);
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

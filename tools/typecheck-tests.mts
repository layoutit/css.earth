import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

// Batching bounds the compiler heap when a test closure imports large prepared scientific data — nebula's own
// typecheck (tools/nebula/typecheck.mts, a much smaller closure) still uses this. The main test closure measured
// the opposite: 17 batches of 96 roots re-parse the same ~3,500 shared files in every batch (27,363 file-instances
// for 5,191 unique files), 70.6 s; one program over the whole closure is 22 s at a 3.9 GB heap (output/TEST_AUDIT.md
// section 2.3) — the runner has 16 GB, so typecheckTests below compiles tests/tsconfig.json directly, unbatched.
export function testTypecheckBatches(files: readonly string[], size = 96): string[][] {
  if (!Number.isSafeInteger(size) || size < 1) throw new TypeError('Invalid TypeScript batch size.');
  const sorted = [...new Set(files)].sort();
  const batches: string[][] = [];
  for (let offset = 0; offset < sorted.length; offset += size) batches.push(sorted.slice(offset, offset + size));
  return batches;
}

export function typecheckTests(root: string): number {
  const configPath = resolve(root, 'tests/tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath), undefined, configPath);
  if (parsed.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  if (!parsed.fileNames.length) throw new Error('The TypeScript test configuration found no files.');
  const compiler = fileURLToPath(import.meta.resolve('typescript/lib/tsc.js'));
  console.log(`Typechecking ${parsed.fileNames.length} test, fixture and capture files in one program.`);
  const result = spawnSync(process.execPath, [compiler, '--project', configPath, '--pretty', 'false'], {
    cwd: root, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = typecheckTests(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
}

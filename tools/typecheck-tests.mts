import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

// Every file discovered by the strict test config is checked. Batching bounds
// the compiler heap when test closures import large prepared scientific data.
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
  const ambient = parsed.fileNames.filter(path => /\.d\.[cm]?ts$/u.test(path));
  const batches = testTypecheckBatches(parsed.fileNames.filter(path => !ambient.includes(path)));
  if (!batches.length) throw new Error('The TypeScript test configuration found no files.');
  mkdirSync(resolve(root, 'output'), { recursive: true });
  const scratch = mkdtempSync(resolve(root, 'output/typecheck-tests-'));
  const compiler = fileURLToPath(import.meta.resolve('typescript/lib/tsc.js'));
  try {
    console.log(`Typechecking ${parsed.fileNames.length} test, fixture and capture files in ${batches.length} sequential groups.`);
    for (const [index, files] of batches.entries()) {
      const batchPath = resolve(scratch, `${index}.json`);
      // Empty include overrides the inherited discovery pattern: only this
      // group's roots plus their full imported TypeScript closure are compiled.
      writeFileSync(batchPath, JSON.stringify({ extends: configPath, files: [...ambient, ...files], include: [] }));
      console.log(`TypeScript test group ${index + 1}/${batches.length} (${files.length} roots)`);
      const result = spawnSync(process.execPath, [compiler, '--project', batchPath, '--pretty', 'false'], {
        cwd: root, stdio: 'inherit',
      });
      if (result.error) throw result.error;
      if (result.status !== 0) return result.status ?? 1;
    }
    return 0;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = typecheckTests(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
}

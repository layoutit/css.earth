/** Strict test discovery for the internal lab, bounded to avoid giant compiler heaps. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { testTypecheckBatches } from '../typecheck-tests.mts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const configPath = resolve(root, 'labs/nebula/tsconfig.tests.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath), undefined, configPath);
if (parsed.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
  getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
}));
const ambient = parsed.fileNames.filter(path => path.endsWith('.d.ts'));
const tests = parsed.fileNames.filter(path => !ambient.includes(path));
if (!tests.length) throw new Error('No nebula tests discovered.');
mkdirSync(resolve(root, 'output'), { recursive: true });
const scratch = mkdtempSync(resolve(root, 'output/nebula-typecheck-'));
try {
  for (const [index, files] of testTypecheckBatches(tests, 32).entries()) {
    const path = resolve(scratch, `${index}.json`);
    writeFileSync(path, JSON.stringify({ extends: configPath, files: [...ambient, ...files], include: [] }));
    console.log(`Nebula strict test group ${index + 1}: ${files.length} roots`);
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.resolve('typescript/lib/tsc.js')), '-p', path, '--pretty', 'false'], {
      cwd: root, stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
  }
  if (!process.exitCode) console.log(`NEBULA_TEST_TYPES_OK ${tests.length} test files checked`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

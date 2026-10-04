import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { MODULE_RELATIVE_ROOT_OWNERS, RETIRED_PATHS } from './retired-paths.mts';

const POLICY = new Set(['.github/scripts/checks/retired-paths.mts', '.github/scripts/checks/check-stale-references.mts']);
const URL = /https?:\/\/[^\s"'<>`)]+/gu;
const ROOT_OWNERS: ReadonlySet<string> = new Set(MODULE_RELATIVE_ROOT_OWNERS);
/** Only executable import/command syntax is live in tests; quoted negative fixtures are evidence. */
function testLiveLines(path: string, text: string): ReadonlySet<number> {
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const lines = new Set<number>();
  const mark = (node: ts.Node) => {
    const start = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line;
    const end = tree.getLineAndCharacterOfPosition(node.getEnd()).line;
    for (let line = start; line <= end; line++) lines.add(line);
  };
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) mark(node.moduleSpecifier);
    else if (ts.isImportTypeNode(node)) mark(node.argument);
    else if (ts.isImportEqualsDeclaration(node)) mark(node.moduleReference);
    else if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '';
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || /^(?:require|execFile(?:Sync)?|spawn(?:Sync)?)$/u.test(name)) mark(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return lines;
}

/** Scan text, not just imports: manifests, generator headers, README commands, sparse lists and globs are callers.
 * Historical migration lines must explicitly identify their replacement with `(now ...)`;
 * source records may instead use their named `historicalAcquisition` field.
 * Test literals are fixtures; actual test imports and commands remain live references. */
export function staleReferenceLines(path: string, bytes: Uint8Array): string[] {
  if (POLICY.has(path) || bytes.subarray(0, 8192).includes(0)) return [];
  const found: string[] = [];
  const testFile = /\.test\.[cm]?[jt]s$/u.test(path);
  const textSource = new TextDecoder().decode(bytes);
  const liveLines = testFile ? testLiveLines(path, textSource) : undefined;
  textSource.split('\n').forEach((line, index) => {
    if (/^\s*"historicalAcquisition"\s*:/u.test(line)) return;
    if (liveLines && !liveLines.has(index)) return;
    const text = line.replace(URL, '');
    for (const retired of RETIRED_PATHS) {
      let at = text.indexOf(retired);
      while (at !== -1) {
        // Do not confuse /devtools/ URLs or another package's unretired subdirectory with root tools/.
        const before = text[at - 1] ?? '';
        const after = text[at + retired.length] ?? '';
        const historical = /^[^\s"'`()]+`?\s+\(now [^)]+\)/u.test(text.slice(at));
        const nestedTools = retired === 'tools/' && before === '/' && /[\w-]/u.test(text[at - 2] ?? '');
        if (!historical && !nestedTools && !/[\w-]/u.test(before) && /[\w*{]/u.test(after)) {
          found.push(`${path}:${index + 1}: retired path ${retired}: ${line.trim().slice(0, 180)}`);
          break;
        }
        at = text.indexOf(retired, at + retired.length);
      }
    }
    if (ROOT_OWNERS.has(path) && /process\s*\.\s*cwd\s*\(/u.test(text))
      found.push(`${path}:${index + 1}: preserve this owner's module-relative checkout root`);
  });
  return found;
}

export function checkStaleReferences(root: string): string[] {
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).split('\0').filter(Boolean);
  return [...new Set(paths)].flatMap(path => existsSync(resolve(root, path))
    ? staleReferenceLines(path, readFileSync(resolve(root, path))) : []);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const failures = checkStaleReferences(resolve(import.meta.dirname, '../../..'));
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log('PASS: live references avoid retired paths and relocated roots stay module-relative.');
}

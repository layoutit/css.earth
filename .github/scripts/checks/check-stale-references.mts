import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { parse } from 'yaml';
import { MODULE_RELATIVE_ROOT_OWNERS, RETIRED_PATHS } from './retired-paths.mts';

const POLICY = new Set(['.github/scripts/checks/retired-paths.mts', '.github/scripts/checks/historical-jwst-references.json', '.github/scripts/checks/check-stale-references.mts']);
// Exact committed prose is history; new strings cannot acquire a retired route through these exceptions.
const historicalValue: unknown = JSON.parse(readFileSync(new URL('./historical-jwst-references.json', import.meta.url), 'utf8'));
if (!historicalValue || typeof historicalValue !== 'object' || Array.isArray(historicalValue)) throw new TypeError('Invalid historical JWST references');
const HISTORICAL_JWST_REFERENCES = new Map<string, readonly string[]>();
for (const [path, lines] of Object.entries(historicalValue)) {
  if (!Array.isArray(lines) || !lines.every((line: unknown) => typeof line === 'string')) throw new TypeError(`Invalid historical references: ${path}`);
  HISTORICAL_JWST_REFERENCES.set(path, lines);
}
const URL_PATTERN = /https?:\/\/[^\s"'<>`)]+/gu;
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
    if (HISTORICAL_JWST_REFERENCES.get(path)?.includes(line.trim())) return;
    if (liveLines && !liveLines.has(index)) return;
    const text = line.replace(URL_PATTERN, url => {
      const live = url.match(/^https?:\/\/github\.com\/[^/]+\/[^/]+\/blob\/main\/(.+)$/u);
      return live?.[1] ?? '';
    });
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

/** Workflow command paths are live callers, including paths not in the retired-path ledger. */
export function workflowCommandPaths(text: string): string[] {
  const paths: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'run' && typeof child === 'string') {
        for (const line of child.replace(/\\\r?\n/gu, ' ').split('\n')) {
          if (!/\b(?:node|pnpm)\b/u.test(line)) continue;
          for (const token of line.matchAll(/(?:^|[\s"'])(\.?\/?(?:packages|site|src|labs|integration|\.github)\/[^\s"';&|<>]+|(?:[\w.@-]+\/)*[\w.@-]+\.(?:[cm]?[jt]s|tsx|json))/gu)) {
            const path = token[1]!.replace(/^\.\//u, '');
            if (!/[*?{}$]/u.test(path)) paths.push(path);
          }
        }
      } else visit(child);
    }
  };
  visit(parse(text));
  return [...new Set(paths)];
}

export function checkStaleReferences(root: string): string[] {
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).split('\0').filter(Boolean);
  const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).split('\0'));
  return [...new Set(paths)].flatMap(path => {
    if (!existsSync(resolve(root, path))) return [];
    const bytes = readFileSync(resolve(root, path));
    const workflow = /^\.github\/workflows\/.*\.ya?ml$/u.test(path)
      ? workflowCommandPaths(bytes.toString()).filter(target => !tracked.has(target)).map(target => `${path}: workflow command path is not tracked: ${target}`) : [];
    return [...staleReferenceLines(path, bytes), ...workflow];
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const failures = checkStaleReferences(resolve(import.meta.dirname, '../../..'));
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log('PASS: live references avoid retired paths and relocated roots stay module-relative.');
}

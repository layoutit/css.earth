/** Derive semantic seeds and pure-move enforcement from the actual Git source diff. */
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { applicationSource } from './source-paths.mts';
export interface SourceDiff { paths: string[]; renames: Record<string, string>; specifierOnly: boolean; }
/** Remove only import operands, never executable constants or arbitrary strings. */
export function importSkeleton(text: string): string {
  const tree = ts.createSourceFile('source.ts', text, ts.ScriptTarget.Latest, true);
  const ranges: [number, number][] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) ranges.push([node.moduleSpecifier.getStart(tree), node.moduleSpecifier.end]);
    if ((ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isNewExpression(node) && node.expression.getText(tree) === 'URL') && node.arguments?.[0] && ts.isStringLiteralLike(node.arguments[0])) ranges.push([node.arguments[0].getStart(tree), node.arguments[0].end]);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) text = text.slice(0, start) + '<specifier>' + text.slice(end);
  return text.replace(/(@import\s+)(['"])([^'"]+)\2|url\(\s*(['"]?)([^\s'"()]+)\4\s*\)/gu, '<style-specifier>');
}
export function sourceDiff(checkout: string, base: string, head: string): SourceDiff {
  // Source files can exceed execFileSync's 1 MiB default (shared ledgers are several MiB).
  const git = (args: string[]): string => execFileSync('git', args, { cwd: checkout, encoding: 'utf8', maxBuffer: 1024 ** 3 });
  const fields = git(['diff', '--name-status', '-z', '-M', `${base}..${head}`]).split('\0');
  const paths = new Set<string>(), renames: Record<string, string> = {}; let specifierOnly = true;
  for (let i = 0; i < fields.length && fields[i];) {
    const status = fields[i++]!, old = fields[i++]!;
    const next = status.startsWith('R') || status.startsWith('C') ? fields[i++]! : old;
    if (!applicationSource(old) && !applicationSource(next)) continue;
    paths.add(old); paths.add(next);
    if (status.startsWith('R')) renames[old] = next;
    if (!/^[MR]/u.test(status)) { specifierOnly = false; continue; }
    if (status === 'R100') continue; // Identical bytes: the skeletons are equal without reading them.
    if (importSkeleton(git(['show', `${base}:${old}`])) !== importSkeleton(git(['show', `${head}:${next}`]))) specifierOnly = false;
  }
  return { paths: [...paths].sort(), renames, specifierOnly: specifierOnly && Object.keys(renames).length > 0 };
}

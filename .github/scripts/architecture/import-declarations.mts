/** Declaration inventory layered on the production cruise and resolver; no independent resolution policy.
 * Computed imports remain unresolved. Astro CSS and new URL assets are recorded although the scanner
 * cannot see them; markup component references use their frontmatter imports, as in the scanner. */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, extname, posix, resolve } from 'node:path';
import { isBuiltin } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { astroScriptBlocks } from './astro-imports.mts';
import { buildImportGraph, importTarget, readWorkspaces, trackedStandIn, type ImportGraph } from './graph.mts';
import { createResolver } from './resolver.mts';
import { byText, isTestPath, zoneOf } from './zones.mts';

export const KINDS = ['value', 'type', 'lazy', 'asset'] as const;
export type Kind = typeof KINDS[number];
export interface Declaration {
  readonly from: string; readonly line: number; readonly specifier: string; readonly to: string | null;
  readonly kind: Kind; readonly symbols: readonly string[]; readonly form: string;
  readonly sideEffectOnly: boolean; readonly test: boolean; readonly unresolved?: boolean;
}
interface Parsed extends Omit<Declaration, 'from' | 'to' | 'test'> { readonly computed?: boolean }
export const codeTarget = (path: string): boolean => /\.(?:[cm]?[jt]s|tsx|jsx|astro)(?:[?#].*)?$/u.test(path);
const lineAt = (source: string, offset: number): number => source.slice(0, offset).split('\n').length;

/** Parse declarations without resolving them; offsets in Astro always refer to the original source. */
export function parseDeclarations(source: string, file: string): Parsed[] {
  const found: Parsed[] = [];
  const parse = (text: string, offset: number): void => {
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const add = (node: ts.Node, specifier: string, kind: Kind, symbols: string[], form: string, sideEffectOnly = false, computed = false): void => {
      found.push({ line: lineAt(source, offset + node.getStart(tree)), specifier, kind, symbols, form, sideEffectOnly, ...(computed ? { computed: true } : {}) });
    };
    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
        const bindings = clause?.namedBindings ?? (ts.isExportDeclaration(node) ? node.exportClause : undefined);
        const symbols: string[] = clause?.name ? ['default'] : [];
        if (bindings && (ts.isNamespaceImport(bindings) || ts.isNamespaceExport(bindings))) symbols.push('*');
        else if (bindings) for (const element of bindings.elements) symbols.push((element.propertyName ?? element.name).text);
        if (ts.isExportDeclaration(node) && !node.exportClause) symbols.push('*');
        const inlineType = bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) && bindings.elements.length > 0
          && bindings.elements.every(element => element.isTypeOnly) && !clause?.name;
        const type = clause?.isTypeOnly || (ts.isExportDeclaration(node) && node.isTypeOnly) || inlineType;
        const side = ts.isImportDeclaration(node) && !clause;
        add(node, node.moduleSpecifier.text, type ? 'type' : 'value', symbols,
          side ? 'side-effect' : ts.isImportDeclaration(node) ? 'import' : node.exportClause ? 'export-from' : 'export-star', side);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
        add(node, node.argument.literal.text, 'type', [node.qualifier?.getText(tree).split('.')[0] ?? '*'], 'import-type-node');
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
        && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
        add(node, node.moduleReference.expression.text, node.isTypeOnly ? 'type' : 'value', ['*'], 'import');
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0]) {
        const arg = node.arguments[0];
        add(node, ts.isStringLiteralLike(arg) ? arg.text : arg.getText(tree), 'lazy', ['(dynamic)'], 'dynamic-import', false, !ts.isStringLiteralLike(arg));
      } else if (ts.isNewExpression(node) && node.expression.getText(tree) === 'URL' && node.arguments?.length === 2
        && node.arguments[1]?.getText(tree) === 'import.meta.url' && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
        add(node, node.arguments[0].text, 'value', [], 'new URL(.., import.meta.url)');
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  };
  if (file.endsWith('.css')) {
    const uncommented = source.replace(/\/\*[\s\S]*?\*\//gu, comment => comment.replace(/[^\r\n]/gu, ' '));
    for (const match of uncommented.matchAll(/@import\s+(?:url\(\s*(?:["']([^"']+)["']|([^\s)]+))\s*\)|["']([^"']+)["'])/gu))
      found.push({ line: lineAt(source, match.index ?? 0), specifier: match[1] ?? match[2] ?? match[3] ?? '', kind: 'asset', symbols: [], form: 'side-effect', sideEffectOnly: true });
  } else if (!file.endsWith('.astro')) parse(source, 0);
  else {
    // Reuse the scanner's eligibility and extraction, then recover each block's real source offset.
    const frontmatter = /^\s*---\r?\n([\s\S]*?)\r?\n---/u.exec(source);
    if (frontmatter?.[1] !== undefined) parse(astroScriptBlocks(frontmatter[0])[0] ?? '', frontmatter[0].indexOf('\n', frontmatter[0].indexOf('---')) + 1);
    for (const script of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu)) {
      const block = astroScriptBlocks(script[0])[0];
      if (block === undefined) continue;
      const attributes = script[1] ?? '';
      const src = /\bsrc\s*=\s*["']([^"']+)["']/u.exec(attributes);
      const offset = (script.index ?? 0) + (src ? script[0].indexOf(src[0]) : script[0].indexOf('>') + 1);
      parse(block, offset);
    }
    for (const style of source.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gu)) {
      const attributes = style[1] ?? '', body = style[2] ?? '', offset = (style.index ?? 0) + style[0].indexOf('>') + 1;
      const src = /\bsrc\s*=\s*["']([^"']+)["']/u.exec(attributes);
      if (src?.[1]) found.push({ line: lineAt(source, style.index ?? 0), specifier: src[1], kind: 'asset', symbols: [], form: 'side-effect', sideEffectOnly: true });
      const uncommented = body.replace(/\/\*[\s\S]*?\*\//gu, comment => comment.replace(/[^\r\n]/gu, ' '));
      for (const match of uncommented.matchAll(/@import\s+(?:url\(\s*(?:["']([^"']+)["']|([^\s)]+))\s*\)|["']([^"']+)["'])/gu)) {
        found.push({ line: lineAt(source, offset + (match.index ?? 0)), specifier: match[1] ?? match[2] ?? match[3] ?? '', kind: 'asset', symbols: [], form: 'side-effect', sideEffectOnly: true });
      }
    }
  }
  return found;
}

export interface InventoryOptions { readonly prefix: string; readonly checkAgainstScanner?: boolean; readonly graph?: ImportGraph }
const pairKey = (from: string, to: string) => `${from}\n${to}`;
export async function readImportDeclarations(checkout: string, options: InventoryOptions) {
  const root = realpathSync(checkout), files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).split('\0').filter(Boolean).sort(), tracked = new Set(files), workspaces = readWorkspaces(root, tracked);
  const selected = files.filter(file => file.startsWith(options.prefix) && /\.(mts|ts|tsx|mjs|astro|css)$/u.test(file));
  const graph = options.graph ?? await buildImportGraph(root, { details: false });
  const resolveImport = createResolver(root, graph.resolution?.tsconfigPath ?? resolve(root, 'tsconfig.json'), graph.resolution?.baseUrl);
  const dependencies = new Map(graph.resolution?.modules.map(module => [module.source, module.dependencies]) ?? []);
  const parsedFiles = new Map(selected.map(from => [from, parseDeclarations(readFileSync(resolve(root, from), 'utf8'), from)]));
  const relativePath = (from: string, specifier: string) => specifier.startsWith('.') ? posix.normalize(posix.join(posix.dirname(from), specifier.replace(/[?#].*$/u, ''))) : undefined;
  const candidates = [...new Set([...parsedFiles].flatMap(([from, entries]) => entries.map(entry => relativePath(from, entry.specifier)).filter((path): path is string => path !== undefined)))];
  const ignoredResult = spawnSync('git', ['check-ignore', '-z', '--stdin'], { cwd: root, input: candidates.join('\0'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (ignoredResult.error) throw ignoredResult.error;
  if (ignoredResult.status !== 0 && ignoredResult.status !== 1) throw new Error(`git check-ignore failed: ${ignoredResult.stderr}`);
  const ignored = new Set(ignoredResult.stdout.split('\0').filter(Boolean));
  const declarations: Declaration[] = [];
  for (const [from, entries] of parsedFiles) for (const parsed of entries) {
    const { computed, ...entry } = parsed;
    const problems: { from: string; specifier: string; reason: string }[] = [];
    const dependency = dependencies.get(from)?.find(item => item.module === parsed.specifier);
    const resolved = dependency && !dependency.couldNotResolve ? dependency.resolved : resolveImport(from, parsed.specifier);
    const relative = relativePath(from, parsed.specifier);
    // Resolve ignored generated inputs by their declared address, never by their presence on disk.
    const declared = relative ? trackedStandIn(relative, tracked) ?? (ignored.has(relative) ? relative : undefined) : undefined;
    let to = computed ? undefined : declared ?? importTarget(from, parsed.specifier, resolved, workspaces, tracked, problems);
    const bare = !/^(\.|\/|#)/u.test(parsed.specifier);
    if (!computed && to === undefined && !problems.length && (isBuiltin(parsed.specifier) || parsed.specifier.startsWith('astro:') || (bare && resolved !== undefined))) {
      to = parsed.specifier.startsWith('@') ? parsed.specifier.split('/').slice(0, 2).join('/') : parsed.specifier.split('/')[0];
      if (isBuiltin(parsed.specifier) || parsed.specifier.startsWith('astro:')) to = parsed.specifier;
    }
    const target = to && tracked.has(to) ? to : resolved ?? parsed.specifier;
    const kind = !computed && extname(target.replace(/[?#].*$/u, '')) && !codeTarget(target) ? 'asset' : entry.kind;
    declarations.push({ ...entry, from, to: to ?? null, kind, test: isTestPath(from), ...(to === undefined ? { unresolved: true } : {}) });
  }
  declarations.sort((a, b) => byText(a.from, b.from) || a.line - b.line || byText(a.specifier, b.specifier) || byText(a.form, b.form));
  const pairs = new Map<string, { from: string; to: string; kinds: Record<Kind, number>; declarations: number }>();
  for (const entry of declarations) {
    if (entry.to === null) continue;
    const key = pairKey(entry.from, entry.to), pair = pairs.get(key) ?? { from: entry.from, to: entry.to, kinds: { value: 0, type: 0, lazy: 0, asset: 0 }, declarations: 0 };
    pair.kinds[entry.kind]++; pair.declarations++; pairs.set(key, pair);
  }
  const folderPairs = new Map<string, { from: string; to: string; kinds: Record<Kind, number>; filePairs: number; declarations: number }>();
  for (const pair of pairs.values()) {
    const from = zoneOf(pair.from), to = tracked.has(pair.to) ? zoneOf(pair.to) : pair.to, key = pairKey(from, to);
    const entry = folderPairs.get(key) ?? { from, to, kinds: { value: 0, type: 0, lazy: 0, asset: 0 }, filePairs: 0, declarations: 0 };
    for (const kind of KINDS) if (pair.kinds[kind]) entry.kinds[kind]++;
    entry.filePairs++; entry.declarations += pair.declarations; folderPairs.set(key, entry);
  }
  const scanner = { checked: false, missing: [] as string[], extra: [] as string[], exceptions: [] as { pair: string; reason: string }[], unexplained: 0 };
  if (options.checkAgainstScanner) {
    const expected = new Set(graph.edges.filter(edge => selected.includes(edge.from) && tracked.has(edge.to)).map(edge => pairKey(edge.from, edge.to)));
    const actual = new Set([...pairs.values()].filter(pair => tracked.has(pair.to)).map(pair => pairKey(pair.from, pair.to)));
    scanner.checked = true;
    scanner.missing = [...expected].filter(key => !actual.has(key)).sort(byText);
    for (const key of [...actual].filter(key => !expected.has(key)).sort(byText)) {
      const hits = declarations.filter(entry => entry.to !== null && pairKey(entry.from, entry.to) === key);
      if (hits.every(entry => entry.form === 'new URL(.., import.meta.url)' || ((entry.from.endsWith('.astro') || entry.from.endsWith('.css')) && entry.kind === 'asset')))
        scanner.exceptions.push({ pair: key, reason: 'Production scanner does not read new URL or stylesheet imports' });
      else scanner.extra.push(key);
    }
    scanner.unexplained = scanner.missing.length + scanner.extra.length;
  }
  return { base: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), declarations,
    pairs: [...pairs.values()].sort((a, b) => byText(a.from, b.from) || byText(a.to, b.to)),
    summary: { files: selected, declarations: declarations.length, filePairs: pairs.size, unresolved: declarations.filter(entry => entry.unresolved).length,
      folderPairs: [...folderPairs.values()].sort((a, b) => byText(a.from, b.from) || byText(a.to, b.to)), scanner } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2); let prefix = 'site/', out: string | undefined, checkAgainstScanner = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--prefix' && args[i + 1]) prefix = args[++i]!;
      else if (args[i] === '--out' && args[i + 1]) out = args[++i]!;
      else if (args[i] === '--check-against-scanner') checkAgainstScanner = true;
      else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
    }
    const result = await readImportDeclarations(process.cwd(), { prefix, checkAgainstScanner });
    const json = `${JSON.stringify(result, null, 2)}\n`;
    if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, json); } else console.log(json);
    console.error(`${result.summary.declarations} declarations; ${result.summary.filePairs} file pairs; ${result.summary.scanner.unexplained} unexplained scanner mismatches`);
    if (result.summary.scanner.unexplained) process.exitCode = 1;
  } catch (error) { console.error(error); process.exitCode = 1; }
}

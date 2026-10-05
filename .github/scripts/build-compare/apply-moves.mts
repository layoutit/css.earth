/** Replay file moves and preserve statically resolved relative references before invoking git mv. */
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export type MoveMap = Record<string, string | null>;
interface Reference { start: number; end: number; value: string; directory: boolean; glob?: boolean; }
interface Edit { start: number; end: number; value: string; }
interface UnresolvedReference { movedOperand?: boolean; classification: 'UNRESOLVED'; file: string; line: number; expression: string; }
interface MovePlan { moved: number; rewritten: number; moves: MoveMap; rewrites: { file: string; edits: { line: number; from: string; to: string }[] }[]; manualReviewRequired: UnresolvedReference[]; unrelatedWarnings: number; }
const slash = (path: string): string => path.split(sep).join('/');
function safePath(value: string): boolean {
  return value.length > 0 && !isAbsolute(value) && !value.includes('\\') && !value.includes('\0') && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}
export function validateMoves(value: unknown): MoveMap {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Move map must be an object');
  const result: MoveMap = {};
  const destinations = new Set<string>();
  for (const [source, target] of Object.entries(value)) {
    if (!safePath(source) || (target !== null && (typeof target !== 'string' || !safePath(target)))) throw new Error(`Invalid move: ${source}`);
    if (target !== null) {
      if (destinations.has(target) || source === target) throw new Error(`Duplicate or unchanged destination: ${target}`);
      destinations.add(target);
    }
    result[source] = target;
  }
  for (const target of destinations) if (Object.hasOwn(result, target)) throw new Error(`Overlapping moves are ambiguous: ${target}`);
  return result;
}
function regions(text: string, file: string): { text: string; offset: number }[] {
  if (!file.endsWith('.astro')) return [{ text, offset: 0 }];
  const result: { text: string; offset: number }[] = [];
  const front = /^(?:\uFEFF)?---[^\S\r\n]*\r?\n([\s\S]*?)^---[^\S\r\n]*(?:\r?\n|$)/mu.exec(text);
  let markup = text;
  if (front && front.index === 0) {
    const content = front[1] ?? '';
    const offset = front.index + front[0].indexOf('\n') + 1;
    result.push({ text: content, offset });
    markup = text.slice(0, front.index) + ' '.repeat(front[0].length) + text.slice(front.index + front[0].length);
  } else if (text.startsWith('---')) throw new Error(`Unclosed Astro frontmatter: ${file}`);
  markup = markup.replace(/<!--[\s\S]*?-->/gu, comment => ' '.repeat(comment.length));
  for (const match of markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu)) {
    const attributes = match[1] ?? '';
    const content = match[2] ?? '';
    if (/\btype\s*=\s*["'](?:application\/ld\+json|application\/json)["']/iu.test(attributes)) continue;
    result.push({ text: content, offset: (match.index ?? 0) + match[0].indexOf('>') + 1 });
  }
  return result;
}
/** Only literal for-of bindings are finite here; do not infer runtime values from names. */
function finiteTemplateValues(node: ts.TemplateExpression): string[] | undefined {
  let values = [node.head.text];
  for (const span of node.templateSpans) {
    let replacements: string[] | undefined;
    if (ts.isStringLiteralLike(span.expression)) replacements = [span.expression.text];
    if (ts.isIdentifier(span.expression)) {
      const identifier = span.expression.text;
      for (let owner: ts.Node | undefined = node.parent; owner; owner = owner.parent) {
        if (ts.isFunctionLike(owner)) break;
        if (ts.isBlock(owner) && owner.statements.some(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText() === identifier))) break;
        if (!ts.isForOfStatement(owner) || !ts.isVariableDeclarationList(owner.initializer)) continue;
        const declarations = owner.initializer.declarations;
        if (declarations.length !== 1 || declarations[0]?.name.getText() !== identifier || !(owner.initializer.flags & ts.NodeFlags.Const)) continue;
        let expression = owner.expression;
        while (ts.isAsExpression(expression) || ts.isParenthesizedExpression(expression)) expression = expression.expression;
        if (ts.isArrayLiteralExpression(expression) && expression.elements.every(ts.isStringLiteralLike)) replacements = expression.elements.map(element => ts.isStringLiteralLike(element) ? element.text : '');
        break;
      }
    }
    if (!replacements || values.length * replacements.length > 256) return undefined;
    values = values.flatMap(value => replacements.map(replacement => value + replacement + span.literal.text));
  }
  return values;
}
function references(text: string, file: string, moved: boolean, sources: string[], root: string, warnings: UnresolvedReference[]): Reference[] {
  const result: Reference[] = [];
  const relativeLiteral = (value: string): boolean => value.length > 0 && !value.startsWith('/') && !value.startsWith('#') && !/^[a-z][a-z0-9+.-]*:/iu.test(value);
  const warnMovedLiteral = (start: number, expression: string): void => {
    warnings.push({ classification: 'UNRESOLVED', file: slash(relative(root, file)), line: text.slice(0, start).split('\n').length, expression, movedOperand: true });
  };
  const add = (node: ts.Node | undefined, tree: ts.SourceFile, offset: number, directory = false, glob = false): void => {
    if (!node) throw new Error(`Missing reference in ${file}`);
    if (ts.isStringLiteralLike(node)) {
      result.push({ start: node.getStart(tree) + offset + 1, end: node.end + offset - 1, value: node.text, directory, glob });
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const finite = finiteTemplateValues(node);
      if (finite) {
        const targets = finite.map(value => slash(relative(root, resolveReference(root, file, value, directory)?.path ?? resolve(dirname(file), value))));
        if (targets.some(target => sources.includes(target))) throw new Error(`Finite computed reference crosses a moved file (UNRESOLVED; explicit literal review required) in ${file}: ${node.getText(tree)}`);
        if (!moved) return;
        throw new Error(`Computed reference in a moved importer requires an explicit literal: ${file}`);
      }
    }
    const expression = node.getText(tree);
    const literals: string[] = [];
    const collect = (child: ts.Node): void => {
      if (ts.isStringLiteralLike(child)) literals.push(child.text);
      ts.forEachChild(child, collect);
    };
    collect(node);
    const prefix = ts.isTemplateExpression(node) ? node.head.text : undefined;
    const isAbsoluteOrPackage = (value: string): boolean => value.startsWith('/') || /^[a-z][a-z0-9+.-]*:/iu.test(value) || (!directory && !value.startsWith('.'));
    const prefixPath = prefix && !isAbsoluteOrPackage(prefix) ? slash(relative(root, resolve(dirname(file), prefix))) : undefined;
    // Unknown operands may be relative; only explicit absolute/package templates or file URLs prove otherwise.
    const relativeToImporter = !(prefix && isAbsoluteOrPackage(prefix)) && !/^pathToFileURL\(/u.test(expression);
    const mentionsMovedSource = sources.some(source => {
      const names = [source, basename(source)];
      // A named folder operand can vary its leaf. An explicit unrelated file below
      // the same ancestor folder does not mention a moved folder operand.
      const folder = dirname(source);
      const folderOperand = (folder.includes('/') && expression.includes(folder)) || literals.some(literal => (folder.includes('/') && literal === folder) || literal === `${folder}/`) || (folder.includes('/') && expression === folder);
      return folderOperand || names.some(name => expression.includes(name) || literals.some(literal => literal.includes(name))) || literals.some(literal => {
        if (!literal.startsWith('.')) return false;
        const path = slash(relative(root, resolve(dirname(file), literal)));
        return path === source || path === dirname(source);
      });
    });
    const prefixCrossesMove = prefixPath !== undefined && sources.some(source => {
      const folder = dirname(source);
      return prefixPath === folder || prefixPath.startsWith(`${folder}/`);
    });
    const warning: UnresolvedReference = { classification: 'UNRESOLVED', file: slash(relative(root, file)), line: text.slice(0, node.getStart(tree) + offset).split('\n').length, expression };
    warnings.push(warning);
    if ((moved && relativeToImporter) || mentionsMovedSource || prefixCrossesMove) throw new Error(`Computed reference cannot be rewritten safely (UNRESOLVED; manual review required) in ${warning.file}:${warning.line}: ${expression}`);
  };
  for (const region of file.endsWith('.css') ? [] : regions(text, file)) {
    const tree = ts.createSourceFile(file, region.text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) add(node.moduleSpecifier, tree, region.offset);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        add(node.moduleReference.expression, tree, region.offset);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        add(node.argument.literal, tree, region.offset);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        add(node.arguments[0], tree, region.offset);
      } else if (ts.isCallExpression(node) && /^import\.meta\.glob(?:Eager)?$/u.test(node.expression.getText(tree))) {
        const operand = node.arguments[0];
        if (operand && ts.isArrayLiteralExpression(operand)) for (const element of operand.elements) add(element, tree, region.offset, false, true);
        else add(operand, tree, region.offset, false, true);
      } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' && node.arguments?.[1]?.getText(tree).replace(/\s/gu, '') === 'import.meta.url') {
        add(node.arguments[0], tree, region.offset, true);
      }
      // These APIs have caller-specific bases: rewriting an operand would guess its meaning.
      // Inspect each literal, including dirname-based and nested calls, without inventing a base.
      if (moved && (ts.isCallExpression(node) || ts.isNewExpression(node))) {
        const name = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '';
        const importerURL = ts.isNewExpression(node) && name === 'URL' && node.arguments?.[1]?.getText(tree).replace(/\s/gu, '') === 'import.meta.url';
        if (!importerURL && ['resolve', 'join', 'readFile', 'readFileSync', 'URL', 'fileURLToPath'].includes(name)) {
          for (const operand of node.arguments ?? []) if (ts.isStringLiteralLike(operand) && relativeLiteral(operand.text)) warnMovedLiteral(operand.getStart(tree) + region.offset, node.getText(tree));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  if (file.endsWith('.astro')) {
    // Astro treats a static script src as a module reference, even without an inline body.
    let markup = text;
    const frontmatter = regions(text, file)[0];
    if (frontmatter && frontmatter.offset <= 5) markup = ' '.repeat(frontmatter.offset + frontmatter.text.length) + text.slice(frontmatter.offset + frontmatter.text.length);
    markup = markup.replace(/<!--[\s\S]*?-->/gu, comment => ' '.repeat(comment.length));
    const warningMarkup = markup.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/giu, (_match: string, open: string, body: string, close: string) => open + body.replace(/[^\r\n]/gu, ' ') + close);
    if (moved) for (const tag of warningMarkup.matchAll(/<[a-z][^>]*>/giu)) for (const attribute of tag[0].matchAll(/\b(?:src|href)\s*=\s*(["'])([^"']+)\1|\b(?:src|href)\s*=\s*\{\s*(["'`])([^"'`]+)\3\s*\}|\b(?:src|href)\s*=\s*([^\s"'`=<>\{]+)/giu)) {
      const value = attribute[2] ?? attribute[4] ?? attribute[5] ?? '';
      if (relativeLiteral(value)) warnMovedLiteral((tag.index ?? 0) + (attribute.index ?? 0), attribute[0]);
    }
    if (moved) for (const tag of warningMarkup.matchAll(/<[a-z][^>]*>/giu)) for (const url of tag[0].matchAll(/url\(\s*(['"]?)([^\s'"()]+)\1\s*\)/gu)) {
      if (relativeLiteral(url[2]!)) warnMovedLiteral((tag.index ?? 0) + (url.index ?? 0), url[0]);
    }
    for (const match of markup.matchAll(/<script\b[^>]*?\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>/giu)) {
      const value = match[2] ?? '';
      const start = (match.index ?? 0) + match[0].indexOf(`${match[1]}${value}${match[1]}`) + 1;
      result.push({ start, end: start + value.length, value, directory: false });
    }
  }
  const cssRegions = file.endsWith('.css') ? [{ text, offset: 0 }] : [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/giu)].map(match => ({ text: match[1]!, offset: match.index! + match[0].indexOf('>') + 1 }));
  for (const region of cssRegions) for (const match of region.text.matchAll(/@import\s+(['"])([^'"]+)\1|url\(\s*(['"]?)([^\s'"()]+)\3\s*\)/gu)) {
    const value = match[2] ?? match[4]!;
    const start = region.offset + match.index! + match[0].indexOf(value);
    if (moved && file.endsWith('.astro') && match[4] !== undefined && relativeLiteral(value)) { warnMovedLiteral(start, match[0]); continue; }
    result.push({ start, end: start + value.length, value, directory: false });
  }
  return result;
}
interface Target { path: string; style: 'exact' | 'extensionless' | 'index' | 'js'; originalExtension: string; }
function resolveReference(root: string, importer: string, specifier: string, directory: boolean): Target | undefined {
  const path = resolve(dirname(importer), specifier);
  const extension = extname(path);
  if (directory && existsSync(path) && lstatSync(path).isDirectory()) return { path, style: 'exact', originalExtension: extension };
  const candidates: Target[] = [{ path, style: 'exact', originalExtension: extension }];
  if (!extension) {
    for (const suffix of ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.astro', '.json']) {
      candidates.push({ path: path + suffix, style: 'extensionless', originalExtension: '' });
      candidates.push({ path: resolve(path, `index${suffix}`), style: 'index', originalExtension: '' });
    }
  } else if (['.js', '.mjs', '.jsx'].includes(extension)) {
    for (const suffix of extension === '.mjs' ? ['.mts'] : extension === '.jsx' ? ['.tsx'] : ['.ts', '.tsx']) candidates.push({ path: path.slice(0, -extension.length) + suffix, style: 'js', originalExtension: extension });
  }
  const matches = candidates.filter(candidate => existsSync(candidate.path) && (lstatSync(candidate.path).isFile() || (directory && candidate.style === 'exact' && lstatSync(candidate.path).isDirectory())));
  if (matches.length > 1) throw new Error(`Ambiguous relative reference in ${slash(relative(root, importer))}: ${specifier}`);
  return matches[0];
}
export function applyMoves(checkout: string, rawMoves: unknown, options: { dryRun?: boolean } = {}): MovePlan {
  const root = resolve(checkout);
  const moves = validateMoves(rawMoves);
  const sources = Object.keys(moves);
  if (!existsSync(resolve(root, 'site'))) throw new Error('Checkout must contain site/');
  for (const [source, target] of Object.entries(moves)) {
    for (const candidate of [source, target]) {
      if (candidate === null) continue;
      let parent = root;
      for (const part of candidate.split('/')) {
        parent = resolve(parent, part);
        if (existsSync(parent) && lstatSync(parent).isSymbolicLink()) throw new Error(`Move traverses a symlink: ${candidate}`);
      }
    }
    if (target === null) throw new Error(`Deletion is comparison-only; apply-moves refuses ${source}`);
    const path = resolve(root, source);
    if (!existsSync(path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error(`Move source must be a regular file: ${source}`);
    if (existsSync(resolve(root, target))) throw new Error(`Move destination exists: ${target}`);
    execFileSync('git', ['ls-files', '--error-unmatch', '--', source], { cwd: root, stdio: 'pipe' });
  }
  const updates: { path: string; text: string }[] = [];
  const warnings: UnresolvedReference[] = [];
  const rewrites: MovePlan['rewrites'] = [];
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean).sort();
  for (const trackedFile of tracked) {
    const file = resolve(root, trackedFile);
    if (!existsSync(file) || lstatSync(file).isSymbolicLink()) continue;
    const originalId = slash(relative(root, file));
    const nextId = moves[originalId] ?? originalId;
    const nextFile = resolve(root, nextId);
    // Git's binary heuristic: never decode a large raster merely to discover its NUL bytes.
    const descriptor = openSync(file, 'r'), prefix = Buffer.alloc(8192);
    let length: number;
    try { length = readSync(descriptor, prefix, 0, prefix.length, 0); } finally { closeSync(descriptor); }
    if (prefix.subarray(0, length).includes(0)) continue;
    const text = readFileSync(file, 'utf8');
    if (text.includes('\0')) continue;
    const edits: Edit[] = [];
    const refs = /\.(?:[cm]?[jt]sx?|astro|css)$/u.test(file) ? references(text, file, nextFile !== file, sources, root, warnings) : [];
    // Exact repository path operands in maintained configuration are unambiguous.
    if (/(?:^|\/)(?:astro\.config\.mts|eslint\.config\.[cm]?[jt]s|package\.json|tsconfig[^/]*\.json)$|\.github\/workflows\/.*\.ya?ml$/u.test(originalId)) {
      for (const match of text.matchAll(/(['"])([^'"\r\n]+)\1/gu)) {
        const target = moves[match[2]!];
        if (typeof target === 'string') { const start = match.index! + 1; edits.push({ start, end: start + match[2]!.length, value: target }); }
      }
    }
    // Markdown local links resolve relative to the document; pinned remote links stay historical.
    if (file.endsWith('.md')) for (const match of text.matchAll(/\]\(([^)\s]+)\)/gu)) {
      const value = match[1]!; if (/^https?:/u.test(value)) continue;
      const start = match.index! + 2; refs.push({ start, end: start + value.length, value, directory: true });
    }
    for (const reference of refs) {
      if (reference.glob && /[*{]/u.test(reference.value)) {
        const pattern = slash(relative(root, resolve(dirname(file), reference.value))).replace(/[.+?^${}()|[\]\\]/gu, '\\$&').replace(/\*\*/gu, '.*').replace(/(?<!\.)\*/gu, '[^/]*');
        if (nextFile !== file) throw new Error(`Computed glob in moved importer cannot be rewritten safely: ${originalId}`);
        if (sources.some(source => new RegExp(`^${pattern}$`, 'u').test(source))) warnings.push({ classification: 'UNRESOLVED', file: originalId, line: text.slice(0, reference.start).split('\n').length, expression: `${reference.value} (covers ${sources.filter(source => new RegExp(`^${pattern}$`, 'u').test(source)).join(', ')})` });
        continue;
      }
      if (!reference.value.startsWith('./') && !reference.value.startsWith('../') && !(reference.directory && !reference.value.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/iu.test(reference.value))) continue;
      const split = /^([^?#]*)([?#][\s\S]*)?$/u.exec(reference.value);
      const originalPath = split?.[1] ?? reference.value;
      const suffix = split?.[2] ?? '';
      const target = resolveReference(root, file, originalPath, reference.directory);
      const unresolvedId = slash(relative(root, resolve(dirname(file), originalPath)));
      if (!target) {
        if (nextFile !== file || sources.some(source => source === unresolvedId || source.startsWith(`${unresolvedId}/`))) throw new Error(`Unresolved relative reference in ${originalId}: ${reference.value}`);
        continue;
      }
      const targetId = slash(relative(root, target.path));
      const nextTarget = moves[targetId] ?? targetId;
      if (nextFile === file && nextTarget === targetId) continue;
      let destination = resolve(root, nextTarget);
      if (target.style === 'extensionless') destination = destination.slice(0, -extname(destination).length);
      if (target.style === 'index') {
        if (!/^index\.[^/]+$/u.test(destination.split(sep).at(-1) ?? '')) throw new Error(`Move loses extensionless directory style: ${targetId}`);
        destination = dirname(destination);
      }
      if (target.style === 'js') destination = destination.slice(0, -extname(destination).length) + target.originalExtension;
      if (target.style === 'exact' && extname(destination) !== target.originalExtension) throw new Error(`Move changes extension style: ${targetId}`);
      let replacement = slash(relative(dirname(nextFile), destination));
      if (!replacement.startsWith('.')) replacement = `./${replacement}`;
      if (originalPath.endsWith('/') && !replacement.endsWith('/')) replacement += '/';
      const quote = text[reference.start - 1];
      if (/[\r\n\\]/u.test(replacement) || (quote && replacement.includes(quote))) throw new Error(`Move requires unsafe string escaping: ${nextTarget}`);
      edits.push({ start: reference.start, end: reference.end, value: replacement + suffix });
    }
    // Unaccounted mentions remain visible; original spans avoid destination basename noise.
    const tokens = [...new Set(sources.flatMap(source => [source, basename(source)]))];
    for (const token of tokens) {
      let offset = 0;
      while ((offset = text.indexOf(token, offset)) !== -1) {
        const at = offset; offset += token.length;
        if (refs.some(ref => at >= ref.start && at < ref.end) || edits.some(edit => at >= edit.start && at < edit.end)) continue;
        const lineStart = text.lastIndexOf('\n', at) + 1, lineEnd = text.indexOf('\n', at);
        const expression = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd).trim();
        if ([...text.matchAll(/https?:\/\/[^\s)]+\/(?:blob|tree)\/[a-f0-9]{7,40}\/[^\s)]*/gu)].some(link => at >= link.index! && at < link.index! + link[0].length)) continue;
        const warning: UnresolvedReference = { classification: 'UNRESOLVED', file: originalId, line: text.slice(0, at).split('\n').length, expression };
        if (!warnings.some(entry => entry.file === warning.file && entry.line === warning.line && entry.expression === warning.expression)) warnings.push(warning);
      }
    }
    for (const folder of new Set(sources.map(dirname))) for (const match of text.matchAll(/(['"`])([^'"`\r\n]+)\1/gu)) {
      const value = match[2]!;
      if (value === basename(folder)) continue; // A bare directory name does not identify a moved file.
      const relativeFolder = slash(relative(root, resolve(dirname(file), value.split(/[\*{]/u)[0]!)));
      if (value !== folder && value !== folder + '/' && !value.includes(folder + '/${') && !(value.startsWith('.') && relativeFolder === folder) && !(value.includes('*') && (value.startsWith(folder + '/') || relativeFolder === folder || relativeFolder.startsWith(folder + '/')))) continue;
      // Root folder mentions and unrelated wildcard patterns are not moved-file operands.
      if (!folder.includes('/')) {
        if (!value.includes('/') || !value.includes('*')) continue;
        const candidate = value.startsWith('.') ? slash(relative(root, resolve(dirname(file), value))) : value;
        const pattern = candidate.replace(/[.+?^${}()|[\]\\]/gu, '\\$&').replace(/\*\*/gu, '.*').replace(/(?<!\.)\*/gu, '[^/]*');
        if (!sources.some(source => new RegExp(`^${pattern}$`, 'u').test(source))) continue;
      }
      const at = match.index!;
      const warning: UnresolvedReference = { classification: 'UNRESOLVED', file: originalId, line: text.slice(0, at).split('\n').length, expression: match[0], movedOperand: true };
      if (!warnings.some(entry => entry.file === warning.file && entry.line === warning.line)) warnings.push(warning);
    }
    if (edits.length) rewrites.push({ file: nextId, edits: edits.map(edit => ({ line: text.slice(0, edit.start).split('\n').length, from: text.slice(edit.start, edit.end), to: edit.value })) });
    let updated = text;
    for (const edit of edits.sort((a, b) => b.start - a.start)) updated = updated.slice(0, edit.start) + edit.value + updated.slice(edit.end);
    if (updated !== text) updates.push({ path: nextFile, text: updated });
  }
  const relevant = warnings.filter(warning => warning.movedOperand || sources.some(source => [source, basename(source)].some(token => warning.expression.includes(token)) || [dirname(source), dirname(source) + '/'].some(folder => (folder.includes('/') && (warning.expression === folder || warning.expression.includes(JSON.stringify(folder)) || warning.expression.includes(`'${folder}'`))) || warning.expression.includes(`${folder}/\${`))));
  const plan: MovePlan = { moved: sources.length, rewritten: updates.length, moves, rewrites, manualReviewRequired: relevant, unrelatedWarnings: warnings.length - relevant.length };
  if (options.dryRun) return plan;
  // Preflight is complete: an ambiguous reference leaves the checkout untouched.
  for (const [source, target] of Object.entries(moves)) {
    if (target === null) throw new Error('Unexpected deletion');
    mkdirSync(dirname(resolve(root, target)), { recursive: true });
    execFileSync('git', ['mv', '--', source, target], { cwd: root, stdio: 'pipe' });
  }
  for (const update of updates) writeFileSync(update.path, update.text);
  return plan;
}
function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const args = process.argv.slice(2).filter(argument => argument !== '--dry-run');
  if (args.length !== 3 || args[0] !== '--checkout' || !args[1] || !args[2]) throw new Error('Usage: apply-moves.mts --checkout <dir> moves.json [--dry-run]');
  const value: unknown = JSON.parse(readFileSync(resolve(args[2]), 'utf8'));
  console.log('Move plan (manual review required for UNRESOLVED warnings):');
  console.log(JSON.stringify(applyMoves(args[1], value, { dryRun }), null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; }
}

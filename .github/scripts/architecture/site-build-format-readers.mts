/** Build readers must admit shared JSON through the format owner, before projecting it. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { schemaLiterals } from './format-schema-ownership.mts';
import { isTestPath } from './zones.mts';

interface ReaderPolicy { readonly schema: string; readonly readers: readonly string[]; readonly paths: readonly string[] }
/** Schema constants and admission policies come from objects source, so this works before dist exists. */
function readerPolicies(root: string, files: readonly string[]): ReaderPolicy[] {
  const constants = new Map<string, string>();
  for (const path of files.filter(path => path.startsWith('packages/objects/src/') && !isTestPath(path) && /\.[cm]?ts$/u.test(path))) {
    if (!existsSync(resolve(root, path))) continue;
    const tree = ts.createSourceFile(path, readFileSync(resolve(root, path), 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isStringLiteralLike(node.initializer) && /^cssearth-[a-z0-9-]+@[0-9]+$/u.test(node.initializer.text)) constants.set(node.name.text, node.initializer.text);
      ts.forEachChild(node, visit);
    }; visit(tree);
  }
  const policies: ReaderPolicy[] = [];
  for (const path of files.filter(path => path.startsWith('packages/objects/src/') && path.endsWith('/format-reader-ledger.ts'))) {
  const ledger = resolve(root, path);
  if (!existsSync(ledger)) continue;
  const tree = ts.createSourceFile(ledger, readFileSync(ledger, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const properties = new Map(node.properties.flatMap(property => ts.isPropertyAssignment(property) ? [[property.name.getText(tree), property.initializer] as const] : []));
      const schema = properties.get('schema'), readers = properties.get('readers'), paths = properties.get('paths');
      if (schema && ts.isIdentifier(schema) && readers && ts.isArrayLiteralExpression(readers) && paths && ts.isArrayLiteralExpression(paths)) {
        const id = constants.get(schema.text);
        if (!id) throw new TypeError(`Unknown objects schema constant in reader ledger: ${schema.text}`);
        const strings = (array: ts.ArrayLiteralExpression) => array.elements.map(element => {
          if (!ts.isStringLiteralLike(element)) throw new TypeError('Reader ledger requires literal reader names and relative paths.');
          return element.text;
        });
        policies.push({ schema: id, readers: strings(readers), paths: strings(paths) });
      }
    }
    ts.forEachChild(node, visit);
  }; visit(tree);
  }
  return policies;
}

/** Discover addresses from tracked schema-bearing records, never a checkout-specific absolute path. */
export function sharedFormatPaths(root: string, files: readonly string[]): Set<string> {
  const known = new Set(files.filter(path => path.startsWith('packages/objects/src/') && /\.[cm]?ts$/u.test(path))
    .flatMap(path => existsSync(resolve(root, path)) ? schemaLiterals(path, readFileSync(resolve(root, path), 'utf8')) : []));
  const paths = new Set<string>();
  for (const path of files.filter(path => path.endsWith('.json'))) {
    if (!existsSync(resolve(root, path))) continue;
    const text = readFileSync(resolve(root, path), 'utf8');
    // Reading schema data for discovery is not an application reader.
    let value: unknown;
    try { value = JSON.parse(text); } catch { continue; }
    if (value === null || typeof value !== 'object' || !('schema' in value) || typeof value.schema !== 'string' || !known.has(value.schema)) continue;
    const object = /^src\/objects\/[^/]+\/(.+)$/u.exec(path);
    paths.add(object?.[1] ?? path);
  }
  return paths;
}

export function buildFormatReaderFindings(path: string, text: string, sharedPaths: ReadonlySet<string>, allowedReaders: ReadonlyMap<string, ReadonlySet<string>> = new Map()): string[] {
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true), parsers = new Map<string, string>();
  const host = ts.createCompilerHost({ noResolve: true, noLib: true });
  host.getSourceFile = name => name === path ? tree : undefined;
  const checker = ts.createProgram([path], { noResolve: true, noLib: true }, host).getTypeChecker();
  const parserSymbols = new Map<ts.Symbol, string>(), calls: ts.CallExpression[] = [];
  const pathFunctions = new Set(['input', 'read', 'sourcePath']);
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) &&
        /^@cssearth\/objects(?:\/|$)/u.test(node.moduleSpecifier.text)) {
      for (const element of node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) ? node.importClause.namedBindings.elements : []) {
        if (/^(?:parse|read|validate|require|has)/u.test((element.propertyName ?? element.name).text)) { parsers.set(element.name.text, (element.propertyName ?? element.name).text); const symbol = checker.getSymbolAtLocation(element.name); if (symbol) parserSymbols.set(symbol, (element.propertyName ?? element.name).text); }
      }
    }
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) && /^node:(?:fs(?:\/promises)?|path|url)$/u.test(node.moduleSpecifier.text))
      for (const element of node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) ? node.importClause.namedBindings.elements : []) pathFunctions.add(element.name.text);
    if (ts.isCallExpression(node)) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const pathProducer = (node: ts.Expression): boolean => {
    if (ts.isAwaitExpression(node) || ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) return pathProducer(node.expression);
    if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) return false;
    if (ts.isCallExpression(node)) return ts.isIdentifier(node.expression) && pathFunctions.has(node.expression.text);
    return true;
  };
  const expanded = (node: ts.Node, seen = new Set<ts.Symbol>()): string => {
    let result = node.getText(tree);
    const walk = (child: ts.Node): void => {
      if (ts.isIdentifier(child) && !(ts.isPropertyAccessExpression(child.parent) && child.parent.name === child)) {
        const symbol = checker.getSymbolAtLocation(child), declaration = symbol?.valueDeclaration;
        if (symbol && !seen.has(symbol) && declaration && ts.isVariableDeclaration(declaration) && declaration.initializer && pathProducer(declaration.initializer) && !declaration.initializer.getText(tree).includes('JSON.parse')) {
          const next = new Set(seen); next.add(symbol);
          result += '\n' + expanded(declaration.initializer, next);
        }
        if (declaration && ts.isVariableDeclaration(declaration) && !declaration.initializer && ts.isVariableDeclarationList(declaration.parent)
          && ts.isForOfStatement(declaration.parent.parent)) {
          let values = declaration.parent.parent.expression;
          if (ts.isAsExpression(values)) values = values.expression;
          if (ts.isArrayLiteralExpression(values)) for (const value of values.elements)
            if (ts.isStringLiteralLike(value)) result += '\n' + node.getText(tree).replaceAll('${' + child.text + '}', value.text);
        }
      }
      ts.forEachChild(child, walk);
    };
    walk(node); return result;
  };
  let requiredReaders: ReadonlySet<string> | undefined;
  const isParser = (call: ts.CallExpression): boolean => {
    if (!ts.isIdentifier(call.expression)) return false;
    const symbol = checker.getSymbolAtLocation(call.expression), reader = symbol && parserSymbols.get(symbol);
    return reader !== undefined && (requiredReaders === undefined || requiredReaders.has(reader));
  };
  const admitted = (node: ts.Node): boolean => {
    for (let parent = node.parent; parent && !ts.isSourceFile(parent); parent = parent.parent) {
      if (ts.isCallExpression(parent) && isParser(parent)) return true;
      if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent) || ts.isFunctionDeclaration(parent)) return false;
      // A field access or newly constructed record must not masquerade as admission of the original document.
      if (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent) || ts.isObjectLiteralExpression(parent) || ts.isArrayLiteralExpression(parent)) return false;
      if ((ts.isVariableDeclaration(parent) || ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) && ts.isIdentifier(ts.isVariableDeclaration(parent) ? parent.name : parent.left)) {
        const symbol = checker.getSymbolAtLocation(ts.isVariableDeclaration(parent) ? parent.name : parent.left);
        // A separate unknown binding is allowed only when its first reference is a parser argument.
        const references: ts.Identifier[] = [];
        const collect = (child: ts.Node): void => {
          if (ts.isIdentifier(child) && checker.getSymbolAtLocation(child) === symbol && child.pos > parent.end) references.push(child);
          ts.forEachChild(child, collect);
        };
        collect(tree);
        const first = references.find(reference => {
          const parent = reference.parent;
          return !(ts.isBinaryExpression(parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(parent.operatorToken.kind)
            && (parent.left.kind === ts.SyntaxKind.NullKeyword || parent.right.kind === ts.SyntaxKind.NullKeyword));
        });
        if (first) for (let owner = first.parent; owner && !ts.isSourceFile(owner); owner = owner.parent) {
          if (ts.isCallExpression(owner) && isParser(owner)) return true;
          if (ts.isPropertyAccessExpression(owner) || ts.isElementAccessExpression(owner) || ts.isObjectLiteralExpression(owner) || ts.isArrayLiteralExpression(owner)) return false;
          if (ts.isStatement(owner)) break;
        }
        return false;
      }
      if (ts.isStatement(parent)) break;
    }
    return false;
  };
  // Small local adapters may add editorial checks after forwarding their untouched input to an objects reader.
  const adapters = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && node.parameters[0] && ts.isIdentifier(node.parameters[0].name) && node.body) {
      const parameter = checker.getSymbolAtLocation(node.parameters[0].name), references: ts.Identifier[] = [];
      const collect = (child: ts.Node): void => {
        if (ts.isIdentifier(child) && checker.getSymbolAtLocation(child) === parameter) references.push(child);
        ts.forEachChild(child, collect);
      }; collect(node.body);
      const first = references[0];
      if (first?.parent && ts.isCallExpression(first.parent) && ts.isIdentifier(first.parent.expression) && parsers.has(first.parent.expression.text))
        {
        const symbol = checker.getSymbolAtLocation(node.name), imported = checker.getSymbolAtLocation(first.parent.expression), reader = imported && parserSymbols.get(imported);
        if (symbol && reader) parserSymbols.set(symbol, reader);
      }
    }
    ts.forEachChild(node, adapters);
  }; adapters(tree);
  const findings: string[] = [];
  const parseNodes: ts.Node[] = [...calls.filter(call => call.expression.getText(tree) === 'JSON.parse')];
  const callbacks = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && node.getText(tree) === 'JSON.parse' && ts.isCallExpression(node.parent) && node.parent.arguments.includes(node)) parseNodes.push(node);
    ts.forEachChild(node, callbacks);
  }; callbacks(tree);
  for (const parse of parseNodes) {
    requiredReaders = undefined;
    let transport: ts.Node = parse;
    for (let parent = parse.parent; parent && !ts.isStatement(parent); parent = parent.parent)
      if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === 'then') transport = parent;
    const instances: { node: ts.Node; origin: string }[] = [{ node: transport, origin: expanded(transport) }];
    // Follow a local JSON transport to its call sites, including parameterized generated filenames.
    for (let parent = parse.parent; parent && !ts.isSourceFile(parent); parent = parent.parent) {
      if (!ts.isFunctionDeclaration(parent) && !ts.isArrowFunction(parent) && !ts.isFunctionExpression(parent)) continue;
      const name = ts.isFunctionDeclaration(parent) ? parent.name : ts.isVariableDeclaration(parent.parent) ? parent.parent.name : undefined;
      if (!name || !ts.isIdentifier(name)) continue;
      let returned = false;
      for (let owner = parse.parent; owner && owner !== parent; owner = owner.parent) if (ts.isReturnStatement(owner)) returned = true;
      if (ts.isArrowFunction(parent) && !ts.isBlock(parent.body)) returned = true;
      if (!returned || admitted(parse)) break;
      const symbol = checker.getSymbolAtLocation(name);
      for (const call of calls.filter(call => ts.isIdentifier(call.expression) && checker.getSymbolAtLocation(call.expression) === symbol)) {
        let origin = expanded(parse) + '\n' + expanded(call);
        for (const [index, parameter] of parent.parameters.entries()) {
          const argument = call.arguments[index];
          if (ts.isIdentifier(parameter.name) && argument && ts.isStringLiteralLike(argument)) origin = origin.replaceAll('${' + parameter.name.text + '}', argument.text);
        }
        instances.push({ node: call, origin });
      }
      break;
    }
    for (const { node, origin } of instances) {
      const matches = [...sharedPaths].filter(address => origin.split(address).slice(0, -1).some(prefix => !/[a-zA-Z0-9_-]$/u.test(prefix))).sort((a, b) => b.length - a.length);
      if (!matches.length && !/cssearth-[a-z0-9-]+@[0-9]+/u.test(origin)) continue;
      const schema = origin.match(/cssearth-[a-z0-9-]+@[0-9]+/u)?.[0];
      requiredReaders = matches.length ? (matches.some(address => allowedReaders.has(address))
        ? new Set(matches.flatMap(address => [...allowedReaders.get(address) ?? []])) : undefined) : schema ? allowedReaders.get(schema) : undefined;
      if (admitted(node) || admitted(parse)) continue;
      const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
      findings.push(`${path}:${line + 1}: shared format JSON.parse must pass through its @cssearth/objects parser`);
    }
  }
  return [...new Set(findings)];
}

export function checkSiteBuildFormatReaders(root: string, files: readonly string[]): string[] {
  const paths = sharedFormatPaths(root, files), policies = readerPolicies(root, files);
  const allowed = new Map<string, Set<string>>();
  for (const policy of policies) allowed.set(policy.schema, new Set(policy.readers));
  for (const policy of policies) for (const path of policy.paths) { paths.add(path); allowed.set(path, new Set(policy.readers)); }
  for (const path of paths) {
    if (allowed.has(path)) continue;
    const records = files.filter(file => file === path || file.startsWith('src/objects/') && file.endsWith('/' + path));
    const readers = new Set<string>();
    for (const file of records) {
      if (!existsSync(resolve(root, file))) continue;
      const input: unknown = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
      if (input && typeof input === 'object' && 'schema' in input)
        for (const policy of policies.filter(policy => policy.schema === input.schema)) for (const reader of policy.readers) readers.add(reader);
    }
    allowed.set(path, readers);
  }
  return files.filter(path => path.startsWith('site/build/') && /\.[cm]?ts$/u.test(path) && !isTestPath(path) && existsSync(resolve(root, path)))
    .flatMap(path => buildFormatReaderFindings(path, readFileSync(resolve(root, path), 'utf8'), paths, allowed));
}

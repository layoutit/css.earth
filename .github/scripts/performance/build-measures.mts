/** Deterministic emitted-file counts; reads built HTML, JavaScript and comparison metadata without executing either. */
import { readFile, stat } from 'node:fs/promises';
import { posix, resolve, sep } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import ts from 'typescript';
import { parseHTML } from 'linkedom';
import { parseEnvironment, files, record, strings, array } from '../build-compare/records.mts';

export interface Measures { schema: string; global: Record<string, number>; routes: Record<string, RouteMeasure> }
export interface RouteMeasure { counts: Record<string, number>; sequences: Record<string, string[]>; declarations: unknown[] }
export const sortedJson = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, 'en'))) : item, 2) + '\n';
export function parseMeasures(value: unknown): Measures {
  const root = record(value);
  if (root.schema !== 'build-measures@1') throw new Error('Unknown measures schema');
  const counts = (raw: unknown) => Object.fromEntries(Object.entries(record(raw)).map(([key, value]) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid count ${key}`);
    return [key, value];
  }));
  return { schema: root.schema, global: counts(root.global), routes: Object.fromEntries(Object.entries(record(root.routes)).map(([route, raw]) => {
    const entry = record(raw);
    return [route, { counts: counts(entry.counts), sequences: Object.fromEntries(Object.entries(record(entry.sequences)).map(([key, value]) => [key, strings(value)])), declarations: array(entry.declarations) }];
  })) };
}
/** Content-addressed file names (`name.<hash>.ext`) change whenever their file does, so every importer's text changes with them. The hash
 * characters are a naming artefact, not delivered code: compressed sizes are taken with each exact reference to an emitted file carrying a
 * fixed placeholder of the same length. Raw sizes always come from the real, unnormalised bytes, and any other byte stays counted. */
export const HASH_PLACEHOLDER = '00000000';
export function hashReferenceNormalizer(emitted: Iterable<string>): (bytes: Buffer) => Buffer {
  const names = new Map<string, string>();
  for (const file of emitted) {
    const name = posix.basename(file), parts = /^(.+)\.([A-Za-z0-9_-]{8})\.([A-Za-z0-9]+)$/u.exec(name);
    if (parts) names.set(name, `${parts[1]}.${HASH_PLACEHOLDER}.${parts[3]}`);
  }
  if (!names.size) return bytes => bytes;
  const escaped = [...names.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1)).map(name => name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'));
  const pattern = new RegExp(`(?<![A-Za-z0-9_.@~$-])(?:${escaped.join('|')})(?![A-Za-z0-9_-])`, 'gu');
  return bytes => Buffer.from(bytes.toString('latin1').replace(pattern, name => names.get(name)!), 'latin1');
}
const TEXT_FILE = /\.(?:[cm]?js|css|html?|json|txt|xml|svg|webmanifest)$/u;
export function localFile(dist: string, url: string): string {
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('\\')) throw new Error(`Not a local URL: ${url}`);
  const path = resolve(dist, '.' + decodeURIComponent(url.split(/[?#]/u)[0]!));
  if (!path.startsWith(resolve(dist) + sep)) throw new Error(`Outside dist: ${url}`);
  return path;
}
export function imports(code: string): { static: string[]; dynamic: string[]; unresolved: string[] } {
  const source = ts.createSourceFile('chunk.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const result: { static: string[]; dynamic: string[]; unresolved: string[] } = { static: [], dynamic: [], unresolved: [] };
  const literal = (node: ts.Node): string => {
    if (!ts.isStringLiteralLike(node)) throw new Error(`Nonliteral import cannot be counted: ${node.getText()}`);
    return node.text;
  };
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) { if (node.moduleSpecifier) result.static.push(literal(node.moduleSpecifier)); }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (!node.arguments[0]) throw new Error('Missing import target');
      if (ts.isStringLiteralLike(node.arguments[0])) result.dynamic.push(literal(node.arguments[0]));
      else result.unresolved.push(node.arguments[0].getText());
    }
    ts.forEachChild(node, visit);
  }
  visit(source); return result;
}
/** Recognizes the emitted startup bootstrap arguments and additional literal fetch calls; never evaluates source. */
export interface RequestDeclaration { url: string; method: string }
export function startupDeclarations(code: string, route = '/', deferred: RequestDeclaration[] = []): RequestDeclaration[] {
  const source = ts.createSourceFile('inline.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), urls: RequestDeclaration[] = [];
  let bootstrapCalls = 0, bootstrapFetchSites = 0;
  function visit(node: ts.Node, inBootstrap = false) {
    if (ts.isCallExpression(node)) {
      let expression: ts.Expression = node.expression;
      while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
      if (ts.isFunctionExpression(expression) && expression.name?.text === 'startStartupRequests') {
        bootstrapCalls++;
        const list = node.arguments[1], transport = node.arguments[2], sceneRoute = node.arguments[3];
        if (!list || !ts.isArrayLiteralExpression(list) || !transport || !ts.isStringLiteralLike(transport) || !sceneRoute || !ts.isStringLiteralLike(sceneRoute)) throw new Error('Unsupported startup arguments');
        const loop: ts.ForOfStatement[] = [];
        function findLoop(child: ts.Node) { if (ts.isForOfStatement(child)) loop.push(child); ts.forEachChild(child, findLoop); }
        findLoop(expression);
        if (loop.length !== 1) throw new Error('Unsupported startup loop structure');
        const iterable = loop[0]!.expression;
        let defaultView = true;
        if (ts.isConditionalExpression(iterable)) {
          if (!ts.isIdentifier(iterable.condition) || iterable.condition.text !== 'defaultView' || !ts.isIdentifier(iterable.whenFalse) || iterable.whenFalse.text !== 'urls') throw new Error('Unsupported startup condition');
          let condition = '';
          function findCondition(child: ts.Node) { if (ts.isVariableDeclaration(child) && ts.isIdentifier(child.name) && child.name.text === 'defaultView') condition = child.initializer?.getText().replace(/\s/gu, '').replaceAll("'", '"') ?? ''; ts.forEachChild(child, findCondition); }
          findCondition(expression);
          if (condition !== '(location.pathname==="/"||location.pathname===sceneRoute)&&!["dataset","feature","v","settings","q"].some((key)=>query.has(key))') throw new Error('Unsupported default-view eligibility');
          defaultView = route === '/' || route === sceneRoute.text;
        }
        const selected = ts.isConditionalExpression(iterable) ? iterable.whenTrue : iterable;
        if (!ts.isArrayLiteralExpression(selected) || selected.elements.length !== 2 || selected.elements[0]?.getText() !== 'transportUrl' || selected.elements[1]?.getText() !== '...urls') throw new Error('Unsupported startup URL loop');
        const target = { url: transport.text, method: 'GET' };
        if (defaultView) urls.push(target); else deferred.push(target);
        urls.push(...list.elements.map(element => { if (!ts.isStringLiteralLike(element)) throw new Error('Nonliteral startup URL'); return { url: element.text, method: 'GET' }; }));
      }
      if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'fetch') throw new Error('Unsupported member fetch expression');
      if (ts.isIdentifier(expression) && expression.text === 'fetch') {
        const argument = node.arguments[0];
        // The bootstrap's loop is covered by its validated call arguments.
        if (argument && ts.isStringLiteralLike(argument)) {
          let method = 'GET';
          const options = node.arguments[1];
          if (options) {
            if (!ts.isObjectLiteralExpression(options)) throw new Error('Unresolved fetch options');
            for (const property of options.properties) {
              if (!ts.isPropertyAssignment(property) || (!ts.isIdentifier(property.name) && !ts.isStringLiteralLike(property.name))) throw new Error('Unresolved fetch options property');
              if (property.name.text === 'method') { if (!ts.isStringLiteralLike(property.initializer) || !/^[A-Za-z]+$/u.test(property.initializer.text)) throw new Error('Unresolved fetch method'); method = property.initializer.text.toUpperCase(); }
            }
          }
          urls.push({ url: argument.text, method });
        } else {
          if (!inBootstrap || !argument || !ts.isIdentifier(argument) || argument.text !== 'url' || node.arguments.length !== 1) throw new Error('Unresolved inline fetch');
          bootstrapFetchSites++;
        }
      }
    }
    ts.forEachChild(node, child => visit(child, inBootstrap || (ts.isFunctionExpression(node) && node.name?.text === 'startStartupRequests')));
  }
  visit(source);
  if (bootstrapCalls !== bootstrapFetchSites) throw new Error('Unsupported startup fetch loop');
  return urls;
}
export const startup = (code: string): string[] => startupDeclarations(code).map(request => request.url);
export async function measure(dist: string, metadata: string, routes: readonly string[]): Promise<Measures> {
  const environments = await Promise.all((await files(metadata)).filter(file => file.endsWith('.json')).map(async file => parseEnvironment(JSON.parse(await readFile(resolve(metadata, file), 'utf8')))));
  const chunks = environments.filter(env => env.environment.startsWith('client') || env.environment.startsWith('worker:')).flatMap(env => env.chunks);
  if (!chunks.length) throw new Error('Missing client metadata');
  const byFile = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
  if (byFile.size !== chunks.length) throw new Error('Duplicate chunks');
  const graph = new Map<string, ReturnType<typeof imports>>(), sizes = new Map<string, { raw: number; gzip: number; brotli: number }>();
  const withoutHashText = hashReferenceNormalizer(await files(dist));
  const withoutHashName = (text: string): string => withoutHashText(Buffer.from(text, 'latin1')).toString('latin1');
  const size = async (url: string) => {
    let cached = sizes.get(url);
    if (!cached) { const bytes = url.startsWith('data:') ? Buffer.from(url.split(',')[1]!, url.includes(';base64,') ? 'base64' : 'utf8') : await readFile(localFile(dist, url)); const compressed = !url.startsWith('data:') && TEXT_FILE.test(url.split(/[?#]/u)[0]!) ? withoutHashText(bytes) : bytes; cached = { raw: bytes.length, gzip: gzipSync(compressed).length, brotli: brotliCompressSync(compressed, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }).length }; sizes.set(url, cached); }
    return cached;
  };
  for (const chunk of chunks) {
    const code = await readFile(localFile(dist, '/' + chunk.fileName), 'utf8');
    const parsed = imports(code), edge = (target: string) => {
      if (!target.startsWith('.')) throw new Error(`External chunk import: ${target}`);
      const file = posix.normalize(posix.join(posix.dirname(chunk.fileName), target));
      if (!byFile.has(file)) throw new Error(`Missing metadata chunk ${file}`);
      return file;
    };
    const entry = { static: parsed.static.map(edge), dynamic: parsed.dynamic.map(edge), unresolved: parsed.unresolved };
    for (const [actual, expected] of [[entry.static, chunk.imports], [entry.dynamic, chunk.dynamicImports]]) {
      if (JSON.stringify([...new Set(actual)].sort()) !== JSON.stringify([...new Set(expected)].sort())) throw new Error(`Metadata import mismatch: ${chunk.fileName}`);
    }
    graph.set(chunk.fileName, entry);
  }
  const basicIdentity = (chunk: typeof chunks[number]) => chunk.facadeModuleId ? posix.basename(chunk.facadeModuleId) : chunk.name;
  const identity = (file: string) => {
    const chunk = byFile.get(file); if (!chunk) throw new Error(`Unknown chunk ${file}`);
    const name = basicIdentity(chunk);
    if (chunks.filter(other => basicIdentity(other) === name).length === 1) return name;
    const owners = [...new Set(chunk.modules.map(module => module.id.startsWith('packages/') ? module.id.split('/')[1]! : posix.basename(module.id)))].sort();
    return `${name}[${owners.join(',')}]`;
  };
  if (new Set(chunks.map(chunk => identity(chunk.fileName))).size !== chunks.length) throw new Error('Ambiguous chunk identities');
  const closure = (entries: string[], dynamic = false): string[] => {
    const seen = new Set<string>();
    function walk(file: string) { if (seen.has(file)) return; const node = graph.get(file); if (!node) throw new Error(`Unknown entry ${file}`); seen.add(file); for (const child of [...node.static, ...dynamic ? node.dynamic : []]) walk(child); }
    entries.forEach(walk); return [...seen];
  };
  const chain = (file: string, ancestors = new Set<string>()): number => {
    if (ancestors.has(file)) return 0; // Count each chunk once on a simple path, including cycles.
    const next = new Set(ancestors).add(file);
    return 1 + Math.max(0, ...graph.get(file)!.static.map(child => chain(child, next)));
  };
  const modules = chunks.flatMap(chunk => chunk.modules);
  const loaders = new Map<string, string>();
  for (const module of modules) {
    if (!module.code || !module.code.includes('queuedImport')) continue;
    let cursor = 0;
    const source = ts.createSourceFile('module.js', module.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && node.initializer.getText().includes('queuedImport')) {
        const targets = imports(node.initializer.getText()).dynamic;
        for (const _target of targets) {
          const id = module.dynamicallyImportedIds[cursor++];
          const target = chunks.find(chunk => chunk.modules.some(member => member.id === id));
          if (!target) throw new Error(`Cannot resolve queued loader ${node.name.text}`);
          loaders.set(node.name.text, target.fileName);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const boot = modules.find(module => posix.basename(module.id) === 'startup-boot.mts');
  const declaredQueue: string[] = [];
  if (loaders.size && !boot?.code) throw new Error('Missing startup queue schedule metadata');
  if (boot?.code) {
    const source = ts.createSourceFile('boot.js', boot.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const functionLoads = (name: string): string[] => {
      const found: string[] = [];
      const body = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
      if (!body) throw new Error(`Missing startup function ${name}`);
      function visit(node: ts.Node) { if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && loaders.has(node.expression.text)) found.push(loaders.get(node.expression.text)!); ts.forEachChild(node, visit); }
      visit(body); return found;
    };
    declaredQueue.push(...functionLoads('startBodyCode'));
    const layout = modules.find(module => module.code?.includes('loadStartupWorld(window).then('));
    if (!layout?.code) throw new Error('Unsupported startup layout schedule');
    const router = /loadStartupWorld\(window\)\.then\((\w+)\)/u.exec(layout.code)?.[1];
    if (!router || !loaders.has(router)) throw new Error('Unresolved startup router');
    declaredQueue.push(loaders.get(router)!, ...functionLoads('startViewCode'));
  }
  const output: Measures = { schema: 'build-measures@1', global: {}, routes: {} };
  const all = await files(dist);
  for (const [label, selected] of [['astro', all.filter(file => file.startsWith('_astro/') && file.endsWith('.js'))], ['css', all.filter(file => file.endsWith('.css'))], ['transports', all.filter(file => /^(objects|world)\/.*\.json$/u.test(file))]] as const) {
    output.global[`${label}.count`] = selected.length;
    const stats = await Promise.all(selected.map(file => stat(localFile(dist, '/' + file))));
    output.global[`${label}.raw`] = stats.reduce((sum, file) => sum + file.size, 0);
    if (label === 'transports') selected.forEach((file, index) => { output.global[`transport.${file}.raw`] = stats[index]!.size; });
    if (label === 'css') for (const file of selected) {
      const asset = environments.flatMap(env => env.assets).find(asset => asset.fileName === file);
      const name = asset?.names.join('|') || file;
      for (const [kind, bytes] of Object.entries(await size('/' + file))) { output.global[`stylesheet.${name}.${kind}`] = bytes; if (kind !== 'raw') output.global[`css.${kind}`] = (output.global[`css.${kind}`] ?? 0) + bytes; }
    }
    if (label === 'astro') for (const file of selected) { for (const [kind, bytes] of Object.entries(await size('/' + file))) { output.global[`astro.${kind}`] = kind === 'raw' ? output.global['astro.raw']! : (output.global[`astro.${kind}`] ?? 0) + bytes; output.global[`chunk.${identity(file)}.${kind}`] = bytes; } }
  }
  for (const route of [...new Set(routes)].sort()) {
    if (!/^\/(?:[a-z0-9-]+\/)?$/u.test(route)) throw new Error(`Invalid route ${route}`);
    const html = await readFile(localFile(dist, route + 'index.html'));
    const { document } = parseHTML(html.toString());
    const counts: Record<string, number> = {}, sequences: Record<string, string[]> = {}, declarations: unknown[] = [];
    const add = (key: string, value: number) => { counts[key] = (counts[key] ?? 0) + value; };
    const addSize = async (key: string, url: string) => { for (const [kind, bytes] of Object.entries(await size(url))) add(`${key}.${kind}`, bytes); };
    await addSize('document', route + 'index.html');
    for (const rel of ['preload', 'modulepreload', 'prefetch', 'preconnect', 'dns-prefetch', 'stylesheet']) counts[`links.${rel}`] = 0;
    for (const key of ['scripts.module', 'scripts.classic', 'scripts.async', 'scripts.defer', 'inline.script.count', 'inline.script.raw', 'inline.style.count', 'inline.style.raw', 'hint.image', 'hint.font', 'stylesheet.raw', 'startup.requests', 'startup.raw', 'startup.gzip', 'startup.brotli']) counts[key] = 0;
    for (const link of document.querySelectorAll('link')) for (const rel of (link.getAttribute('rel') ?? '').toLowerCase().split(/\s+/u)) {
      if (!Object.hasOwn(counts, `links.${rel}`)) continue;
      const href = link.getAttribute('href'); if (!href) throw new Error('Link lacks href');
      add(`links.${rel}`, 1);
      const as = link.getAttribute('as') ?? ''; if (as === 'image' || as === 'font') add(`hint.${as}`, 1);
      declarations.push({ rel, href: withoutHashName(href), as, fetchpriority: link.getAttribute('fetchpriority') ?? '', noscript: !!link.closest('noscript') });
      if (rel === 'stylesheet' && href.startsWith('/')) add('stylesheet.raw', (await stat(localFile(dist, href))).size);
    }
    const entries: string[] = [], inlineDynamic: string[] = [], requests: RequestDeclaration[] = [], deferred: RequestDeclaration[] = [];
    for (const script of document.querySelectorAll('script')) {
      const src = script.getAttribute('src');
      if (src) { const module = script.getAttribute('type') === 'module'; add(`scripts.${module ? 'module' : 'classic'}`, 1); for (const flag of ['async', 'defer']) if (script.hasAttribute(flag)) add(`scripts.${flag}`, 1); declarations.push({ src: withoutHashName(src), module, async: script.hasAttribute('async'), defer: script.hasAttribute('defer') }); if (module) entries.push(src.replace(/^\//u, '')); }
      else { if (script.getAttribute('type') === 'module') {
        const parsed = imports(script.textContent ?? '');
        const target = (url: string) => { const address = new URL(url, 'https://build.invalid' + route); if (address.origin !== 'https://build.invalid') throw new Error('External inline module import'); const file = address.pathname.slice(1); if (!byFile.has(file)) throw new Error('Missing inline import metadata'); return file; };
        entries.push(...parsed.static.map(target)); inlineDynamic.push(...parsed.dynamic.map(target)); counts['inline.dynamic.unresolved'] = (counts['inline.dynamic.unresolved'] ?? 0) + parsed.unresolved.length; if (parsed.unresolved.length) sequences['inline.unresolved'] = [...sequences['inline.unresolved'] ?? [], ...parsed.unresolved];
      } add('inline.script.count', 1); add('inline.script.raw', Buffer.byteLength(script.textContent ?? '')); if (!script.getAttribute('type') || script.getAttribute('type') === 'module') requests.push(...startupDeclarations(script.textContent ?? '', route, deferred)); }
    }
    for (const style of document.querySelectorAll('style')) { add('inline.style.count', 1); add('inline.style.raw', Buffer.byteLength(style.textContent ?? '')); }
    const staticFiles = closure(entries), reachable = closure([...entries, ...inlineDynamic], true);
    counts['static.count'] = staticFiles.length; counts['static.chain'] = Math.max(0, ...entries.map(file => chain(file)));
    for (const file of staticFiles) { await addSize('static', '/' + file); await addSize(`chunk.${identity(file)}`, '/' + file); }
    const dynamicTargets = [...new Set([...inlineDynamic, ...reachable.flatMap(file => graph.get(file)!.dynamic)])];
    counts['dynamic.count'] = dynamicTargets.length;
    if (inlineDynamic.length) sequences['imports.inline'] = inlineDynamic.map(identity);
    counts['dynamic.unresolved'] = reachable.reduce((sum, file) => sum + graph.get(file)!.unresolved.length, 0);
    for (const file of reachable) if (graph.get(file)!.unresolved.length) sequences[`unresolved.${identity(file)}`] = graph.get(file)!.unresolved;
    for (const file of dynamicTargets) { await addSize('dynamic', '/' + file); await addSize(`lazy.${identity(file)}`, '/' + file); }
    for (const file of reachable) { const order = graph.get(file)!.dynamic; if (order.length) sequences[`imports.${identity(file)}`] = order.map(identity); }
    sequences.startup = requests.map(({ url, method }) => url.startsWith('data:') ? `${method} embedded-world-summary` : `${method} ${url}`);
    for (const { url, method } of requests) { if (!url.startsWith('data:')) { add('startup.requests', 1); add(`startup.methods.${method}`, 1); } await addSize('startup', url); await addSize(`transport.${url.startsWith('data:') ? 'embedded-summary' : url}`, url); }
    sequences['startup.deferred'] = deferred.map(({ url, method }) => `${method} ${url}`);
    counts['startup.deferred.requests'] = deferred.length;
    for (const { url } of deferred) { await addSize('startup.deferred', url); await addSize(`transport.${url}`, url); }
    counts['startup.parallelRounds'] = requests.some(({ url }) => !url.startsWith('data:')) ? 1 : 0;
    counts['lazy.staticClosure.count'] = reachable.length;
    for (const file of reachable) await addSize('lazy.staticClosure', '/' + file);
    counts['astro.count'] = reachable.length;
    for (const file of reachable) await addSize('astro', '/' + file);
    counts['css.raw'] = counts['stylesheet.raw']! + counts['inline.style.raw']!;
    const routeTransports = [...new Set([...requests, ...deferred].map(request => request.url.split(/[?#]/u)[0]!).filter(url => /^\/(objects|world)\//u.test(url)))];
    counts['transports.count'] = routeTransports.length;
    for (const url of routeTransports) await addSize('transports', url);
    // Source-ordered declarations, not a claim about conditional browser execution.
    sequences.entries = entries.map(identity);
    const queue = [...new Set(declaredQueue)].filter(file => reachable.includes(file) && !staticFiles.includes(file));
    sequences['startup.queue'] = queue.map(identity);
    counts['startup.queue.count'] = queue.length;
    const fetched = new Set(staticFiles);
    let rounds = Math.max(counts['startup.parallelRounds']!, counts['static.chain']!);
    for (const file of queue) {
      const depth = (target: string, seen = new Set<string>()): number => fetched.has(target) || seen.has(target) ? 0 : 1 + Math.max(0, ...graph.get(target)!.static.map(child => depth(child, new Set(seen).add(target))));
      rounds += depth(file); closure([file]).forEach(child => fetched.add(child));
    }
    counts['startup.sequentialRoundTrips'] = rounds + (deferred.length ? 1 : 0);
    declarations.sort((a, b) => { const left = record(a), right = record(b); return String(left.href ?? left.src).localeCompare(String(right.href ?? right.src), 'en') || sortedJson(a).localeCompare(sortedJson(b), 'en'); });
    output.routes[route] = { counts, sequences, declarations };
  }
  return output;
}

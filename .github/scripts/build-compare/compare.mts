/** Full emitted-tree comparison with separate source semantics and output layout verdicts. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import ts from 'typescript';
import { args, array, bytes, isMain, loadBuild, parseMoves, record, strings } from './records.mts';
import type { Build, Chunk, Moves } from './records.mts';
import { changedHunk, outputMatches, semanticPolicy, sourceSeedMatches } from './semantic-policy.mts';
import type { OutputPermission } from './semantic-policy.mts';

export type Mode = 'report' | 'pure-move' | 'semantic';
export type Dimension = 'modules' | 'imports' | 'membership' | 'references' | 'html' | 'css' | 'js' | 'asset' | 'data' | 'other' | 'files' | 'inventory' | 'order';
export interface Difference { dimension: Dimension; identity: string; base?: string; head?: string; insideClosure: boolean; declaredOutput?: boolean; layoutOnly?: boolean; modules: string[]; chunks: string[]; pages: string[]; detail?: { base: unknown; head: unknown }; diagnostic?: unknown }
export interface Report { diagnostics: { omitted: Record<string, number>; environments: Record<string, Record<string, number>>; environmentTotals: Record<string, number>; emittedBytesEqual: Record<string, boolean> }; semanticEqual: boolean; layoutEqual: boolean; equal: boolean; mode: Mode; exitCode: number; differences: Difference[]; closure: { modules: string[]; directImporters: string[]; chunks: string[]; pages: string[]; assets: string[]; outputs: string[] }; manifest: { base: Record<string, string>; head: Record<string, string>; metadata: { base: unknown; head: unknown } }; routes: Record<string, number[]>; htmlGroups: { pages: string[]; base: string; head: string }[]; declaration: { outputs: OutputPermission[]; layout: 'none' | 'changes'; layoutEligible: boolean; outsideClosure: string[] } }
const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const digest = (value: string): string => createHash('md5').update(value).digest('hex');
/** Bounded first differing region, including context without copying a whole module. */
export function codeHunk(base: string, head: string) {
  let start = 0;
  while (start < Math.min(base.length, head.length) && base[start] === head[start]) start++;
  const from = Math.max(0, start - 80);
  return { offset: start, baseLength: base.length, headLength: head.length,
    base: base.slice(from, start + 160), head: head.slice(from, start + 160) };
}
/** The artifact is a bounded review view; full inputs remain in each build's metadata/dist. */
export function compactReport(report: Report) {
  const bounded = (items: string[]) => ({ values: items.slice(0, 10), omitted: Math.max(0, items.length - 10) });
  return { ...report,
    differences: report.differences.map(({ detail, modules, chunks, pages, ...diff }) => ({ ...diff,
      ...(diff.dimension === 'html' && detail ? { detail: codeHunk(String(detail.base ?? ''), String(detail.head ?? '')) } : {}), modules: bounded(modules), chunks: bounded(chunks), pages: bounded(pages) })),
    closure: Object.fromEntries(Object.entries(report.closure).map(([key, values]) => [key, { count: values.length, ...bounded(values) }])),
    manifest: Object.fromEntries((['base', 'head'] as const).map(side => [side, { files: Object.keys(report.manifest[side]).length,
      dimensions: Object.fromEntries(sorted(Object.values(report.manifest[side])).map(dimension => [dimension, Object.values(report.manifest[side]).filter(value => value === dimension).length])) }])),
    routes: { count: Object.keys(report.routes).length, affected: Object.values(report.routes).filter(values => values.length).length },
    htmlGroups: report.htmlGroups.slice(0, 25).map(group => ({ ...codeHunk(group.base, group.head), pages: bounded(group.pages) })),
    declaration: { ...report.declaration, outsideClosure: bounded(report.declaration.outsideClosure) } };
}
export function classify(path: string): Dimension {
  if (/\.html$/u.test(path)) return 'html'; if (/\.css$/u.test(path)) return 'css'; if (/\.m?js$/u.test(path)) return 'js';
  if (/\.(?:json|bin|csv|xml|txt)$/u.test(path)) return 'data';
  if (/\.(?:png|jpe?g|webp|avif|svg|ico|gif|woff2?|ttf|mp[34]|ogg|wav|pdf)$/u.test(path)) return 'asset'; return 'other';
}
function renamer(moves: Moves): (id: string) => string {
  const entries = Object.entries(moves).sort(([a], [b]) => b.length - a.length);
  return id => {
    for (const [old, next] of entries) {
      // Astro virtual ids append a query; paths also appear after a virtual-id prefix.
      const at = id.indexOf(old);
      if (at >= 0 && (at === 0 || /[/:\0]/u.test(id[at - 1]!)) && (id.length === at + old.length || /[?&]/u.test(id[at + old.length]!))) return id.slice(0, at) + (next ?? `<deleted:${old}>`) + id.slice(at + old.length);
    }
    return id;
  };
}
interface Indexed {
  modules: Map<string, { environment: string; code: string | null; edges: string[]; assets: string[] }>;
  chunks: Map<string, { chunk: Chunk; modules: string[]; edges: string[]; assets: string[] }>;
  names: Map<string, string>;
  assetOwners: Map<string, string[]>;
  fileNames: Map<string, string>;
}
function index(build: Build, rename: (id: string) => string): Indexed {
  const result: Indexed = { modules: new Map(), chunks: new Map(), names: new Map(), assetOwners: new Map(), fileNames: new Map() };
  const emittedChunkFiles = new Set(build.environments.flatMap(env => env.chunks.map(chunk => chunk.fileName)).filter(name => build.files.has(name)));
  for (const env of build.environments) {
    const environment = env.environment.startsWith('worker') ? `worker:${env.chunks.filter(chunk => chunk.isEntry && chunk.facadeModuleId).map(chunk => rename(chunk.facadeModuleId!)).sort().join('|')}` : rename(env.environment);
    const local = new Map<string, string>();
    for (const chunk of env.chunks) {
      const ids = sorted(chunk.modules.map(module => rename(module.id)));
      const identity = `${environment}:chunk:${ids.length ? 'modules' : 'empty'}:${digest(JSON.stringify(ids.length ? ids : [rename(chunk.facadeModuleId ?? chunk.name)]))}`;
      if (result.chunks.has(identity)) throw new Error(`Ambiguous chunk identity: ${identity}`);
      local.set(chunk.fileName, identity);
      result.chunks.set(identity, { chunk, modules: ids, edges: [], assets: [] });
      // Only the client/worker output appears in dist; SSR names can coincide.
      if (build.files.has(chunk.fileName)) {
        const prior = result.names.get(chunk.fileName);
        if (prior && prior !== identity) throw new Error(`Ambiguous emitted name: ${chunk.fileName}`);
        result.names.set(chunk.fileName, identity);
      }
    }
    for (const asset of env.assets) {
      // Vite transports separately bundled workers as assets in their parent's bundle.
      if (emittedChunkFiles.has(asset.fileName)) continue;
      const origins = sorted(asset.originalFileNames.map(rename));
      // Assets without source paths retain their name: never identify them by their bytes.
      const identity = `asset:${JSON.stringify(origins.length ? origins : asset.names.length ? sorted(asset.names) : [asset.fileName])}`;
      const previous = result.names.get(asset.fileName);
      if (previous && previous !== identity) throw new Error(`Ambiguous asset identity: ${asset.fileName}`);
      result.names.set(asset.fileName, identity);
      result.assetOwners.set(identity, origins);
    }
    for (const chunk of env.chunks) {
      const identity = local.get(chunk.fileName)!;
      const entry = result.chunks.get(identity)!;
      entry.edges = sorted([...chunk.imports.map(name => `static:${local.get(name) ?? result.names.get(name) ?? name}`), ...chunk.dynamicImports.map(name => `dynamic:${local.get(name) ?? result.names.get(name) ?? name}`)]);
      entry.assets = sorted([...chunk.importedCss, ...chunk.importedAssets].map(name => result.names.get(name) ?? name));
      for (const module of chunk.modules) {
        const key = `${environment}:${rename(module.id)}`;
        const code = module.code === null ? null : module.code.replace(/__VITE_ASSET__[\w$]+__(?:\$_.*?__)?/gu, token => { const path = env.references?.[token]; if (!path) throw new Error(`Missing Vite asset reference binding: ${token}; rebuild with current comparison tools`); return path; });
        const value = { environment, code, edges: [...module.importedIds.map(id => `static:${rename(id)}`), ...module.dynamicallyImportedIds.map(id => `dynamic:${rename(id)}`)], assets: sorted([...module.importedCss, ...module.importedAssets].map(name => result.names.get(name) ?? name)) };
        const previous = result.modules.get(key);
        if (previous && !same(previous, value)) throw new Error(`Conflicting module records: ${key}`);
        result.modules.set(key, value);
      }
    }
  }
  for (const name of build.files.keys()) {
    const identity = result.names.get(name) ?? name;
    if (result.fileNames.has(identity)) throw new Error(`Duplicate file identity: ${identity}`);
    result.fileNames.set(identity, name);
  }
  return result;
}
const canonicalPatterns = new WeakMap<Indexed, { pattern: RegExp; replacements: Map<string, string> }>();
function canonical(text: string, indexed: Indexed, moves: Moves = {}): string {
  let cached = canonicalPatterns.get(indexed);
  if (!cached) {
    const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const full: string[] = [], sibling: string[] = [], replacements = new Map<string, string>();
    for (const [name, identity] of indexed.names) {
      full.push(escape(name)); replacements.set(name, `<emitted:${identity}>`);
      if (name.startsWith('_astro/')) {
        const tail = name.slice(7);
        sibling.push(escape(`./${tail}`), escape(tail));
        replacements.set(`./${tail}`, `./<emitted:${identity}>`); replacements.set(tail, `<emitted:${identity}>`);
      }
    }
    const longest = (values: string[]) => values.sort((a, b) => b.length - a.length).join('|') || '(?!)';
    cached = { pattern: new RegExp(`(?<![\\w.-])(?:${longest(full)})(?![\\w.-])|(?<![\\w/.-])(?:${longest(sibling)})(?![\\w.-])`, 'gu'), replacements };
    canonicalPatterns.set(indexed, cached);
  }
  text = text.replace(cached.pattern, match => cached.replacements.get(match)!);
  for (const [old, next] of Object.entries(moves).sort(([a], [b]) => b.length - a.length)) if (next !== null) text = text.replace(new RegExp(`(?<![\\w/.-])${old.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?![\\w/.-])`, 'gu'), () => next);
  return text;
}
function routePattern(facade: string | null): RegExp | undefined {
  if (!facade?.startsWith('\0virtual:astro:page:')) return undefined;
  const path = /(?:^|\/)pages\/(.*)$/u.exec(facade)?.[1]?.replace('@_@', '.');
  if (!path) return undefined;
  const html = path.endsWith('.astro');
  const route = path.replace(/\.(?:astro|[cm]?[jt]sx?)$/u, '').replace(/(?:^|\/)index$/u, '');
  let pattern = '', offset = 0;
  for (const match of route.matchAll(/\[(\.\.\.)?[^\]]+\]/gu)) {
    pattern += route.slice(offset, match.index).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    pattern += match[1] ? '.*' : '[^/]+'; offset = match.index! + match[0].length;
  }
  pattern += route.slice(offset).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  pattern = pattern.replace(/^\//u, '');
  return new RegExp(html ? pattern ? `^(?:${pattern}/index\\.html|${pattern}\\.html)$` : '^index\\.html$' : `^${pattern}$`, 'u');
}
function pageReferences(html: string, page: string): Set<string> {
  const { document } = parseHTML(html);
  const result = new Set<string>();
  const add = (value: string): void => {
    try { result.add(new URL(value, `https://comparison.invalid/${page}`).pathname.slice(1)); } catch { /* A non-URL attribute cannot reference an emitted file. */ }
  };
  for (const node of document.querySelectorAll('[src], [href], [poster], [data]')) for (const attr of ['src', 'href', 'poster', 'data']) { const value = node.getAttribute(attr); if (value) add(value); }
  for (const script of document.querySelectorAll('script:not([src])')) {
    const tree = ts.createSourceFile('inline.js', script.textContent ?? '', ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) add(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) add(node.arguments[0].text);
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  for (const style of document.querySelectorAll('style, [style]')) for (const match of (style.getAttribute('style') ?? style.textContent ?? '').matchAll(/url\(\s*['"]?([^\s'"()]+)['"]?\s*\)/gu)) add(match[1]!);
  return result;
}
export async function compare(base: Build, head: Build, moves: Moves = {}, mode: Mode = 'report', progress: (message: string) => void = () => {}, sourceChanges: { paths: string[]; objects?: string[]; outputs?: OutputPermission[]; layout?: 'none' | 'changes' } = { paths: [] }): Promise<Report> {
  for (const [label, build] of [['base', base], ['head', head]] as const) {
    if (!build.files.size || !build.environments.some(env => env.chunks.some(chunk => chunk.modules.length))) throw new Error(`Empty ${label} comparison build: files and module metadata are required`);
  }
  for (const build of [base, head]) for (const env of build.environments) for (const chunk of env.chunks) {
    for (const module of chunk.modules) {
      if (module.codeDigest !== undefined && digest(module.code ?? '<null>') !== module.codeDigest) throw new Error(`Module code evidence mismatch: ${module.id}`);
    }
    if (chunk.emittedDigest !== undefined && build.files.has(chunk.fileName) && digest((await bytes(build.files.get(chunk.fileName)!)).toString('utf8')) !== chunk.emittedDigest) throw new Error(`Emitted chunk evidence mismatch: ${chunk.fileName}`);
  }
  moves = parseMoves(moves);
  const a = index(base, renamer(moves)), b = index(head, id => id);
  const policy = semanticPolicy(sourceChanges);
  // Cache only parsed reference sets, never entire page bodies. Equal pages on the
  // two sides share a parse after exact byte comparison, not a compact digest.
  const pageCache = new Map<string, Promise<{ base: Set<string>; head: Set<string> }>>();
  const referencesFor = async (build: Build, name: string): Promise<Set<string>> => {
    let entry = pageCache.get(name);
    if (!entry) {
      entry = (async () => {
        const leftFile = base.files.get(name), rightFile = head.files.get(name);
        const [left, right] = await Promise.all([leftFile === undefined ? undefined : bytes(leftFile), rightFile === undefined ? undefined : bytes(rightFile)]);
        const leftReferences = left === undefined ? new Set<string>() : pageReferences(left.toString('utf8'), name);
        const rightReferences = right === undefined ? new Set<string>() : left?.equals(right) ? leftReferences : pageReferences(right.toString('utf8'), name);
        return { base: leftReferences, head: rightReferences };
      })();
      pageCache.set(name, entry);
    }
    return (await entry)[build === base ? 'base' : 'head'];
  };
  const differences: Difference[] = [], changed = new Set<string>(), seeded = new Set<string>(), directImporters = new Set<string>(), closureChunks = new Set<string>(), closureAssets = new Set<string>(), closurePages = new Set<string>(), closureOutputs = new Set<string>();
  const add = (dimension: Dimension, identity: string, modules: string[] = [], chunks: string[] = [], pages: string[] = [], baseName?: string, headName?: string): void => { differences.push({ dimension, identity, modules, chunks, pages, base: baseName, head: headName, insideClosure: false }); };
  const sourcePaths = mode === 'pure-move' ? [] : sourceChanges.paths.map(renamer(moves));
  for (const indexed of [a, b]) for (const key of indexed.modules.keys()) if (sourcePaths.some(path => sourceSeedMatches(key, path))) seeded.add(key);
  for (const indexed of [a, b]) for (const [key, module] of indexed.modules) {
    const environment = module.environment;
    if (!seeded.has(key) && module.edges.some(edge => seeded.has(`${environment}:${edge.slice(edge.indexOf(':') + 1)}`))) directImporters.add(key);
  }
  const permittedModules = new Set([...seeded, ...directImporters]);
  for (const object of sorted([...(base.inventories?.keys() ?? []), ...(head.inventories?.keys() ?? [])])) {
    const left = base.inventories?.get(object), right = head.inventories?.get(object);
    if (!left || !right || !(await bytes(left)).equals(await bytes(right))) {
      add('inventory', object);
      const entries = async (value: Buffer | string | undefined) => new Map(value === undefined ? [] : array(record(JSON.parse((await bytes(value)).toString('utf8'))).assets ?? []).map(raw => {
        const asset = record(raw); return [String(asset.location) + ':' + String(asset.filename), JSON.stringify(asset)] as const;
      }));
      const x = await entries(left), y = await entries(right);
      differences.at(-1)!.diagnostic = { assets: sorted([...x.keys(), ...y.keys()]).filter(name => x.get(name) !== y.get(name)) };
    }
  }
  for (const id of sorted([...a.modules.keys(), ...b.modules.keys()])) {
    const left = a.modules.get(id), right = b.modules.get(id);
    if (!left || !right || canonical(left.code ?? '<null>', a, moves) !== canonical(right.code ?? '<null>', b)) { changed.add(id); add('modules', id, [id]); }
    if (!left || !right || !same(left.edges, right.edges)) { changed.add(id); add('imports', id, [id]); }
  }
  // A module that only closure modules import, and that exists in one build only, leaves or enters the bundle with them: its removal is part of the change, not an independent one.
  // Importers are read from both graphs, so a deleted edge cannot shrink the permitted set; an importer outside the closure keeps it independent.
  const importersOf = new Map<string, Set<string>>();
  for (const indexed of [a, b]) for (const [key, module] of indexed.modules) for (const edge of module.edges) {
    const target = `${module.environment}:${edge.slice(edge.indexOf(':') + 1)}`;
    importersOf.set(target, (importersOf.get(target) ?? new Set()).add(key));
  }
  const orphaned = new Set<string>();
  const candidates = differences.filter(diff => diff.dimension === 'modules' || diff.dimension === 'imports').map(diff => diff.identity).filter(id => !permittedModules.has(id) && (!a.modules.has(id) || !b.modules.has(id)));
  for (let grew = true; grew;) {
    grew = false;
    for (const id of candidates) {
      if (permittedModules.has(id)) continue;
      const importers = [...(importersOf.get(id) ?? [])];
      if (importers.length > 0 && importers.every(importer => permittedModules.has(importer))) { permittedModules.add(id); orphaned.add(id); grew = true; }
    }
  }
  for (const id of sorted([...a.chunks.keys(), ...b.chunks.keys()])) {
    const left = a.chunks.get(id), right = b.chunks.get(id);
    const members = sorted([...(left?.modules ?? []), ...(right?.modules ?? [])]);
    if (!left || !right) add('membership', id, members, [id]);
    else if (!same([left.chunk.isEntry, left.chunk.isDynamicEntry, renamer(moves)(left.chunk.facadeModuleId ?? '')], [right.chunk.isEntry, right.chunk.isDynamicEntry, right.chunk.facadeModuleId ?? ''])) add('membership', id, members, [id]);
    if (left && right && !same(left.chunk.modules.map(module => renamer(moves)(module.id)), right.chunk.modules.map(module => module.id))) add('order', id, members, [id]);
    if (!left || !right || !same(left.edges, right.edges)) add('references', id, members, [id]);
  }
  // A native asset's emitted bytes are its source module's output. Attribute only unique source origins.
  for (const asset of sorted([...a.assetOwners.keys(), ...b.assetOwners.keys()])) {
    const leftName = a.fileNames.get(asset), rightName = b.fileNames.get(asset);
    if (!leftName || !rightName || (await bytes(base.files.get(leftName)!)).equals(await bytes(head.files.get(rightName)!))) continue;
    const origins = sorted([...(a.assetOwners.get(asset) ?? []), ...(b.assetOwners.get(asset) ?? [])]);
    if (origins.length !== 1) continue; // Mixed-origin output cannot prove which producer changed.
    for (const indexed of [a, b]) for (const id of indexed.modules.keys()) {
      const origin = origins[0]!;
      if (id.endsWith(`:${origin}`) || id.includes(`:${origin}?`)) { if (!changed.has(id)) add('modules', id, [id], [], [], leftName, rightName); changed.add(id); }
    }
  }
  // A module may be added or removed (its modules difference) only if it is a seed or an orphan of one; an importer may differ in its import list, never in its code.
  const layoutEligible = !differences.some(diff => diff.dimension === 'modules' && !seeded.has(diff.identity) && !orphaned.has(diff.identity))
    && !differences.some(diff => diff.dimension === 'imports' && !permittedModules.has(diff.identity));
  // Entry facades survive repartitioning. Normalize their URLs only after the
  // declared layout invariant is proved; page content still compares exactly.
  const layoutIndex = (indexed: Indexed, other: Indexed): Indexed => {
    if (mode !== 'semantic' || policy.layout !== 'changes' || !layoutEligible) return indexed;
    const names = new Map(indexed.names);
    for (const [name, id] of names) {
      const entry = indexed.chunks.get(id);
      if (!entry?.chunk.facadeModuleId) continue;
      const facade = indexed === a ? renamer(moves)(entry.chunk.facadeModuleId) : entry.chunk.facadeModuleId;
      const env = id.slice(0, id.indexOf(':chunk:'));
      if ([...other.chunks].some(([otherId, value]) => otherId.startsWith(`${env}:chunk:`) && (other === a ? renamer(moves)(value.chunk.facadeModuleId ?? '') : value.chunk.facadeModuleId) === facade)) names.set(name, `${env}:facade:${facade}`);
    }
    return { ...indexed, names };
  };
  const outputA = layoutIndex(a, b), outputB = layoutIndex(b, a);
  progress(`Module comparison finished: ${changed.size} changed modules`);
  // Union both graphs: deleted edges cannot shrink the permitted closure.
  for (const indexed of [a, b]) {
    for (const [id, entry] of indexed.chunks) {
      const env = id.slice(0, id.indexOf(':chunk:'));
      if (entry.modules.some(module => seeded.has(`${env}:${module}`) || directImporters.has(`${env}:${module}`) && changed.has(`${env}:${module}`))) closureChunks.add(id);
    }
  }
  for (const indexed of [a, b]) {
    for (const id of seeded) for (const asset of indexed.modules.get(id)?.assets ?? []) closureAssets.add(asset);
    // Chunk Vite metadata is the output attribution when getModuleInfo has none.
    for (const id of closureChunks) for (const asset of indexed.chunks.get(id)?.assets ?? []) {
      const owners = indexed.assetOwners.get(asset) ?? [];
      if (owners.some(owner => [...seeded].some(module => module.endsWith(`:${owner}`)))) closureAssets.add(asset);
    }
    for (const [asset, owners] of indexed.assetOwners) if (owners.some(owner => [...seeded].some(module => module.endsWith(`:${owner}`)))) closureAssets.add(asset);
  }
  // Only the server-render graph grants route changes; client references do not.
  for (const [build, indexed, rename] of [[base, a, renamer(moves)], [head, b, (id: string) => id]] as const) {
    const reachesSeed = (moduleKey: string, seen = new Set<string>()): boolean => {
      if (seeded.has(moduleKey)) return true;
      if (seen.has(moduleKey)) return false; seen.add(moduleKey);
      const module = indexed.modules.get(moduleKey); if (!module) return false;
      return module.edges.some(edge => reachesSeed(`${module.environment}:${edge.slice(edge.indexOf(':') + 1)}`, seen));
    };
    const patterns = [...indexed.chunks].flatMap(([id, entry]) => {
      if (!/^(?:prerender|ssr)/u.test(id)) return [];
      const facade = entry.chunk.facadeModuleId ? rename(entry.chunk.facadeModuleId) : null;
      const pattern = routePattern(facade);
      if (!pattern || !facade) return [];
      const environment = id.slice(0, id.indexOf(':chunk:'));
      const moduleKey = `${environment}:${facade}`;
      if (!indexed.modules.has(moduleKey)) throw new Error(`Missing prerender facade module graph: ${facade}`);
      return reachesSeed(moduleKey) ? [pattern] : [];
    });
    const inlineCss = [...closureAssets].flatMap(asset => {
      const name = indexed.fileNames.get(asset); return name && classify(name) === 'css' ? [name] : [];
    });
    const sheets = await Promise.all(inlineCss.map(async name => (await bytes(build.files.get(name)!)).toString('utf8')));
    for (const [name, value] of build.files) {
      const route = patterns.some(pattern => pattern.test(name));
      let hasInline = false;
      if (classify(name) === 'html' && sheets.length) {
        const text = (await bytes(value)).toString('utf8');
        hasInline = sheets.some(sheet => sheet.length > 0 && text.includes(`<style>${sheet}</style>`));
      }
      if (route || hasInline) { closureOutputs.add(name); if (classify(name) === 'html') closurePages.add(name); }
    }
  }
  // Astro copies the public directory verbatim: a changed source file there is its own output at the same relative path.
  for (const path of sourcePaths) {
    const copied = /^(?:site\/)?public\/(.+)$/u.exec(path)?.[1];
    if (copied && (base.files.has(copied) || head.files.has(copied))) closureOutputs.add(copied);
  }
  progress('Output closure finished');
  let comparedFiles = 0;
  progress('Comparing emitted file bytes');
  for (const id of sorted([...a.fileNames.keys(), ...b.fileNames.keys()])) {
    if (++comparedFiles % 10000 === 0) progress(`Compared ${comparedFiles} emitted files`);
    const leftName = a.fileNames.get(id), rightName = b.fileNames.get(id);
    const name = rightName ?? leftName!;
    const dimension = classify(name);
    const chunks = a.chunks.has(id) || b.chunks.has(id) ? [id] : [];
    const pages = dimension === 'html' ? [name] : [];
    const modules = sorted([...(a.chunks.get(id)?.modules ?? []), ...(b.chunks.get(id)?.modules ?? [])]);
    if (!leftName || !rightName) {
      add('files', id, modules, chunks, pages, leftName, rightName); add(dimension, id, modules, chunks, pages, leftName, rightName);
      if (dimension === 'html') differences.at(-1)!.detail = changedHunk(leftName ? canonical((await bytes(base.files.get(leftName)!)).toString('utf8'), outputA, moves) : '', rightName ? canonical((await bytes(head.files.get(rightName)!)).toString('utf8'), outputB) : '');
      continue;
    }
    const left = await bytes(base.files.get(leftName)!), right = await bytes(head.files.get(rightName)!);
    if (left.equals(right)) continue;
    const text = ['html', 'css', 'js'].includes(dimension) || /\.(?:json|csv|xml|txt)$/u.test(name) || /^(?:_headers|_redirects)$/u.test(name);
    if (!(text ? Buffer.from(canonical(left.toString('utf8'), outputA, moves)).equals(Buffer.from(canonical(right.toString('utf8'), outputB))) : left.equals(right))) {
      add(dimension, id, modules, chunks, pages, leftName, rightName);
      if (dimension === 'html') differences.at(-1)!.detail = changedHunk(canonical(left.toString('utf8'), outputA, moves), canonical(right.toString('utf8'), outputB));
    }
  }
  progress('Emitted file bytes finished');
  const ancestors = (seeds: string[]): Set<string> => {
    const result = new Set(seeds); let grew = true;
    while (grew) { grew = false; for (const indexed of [a, b]) for (const [id, entry] of indexed.chunks) if (!result.has(id) && entry.edges.some(edge => result.has(edge.slice(edge.indexOf(':') + 1)))) { result.add(id); grew = true; } }
    return result;
  };
  const contexts = differences.map(diff => {
    if (diff.dimension === 'modules' || diff.dimension === 'imports') {
      diff.chunks = sorted([a, b].flatMap(indexed => [...indexed.chunks].filter(([id, entry]) => entry.modules.some(module => diff.identity === `${id.slice(0, id.indexOf(':chunk:'))}:${module}`)).map(([id]) => id)));

    }
    if (!diff.chunks.length && (a.assetOwners.has(diff.identity) || b.assetOwners.has(diff.identity))) {
      const owners = sorted([...(a.assetOwners.get(diff.identity) ?? []), ...(b.assetOwners.get(diff.identity) ?? [])]); diff.modules = owners;
      diff.chunks = sorted([a, b].flatMap(indexed => [...indexed.chunks].filter(([, entry]) => entry.assets.includes(diff.identity) || entry.modules.some(module => owners.some(owner => module === owner || module.startsWith(`${owner}?`)))).map(([id]) => id)));
    }
    const importers = ancestors(diff.chunks), direct = new Set([...importers, diff.identity]);
    const names = sorted([a, b].flatMap(indexed => [...indexed.names].filter(([, id]) => direct.has(id)).map(([name]) => name)));
    const patterns = [...importers].flatMap(id => [a, b].flatMap(indexed => { const c = indexed.chunks.get(id)?.chunk; const pattern = routePattern(c?.facadeModuleId ? renamer(indexed === a ? moves : {})(c.facadeModuleId) : null); return pattern ? [pattern] : []; }));
    return { diff, direct, names, patterns, pages: new Set(diff.pages) };
  });
  if (differences.length) for (const [build, indexed] of [[base, a], [head, b]] as const) for (const [page, value] of build.files) if (classify(page) === 'html') {
    const candidates = contexts.filter(context => context.names.length || context.patterns.some(pattern => pattern.test(page)));
    if (!candidates.length) continue;
    const text = (await bytes(value)).toString('utf8');
    const relevant = candidates.filter(context => context.names.some(name => text.includes(name)) || context.patterns.some(pattern => pattern.test(page)));
    if (!relevant.length) continue;
    const needsReferences = relevant.some(context => !context.patterns.some(pattern => pattern.test(page)));
    const references = needsReferences ? [...await referencesFor(build, page)].map(name => indexed.names.get(name) ?? name) : [];
    for (const context of relevant) if (context.patterns.some(pattern => pattern.test(page)) || references.some(id => context.direct.has(id))) context.pages.add(page);
  }
  progress('Route attribution finished');
  for (const context of contexts) context.diff.pages = sorted(context.pages);
  for (const diff of differences) diff.insideClosure = diff.dimension === 'inventory' ? (sourceChanges.objects ?? []).includes(diff.identity) : diff.dimension === 'modules' || diff.dimension === 'imports' ? permittedModules.has(diff.identity) : closureChunks.has(diff.identity) || closureAssets.has(diff.identity) || closurePages.has(diff.identity) || closureOutputs.has(diff.identity);
  const outputClasses = new Set<Dimension>(['html', 'css', 'data', 'asset', 'other']);
  const layoutClasses = new Set<Dimension>(['membership', 'references', 'order', 'js']);
  for (const diff of differences) {
    if (outputClasses.has(diff.dimension) || diff.dimension === 'files' && !diff.chunks.length) diff.declaredOutput = policy.outputs.some(output => [diff.base, diff.head].some(path => path !== undefined && outputMatches(path, output.glob)));
    diff.layoutOnly = policy.layout === 'changes' && layoutEligible && (layoutClasses.has(diff.dimension) && (diff.dimension !== 'js' || diff.chunks.length > 0) || diff.dimension === 'files' && diff.chunks.length > 0);
  }
  const declaredPaths = sorted([...base.files.keys(), ...head.files.keys()].filter(path => policy.outputs.some(output => outputMatches(path, output.glob))));
  const insideOutputClosure = (path: string): boolean => closureOutputs.has(path) || closurePages.has(path) || [a, b].some(indexed => closureAssets.has(indexed.names.get(path) ?? path));
  const outsideClosure = declaredPaths.filter(path => !insideOutputClosure(path));
  const groupedHtml = new Map<string, Difference[]>();
  for (const diff of differences.filter(diff => diff.dimension === 'html')) {
    const key = JSON.stringify(diff.detail ?? { base: diff.base, head: diff.head });
    groupedHtml.set(key, [...(groupedHtml.get(key) ?? []), diff]);
  }
  const htmlGroups = [...groupedHtml.values()].map(group => ({ pages: sorted(group.flatMap(diff => diff.pages)), base: String(group[0]!.detail?.base ?? ''), head: String(group[0]!.detail?.head ?? '') }));
  const semanticViolation = differences.some(diff => {
    if (outputClasses.has(diff.dimension) || diff.dimension === 'files' && !diff.chunks.length) return !diff.insideClosure || !diff.declaredOutput;
    if (['membership', 'references', 'order'].includes(diff.dimension) || diff.dimension === 'files' && diff.chunks.length > 0) return !diff.layoutOnly;
    return !diff.insideClosure && !diff.layoutOnly;
  }) || outsideClosure.length > 0;
  const semanticEqual = !differences.some(diff => diff.dimension === 'modules' || diff.dimension === 'imports');
  const layoutEqual = !differences.some(diff => diff.dimension !== 'modules' && diff.dimension !== 'imports');
  const equal = semanticEqual && layoutEqual;
  const routes = Object.fromEntries(sorted([...base.files.keys(), ...head.files.keys()].filter(name => classify(name) === 'html')).map(page => [page, differences.flatMap((diff, index) => diff.pages.includes(page) ? [index] : [])]));
  const omitted: Record<string, number> = {}, environments: Record<string, Record<string, number>> = {};
  const seen: Record<string, number> = {};
  for (const diff of differences) {
    const environment = /^(prerender-[^:]+|client-[^:]+|worker):/u.exec(diff.identity)?.[1] ?? 'other';
    const counts = environments[environment] ??= {};
    counts[diff.dimension] = (counts[diff.dimension] ?? 0) + 1;
    if (!['modules', 'imports', 'references', 'membership'].includes(diff.dimension)) continue;
    seen[diff.dimension] = (seen[diff.dimension] ?? 0) + 1;
    if (seen[diff.dimension]! > 25) { omitted[diff.dimension] = (omitted[diff.dimension] ?? 0) + 1; continue; }
    if (diff.dimension === 'modules') { const hunk = codeHunk(a.modules.get(diff.identity)?.code ?? '', b.modules.get(diff.identity)?.code ?? ''); diff.diagnostic = hunk; diff.detail = { base: hunk.base, head: hunk.head }; }
    else if (diff.dimension === 'membership') {
      const env = diff.identity.slice(0, diff.identity.indexOf(':chunk:'));
      diff.diagnostic = { moved: diff.modules.slice(0, 10).map(module => ({ module,
        base: [...a.chunks].filter(([id, chunk]) => id.startsWith(`${env}:chunk:`) && chunk.modules.includes(module)).map(([id]) => id),
        head: [...b.chunks].filter(([id, chunk]) => id.startsWith(`${env}:chunk:`) && chunk.modules.includes(module)).map(([id]) => id) })), omitted: Math.max(0, diff.modules.length - 10) };
    } else {
      const x = (diff.dimension === 'imports' ? a.modules.get(diff.identity) : a.chunks.get(diff.identity))?.edges ?? [];
      const y = (diff.dimension === 'imports' ? b.modules.get(diff.identity) : b.chunks.get(diff.identity))?.edges ?? [];
      const removed = x.filter(id => !y.includes(id)), added = y.filter(id => !x.includes(id));
      diff.diagnostic = { removed: removed.slice(0, 10), added: added.slice(0, 10), removedOmitted: Math.max(0, removed.length - 10), addedOmitted: Math.max(0, added.length - 10), orderChanged: !same(x, y) && !removed.length && !added.length };
    }
  }
  const environmentTotals: Record<string, number> = { prerender: 0, client: 0, worker: 0, other: 0 };
  for (const [environment, counts] of Object.entries(environments)) {
    const group = environment.startsWith('prerender-') ? 'prerender' : environment.startsWith('client-') ? 'client' : environment === 'worker' ? 'worker' : 'other';
    environmentTotals[group]! += Object.values(counts).reduce((sum, count) => sum + count, 0);
  }
  const emittedBytesEqual: Record<string, boolean> = {};
  for (const dimension of ['html', 'js', 'css']) {
    emittedBytesEqual[dimension] = true;
    for (const name of sorted([...base.files.keys(), ...head.files.keys()]).filter(name => classify(name) === dimension)) {
      const x = base.files.get(name), y = head.files.get(name);
      if (x === undefined || y === undefined || !(await bytes(x)).equals(await bytes(y))) { emittedBytesEqual[dimension] = false; break; }
    }
  }
  return { diagnostics: { omitted, environments, environmentTotals, emittedBytesEqual }, semanticEqual, layoutEqual, equal, mode, exitCode: mode === 'report' ? 0 : mode === 'pure-move' ? equal ? 0 : 1 : semanticViolation ? 1 : 0,
    differences, closure: { modules: sorted(seeded), directImporters: sorted(directImporters), chunks: sorted(closureChunks), pages: sorted(closurePages), assets: sorted(closureAssets), outputs: sorted(closureOutputs) },
    manifest: { base: Object.fromEntries([...base.files.keys()].map(name => [name, classify(name)])), head: Object.fromEntries([...head.files.keys()].map(name => [name, classify(name)])), metadata: { base: { chunks: [...a.chunks].map(([id, chunk]) => ({ identity: id, fileName: chunk.chunk.fileName, modules: chunk.modules, references: chunk.edges, assets: chunk.assets })), assets: [...a.assetOwners] }, head: { chunks: [...b.chunks].map(([id, chunk]) => ({ identity: id, fileName: chunk.chunk.fileName, modules: chunk.modules, references: chunk.edges, assets: chunk.assets })), assets: [...b.assetOwners] } } }, routes, htmlGroups, declaration: { ...policy, layoutEligible, outsideClosure } };
}
if (isMain(import.meta.url)) {
  try {
    const flags = args(['--base', '--head', '--moves', '--json', '--mode', '--sources']);
    const base = flags.get('--base'), head = flags.get('--head'), mode = flags.get('--mode') ?? 'report';
    if (!base || !head || !['report', 'pure-move', 'semantic'].includes(mode)) throw new Error('Usage: compare.mts --base <dir> --head <dir> [--moves <file>] [--mode report|pure-move|semantic] [--json <file>]');
    const moves = flags.has('--moves') ? parseMoves(JSON.parse(await readFile(flags.get('--moves')!, 'utf8'))) : {};
    const requireSources = flags.has('--sources') ? await readFile(flags.get('--sources')!, 'utf8') : '{}';
    const started = performance.now();
    const report = await compare(await loadBuild(base), await loadBuild(head), moves, mode === 'semantic' ? 'semantic' : mode === 'pure-move' ? 'pure-move' : 'report', message => console.error(`[${((performance.now() - started) / 1000).toFixed(1)}s] ${message}`), flags.has('--sources') ? (() => { const raw = record(JSON.parse(requireSources)); return { paths: strings(raw.paths), objects: strings(raw.objects ?? []), ...semanticPolicy(raw) }; })() : { paths: [] });
    if (flags.has('--json')) await writeFile(flags.get('--json')!, JSON.stringify(compactReport(report)));
    console.log(JSON.stringify({ semanticEqual: report.semanticEqual, layoutEqual: report.layoutEqual, differences: report.differences.length, closure: Object.fromEntries(Object.entries(report.closure).map(([key, values]) => [key, values.length])), counts: Object.fromEntries((['base', 'head'] as const).map(side => { const metadata = record(report.manifest.metadata[side]); const chunks = array(metadata.chunks).map(record); return [side, { files: Object.keys(report.manifest[side]).length, modules: new Set(chunks.flatMap(chunk => strings(chunk.modules))).size, chunks: chunks.length, pages: Object.values(report.manifest[side]).filter(value => value === 'html').length }]; })), exitCode: report.exitCode }));
    for (const diff of report.differences) console.log(`${diff.insideClosure ? 'inside' : 'OUTSIDE'} ${diff.dimension} ${diff.identity}`);
    process.exitCode = report.exitCode;
  } catch (error) { console.error(error); process.exitCode = 2; }
}

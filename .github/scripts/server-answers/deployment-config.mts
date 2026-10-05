/** Deployment facts and isolated Netlify packages, read from the configuration shipped with this build. */
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { object } from './model.mts';
export interface DeploymentConfig {
  facts: Record<string, unknown>;
  headerRules: { netlify: HeaderRule[]; assets: HeaderRule[] };
  functionsDirectory: string;
  edgeDirectory: string;
  included: string[];
  includedByFunction: Record<string, string[]>;
  edgeFunctions: { path: string; function: string }[];
  immutableCache: { netlify: string | null; assets: string | null };
  workerMain: string;
  assets: Record<string, unknown>;
}
export interface HeaderRule { path: string; values: Record<string, string>; }
export function netlifyHeaderRules(toml: string): HeaderRule[] {
  return [...toml.matchAll(/\[\[headers\]\]([\s\S]*?)(?=^\[\[|$(?![\s\S]))/gmu)].map(section => {
    const path = /for\s*=\s*"([^"]+)"/u.exec(section[1]!)?.[1];
    if (!path) throw new Error('Invalid headers rule');
    const valuesText = section[1]!.split('[headers.values]')[1];
    if (!valuesText) throw new Error('Missing headers values');
    return { path, values: Object.fromEntries([...valuesText.matchAll(/^\s*"?([\w-]+)"?\s*=\s*"([^"]*)"/gmu)].map(match => [match[1]!.toLowerCase(), match[2]!])) };
  });
}
export function assetHeaderRules(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/u.test(line)) rules.push({ path: line.trim(), values: {} });
    else {
      const match = /^\s+([\w-]+):\s*(.*)$/u.exec(line);
      if (!match || !rules.length) throw new Error('Invalid asset headers rule');
      rules.at(-1)!.values[match[1]!.toLowerCase()] = match[2]!;
    }
  }
  return rules;
}
function strings(value: string): string[] { return [...value.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/gu)].map(match => { const decoded: unknown = JSON.parse(`"${match[1]}"`); if (typeof decoded !== 'string') throw new Error('Invalid configuration string'); return decoded; }); }
/** Match POSIX glob segments: * stays in its directory, ** traverses zero or more directories; exclusions always win. */
export function matchesPatterns(file: string, patterns: readonly string[]): boolean {
  const match = (pattern: string) => {
    let expression = '';
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '*') {
        if (pattern[i + 1] === '*') { i++; if (pattern[i + 1] === '/') { i++; expression += '(?:.*/)?'; } else expression += '.*'; }
        else expression += '[^/]*';
      } else expression += pattern[i]!.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    }
    return new RegExp(`^${expression}$`, 'u').test(file);
  };
  return patterns.some(pattern => !pattern.startsWith('!') && match(pattern)) && !patterns.some(pattern => pattern.startsWith('!') && match(pattern.slice(1)));
}
/** Hosting path wildcards span slashes; included_files globs use directory segments instead. */
export const matchesRoutes = (path: string, patterns: readonly string[]): boolean => matchesPatterns(path, patterns.map(pattern => pattern.replaceAll('*', '**')));
export async function readDeploymentConfig(root: string, dist = resolve(root, 'dist')): Promise<DeploymentConfig> {
  const toml = await readFile(resolve(root, 'netlify.toml'), 'utf8');
  const sections = [...toml.matchAll(/^\[functions(?:\."?([^"\]\n]+)"?)?\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/gmu)];
  const common = sections.find(section => !section[1])?.[2];
  if (!common) throw new Error('Missing [functions]');
  const functionsDirectory = /directory\s*=\s*"([^"]+)"/u.exec(common)?.[1];
  if (!functionsDirectory) throw new Error('Missing functions directory');
  const safePath = (path: string) => !isAbsolute(path) && !path.split(/[\\/]/u).includes('..');
  if (!safePath(functionsDirectory)) throw new Error('Unsafe functions directory');
  const includedFor = (text: string) => { const list = /included_files\s*=\s*\[([^\]]*)\]/u.exec(text)?.[1]; return list === undefined ? undefined : strings(list); };
  const included = includedFor(common) ?? [];
  const includedByFunction = Object.fromEntries(sections.filter(section => section[1]).map(section => [section[1]!, [...included, ...(includedFor(section[2]!) ?? [])]]));
  const edgeSection = /^\[edge_functions\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/gmu.exec(toml)?.[1] ?? '';
  const edgeDirectory = /directory\s*=\s*"([^"]+)"/u.exec(edgeSection)?.[1] ?? 'netlify/edge-functions';
  if (!safePath(edgeDirectory)) throw new Error('Unsafe edge directory');
  const edgeFunctions = [...toml.matchAll(/\[\[edge_functions\]\]([\s\S]*?)(?=^\[|$(?![\s\S]))/gmu)].map(section => {
    const path = /path\s*=\s*"([^"]+)"/u.exec(section[1]!)?.[1], name = /function\s*=\s*"([^"]+)"/u.exec(section[1]!)?.[1];
    if (!path || !name) throw new Error('Invalid edge function section'); return { path, function: name };
  });
  const rule = [...toml.matchAll(/\[\[headers\]\]([\s\S]*?)(?=^\[\[|$(?![\s\S]))/gmu)].find(section => /for\s*=\s*"\/_astro\/\*"/u.test(section[1]!));
  const netlify = rule ? /Cache-Control\s*=\s*"([^"]+)"/u.exec(rule[1]!)?.[1] ?? null : null;
  const headers = await readFile(resolve(dist, '_headers'), 'utf8').catch(() => '');
  const assetsCache = /^\/_astro\/\*\s*\n\s+Cache-Control:\s*([^\n]+)/imu.exec(headers)?.[1]?.trim() ?? null;
  // Configuration currently contains comments, no strings with comment tokens; preserve quoted values when removing them.
  const jsonc = (await readFile(resolve(root, 'wrangler.jsonc'), 'utf8')).replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//gu, value => value.startsWith('"') ? value : '');
  const wrangler = object(JSON.parse(jsonc));
  if (typeof wrangler.main !== 'string') throw new Error('Missing worker main');
  if (!safePath(wrangler.main)) throw new Error('Unsafe worker main');
  const facts = { headerRules: { netlify: netlifyHeaderRules(toml), assets: assetHeaderRules(headers) }, functionsDirectory, edgeDirectory, included, includedByFunction, edgeFunctions, immutableCache: { netlify, assets: assetsCache }, workerMain: wrangler.main, assets: object(wrangler.assets) };
  return { ...facts, facts };
}
/** Expand only the included files into a fresh directory; bundled code receives no access to the source checkout. */
export async function packagedFunction(root: string, name: string, config: DeploymentConfig): Promise<{ root: string; bundle: string }> {
  const sourceRoot = await realpath(root), destination = await realpath(await mkdtemp(resolve(tmpdir(), `server-answers-${name}-`)));
  const patterns = config.includedByFunction[name] ?? config.included;
  const visit = (path: string) => patterns.filter(pattern => !pattern.startsWith('!')).some(pattern => {
    const parts = pattern.split('/'), directories = path.split('/');
    const prefix = (pi: number, di: number): boolean => {
      if (di === directories.length) return pi < parts.length;
      if (pi === parts.length) return false;
      if (parts[pi] === '**') return prefix(pi + 1, di) || prefix(pi, di + 1);
      return matchesPatterns(directories[di]!, [parts[pi]!]) && prefix(pi + 1, di + 1);
    };
    return prefix(0, 0);
  });
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name), path = relative(sourceRoot, absolute).split(sep).join('/');
      if (entry.isSymbolicLink() && visit(path) && (await stat(absolute)).isDirectory()) {
        // A linked directory is followed only while it stays inside the project: one that leads out is refused at once, never walked.
        const target = await realpath(absolute), shared = resolve(sourceRoot, 'public/scenes');
        const sharedRoot = await realpath(shared).catch(() => shared);
        if (!target.startsWith(sourceRoot + sep) && !(path.startsWith('public/scenes/') && target.startsWith(sharedRoot + sep))) throw new Error(`Included file escapes project root: ${path}`);
        await walk(absolute);
      } else if (entry.isDirectory()) { if (visit(path)) await walk(absolute); }
      else if (matchesPatterns(path, patterns)) {
        const actual = await realpath(absolute);
        const shared = resolve(sourceRoot, 'public/scenes');
        const sharedRoot = await realpath(shared).catch(() => shared);
        if (!actual.startsWith(sourceRoot + sep) && !(path.startsWith('public/scenes/') && actual.startsWith(sharedRoot + sep))) throw new Error(`Included file escapes project root: ${path}`);
        const to = resolve(destination, path); await mkdir(dirname(to), { recursive: true }); await cp(actual, to);
      }
    }
  }
  try {
    await walk(sourceRoot);
    const bundle = resolve(destination, config.functionsDirectory, `${name}.mjs`);
    const sourceBundle = await realpath(resolve(sourceRoot, config.functionsDirectory, `${name}.mjs`));
    if (!sourceBundle.startsWith(sourceRoot + sep)) throw new Error('Bundle escapes project root');
    await mkdir(dirname(bundle), { recursive: true }); await cp(sourceBundle, bundle);
    return { root: destination, bundle };
  } catch (error) { await rm(destination, { recursive: true, force: true }); throw error; }
}

/** Directory lookup has already found index.html; honor the configured asset URL shape. */
export function directoryRedirect(url: URL, assets: Record<string, unknown>): Response | undefined {
  return assets.html_handling === 'auto-trailing-slash' && !url.pathname.endsWith('/')
    ? new Response(null, { status: 307, headers: { location: url.origin + url.pathname + '/' + url.search } }) : undefined;
}
/** Model hosting header rules on fetch-decoded bytes, including negotiated encoding metadata. */
export function hostingHeaders(request: Request, headers: Headers, rules: readonly HeaderRule[], compressible: boolean): Headers {
  for (const rule of rules) if (matchesRoutes(new URL(request.url).pathname, [rule.path])) {
    for (const [name, value] of Object.entries(rule.values)) headers.set(name, value);
  }
  if (compressible && !request.headers.has('range') && (!request.headers.has('accept-encoding') || /gzip/u.test(request.headers.get('accept-encoding') ?? ''))) headers.set('content-encoding', 'gzip');
  return headers;
}

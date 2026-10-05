/** Deployment facts and isolated Netlify packages, read from the configuration shipped with this build. */
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { object } from './model.mts';
export interface DeploymentConfig {
  facts: Record<string, unknown>;
  functionsDirectory: string;
  included: string[];
  includedByFunction: Record<string, string[]>;
  edgeFunctions: { path: string; function: string }[];
  immutableCache: { netlify: string | null; assets: string | null };
  workerMain: string;
  assets: Record<string, unknown>;
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
  const facts = { functionsDirectory, included, includedByFunction, edgeFunctions, immutableCache: { netlify, assets: assetsCache }, workerMain: wrangler.main, assets: object(wrangler.assets) };
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
      if (entry.isDirectory()) { if (visit(path)) await walk(absolute); }
      else if (matchesPatterns(path, patterns)) {
        const actual = await realpath(absolute);
        if (!actual.startsWith(sourceRoot + sep)) throw new Error(`Included file escapes project root: ${path}`);
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

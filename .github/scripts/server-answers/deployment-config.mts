/** Deployment facts, read from the Cloudflare configuration shipped with this build. */
import { readFile } from 'node:fs/promises';
import { isAbsolute, posix, resolve } from 'node:path';
import { object } from './model.mts';
export interface DeploymentConfig {
  facts: Record<string, unknown>;
  headerRules: HeaderRule[];
  immutableCache: string | null;
  workerMain: string;
  assets: Record<string, unknown>;
}
export interface HeaderRule { path: string; values: Record<string, string>; }
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
/** Hosting path wildcards span slashes; the globs above keep to directory segments. */
export const matchesRoutes = (path: string, patterns: readonly string[]): boolean => matchesPatterns(path, patterns.map(pattern => pattern.replaceAll('*', '**')));
export async function readDeploymentConfig(root: string, dist = resolve(root, 'dist')): Promise<DeploymentConfig> {
  const safePath = (path: string) => !isAbsolute(path) && !path.split(/[\\/]/u).includes('..');
  const headers = await readFile(resolve(dist, '_headers'), 'utf8').catch(() => '');
  const immutableCache = /^\/_astro\/\*\s*\n\s+Cache-Control:\s*([^\n]+)/imu.exec(headers)?.[1]?.trim() ?? null;
  // Configuration currently contains comments, no strings with comment tokens; preserve quoted values when removing them.
  const wranglerConfig = await wranglerConfigPath(root);
  if (!safePath(wranglerConfig)) throw new Error('Unsafe Wrangler configuration path');
  const jsonc = (await readFile(resolve(root, wranglerConfig), 'utf8')).replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//gu, value => value.startsWith('"') ? value : '');
  const wrangler = object(JSON.parse(jsonc));
  // Wrangler resolves `main` and `assets.directory` from the folder its configuration file is in.
  const fromConfig = (path: string) => posix.normalize(posix.join(posix.dirname(wranglerConfig), path));
  if (typeof wrangler.main !== 'string') throw new Error('Missing worker main');
  const workerMain = fromConfig(wrangler.main);
  if (!safePath(workerMain)) throw new Error('Unsafe worker main');
  const assets = object(wrangler.assets);
  if (typeof assets.directory === 'string') assets.directory = fromConfig(assets.directory);
  // Facts are what the host serves. Where the configuration and the bundle sit in the checkout is layout, so the
  // Worker's script path stays out of them.
  const facts = { headerRules: assetHeaderRules(headers), immutableCache, assets };
  return { ...facts, workerMain, facts };
}
/** The Wrangler configuration this revision deploys with: the `--config` its `deploy:cloudflare-preview` script passes to
 * Wrangler, else Wrangler's own default at the root. */
async function wranglerConfigPath(root: string): Promise<string> {
  const manifest = await readFile(resolve(root, 'package.json'), 'utf8').catch(() => undefined);
  const script = manifest === undefined ? undefined : object(object(JSON.parse(manifest)).scripts)['deploy:cloudflare-preview'];
  return (typeof script === 'string' ? /\bwrangler\S*\s+deploy\b[^&]*?\s(?:--config|-c)[\s=]+([^\s&]+)/u.exec(script)?.[1] : undefined) ?? 'wrangler.jsonc';
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

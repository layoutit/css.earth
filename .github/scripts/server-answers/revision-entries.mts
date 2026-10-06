/** Resolve executable owners from the revision under test, never the recording tool's revision. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { object } from './model.mts';

export async function scriptsAt(root: string): Promise<Record<string, string>> {
  const scripts = object(object(JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))).scripts);
  if (!Object.values(scripts).every(value => typeof value === 'string')) throw new Error('Invalid package scripts');
  return Object.fromEntries(Object.entries(scripts).map(([key, value]) => [key, String(value)]));
}
/** The deploy recipe's Astro build, with or without the config path a revision keeping its config under site/ passes. */
export function isAstroBuild(step: string): boolean {
  return /^(?:pnpm exec )?astro build(?: --config site\/astro\.config\.mts)?$/u.test(step);
}
/** This project uses node entry scripts, pnpm script references and && sequences. Reject unsupported syntax. */
export function expandScript(scripts: Record<string, string>, name: string, visiting: string[] = []): string[] {
  if (visiting.includes(name) || !scripts[name]) throw new Error(`Missing or cyclic script: ${name}`);
  return scripts[name].split(/\s*&&\s*/u).flatMap(step => {
    const reference = /^pnpm (?:run )?([\w:-]+)$/u.exec(step);
    return reference && scripts[reference[1]!] ? expandScript(scripts, reference[1]!, [...visiting, name]) : [step];
  });
}
export async function previewEntry(root: string): Promise<string> {
  const steps = expandScript(await scriptsAt(root), 'preview');
  const entry = steps.at(-1)?.match(/^node\s+([^\s]+\.[cm]?ts)(?:\s|$)/u)?.[1];
  if (!entry || entry.startsWith('/') || entry.split('/').includes('..')) throw new Error('Unsupported preview entry');
  return resolve(root, entry);
}
/** The page router the Worker and the preview server share: a page address with a query goes to the page handler. */
export async function loadPageRoute(root: string): Promise<(request: Request) => URL | undefined> {
  const loaded = object(await import(pathToFileURL(resolve(root, 'site/server/search-route.mts')).href));
  if (typeof loaded.default !== 'function') throw new Error('Invalid page router');
  const callable = loaded.default;
  return request => { const value: unknown = callable(request); if (value !== undefined && !(value instanceof URL)) throw new Error('Invalid page route'); return value; };
}
/** Preserve the revision's deploy order, skipping download-only owners whose inputs were restored. */
export function offlineDeploySteps(scripts: Record<string, string>): string[] {
  // The social share images fetch the published arrival images from the asset origin, which an offline build cannot reach and which no server answers.
  return expandScript(scripts, 'build:deploy').filter(step => !/\bshare-images\b/u.test(step) && ![
    ...expandScript(scripts, 'build:packages'), ...expandScript(scripts, 'setup:asset-data'),
  ].includes(step)).map(step => step.includes('prepare-facilities') && !step.includes('--restored-only') ? step + ' --restored-only' : step);
}

/** Reuse the comparison build: only the Worker bundler remains, after at most one other node bundler the revision runs after
 * Astro (an older revision bundles a second host's functions there). */
export function postBuildSteps(scripts: Record<string, string>): string[] {
  const deploy = expandScript(scripts, 'build:deploy');
  const boundaries = deploy.flatMap((step, index) => isAstroBuild(step) && !step.startsWith('pnpm exec ') ? [index] : []);
  if (boundaries.length !== 1) throw new Error('Expected one standalone Astro build');
  const remaining = deploy.slice(boundaries[0]! + 1).filter(step => !/\bshare-images\b/u.test(step) && !/\brun-implemented-objects\.mts assemble$/u.test(step));
  const worker = expandScript(scripts, 'deploy:cloudflare-preview').find(step => step.startsWith('node '));
  const safe = (step: string) => /^node [\w./-]+\.[cm]?ts(?: --[\w-]+)*$/u.test(step) && !step.split(/[ /]/u).includes('..');
  if (remaining.length > 1 || !remaining.every(safe) || !worker || !safe(worker)) throw new Error('Unsupported post-build bundle recipe; another build is forbidden');
  return [...remaining, worker.replace(/\s+--noindex\b/u, '')];
}

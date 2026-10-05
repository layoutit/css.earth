/** Resolve executable owners from the revision under test, never the recording tool's revision. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { object } from './model.mts';
import { readDeploymentConfig } from './deployment-config.mts';

export async function scriptsAt(root: string): Promise<Record<string, string>> {
  const scripts = object(object(JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))).scripts);
  if (!Object.values(scripts).every(value => typeof value === 'string')) throw new Error('Invalid package scripts');
  return Object.fromEntries(Object.entries(scripts).map(([key, value]) => [key, String(value)]));
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
export async function edgeEntry(root: string, dist = resolve(root, 'dist')): Promise<string> {
  const config = await readDeploymentConfig(root, dist);
  const route = config.edgeFunctions.find(entry => entry.path === '/*');
  if (!route) throw new Error('Missing page edge route');
  const directory = config.edgeDirectory;
  if (directory.startsWith('/') || directory.split('/').includes('..') || !/^[\w-]+$/u.test(route.function)) throw new Error('Unsafe edge entry');
  return resolve(root, directory, `${route.function}.ts`);
}
export async function loadEdge(root: string): Promise<(request: Request) => URL | undefined> {
  const loaded = object(await import(pathToFileURL(await edgeEntry(root)).href));
  if (typeof loaded.default !== 'function') throw new Error('Invalid edge handler');
  const callable = loaded.default;
  return request => { const value: unknown = callable(request); if (value !== undefined && !(value instanceof URL)) throw new Error('Invalid edge rewrite'); return value; };
}
/** Preserve the revision's deploy order, skipping download-only owners whose inputs were restored. */
export function offlineDeploySteps(scripts: Record<string, string>): string[] {
  return expandScript(scripts, 'build:deploy').filter(step => ![
    ...expandScript(scripts, 'build:packages'), ...expandScript(scripts, 'setup:asset-data'),
  ].includes(step)).map(step => step.includes('prepare-facilities') && !step.includes('--restored-only') ? step + ' --restored-only' : step);
}

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { test } from 'node:test';
import { parseCli } from './cli-arguments.mts';
import { helpText } from './help.mts';
import { workspaceArguments } from '@cssearth/telescope-core/node';

const repository = resolve(import.meta.dirname, '../../..');
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    // Preserved external inputs are not command instructions.
    if (['fixtures', 'vendor', 'node_modules', 'dist', 'data'].includes(entry.name)) return [];
    return entry.isDirectory() ? sourceFiles(path) : ['.mts', '.ts', '.md'].includes(extname(path)) ? [path] : [];
  });
}
function packageScripts(path: string): { name: string; scripts: Set<string> } {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(value && typeof value === 'object' && 'name' in value && typeof value.name === 'string');
  assert.ok('scripts' in value && value.scripts && typeof value.scripts === 'object');
  return { name: value.name, scripts: new Set(Object.keys(value.scripts)) };
}

test('telescope source, guides and skills name existing package scripts', () => {
  const root = packageScripts(resolve(repository, 'package.json'));
  const packages = new Map(readdirSync(resolve(repository, 'packages')).flatMap(name => {
    try { const pkg = packageScripts(resolve(repository, 'packages', name, 'package.json')); return [[pkg.name, pkg.scripts] as const]; }
    catch { return []; }
  }));
  const files = ['telescope-cli', 'telescope-core'].flatMap(name => {
    const directory = resolve(repository, 'packages', name);
    return [...sourceFiles(resolve(directory, 'src')), resolve(directory, 'README.md'), resolve(directory, 'AGENTS.md'),
      ...(name === 'telescope-cli' ? sourceFiles(resolve(directory, 'skills')) : [])];
  });
  files.push(...sourceFiles(resolve(repository, '.agents/skills/telescope')),
    ...readdirSync(resolve(repository, 'docs')).filter(name => /^telescope-.*\.md$/u.test(name)).map(name => resolve(repository, 'docs', name)),
    resolve(repository, 'README.md'));
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bpnpm\s+(?:--silent\s+)?(?:--filter\s+["']?([^\s"']+)["']?\s+)?(?:run\s+)?([a-z][a-z0-9:_-]*)/gu)) {
      const [, filter, script] = match;
      // pnpm's own commands are not package scripts.
      if (['install', 'exec', 'dlx', 'pack', 'publish', 'add', 'remove'].includes(script!)) continue;
      const scripts = filter ? packages.get(filter) : root.scripts;
      assert.ok(scripts?.has(script!), `${file}: nonexistent package script ${filter ?? root.name} ${script}`);
    }
  }
});

// Valid, read-only parser inputs. No command implementation runs and no output directory is created.
const invocations: readonly (readonly string[])[] = [
  ['open'], ['open', 'telescope-runs', '--json'],
  ['help', 'all'], ['explore', 'eris', '--from', '2024-01-01', '--to', '2024-01-02'],
  ['query', 'eris', '--wavelength', '2,3', '--out', 'result'], ['get', 'run', '--pick', '1'],
  ['outputs', 'result.json'], ['export', 'result.json', '--output', 'image', '--hdu', '0'],
  ['export', 'result.json', '--output', 'spectrum', '--hdu', '0', '--pixel', '0,0'],
  ['export', 'result.json', '--output', 'aperture-spectrum', '--hdu', '0', '--aperture', '0,0,1,1', '--background', 'none'],
  ['export', 'result.json', '--output', 'feature-map', '--hdu', '0', '--band', '2,3', '--continuum', '1,1.5,3.5,4'],
  ['export', 'result.json', '--output', 'body-map', '--geometry', 'navigation.json'],
  ['project', 'result.json', '--geometry', 'navigation.json', '--out', 'result'],
  ['papers', 'eris'], ['simulations', 'eris'], ['leads', 'eris'], ['leads', '--class', 'exoplanet'],
  ['stars', 'm31'], ['gaia-cone', '83,-5,0.1'], ['ascl', 'astropy'], ['ascl', '--product', 'result.json'],
  ['new-object', 'spec.json', '--out', 'draft.json'],
  ['skill', 'install', '--provider', 'agents'], ['skill', 'install', '--dest', 'skills'],
  ['toolchain', 'list'], ['fetch', 'explore.json', '--archive', 'chandra', '--pick', '1'],
  ['wwt-fits', 'catalog.json', '--set', 'phat', '--level', '0', '--x', '0', '--y', '0', '--out', 'tile'],
  ['wwt-fits', 'explore.json', '--pick', '1', '--level', '0', '--x', '0', '--y', '0', '--out', 'tile'],
  ['wwt-image', 'explore.json', '--pick', '1', '--level', '0', '--out', 'image'],
  ['import', 'spec.json', '--out', 'result'], ['families'],
  ['family-assess', 'request.json', 'descriptor.json', '--out', 'result'],
  ['family-run', 'descriptor.json', 'operation', '--out', 'result'],
  ['candidates', 'star', '--epoch', '60000', '--out', 'result'],
  ['associate', 'measurements.csv', '--system', 'star', '--out', 'result'],
];
const values: Readonly<Record<string, string>> = {
  '--out': 'result', '--pick': '1', '--output': 'image', '--hdu': '0', '--plane': '0', '--pixel': '0,0',
  '--wavelength': '2,3', '--from': '2024-01-01', '--to': '2024-01-02', '--icrs-circle': '83,-5,0.1',
  '--family': 'F01', '--kind': 'image', '--instrument': 'ERIS', '--provider': 'agents', '--dest': 'skills',
  '--archive': 'chandra', '--file': 'science.fits', '--about': 'imaging', '--host': 'star', '--class': 'exoplanet',
  '--magnitude-limit': '16', '--limit': '10', '--product': 'result.json', '--level': '0', '--x': '0', '--y': '0',
  '--set': 'phat', '--component': 'science', '--params': 'params.json', '--structure': 'science', '--epoch': '60000',
  '--system': 'star', '--orbit-draws': '10', '--figure-background': 'transparent', '--geometry': 'navigation.json',
  '--band': '2,3', '--aperture': '0,0,1,1', '--background': 'none', '--continuum': '1,1.5,3.5,4',
  '--uncertainty': 'omit', '--spectral-frame': 'barycentric', '--min-arcsec': '1', '--min-km': '1',
  '--min-elements': '1', '--range-km': '100', '--radius-km': '10', '--accept-assumptions': 'jwst.archive-point-source',
  '--max-science-bytes': '100', '--max-metadata-bytes': '100', '--max-expanded-bytes': '100',
  '--max-package-members': '10', '--max-link-depth': '1', '--max-link-requests': '10',
};
function acceptsFlag(args: readonly string[], flag: string): boolean {
  // Help resolves before option validation, so it must not admit arbitrary flags here.
  if (args[0] === 'help') return false;
  if (flag === '--help' || flag === '--version') {
    try { parseCli([flag]); return true; } catch { return false; }
  }
  const remaining = [...args], at = remaining.indexOf(flag);
  if (at >= 0) remaining.splice(at, values[flag] === undefined ? 1 : 2);
  const value = flag.startsWith('--from-') ? 'star' : values[flag];
  try { parseCli([...remaining, flag, ...(value === undefined ? [] : [value])]); return true; }
  catch { return false; }
}

test('every command and flag in help all is accepted by the actual parsers', () => {
  const help = helpText('all');
  for (const args of invocations) assert.doesNotThrow(() => parseCli(args), args.join(' '));
  // This phrase describes data rather than a command invocation.
  const commands = help.replaceAll('existing telescope deliveries', 'existing deliveries');
  for (const match of commands.matchAll(/\btelescope ([a-z][a-z-]*)/gu)) {
    const command = match[1]!;
    assert.ok(invocations.some(args => args[0] === command), `help names unknown command ${command}`);
  }
  for (const line of help.split('\n')) {
    const command = /^\s+telescope ([a-z][a-z-]*) /u.exec(line)?.[1];
    for (const match of line.matchAll(/--[a-z][a-z0-9-]*/gu)) {
      const flag = match[0];
      if (flag === '--workspace') {
        assert.equal(workspaceArguments(['--workspace', repository], {}, repository).workspace, repository);
        continue;
      }
      assert.ok(invocations.some(args => (!command || args[0] === command) && acceptsFlag(args, flag)),
        `help ${command ?? 'all'} names unsupported flag ${flag}`);
    }
  }
});

test('the core package ships its runtime toolchain directory', () => {
  const path = resolve(repository, 'packages/telescope-core/package.json');
  const pkg: unknown = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(pkg && typeof pkg === 'object' && 'files' in pkg && Array.isArray(pkg.files));
  assert.ok(pkg.files.includes('toolchains'));
  assert.ok(readdirSync(resolve(dirname(path), 'toolchains')).includes('toolchain.json'));
});

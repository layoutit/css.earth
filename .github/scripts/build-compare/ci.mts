/** CI orchestration: prepare isolated checkouts, compare merge-base to HEAD, and retain stage timings. */
import { spawn, execFile } from 'node:child_process';
import { cp, mkdir, readFile, writeFile, appendFile, rm, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { serverVerdict } from './server-policy.mts';
import { performanceStage, performanceSummary, performanceVerdict } from './performance-stage.mts';
import { sourceDiff } from './source-diff.mts';
import { parseMoves, record, strings } from './records.mts';

const execute = promisify(execFile);
export interface RefactorDeclaration { mode: 'report' | 'pure-move' | 'semantic'; moves: Record<string, string | null>; tools?: 'head'; objects?: string[]; outputs?: { glob: string; reason: string }[]; layout?: 'none' | 'changes'; change?: string; }
export function refactorDeclaration(raw: unknown): RefactorDeclaration {
  if (raw === undefined) return { mode: 'report', moves: {} };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Refactor declaration must be an object.');
  const values = Object.entries(raw), mode = values.find(([key]) => key === 'mode')?.[1];
  if (values.some(([key]) => !['mode', 'moves', 'tools', 'objects', 'outputs', 'layout', 'change'].includes(key)) || !['pure-move', 'semantic'].includes(String(mode)))
    throw new Error('Refactor declaration requires mode pure-move or semantic.');
  const moves = values.find(([key]) => key === 'moves')?.[1];
  if (moves === null || typeof moves !== 'object' || Array.isArray(moves)) throw new Error('Refactor moves must be an object.');
  const rawRecord = record(raw);
  if (rawRecord.tools !== undefined && rawRecord.tools !== 'head') throw new Error('tools must be head');
  const objects = rawRecord.objects === undefined ? undefined : strings(rawRecord.objects);
  if (objects?.some(id => !/^[a-z0-9-]+$/u.test(id))) throw new Error('Invalid declared object');
  const outputs = rawRecord.outputs === undefined ? undefined : declaredOutputs(rawRecord.outputs);
  if (rawRecord.layout !== undefined && !['none', 'changes'].includes(String(rawRecord.layout))) throw new Error('layout must be none or changes');
  if (rawRecord.change !== undefined && (typeof rawRecord.change !== 'string' || !rawRecord.change.trim() || rawRecord.change.length > 200)) throw new Error('change must name the refactor in 1 to 200 characters');
  return { ...(typeof rawRecord.change === 'string' ? { change: rawRecord.change } : {}), ...(outputs ? { outputs } : {}), ...(rawRecord.layout ? { layout: rawRecord.layout === 'changes' ? 'changes' as const : 'none' as const } : {}), mode: mode === 'pure-move' ? 'pure-move' : 'semantic', moves: parseMoves(moves), ...(rawRecord.tools === 'head' ? { tools: 'head' as const } : {}), ...(objects ? { objects } : {}) };
}
export function declaredOutputs(raw: unknown): { glob: string; reason: string }[] {
  if (!Array.isArray(raw)) throw new Error('outputs must be an array');
  return raw.map(value => {
    const item = record(value);
    if (Object.keys(item).some(key => !['glob', 'reason'].includes(key)) || typeof item.glob !== 'string' || !item.glob || item.glob.startsWith('/') || item.glob.includes('..') || item.glob.includes('\\') || typeof item.reason !== 'string' || !item.reason.trim()) throw new Error('Each output requires a relative glob and reason');
    return { glob: item.glob, reason: item.reason };
  });
}
/** Stale declarations have no authority over a later PR, even if their schema is old. */
export function effectiveDeclaration(status: string, current: unknown, prior: unknown): RefactorDeclaration {
  if (!/^[AM]\s/u.test(status)) return refactorDeclaration(undefined);
  requireFreshDeclaration(status, current, prior);
  return refactorDeclaration(current);
}
export function enforcedMode(mode: RefactorDeclaration['mode'], specifierOnly: boolean): RefactorDeclaration['mode'] {
  if (!specifierOnly) return mode;
  if (mode === 'report') throw new Error('Rename/specifier-only PR requires a new pure-move declaration');
  return 'pure-move';
}
export function skipLockfile(mode: RefactorDeclaration['mode'], base: Uint8Array, head: Uint8Array): boolean {
  return mode === 'report' && !Buffer.from(base).equals(Buffer.from(head));
}
export function skipToolchain(mode: RefactorDeclaration['mode'], label: string, failure: string | undefined): boolean {
  return mode === 'report' && label === 'head' && Boolean(failure);
}
export function requireFreshDeclaration(status: string, current: unknown, prior: unknown): void {
  if (!/^[AM]\s/u.test(status)) throw new Error('Refactor declaration must be added or changed in this PR');
  const normalized = (raw: unknown): string => { const declaration = refactorDeclaration(raw); return JSON.stringify([declaration.mode, Object.entries(declaration.moves).sort(([a], [b]) => a.localeCompare(b)), declaration.tools ?? 'merge-base', [...(declaration.objects ?? [])].sort(), declaration.outputs ?? [], declaration.layout ?? 'none', declaration.change ?? '']); };
  if (prior !== undefined && normalized(prior) === normalized(current)) throw new Error('Base already contains identical declaration');
}
/** Which copy of the comparison tools runs. The merge base's, unless the declaration or a label opts into the head's, or the merge base has no
 * tools at all (only the pull request that introduces them: `bootstrap`, run loudly). */
export function toolSource(declaration: RefactorDeclaration, labels: string[], baseHasTools = true): 'head' | 'merge-base' | 'bootstrap' {
  if (declaration.tools === 'head' || labels.includes('tool-change')) return 'head';
  return baseHasTools ? 'merge-base' : 'bootstrap';
}
export function preparationCommand(raw: unknown): string {
  if (raw === null || typeof raw !== 'object' || !('scripts' in raw)) throw new Error('Missing package scripts.');
  const scripts = raw.scripts;
  if (scripts === null || typeof scripts !== 'object' || !('build:deploy' in scripts) || typeof scripts['build:deploy'] !== 'string')
    throw new Error('Missing build:deploy recipe.');
  const steps = scripts['build:deploy'].split(/\s*&&\s*/u).map(step => step.trim());
  const boundaries = steps.flatMap((step, index) => step === 'astro build' ? [index] : []);
  const boundary = boundaries[0];
  if (boundaries.length !== 1 || boundary === undefined || boundary === 0) throw new Error('build:deploy must contain exactly one standalone astro build after preparation');
  return steps.slice(0, boundary).join(' && ');
}
export function comparisonPreparation(raw: unknown): string {
  const recipe = preparationCommand(raw);
  const steps = recipe.split(' && ');
  if (steps.filter(step => step === 'pnpm setup:asset-data').length !== 1) throw new Error('Preparation recipe must contain exactly one standalone pnpm setup:asset-data; renamed or substituted asset restore is unsafe');
  if (steps.some(step => step.includes('prepare-nebulae.mts') && step !== 'node packages/bake/cli/prepare-nebulae.mts --if-missing')) throw new Error('Unknown nebula authoring step in comparison preparation');
  // Restore already supplies the pinned bank. The authoring CLI re-inventories even a reused bank.
  return steps.filter(step => step !== 'node packages/bake/cli/prepare-nebulae.mts --if-missing').map(step => step === 'pnpm setup:asset-data' ? 'node .github/scripts/build-compare/restore-preparation.mts --checkout .' : step).join(' && ');
}
/** Compare against the pre-preparation state, including intentional tool-copy edits. */
export function requireUnchangedTracked(before: string, after: string): void {
  if (before !== after) throw new Error('Preparation modified tracked files; comparison inputs are no longer the requested commits. Inspect git status --short and git diff in the failing checkout.');
}
export function jobSummary(raw: unknown, timings: { stage: string; seconds: number; exitCode: number }[], mode: string, tools: string): string {
  const report = record(raw), diagnostics = record(report.diagnostics ?? {});
  const environments = record(diagnostics.environments ?? {});
  const dimensions = new Set(Object.values(environments).flatMap(value => Object.keys(record(value))));
  const rows = [...dimensions].sort().map(dimension => `| ${dimension} | ${Object.values(environments).reduce<number>((sum, value) => sum + Number(record(value)[dimension] ?? 0), 0)} |`);
  const environmentRows = Object.entries(environments).map(([environment, counts]) => `| ${environment} | ${Object.values(record(counts)).reduce<number>((sum, n) => sum + Number(n), 0)} |`);
  const closure = record(report.closure ?? {});
  return `## Built-site comparison\n\nMode: ${mode}; tools: ${tools}.\n\nEnvironment totals: ${JSON.stringify(diagnostics.environmentTotals ?? {})}.\n\nEmitted HTML/JS/CSS byte equality: ${JSON.stringify(diagnostics.emittedBytesEqual ?? {})}.\n\nClosure size: ${Object.entries(closure).map(([key, value]) => `${key}=${Array.isArray(value) ? value.length : record(value).count}`).join(', ')}.\n\n| Dimension | Differences |\n| --- | ---: |\n${rows.join('\n')}\n\n| Environment | Differences |\n| --- | ---: |\n${environmentRows.join('\n')}\n\n| Stage | Seconds | Exit |\n| --- | ---: | ---: |\n${timings.map(time => `| ${time.stage} | ${time.seconds.toFixed(1)} | ${time.exitCode} |`).join('\n')}\n`;
}
async function command(program: string, args: string[], cwd: string): Promise<number> {
  return new Promise((accept, reject) => {
    const child = spawn(program, args, { cwd, stdio: 'inherit', env: { ...process.env, TZ: 'UTC', LC_ALL: 'C',
      NODE_OPTIONS: '--max-old-space-size=6144', CSSEARTH_SKIP_DECLARATIONS: '1', ASSET_ORIGIN: 'https://earth-assets.lowpoly.cc', CSSEARTH_ALLOW_MISSING_ASSETS: '0' } });
    child.once('error', reject);
    child.once('exit', (code, signal) => signal ? reject(new Error(`${program} terminated by ${signal}`)) : accept(code ?? 2));
  });
}
async function main(): Promise<number> {
  const args = process.argv.slice(2), options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index], value = args[index + 1];
    if (!key || !['--head', '--base', '--out'].includes(key) || !value || value.startsWith('--') || options.has(key))
      throw new Error('Usage: ci.mts --head <checkout> --base <isolated checkout> --out <directory>');
    options.set(key, value);
  }
  const headValue = options.get('--head'), baseValue = options.get('--base'), outValue = options.get('--out');
  if (!headValue || !baseValue || !outValue) throw new Error('All three paths are required.');
  const head = resolve(headValue), base = resolve(baseValue), out = resolve(outValue);
  if (head === base || head.startsWith(`${base}/`) || base.startsWith(`${head}/`)) throw new Error('Checkouts must be isolated siblings.');
  await mkdir(out, { recursive: true });
  const timings: { stage: string; seconds: number; exitCode: number }[] = [];
  const stage = async (name: string, program: string, values: string[], cwd: string) => {
    const started = performance.now(), exitCode = await command(program, values, cwd);
    timings.push({ stage: name, seconds: (performance.now() - started) / 1000, exitCode });
    await writeFile(join(out, 'timings.json'), `${JSON.stringify(timings, null, 2)}\n`);
    console.log(`[build-compare] ${name}: ${timings.at(-1)?.seconds.toFixed(1)}s, exit ${exitCode}`);
    return exitCode;
  };
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'HEAD^';
  const { stdout } = await execute('git', ['merge-base', 'HEAD', baseRef], { cwd: head });
  const revision = stdout.trim();
  if (!/^[a-f0-9]{40}$/u.test(revision)) throw new Error('Git did not return a merge-base commit.');
  await execute('git', ['checkout', '--detach', revision], { cwd: base });
  const declarationPath = '.github/site-refactor.json';
  const diff = await execute('git', ['diff', '--name-status', `${revision}..HEAD`, '--', declarationPath], { cwd: head });
  let current: unknown, prior: unknown;
  if (/^[AM]\s/u.test(diff.stdout)) {
    current = JSON.parse(await readFile(join(head, declarationPath), 'utf8'));
    try { prior = JSON.parse((await execute('git', ['show', `${revision}:${declarationPath}`], { cwd: head })).stdout); } catch { /* Absent on base. */ }
  }
  const declaration = effectiveDeclaration(diff.stdout, current, prior);
  const sources = sourceDiff(head, revision, 'HEAD');
  declaration.mode = enforcedMode(declaration.mode, sources.specifierOnly);
  const event = process.env.GITHUB_EVENT_PATH ? record(JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'))) : {};
  const labels = event.pull_request === undefined ? [] : record(event.pull_request).labels;
  const toolLabel = Array.isArray(labels) && labels.some(label => record(label).name === 'tool-change');
  const baseHasTools = await readFile(join(base, '.github/scripts/build-compare/build.mts')).then(() => true, () => false);
  const source = toolSource(declaration, toolLabel ? ['tool-change'] : [], baseHasTools);
  const headTools = source !== 'merge-base';
  const toolRoot = headTools ? join(head, '.github/scripts/build-compare') : join(base, '.github/scripts/build-compare');
  if (source === 'head') console.warn('::warning::TOOL TRUST OVERRIDE: running PR HEAD comparison tools');
  if (source === 'bootstrap') console.warn('::warning::Bootstrap: the merge base has no comparison tools; this pull request introduces them, so its own tools run');
  try { await readFile(join(toolRoot, 'build.mts')); } catch { throw new Error('Merge-base comparison tools are absent; bootstrap requires tool-change or tools: head'); }
  for (const checkout of [base, head]) {
    const destination = join(checkout, '.github/scripts/build-compare');
    if (destination === toolRoot) continue;
    await rm(destination, { recursive: true, force: true });
    await cp(toolRoot, destination, { recursive: true });
  }
  const sourcesPath = join(out, 'sources.json');
  await writeFile(sourcesPath, JSON.stringify({ paths: sources.paths, objects: declaration.objects ?? [], outputs: declaration.outputs ?? [], layout: declaration.layout ?? 'none' }, null, 2));
  if (skipLockfile(declaration.mode, await readFile(join(base, 'pnpm-lock.yaml')), await readFile(join(head, 'pnpm-lock.yaml')))) {
    await writeFile(join(out, 'report.json'), JSON.stringify({ skipped: true, notice: 'Toolchain/lockfile mismatch; informational comparison skipped' }));
    console.warn('::notice::Toolchain/lockfile mismatch; report-mode comparison skipped'); return 0;
  }
  const inventoryPaths = (await execute('git', ['ls-files', 'src/objects/*/inventory.json'], { cwd: base })).stdout.trim().split('\n').filter(Boolean);
  const headInventoryPaths = (await execute('git', ['ls-files', 'src/objects/*/inventory.json'], { cwd: head })).stdout.trim().split('\n').filter(Boolean);
  let sharePrepared = JSON.stringify(inventoryPaths) === JSON.stringify(headInventoryPaths);
  for (const path of inventoryPaths) if (sharePrepared && !(await readFile(join(base, path))).equals(await readFile(join(head, path)))) sharePrepared = false;
  const moves = join(out, 'moves.json');
  await writeFile(moves, `${JSON.stringify(declaration.moves, null, 2)}\n`);
  await writeFile(join(out, 'inputs.json'), `${JSON.stringify({ base: revision, mode: declaration.mode, tools: source, sharePrepared }, null, 2)}\n`);
  for (const [label, checkout] of [['base', base], ['head', head]] as const) {
    let result = await stage(`${label} install`, 'pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], checkout);
    if (result) return result;
    if (label === 'head' && sharePrepared) {
      // Preparation may refresh base inventories; recheck before sharing its bytes.
      for (const path of inventoryPaths) if (!(await readFile(join(base, path))).equals(await readFile(join(head, path)))) sharePrepared = false;
    }
    if (label === 'head' && sharePrepared) {
      for (const path of inventoryPaths) {
        const folder = path.replace(/inventory\.json$/u, 'prepared');
        if (!(await stat(join(base, folder)).catch(() => undefined))?.isDirectory()) {
          const inventory = record(JSON.parse(await readFile(join(base, path), 'utf8')));
          if (Array.isArray(inventory.assets) && !inventory.assets.some(asset => record(asset).location === 'prepared')) continue;
          throw new Error(`Missing restored prepared folder: ${folder}`);
        }
        await rm(join(head, folder), { recursive: true, force: true });
        const linked = await stage(`copy ${folder}`, 'cp', ['-a', join(base, folder), join(head, folder)], head);
        if (linked) return linked;
      }
    }
    const preparation = comparisonPreparation(JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8')));
    const trackedDiff = async () => (await execute('git', ['diff', '--binary', '--no-ext-diff', 'HEAD', '--'], { cwd: checkout, maxBuffer: 32 * 1024 * 1024 })).stdout;
    const beforePreparation = await trackedDiff();
    result = await stage(`${label} preparation`, 'bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', preparation], checkout);
    requireUnchangedTracked(beforePreparation, await trackedDiff());
    if (result) return result;
    const values = [join(toolRoot, 'build.mts'), '--checkout', checkout, '--out', join(out, label)];
    if (label === 'head') values.push('--toolchain', join(out, 'base/toolchain.json'));
    result = await stage(`${label} build`, process.execPath, values, checkout);
    if (result) {
      if (label === 'head') {
        const failure = await readFile(join(out, 'head/toolchain-mismatch.json'), 'utf8').catch(() => undefined);
        if (failure !== undefined && skipToolchain(declaration.mode, label, failure)) { console.warn('::notice::Toolchain mismatch; report-mode comparison skipped'); await writeFile(join(out, 'report.json'), failure); return 0; }
      }
      return result;
    }
  }
  const comparisonExit = await stage('compare', process.execPath, [join(toolRoot, 'compare.mts'), '--base', join(out, 'base'),
    '--head', join(out, 'head'), '--mode', declaration.mode, '--moves', moves, '--sources', sourcesPath, '--json', join(out, 'report.json')], head);
  let answerExit = 0, answerSummary = '', performanceExit = 0;
  try {
    // L7 follows the same trust selection as L2: merge-base tools, except for the pull request that introduces them.
    let performanceRoot = join(headTools ? head : base, '.github/scripts/performance');
    if (!headTools && !await stat(performanceRoot).catch(() => undefined)) {
      console.warn('::warning::Bootstrap: merge base has no performance guard tools; using HEAD performance tools');
      performanceRoot = join(head, '.github/scripts/performance');
    }
    for (const checkout of [base, head]) {
      const destination = join(checkout, '.github/scripts/performance');
      if (destination === performanceRoot) continue;
      await rm(destination, { recursive: true, force: true });
      await cp(performanceRoot, destination, { recursive: true });
    }
    const approved = Array.isArray(labels) && labels.some(label => record(label).name === 'performance-increase-approved');
    const guard = await performanceStage(join(head, '.github/scripts/performance'), base, head, out, declaration.mode, approved);
    timings.push(...guard.timings);
    performanceExit = guard.exitCode;
    answerSummary += performanceSummary(guard);
  } catch (error) {
    console.warn(`::${declaration.mode === 'report' ? 'notice' : 'error'}::Performance guard stage failed: ${String(error).replaceAll('\n', '%0A').replaceAll('\r', '%0D')}`);
    performanceExit = performanceVerdict(declaration.mode, undefined, 1, false);
    answerSummary += `\n## Performance guard\n\nStage failed: ${String(error)}. Exit: ${performanceExit}.\n`;
    await writeFile(join(out, 'performance.json'), JSON.stringify({ exitCode: performanceExit, failure: String(error) }));
  }
  try {
    // L2 follows the same trust selection; only its introducing PR may bootstrap an absent base copy.
    let answerRoot = join(headTools ? head : base, '.github/scripts/server-answers');
    if (!headTools && !await stat(answerRoot).catch(() => undefined)) {
      console.warn('::warning::Bootstrap: merge base has no server-answer tools; using HEAD server-answer tools');
      answerRoot = join(head, '.github/scripts/server-answers');
    }
    for (const checkout of [base, head]) {
      const destination = join(checkout, '.github/scripts/server-answers');
      if (destination === answerRoot) continue;
      await rm(destination, { recursive: true, force: true });
      await cp(answerRoot, destination, { recursive: true });
    }
    const { serverStage, serverSummary } = await import('./server-stage.mts');
    const answers = await serverStage(base, head, out, declaration.mode, 'https://earth-assets.lowpoly.cc');
    timings.push(...answers.timings);
    answerExit = answers.exitCode;
    answerSummary = serverSummary(answers);
  } catch (error) {
    // Even setup/reporting failure of L2 remains informational without a declaration.
    console.warn(`::notice::Server answers stage failed: ${String(error).replaceAll('\n', '%0A').replaceAll('\r', '%0D')}`);
    answerExit = serverVerdict(declaration.mode, 0, 1);
    answerSummary = `\n## Server answers\n\nStage failed: ${String(error)}. Exit: ${answerExit}.\n`;
    await writeFile(join(out, 'server-answers.json'), JSON.stringify({ exitCode: answerExit, failure: String(error) }));
  }
  await writeFile(join(out, 'timings.json'), `${JSON.stringify(timings, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, jobSummary(JSON.parse(await readFile(join(out, 'report.json'), 'utf8')), timings, declaration.mode, source) + answerSummary);
  return comparisonExit || answerExit || performanceExit;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await main(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; }
}

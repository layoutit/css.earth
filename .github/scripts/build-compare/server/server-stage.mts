/** Reuse the two L3 outputs for offline L2 bundles, recordings, sanity checks and exact diffs. */
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, stat, rm, writeFile } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { scriptsAt, postBuildSteps } from '../../server-answers/revision-entries.mts';
import { readDeploymentConfig } from '../../server-answers/deployment-config.mts';
import { array, files, number, record, string } from '../records.mts';
import { retainRecordingPair, serverVerdict } from './server-policy.mts';
import { parallel, recordingConcurrency, recordingIsolation } from './parallel.mts';

export interface Timing { stage: string; seconds: number; exitCode: number }
interface TargetReport { target: string; base: number | null; head: number | null; differences: { file: string; dimension: string }[]; compared: boolean }
export interface ServerReport { exitCode: number; failures: string[]; targets: TargetReport[]; timings: Timing[]; retainedBytes: number }
export type Run = (stage: string, program: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) => Promise<{ exitCode: number; output: string }>;
export function serverSummary(report: ServerReport): string {
  return `## Server answers\n\nServer answers must match exactly in every declared refactor. Exit: ${report.exitCode}.\n\n| Target | Base answers | Head answers | Differences |\n| --- | ---: | ---: | ---: |\n${report.targets.map(target => `| ${target.target} | ${target.base ?? 'failed'} | ${target.head ?? 'failed'} | ${target.compared ? target.differences.length : 'not compared'} |`).join('\n')}\n\n${report.targets.flatMap(target => target.differences.slice(0, 10).map(diff => `- ${target.target}: ${diff.file} — ${diff.dimension}`)).join('\n')}\n\n${report.failures.map(failure => `- Failure: ${failure}`).join('\n')}\n\n| L2 stage | Seconds | Exit |\n| --- | ---: | ---: |\n${report.timings.map(time => `| ${time.stage} | ${time.seconds.toFixed(1)} | ${time.exitCode} |`).join('\n')}\n`;
}
/** A finite total budget prevents unhealthy recordings from multiplying the lane's cost. */
export function supervisedRun(out: string, budgetMs = 300_000): Run {
  const deadline = performance.now() + budgetMs;
  return async (stage, program, args, cwd, env) => {
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw new Error('L2 five-minute budget exhausted');
    return new Promise((accept, reject) => {
      const child = spawn(program, args, { cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '', expired = false;
      const stop = (signal: NodeJS.Signals) => {
        if (child.pid && process.platform !== 'win32') { try { process.kill(-child.pid, signal); } catch { /* Already exited. */ } }
        else child.kill(signal);
      };
      const watch = setInterval(() => console.log(`[server-answers] ${stage}: running`), 30_000);
      let kill: ReturnType<typeof setTimeout> | undefined;
      const timer = setTimeout(() => { expired = true; stop('SIGTERM'); kill = setTimeout(() => stop('SIGKILL'), 5000); }, remaining);
      const interrupt = () => stop('SIGTERM');
      process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
      const cleanup = () => { clearInterval(watch); clearTimeout(timer); clearTimeout(kill); process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); };
      child.stdout.on('data', chunk => { output += String(chunk); });
      child.stderr.on('data', chunk => { output += String(chunk); });
      child.once('error', error => { cleanup(); reject(error); });
      child.once('close', code => {
        cleanup();
        if (expired) output += '\nL2 five-minute budget exhausted\n';
        void writeFile(join(out, `${stage}.log`), output).then(() => accept({ exitCode: expired ? 2 : code ?? 2, output }), reject);
      });
    });
  };
}
export async function serverStage(base: string, head: string, out: string, mode: 'report' | 'pure-move' | 'semantic', publishedOrigin: string, run?: Run, options: { cachedBase?: boolean; onlyBase?: boolean } = {}): Promise<ServerReport> {
  const evidence = join(out, 'server-answers');
  await mkdir(evidence, { recursive: true });
  const execute = run ?? supervisedRun(evidence);
  const report: ServerReport = { exitCode: 0, failures: [], targets: ['preview', 'cloudflare'].map(target => ({ target, base: null, head: null, differences: [], compared: false })), timings: [], retainedBytes: 0 };
  const fail = (message: string) => { report.failures.push(message); console.warn(`::notice::Server answers: ${message.replaceAll('\n', '%0A').replaceAll('\r', '%0D')}`); };
  const stage = async (name: string, program: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) => {
    const start = performance.now();
    let result;
    try { result = await execute(name, program, args, cwd, env); }
    catch (error) { result = { exitCode: 2, output: String(error) }; await writeFile(join(evidence, `${name}.log`), result.output); }
    report.timings.push({ stage: name, seconds: (performance.now() - start) / 1000, exitCode: result.exitCode });
    console.log(`[server-answers] ${name}: ${report.timings.at(-1)?.seconds.toFixed(1)}s, exit ${result.exitCode}`);
    if (result.exitCode > 1 || (result.exitCode && !name.startsWith('diff-'))) fail(`${name}: exit ${result.exitCode}; ${result.output}`);
    return result;
  };
  for (const [side, checkout] of [['base', base], ['head', head]] as const) {
    if (side === 'head' && options.onlyBase) continue;
    if (side === 'base' && options.cachedBase) {
      for (const target of report.targets) target.base = array(record(JSON.parse(await readFile(join(evidence, 'base', target.target, 'index.json'), 'utf8'))).requests).map(string).length;
      continue;
    }
    const tools = join(checkout, '.github/scripts/server-answers');
    const env = { ...process.env, PATH: `${join(checkout, 'node_modules/.bin')}${delimiter}${process.env.PATH ?? ''}`, ASSET_ORIGIN: publishedOrigin, CSSEARTH_ALLOW_MISSING_ASSETS: '0', CSSEARTH_SKIP_DECLARATIONS: '1', NODE_OPTIONS: `--max-old-space-size=1536 --import=${join(tools, 'offline.mts')}` };
    let copied = false;
    try {
      // L2 mutates its checkout copy; L3 and simultaneous L7 keep reading the original.
      await cp(join(out, side, 'dist'), join(checkout, 'dist'), { recursive: true, errorOnExist: true, force: false });
      copied = true;
      const steps = postBuildSteps(await scriptsAt(checkout));
      for (const [index, step] of steps.entries()) {
        const result = await stage(`${side}-bundle-${index}`, 'bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', step], checkout, env);
        if (result.exitCode) throw new Error(`${side} bundle failed; see log`);
      }
      const config = await readDeploymentConfig(checkout);
      if (!(await stat(resolve(checkout, config.workerMain))).size) throw new Error(`Empty bundle: ${config.workerMain}`);
      // Host owns fetch routing; the offline preload is only for bundling.
      const recordedTargets = await parallel(report.targets, recordingConcurrency, async target => {
        const isolated = await recordingIsolation(join(evidence, 'temporary'), `${side}-${target.target}`);
        try {
          const recordingEnv = { ...env, ...isolated.env, PATH: env.PATH };
          const destination = join(evidence, side, target.target);
          const recorded = await stage(`${side}-record-${target.target}`, process.execPath, [join(tools, 'record.mts'), '--target', target.target, '--dist', join(checkout, 'dist'), '--asset-origin', publishedOrigin, '--out', destination], checkout, recordingEnv);
          if (recorded.exitCode) return;
          const checked = await stage(`${side}-check-${target.target}`, process.execPath, [join(tools, 'check.mts'), '--recorded', destination], checkout, recordingEnv);
          if (checked.exitCode) return;
          if (!checked.output.includes('Sane baseline:')) { fail(`${side} ${target.target}: checker produced no sanity evidence`); return; }
          try {
            const count = array(record(JSON.parse(await readFile(join(destination, 'index.json'), 'utf8'))).requests).map(string).length;
            if (!count) throw new Error('Empty request catalogue');
            target[side] = count;
          }
          catch (error) { fail(`${side} ${target.target}: missing valid recording index: ${String(error)}`); }
        } finally { await isolated.close(); }
      });
      for (const result of recordedTargets) if (result.status === 'rejected') fail(`${side} recording: ${String(result.reason)}`);
    } catch (error) { fail(`${side}: ${String(error)}`); }
    finally {
      if (copied) {
        try { await rm(join(checkout, 'dist'), { recursive: true, force: true }); }
        catch (error) { fail(`${side} remove temporary dist: ${String(error)}`); }
      }
    }
  }
  for (const target of options.onlyBase ? [] : report.targets) {
    if (target.base === null || target.head === null) continue;
    const before = join(evidence, 'base', target.target), after = join(evidence, 'head', target.target);
    const result = await stage(`diff-${target.target}`, process.execPath, [join(head, '.github/scripts/server-answers/diff.mts'), '--base', before, '--head', after, '--summary'], head, { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' });
    if (result.exitCode > 1) continue;
    try {
      target.differences = array(record(JSON.parse(result.output)).differences).map(raw => { const diff = record(raw); return { file: string(diff.file), dimension: string(diff.dimension) }; });
      if (result.exitCode !== (target.differences.length ? 1 : 0)) throw new Error('Diff exit/count mismatch');
      target.compared = true;
      if (target.differences.length) {
        await mkdir(join(evidence, 'artifacts'), { recursive: true });
        await writeFile(join(evidence, 'artifacts', `${target.target}-diff.json`), `${JSON.stringify(target.differences, null, 2)}\n`);
        const pairBytes = (await Promise.all([before, after].map(async dir => (await Promise.all((await files(dir)).map(async file => (await stat(join(dir, file))).size))).reduce((sum, size) => sum + size, 0)))).reduce((sum, size) => sum + size, 0);
        if (retainRecordingPair(report.retainedBytes, number(pairBytes))) {
          for (const [side, dir] of [['base', before], ['head', after]]) await cp(dir!, join(evidence, 'artifacts', target.target, side!), { recursive: true });
          report.retainedBytes += pairBytes;
        }
      }
    } catch (error) { fail(`${target.target} diff evidence: ${String(error)}`); }
  }
  report.exitCode = serverVerdict(mode, report.targets.reduce((sum, target) => sum + target.differences.length, 0), report.failures.length);
  await writeFile(join(out, 'server-answers.json'), `${JSON.stringify({ ...report, timings: undefined }, null, 2)}\n`);
  console.log(serverSummary(report));
  return report;
}

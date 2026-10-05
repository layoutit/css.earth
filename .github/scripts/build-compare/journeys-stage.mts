/** L1 inside the comparison lane: run the qualified browser journeys on both built sites and compare their recordings exactly. */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type JourneysMode = 'report' | 'pure-move' | 'semantic';
export interface JourneysStageReport { exitCode: number; mode: JourneysMode; profiles: { profile: string; base: number; head: number; compare: number | undefined }[]; failures: string[]; timings: { stage: string; seconds: number; exitCode: number }[]; summary: string }
export type JourneysRun = (stage: string, args: string[], cwd: string) => Promise<{ exitCode: number; output: string }>;
/** Ordinary pull requests only report. A declared refactor needs every run to finish and every recording to match exactly. */
export function journeysVerdict(mode: JourneysMode, failures: number, differences: number): number {
  if (mode === 'report') return 0;
  if (failures > 0) return 2;
  return differences > 0 ? 1 : 0;
}
export function runNode(stage: string, args: string[], cwd: string): ReturnType<JourneysRun> {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += String(chunk); });
    child.stderr.on('data', chunk => { output += String(chunk); });
    child.once('error', reject);
    child.once('close', code => accept({ exitCode: code ?? 2, output }));
  });
}
/** `harness` is the checkout whose `site/journeys` runs (merge base, except for the introducing pull request); each side serves its own checkout. */
export async function journeysStage(harness: string, base: string, head: string, out: string, mode: JourneysMode, profiles: readonly string[] = ['chromium-desktop', 'webkit-desktop'], run: JourneysRun = runNode): Promise<JourneysStageReport> {
  const evidence = join(out, 'journeys');
  await mkdir(evidence, { recursive: true });
  const report: JourneysStageReport = { exitCode: 0, mode, profiles: [], failures: [], timings: [], summary: '' };
  const step = async (name: string, args: string[]) => {
    const started = performance.now();
    let result;
    try { result = await run(name, args, harness); } catch (error) { result = { exitCode: 2, output: String(error) }; }
    report.timings.push({ stage: `journeys-${name}`, seconds: (performance.now() - started) / 1000, exitCode: result.exitCode });
    await writeFile(join(evidence, `${name}.log`), result.output);
    console.log(`[journeys] ${name}: ${report.timings.at(-1)?.seconds.toFixed(1)}s, exit ${result.exitCode}`);
    return result;
  };
  let differences = 0;
  for (const profile of profiles) {
    const record = (side: 'base' | 'head', checkout: string) => step(`${side}-${profile}`, ['site/journeys/run.mts', '--dist', join(out, side, 'dist'), '--checkout', checkout,
      '--out', join(evidence, side, profile), '--profile', profile, '--gate', '--repeat', '2']);
    const [before, after] = await Promise.all([record('base', base), record('head', head)]);
    const row: JourneysStageReport['profiles'][number] = { profile, base: before.exitCode, head: after.exitCode, compare: undefined };
    for (const [side, result] of [['base', before], ['head', after]] as const) if (result.exitCode) report.failures.push(`${side} ${profile} exited ${result.exitCode}: ${result.output.slice(-300)}`);
    if (!before.exitCode && !after.exitCode) {
      const compared = await step(`compare-${profile}`, ['site/journeys/compare.mts', '--base', join(evidence, 'base', profile), '--head', join(evidence, 'head', profile)]);
      row.compare = compared.exitCode;
      if (compared.exitCode === 1) differences++;
      else if (compared.exitCode) report.failures.push(`compare ${profile} exited ${compared.exitCode}: ${compared.output.slice(-300)}`);
    }
    report.profiles.push(row);
  }
  report.exitCode = journeysVerdict(mode, report.failures.length, differences);
  report.summary = report.profiles.map(row => `| ${row.profile} | ${row.base} | ${row.head} | ${row.compare ?? 'not run'} |`).join('\n');
  await writeFile(join(out, 'journeys.json'), `${JSON.stringify({ ...report, timings: undefined }, null, 2)}\n`);
  return report;
}
export function journeysSummary(report: JourneysStageReport): string {
  const rule = report.mode === 'report' ? 'Reported only: an ordinary pull request may change behavior.' : 'Declared refactor: every qualified journey must record the same observations on both builds.';
  return `## Browser journeys\n\n${rule} Exit: ${report.exitCode}.\n\n| Profile | Base run | Head run | Comparison |\n| --- | ---: | ---: | ---: |\n${report.summary}\n${report.failures.length ? `\nCould not complete: ${report.failures.join('; ')}\n` : ''}`;
}

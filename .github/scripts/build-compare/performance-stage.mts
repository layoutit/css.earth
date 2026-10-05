/** L7 part A inside the comparison lane: measure the two builds the lane already made and apply the one-way rule. */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PerformanceStageReport { exitCode: number; mode: PerformanceMode; approved: boolean; failures: string[]; timings: { stage: string; seconds: number; exitCode: number }[]; summary: string }
export type PerformanceRun = (stage: string, args: string[], cwd: string) => Promise<{ exitCode: number; output: string }>;
export type PerformanceMode = 'report' | 'pure-move' | 'semantic';
/** Ordinary pull requests only report. A declared refactor is strict: any increase fails, an owner-approved one still reports, a stage that could not run fails closed. */
export function performanceVerdict(mode: PerformanceMode, compareExit: number | undefined, failures: number, approved: boolean): number {
  if (mode === 'report') return 0;
  if (failures > 0 || compareExit === undefined || compareExit > 1) return 2;
  if (compareExit === 1 && approved) return 0;
  return compareExit;
}
export function runNode(stage: string, args: string[], cwd: string): ReturnType<PerformanceRun> {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += String(chunk); });
    child.stderr.on('data', chunk => { output += String(chunk); });
    child.once('error', reject);
    child.once('close', code => accept({ exitCode: code ?? 2, output }));
  });
}
export async function performanceStage(tools: string, base: string, head: string, out: string, mode: PerformanceMode, approved: boolean, run: PerformanceRun = runNode): Promise<PerformanceStageReport> {
  const evidence = join(out, 'performance');
  await mkdir(evidence, { recursive: true });
  const report: PerformanceStageReport = { exitCode: 0, mode, approved, failures: [], timings: [], summary: '' };
  const step = async (name: string, args: string[]) => {
    const started = performance.now();
    let result;
    try { result = await run(name, args, head); } catch (error) { result = { exitCode: 2, output: String(error) }; }
    report.timings.push({ stage: `performance-${name}`, seconds: (performance.now() - started) / 1000, exitCode: result.exitCode });
    await writeFile(join(evidence, `${name}.log`), result.output);
    console.log(`[performance] ${name}: ${report.timings.at(-1)?.seconds.toFixed(1)}s, exit ${result.exitCode}`);
    return result;
  };
  for (const side of ['base', 'head'] as const) {
    const measured = await step(`measure-${side}`, [join(tools, 'measure.mts'), '--dist', join(out, side, 'dist'), '--metadata', join(out, side, 'metadata'), '--out', join(evidence, side), '--summary', join(evidence, `${side}.md`)]);
    if (measured.exitCode) report.failures.push(`${side} measurement exited ${measured.exitCode}: ${measured.output.slice(-400)}`);
  }
  let compareExit: number | undefined;
  if (!report.failures.length) {
    const compared = await step('compare', [join(tools, 'compare-measures.mts'), '--base', join(evidence, 'base'), '--head', join(evidence, 'head'), '--json', join(evidence, 'comparison.json'), '--summary', join(evidence, 'comparison.md')]);
    compareExit = compared.exitCode;
    report.summary = compared.output;
  }
  report.exitCode = performanceVerdict(mode, compareExit, report.failures.length, approved);
  if (report.failures.length) report.summary = `Performance guard could not run: ${report.failures.join('; ')}`;
  await writeFile(join(out, 'performance.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
export function performanceSummary(report: PerformanceStageReport): string {
  const rule = report.mode === 'report' ? 'Reported only: an ordinary pull request may add bytes. A declared refactor must keep every counted measure at or below the merge base.' : 'Declared refactor: every counted measure must stay at or below the merge base.';
  const heading = `## Performance guard\n\n${rule} Exit: ${report.exitCode}${report.approved && report.mode !== 'report' ? ' (increase approved by the owner label)' : ''}.\n\n`;
  return heading + report.summary.split('\n').slice(0, 60).join('\n') + '\n';
}

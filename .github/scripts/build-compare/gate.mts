/** Tiny merge-base-owned PR gate and demand selector; no dependencies or builds. */
import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasApplicationRenames, applicationPaths } from './source-paths.mts';
export interface GateInput { declarationStatus: string; applicationRenames: boolean; labels: string[]; branch: string; dispatch?: boolean; applicationChanged?: boolean; }
export function gateDecision(input: GateInput): { required: boolean; fresh: boolean; run: boolean; passes: boolean } {
  const fresh = /^[AM]\s/u.test(input.declarationStatus);
  const required = input.applicationRenames || input.labels.includes('refactor');
  return { required, fresh, run: Boolean(input.dispatch) || Boolean(input.applicationChanged) || input.applicationRenames || input.labels.includes('tool-change'), passes: !required || fresh };
}
export function cancelBuild(action: string): boolean { return action === 'synchronize'; }
function main(): void {
  const base = process.argv[2];
  if (!base) throw new Error('Usage: gate.mts <merge-base> [--select]');
  const git = (args: string[]): string => execFileSync('git', args, { encoding: 'utf8' });
  const event: unknown = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
  const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
  const pr = object(object(event).pull_request), head = object(pr.head);
  const labels = Array.isArray(pr.labels) ? pr.labels.flatMap(value => typeof object(value).name === 'string' ? [String(object(value).name)] : []) : [];
  const decision = gateDecision({ declarationStatus: git(['diff', '--name-status', `${base}..HEAD`, '--', '.github/site-refactor.json']), applicationChanged: applicationPaths(git(['diff', '--name-status', '-z', '-M', `${base}..HEAD`])).length > 0, applicationRenames: hasApplicationRenames(process.cwd(), base, 'HEAD'), labels, branch: typeof head.ref === 'string' ? head.ref : '', dispatch: process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' });
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run_production=${decision.run}\n`);
  console.log(JSON.stringify(decision));
  if (process.argv.includes('--select') && process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, decision.run ? 'Full build comparison selected: application input, tool-change or dispatch.\n' : 'No build: docs/tools/test-only changes rely on the changed tools’ own tests in the universe lane.\n');
  if (!process.argv.includes('--select') && !decision.passes) { console.error('::error::Application rename or refactor marker requires .github/site-refactor.json added or changed in this PR'); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}

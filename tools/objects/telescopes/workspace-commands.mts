/** Workspace entry scripts the telescope runs as processes of their own. They read and write the checkout's body packages,
 * prepared inventory and application shell, which the telescope does not import: it hands them its parsed options and
 * takes back their result text and exit code, and an error they throw is raised again here with its class and message. */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';

/** `telescope new-object`: the object generator and the bake it hands its objects to. */
export const NEW_OBJECT_COMMAND = 'tools/objects/new-object/cli.mts';
/** The built density-volume preparation, as `#preparation/prepare-volume` resolves it. */
export const PREPARE_VOLUME_COMMAND = 'tools/objects/dist/prepare-volume.js';
/** The exit code of an entry that failed with an error, whose stdout then holds only `workspaceCommandFailure(error)`. */
export const WORKSPACE_COMMAND_FAILED = 70;

export function workspaceCommandFailure(error: unknown): string {
  const failure = error instanceof Error ? { name: error.name, message: error.message, ...(error.cause instanceof Error ? { cause: error.cause.message } : {}), ...(error.stack ? { stack: error.stack } : {}) }
    : { name: 'Error', message: String(error) };
  return `${JSON.stringify({ workspaceCommandFailure: failure })}\n`;
}

function raised(text: string): Error {
  const failure = requireRecord(requireRecord(JSON.parse(text), 'workspace command failure').workspaceCommandFailure, 'workspace command failure');
  const name = requireString(failure.name, 'failure name'), message = requireString(failure.message, 'failure message');
  const options = failure.cause === undefined ? undefined : { cause: new Error(requireString(failure.cause, 'failure cause')) };
  const error = name === 'TypeError' ? new TypeError(message, options) : name === 'RangeError' ? new RangeError(message, options) : new Error(message, options);
  if (typeof failure.stack === 'string') error.stack = failure.stack;
  return error;
}

/** Run a workspace entry with the telescope's own Node. Its stderr is the telescope's; its stdout is returned as the result
 * text, and with `output: 'stderr'` it goes to stderr too, as the telescope keeps instrument logging off stdout. */
export async function runWorkspaceCommand(root: string, script: string, args: readonly string[], { output = 'text' }: { readonly output?: 'text' | 'stderr' } = {}): Promise<{ text: string; code: number }> {
  const child = spawn(process.execPath, [resolve(root, script), ...args], { cwd: root, stdio: ['inherit', output === 'text' ? 'pipe' : 2, 2] });
  let text = '';
  child.stdout?.setEncoding('utf8').on('data', (chunk: string) => { text += chunk; });
  const code = await new Promise<number>((accept, reject) => { child.once('error', reject); child.once('close', (status, signal) => accept(status ?? (signal === 'SIGINT' ? 130 : 143))); });
  if (code === WORKSPACE_COMMAND_FAILED) throw raised(text);
  return { text, code };
}

/** Run a workspace entry whose result is the files it writes; a non-zero exit is an error. */
export async function runWorkspaceScript(root: string, script: string, args: readonly string[]): Promise<void> {
  const { code } = await runWorkspaceCommand(root, script, args, { output: 'stderr' });
  if (code !== 0) throw new Error(`${script} ${args.join(' ')} exited with ${code}.`);
}

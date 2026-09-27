/** Workspace entry scripts the telescope runs as processes of their own. They read and write the checkout's body packages,
 * prepared inventory and application shell, which the telescope does not import: it hands them its parsed options and
 * takes back their answer over the IPC channel (`answerParent` in `@cssearth/core/node`): the result text and exit code, or
 * the failure, raised here again with its class, message, cause and stack. Everything the entry and the processes it starts
 * print goes to the telescope's stderr, so stdout carries only the telescope's own result. */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { parseProcessAnswer, raisedProcessFailure, type ProcessAnswer, type ProcessResult } from '@cssearth/core/node';

/** A workspace entry: the script the telescope runs, and the source that script is built from. Each is declared in its own
 * `workspace-commands/<name>.mts`, which an implementation identity follows into `source`. */
export interface WorkspaceCommand { readonly script: string; readonly source: string }

/** Run a workspace entry with the telescope's own Node and return its answer's result. */
export async function runWorkspaceCommand(root: string, command: WorkspaceCommand, args: readonly string[]): Promise<ProcessResult> {
  const child = spawn(process.execPath, [resolve(root, command.script), ...args], { cwd: root, stdio: ['inherit', 2, 2, 'ipc'] });
  let answer: ProcessAnswer | undefined;
  child.on('message', message => { answer ??= parseProcessAnswer(message); });
  const code = await new Promise<number>((accept, reject) => { child.once('error', reject); child.once('close', (status, signal) => accept(status ?? (signal === 'SIGINT' ? 130 : 143))); });
  if (answer && 'failure' in answer) throw raisedProcessFailure(answer.failure);
  return answer?.result ?? { text: '', code };
}

/** Run a workspace entry whose result is the files it writes; a non-zero exit is an error. */
export async function runWorkspaceScript(root: string, command: WorkspaceCommand, args: readonly string[]): Promise<void> {
  const { code } = await runWorkspaceCommand(root, command, args);
  if (code !== 0) throw new Error(`${command.script} ${args.join(' ')} exited with ${code}.`);
}

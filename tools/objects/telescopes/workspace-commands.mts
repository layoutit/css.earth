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
  // Its own process group, so a signal reaches every process the command starts (a bake's steps) as well as the command.
  // The commands read no input; a process outside the terminal's session could not read it anyway.
  const child = spawn(process.execPath, [resolve(root, command.script), ...args], { cwd: root, detached: true, stdio: ['ignore', 2, 2, 'ipc'] });
  const signalGroup = (signal: NodeJS.Signals) => { try { process.kill(-child.pid!, signal); } catch { /* The group has already ended. */ } };
  let answer: ProcessAnswer | undefined;
  child.on('message', message => { answer ??= parseProcessAnswer(message); });
  // The command is part of the telescope's own run: a signal the telescope receives stops it too, and the telescope then
  // ends by that signal as it did when it ran the command in process; if the telescope exits first, the command goes with it.
  let received: NodeJS.Signals | undefined;
  const forward = (signal: NodeJS.Signals) => { received ??= signal; signalGroup(signal); }, orphan = () => { signalGroup('SIGKILL'); };
  process.on('SIGINT', forward); process.on('SIGTERM', forward); process.on('exit', orphan);
  const code = await new Promise<number>((accept, reject) => { child.once('error', reject); child.once('close', (status, signal) => accept(status ?? (signal === 'SIGINT' ? 130 : 143))); })
    .finally(() => { process.off('SIGINT', forward); process.off('SIGTERM', forward); process.off('exit', orphan); });
  if (received) { process.kill(process.pid, received); await new Promise(() => {}); }
  if (answer && 'failure' in answer) throw raisedProcessFailure(answer.failure);
  if (!answer) throw new Error(`${command.script} exited with ${code} without answering.`);
  return answer.result;
}

/** Run a workspace entry whose result is the files it writes; a non-zero exit is an error. */
export async function runWorkspaceScript(root: string, command: WorkspaceCommand, args: readonly string[]): Promise<void> {
  const { code } = await runWorkspaceCommand(root, command, args);
  if (code !== 0) throw new Error(`${command.script} ${args.join(' ')} exited with ${code}.`);
}

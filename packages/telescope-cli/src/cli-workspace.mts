/** Admit the caller's workspace before CLI dependencies capture their read-only roots. */
import { configureWorkspace, workspaceArguments } from '@cssearth/telescope-core/node';

export function cliWorkspaceArguments(args: readonly string[], env: NodeJS.ProcessEnv = process.env) {
  return workspaceArguments(args, env, process.cwd());
}

export function configureCliWorkspace(args: readonly string[]): string[] {
  return configureWorkspace(args, process.cwd());
}

try { configureCliWorkspace(process.argv.slice(2)); }
catch { /* The entry reports invalid global options inside its normal error boundary. */ }

import type { CliIo } from './cli/cli-io.mts';
import { helpText } from './help.mts';
import { helpScreen } from './tui/help.mts';
import { processTerminal } from './tui/terminal.mts';

/** Both the early binary help and worker help use the same terminal screen. */
export async function writeHelp(topic: string | undefined, io: CliIo, json: boolean): Promise<number> {
  if ((!topic || topic === 'help') && io.stdinIsTTY && io.stdoutIsTTY && io.stderrIsTTY === true && !json) {
    return helpScreen(io.terminal ?? processTerminal());
  }
  io.write(helpText(topic));
  return 0;
}

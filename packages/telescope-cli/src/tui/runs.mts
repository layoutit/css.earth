import { LIST_MINIMUM_ROWS, listPageSize } from './list.mts';
import { screenFrame } from './screen.mts';
import { bold, breadcrumb, dim, green, yellow } from './style.mts';
import type { Terminal } from './terminal.mts';
import type { SavedRun } from './saved-runs.mts';

export const NO_SAVED_RUNS = 'No saved runs yet. Start one with: telescope explore TARGET';
function age(at: string, now: number): string {
  const minutes = Math.round((now - Date.parse(at)) / 60000);
  return minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} d ago`;
}
export function renderRuns(runs: readonly SavedRun[], active: number, now: number, height = 40): string[] {
  if (!runs.length) return [NO_SAVED_RUNS];
  if (height < LIST_MINIMUM_ROWS) return [`make the window taller: needs ${LIST_MINIMUM_ROWS} rows`];
  const page = listPageSize(height), start = Math.max(0, Math.min(active - Math.floor(page / 2), runs.length - page));
  return [breadcrumb(['telescope', 'runs']), '', bold('Your runs'), '', ...runs.slice(start, start + page).map((run, index) =>
    (index + start === active ? bold('> ') : '  ') + run.target.padEnd(14) + age(run.at, now).padEnd(12) + `${String(run.observations).padStart(3)} observations   ` +
    (run.downloaded ? green(`✓ ${run.downloaded} downloaded`) : dim('nothing downloaded')) +
    (run.partial ? `  ${yellow(`◐ ${run.partial} partial`)}` : '') + (run.made ? dim(`  · ${run.made} made`) : '')),
    '', dim(`↑↓ choose · enter reopen · esc quit   ${runs[active]!.run}`)];
}
export interface RunsExit { readonly code: number; readonly run?: SavedRun }
export async function runsScreen(runs: readonly SavedRun[], terminal: Terminal, now: () => number = Date.now): Promise<RunsExit> {
  if (!runs.length) { terminal.write(`${NO_SAVED_RUNS}\n`); return { code: 0 }; }
  let active = 0, close = () => {};
  const lines = () => renderRuns(runs, active, now(), terminal.rows);
  try {
    return await new Promise<RunsExit>((accept, reject) => {
      let closed = false;
      const finish = (exit: RunsExit) => { closed = true; accept(exit); };
      const draw = () => { try { terminal.write(screenFrame(lines(), terminal.columns, terminal.rows)); } catch (error) { closed = true; reject(error); } };
      close = terminal.listen(key => {
        if (closed) return;
        if (key.ctrl && key.name === 'c') { finish({ code: 130 }); return; }
        if (key.name === 'escape' || key.name === 'eof') { finish({ code: 0 }); return; }
        if (terminal.rows < LIST_MINIMUM_ROWS) return;
        if (key.name === 'return') { finish({ code: 0, run: runs[active]! }); return; }
        if (key.name === 'up') active = Math.max(0, active - 1);
        if (key.name === 'down') active = Math.min(runs.length - 1, active + 1);
        if (key.name === 'pageup') active = Math.max(0, active - listPageSize(terminal.rows));
        if (key.name === 'pagedown') active = Math.min(runs.length - 1, active + listPageSize(terminal.rows));
        draw();
      }, draw, { alternateScreen: true });
      draw();
    });
  } finally { close(); }
}

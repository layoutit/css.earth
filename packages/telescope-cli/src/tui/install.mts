import { statfs } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ToolchainProgress, ToolchainStep } from '@cssearth/telescope-core/node';
import { header } from './help.mts';
import { liveBlock } from './live-block.mts';
import { bold, breadcrumb, dim, green } from './style.mts';
import type { Terminal } from './terminal.mts';

export const NOT_INSTALLED = 'Not installed. Commands that need Python will ask again; install any time with: telescope toolchain install';
const steps: readonly ToolchainStep[] = ['micromamba', 'python', 'packages', 'check'];
type StepState = 'waiting' | 'started' | 'finished';
export interface InstallState {
  readonly frame: number;
  readonly installed: boolean;
  readonly steps: Readonly<Record<ToolchainStep, StepState>>;
  readonly python: string;
  readonly received?: number;
  readonly total?: number;
}
export const initialInstallState = (): InstallState => ({ frame: 0, installed: false, python: 'Python',
  steps: { micromamba: 'waiting', python: 'waiting', packages: 'waiting', check: 'waiting' } });
export function installProgress(state: InstallState, event: ToolchainProgress): InstallState {
  if (event.type === 'installed') return { ...state, installed: true };
  if (event.type === 'download') return { ...state, received: event.received, total: event.total };
  return { ...state, python: event.step === 'python' && event.label ? event.label : state.python,
    steps: { ...state.steps, [event.step]: event.status } };
}
const installHeader = (frame: number, columns: number) => [breadcrumb(['telescope', 'toolchain', 'install']), ...header(frame, columns)];
export function renderInstallConsent(freeGb: string, columns: number): string[] {
  return [...installHeader(0, columns), '', bold('This needs the astronomy tools first.'),
    `  Python and its astronomy packages · about 1 GB · installed once, shared by every run · ${freeGb} GB free`, '',
    `  ${bold('Install them now?')}  ${dim('enter yes · esc not now')}`];
}
function bar(state: InstallState): string {
  if (state.received !== undefined && state.total !== undefined) {
    const fraction = Math.max(0, Math.min(1, state.received / state.total)), filled = Math.round(fraction * 24);
    return '━'.repeat(filled) + dim('─'.repeat(24 - filled)) + ` ${Math.round(fraction * 100)}%`;
  }
  const position = state.frame % 24;
  return dim('─'.repeat(position)) + '━' + dim('─'.repeat(23 - position));
}
export function renderInstall(state: InstallState, columns: number): string[] {
  const names = { micromamba: 'micromamba', python: state.python, packages: 'Astronomy packages', check: 'Check the install' };
  return [...installHeader(state.frame, columns), '', bold(state.installed ? 'Installed.' : 'Installing astronomy tools (one time)…'),
    ...steps.map(step => {
      const size = step === 'micromamba' && state.received !== undefined
        ? `${(state.received / 1e6).toFixed(1)} MB${state.total === undefined ? '' : ` of ${(state.total / 1e6).toFixed(1)} MB`}`
        : step === 'packages' ? '~1 GB' : '';
      const status = state.installed || state.steps[step] === 'finished' ? green('done')
        : state.steps[step] === 'started' ? bar(step === 'micromamba' ? state : { ...state, received: undefined, total: undefined }) : dim('waiting');
      return `  ${names[step].padEnd(20)}${size.padEnd(9)}${size.length >= 9 ? ' ' : ''}${status}`;
    }), ...(state.installed ? ['', bold('Try:'), '  telescope explore Betelgeuse      find observations and pick one',
      '  telescope explore "Crab Nebula"   any star, galaxy, nebula or planet', '  telescope help                    every command'] : [])];
}

/** Find the user's volume even before the toolchain root itself exists. */
export async function installFreeGb(userRoot: string): Promise<string> {
  for (let directory = userRoot; ;) {
    try { const { bavail, bsize } = await statfs(directory); return (bavail * bsize / 1024 ** 3).toFixed(0); }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT') || dirname(directory) === directory) throw error;
      directory = dirname(directory);
    }
  }
}

/** Short-lived install blocks stay inline; the raw-key listener belongs to the whole transaction. */
export function createInstallScreen(terminal: Terminal, controller: AbortController, toolchain = 'astroquery') {
  terminal.write('\r\x1b[K');
  let state = initialInstallState(), block = liveBlock(terminal), close = () => {}, running = false, stopped = false;
  let answer: ((accepted: boolean) => void) | undefined;
  const animation = new AbortController();
  const draw = () => block.draw(renderInstall(state, terminal.columns));
  const finish = () => {
    if (stopped) return;
    stopped = true; animation.abort(); block.done(running ? renderInstall(state, terminal.columns) : undefined); close();
  };
  const animate = async () => {
    try {
      while (!animation.signal.aborted) {
        await terminal.delay(80, animation.signal);
        if (animation.signal.aborted) break;
        state = { ...state, frame: state.frame + 1 }; draw();
      }
    } catch (error) { if (!animation.signal.aborted) { controller.abort(error); finish(); } }
  };
  return {
    get active() { return !stopped; },
    async consent(freeGb: string, yes = false): Promise<boolean> {
      let consentLines = renderInstallConsent(freeGb, terminal.columns);
      close = terminal.listen(key => {
        if (key.name === 'eof' || key.ctrl && key.name === 'c') { controller.abort(); answer?.(false); finish(); }
        else if (!running && key.name === 'return') answer?.(true);
        else if (!running && key.name === 'escape') answer?.(false);
      }, () => { if (running) draw(); else { consentLines = renderInstallConsent(freeGb, terminal.columns); block.draw(consentLines); } });
      block.draw(consentLines);
      // Consent must remain readable in a short window before waiting for a key.
      if (consentLines.length >= terminal.rows) { block.done(consentLines); block = liveBlock(terminal); }
      const accepted = yes || await new Promise<boolean>(resolve => { answer = resolve; });
      answer = undefined;
      if (!accepted) { finish(); terminal.write(`${dim(`${NOT_INSTALLED} ${toolchain}`)}\n`); return false; }
      running = true; draw(); void animate(); return true;
    },
    progress(event: ToolchainProgress): void {
      if (stopped) return;
      state = installProgress(state, event); draw();
      if (state.installed) finish();
    },
    close: finish,
  };
}

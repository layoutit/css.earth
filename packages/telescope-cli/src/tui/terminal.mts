import { emitKeypressEvents, type Key } from 'node:readline';
import { setTimeout } from 'node:timers/promises';
import { EventEmitter } from 'node:events';

export interface ScreenKey { readonly name?: string; readonly text?: string; readonly ctrl?: boolean; readonly meta?: boolean }
export interface TerminalOptions { readonly alternateScreen?: boolean }
export const ENTER_SCREEN = '\x1b[?1049h\x1b[?25l';
export const LEAVE_SCREEN = '\x1b[?1049l\x1b[?25h';
export interface Terminal {
  readonly columns: number;
  readonly rows: number;
  write(text: string): void;
  listen(key: (key: ScreenKey) => void, resize: () => void, options?: TerminalOptions): () => void;
  delay(milliseconds: number, signal: AbortSignal): Promise<void>;
}
interface TerminalInput extends NodeJS.ReadableStream {
  readonly readableEnded?: boolean;
  readonly isRaw?: boolean;
  readonly readableFlowing?: boolean | null;
  isPaused(): boolean;
  setRawMode?(enabled: boolean): unknown;
}
interface TerminalOutput extends NodeJS.WritableStream { readonly columns?: number; readonly rows?: number }

/** The worker's stdout is IPC; only stdin and stderr belong to the terminal. */
export function processTerminal(input: TerminalInput = process.stdin, output: TerminalOutput = process.stderr, lifecycle: EventEmitter = process): Terminal {
  return {
    get columns() { return output.columns ?? 80; },
    get rows() { return output.rows ?? 24; },
    write: text => { output.write(text); },
    delay: async (milliseconds, signal) => { await setTimeout(milliseconds, undefined, { signal }); },
    listen(key, resize, options) {
      const wasRaw = input.isRaw, wasFlowing = input.readableFlowing === true;
      emitKeypressEvents(input);
      const press = (text: string | undefined, event: Key) => key({ name: event.name, ctrl: event.ctrl, meta: event.meta, text });
      const interrupt = () => key({ name: 'c', ctrl: true });
      const end = () => {
        if (closed) return;
        try { key({ name: 'eof' }); } finally { close(); }
      };
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        input.off('keypress', press); input.off('end', end); input.off('close', end); output.off('resize', resize);
        lifecycle.off('exit', close); lifecycle.off('SIGINT', interrupt); lifecycle.off('SIGTERM', interrupt);
        try { input.setRawMode?.(wasRaw === true); }
        finally {
          if (!wasFlowing) input.pause();
          output.write(options?.alternateScreen ? LEAVE_SCREEN : '\x1b[?25h');
        }
      };
      lifecycle.once('exit', close); lifecycle.on('SIGINT', interrupt); lifecycle.on('SIGTERM', interrupt);
      input.on('keypress', press); input.once('end', end); input.once('close', end); output.on('resize', resize);
      try {
        if (options?.alternateScreen) output.write(ENTER_SCREEN);
        input.setRawMode?.(true); input.resume();
        if (input.readableEnded) queueMicrotask(end);
      }
      catch (error) { close(); throw error; }
      return close;
    },
  };
}

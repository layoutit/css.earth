import type { ScreenKey, Terminal } from './terminal.mts';

/** Scripted terminal for offline screen tests; no process streams or wall-clock timers. */
export class FakeTerminal implements Terminal {
  columns: number;
  rows: number;
  readonly writes: string[] = [];
  readonly delays: number[] = [];
  listening = false;
  private key: (key: ScreenKey) => void = () => {};
  private resized: () => void = () => {};
  onDelay?: (index: number) => void;
  constructor(columns = 120, rows = 40) { this.columns = columns; this.rows = rows; }
  write(text: string): void { this.writes.push(text); }
  listen(key: (key: ScreenKey) => void, resize: () => void): () => void {
    this.listening = true; this.key = key; this.resized = resize;
    return () => { this.listening = false; this.key = () => {}; this.resized = () => {}; };
  }
  async delay(milliseconds: number, signal: AbortSignal): Promise<void> {
    this.delays.push(milliseconds); this.onDelay?.(this.delays.length - 1);
    signal.throwIfAborted();
  }
  async press(...keys: readonly ScreenKey[]): Promise<void> {
    for (const key of keys) { this.key(key); await new Promise<void>(resolve => setImmediate(resolve)); }
  }
  resize(columns: number, rows: number): void { this.columns = columns; this.rows = rows; this.resized(); }
}

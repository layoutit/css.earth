import { ENTER_SCREEN, LEAVE_SCREEN, type ScreenKey, type Terminal, type TerminalOptions } from './terminal.mts';
import { visibleWidth } from './style.mts';

interface PhysicalRow { cells: string[]; wrapped: boolean }
interface SavedBuffer { physical: PhysicalRow[]; cursorRow: number; cursorColumn: number }

/** Scripted terminal for offline screen tests; no process streams or wall-clock timers. */
export class FakeTerminal implements Terminal {
  columns: number;
  rows: number;
  readonly writes: string[] = [];
  readonly delays: number[] = [];
  readonly frames: string[][] = [];
  wraps = 0;
  private physical: PhysicalRow[] = [{ cells: [], wrapped: false }];
  private cursorRow = 0;
  private cursorColumn = 0;
  private normal?: SavedBuffer;
  private readonly graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  get screen(): string[] {
    const lines = this.physical.slice(Math.max(0, this.physical.length - this.rows)).map(row => row.cells.join(''));
    if (this.normal) while (lines.length < this.rows) lines.push('');
    return lines;
  }
  get alternateScreen(): boolean { return this.normal !== undefined; }
  get scrollback(): string[] {
    return this.normal ? [] : this.physical.slice(0, Math.max(0, this.physical.length - this.rows)).map(row => row.cells.join(''));
  }
  private save(): SavedBuffer {
    return { physical: this.physical, cursorRow: this.cursorRow, cursorColumn: this.cursorColumn };
  }
  private restore(buffer: SavedBuffer): void {
    this.physical = buffer.physical; this.cursorRow = buffer.cursorRow; this.cursorColumn = buffer.cursorColumn;
  }
  private row(): PhysicalRow {
    if (this.normal && this.cursorRow >= this.rows) {
      this.physical.shift(); this.cursorRow = this.rows - 1;
    }
    while (this.physical.length <= this.cursorRow) this.physical.push({ cells: [], wrapped: false });
    return this.physical[this.cursorRow]!;
  }
  listening = false;
  private key: (key: ScreenKey) => void = () => {};
  private resized: () => void = () => {};
  onDelay?: (index: number) => void;
  constructor(columns = 120, rows = 40) { this.columns = columns; this.rows = rows; }
  write(text: string): void {
    this.writes.push(text);
    for (const token of text.split(/(\x1b\[[?0-9;]*[A-Za-z]|\n|\r)/u).filter(Boolean)) {
      if (token.startsWith('\x1b[')) {
        if (token === '\x1b[?1049h' && !this.normal) {
          this.normal = this.save(); this.physical = [{ cells: [], wrapped: false }];
          this.cursorRow = 0; this.cursorColumn = 0;
        } else if (token === '\x1b[?1049l' && this.normal) {
          this.restore(this.normal); this.normal = undefined;
        } else if (token === '\x1b[H') {
          this.cursorRow = Math.max(0, this.physical.length - this.rows); this.cursorColumn = 0;
        } else if (token.endsWith('F')) {
          const count = Number(token.slice(2, -1)) || 1;
          this.cursorRow = Math.max(Math.max(0, this.physical.length - this.rows), this.cursorRow - count);
          this.cursorColumn = 0;
        } else if (token.endsWith('K')) {
          if (token === '\x1b[2K') this.row().cells = [];
          else this.row().cells.length = Math.min(this.row().cells.length, this.cursorColumn);
          this.row().wrapped = false;
        } else if (token === '\x1b[J') {
          this.row().cells.length = Math.min(this.row().cells.length, this.cursorColumn);
          this.row().wrapped = false;
          for (let index = this.cursorRow + 1; index < this.physical.length; index++) {
            this.physical[index] = { cells: [], wrapped: false };
          }
        }
        continue;
      }
      if (token === '\n') { this.cursorRow++; this.cursorColumn = 0; this.row(); continue; }
      if (token === '\r') { this.cursorColumn = 0; continue; }
      for (const { segment } of this.graphemes.segment(token)) {
        const width = visibleWidth(segment);
        if (this.cursorColumn + width > this.columns) {
          this.row().wrapped = true; this.cursorRow++; this.cursorColumn = 0; this.wraps++;
        }
        const cells = this.row().cells;
        while (cells.length < this.cursorColumn) cells.push(' ');
        cells[this.cursorColumn] = segment;
        for (let offset = 1; offset < width; offset++) cells[this.cursorColumn + offset] = '';
        this.cursorColumn += width;
      }
    }
    this.frames.push(this.screen);
  }
  listen(key: (key: ScreenKey) => void, resize: () => void, options?: TerminalOptions): () => void {
    this.listening = true; this.key = key; this.resized = resize;
    if (options?.alternateScreen) this.write(ENTER_SCREEN);
    return () => {
      if (!this.listening) return;
      this.listening = false; this.key = () => {}; this.resized = () => {};
      this.write(options?.alternateScreen ? LEAVE_SCREEN : '\x1b[?25h');
    };
  }
  async delay(milliseconds: number, signal: AbortSignal): Promise<void> {
    this.delays.push(milliseconds); this.onDelay?.(this.delays.length - 1);
    signal.throwIfAborted();
  }
  async press(...keys: readonly ScreenKey[]): Promise<void> {
    for (const key of keys) { this.key(key); await new Promise<void>(resolve => setImmediate(resolve)); }
  }
  resize(columns: number, rows: number): void {
    if (this.normal) {
      const alternate = this.save();
      this.restore(this.normal); this.reflow(columns); this.normal = this.save();
      this.restore(alternate); this.physical = this.physical.slice(0, rows);
      for (const row of this.physical) { row.cells = row.cells.slice(0, columns); row.wrapped = false; }
      this.cursorRow = Math.min(this.cursorRow, rows - 1); this.cursorColumn = Math.min(this.cursorColumn, columns - 1);
    } else this.reflow(columns);
    this.columns = columns; this.rows = rows; this.resized();
  }
  private reflow(columns: number): void {
    // Reflow soft-wrapped rows together; hard newlines keep their boundaries.
    const reflowed: PhysicalRow[] = [];
    let cells: string[] = [], cursorOffset: number | undefined;
    const oldCursorRow = this.cursorRow;
    for (let index = 0; index < this.physical.length; index++) {
      const row = this.physical[index]!;
      if (index === oldCursorRow) cursorOffset = cells.length + this.cursorColumn;
      cells.push(...row.cells);
      if (row.wrapped) continue;
      const start = reflowed.length, count = Math.max(1, Math.ceil(cells.length / columns));
      for (let part = 0; part < count; part++) reflowed.push({
        cells: cells.slice(part * columns, (part + 1) * columns), wrapped: part < count - 1,
      });
      if (cursorOffset !== undefined) {
        this.cursorRow = start + Math.min(count - 1, Math.floor(cursorOffset / columns));
        this.cursorColumn = cursorOffset % columns; cursorOffset = undefined;
      }
      cells = [];
    }
    this.physical = reflowed;
  }
}

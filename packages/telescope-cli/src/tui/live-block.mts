import type { Terminal } from './terminal.mts';
import { clipLine, visibleWidth } from './style.mts';

/** One retained block; a scrolling block is printed only when its final state is known. */
export function liveBlock(terminal: Pick<Terminal, 'columns' | 'rows' | 'write'>) {
  let previous: readonly string[] = [], columns = terminal.columns, rows = terminal.rows;
  let tall = false, closed = false, inline = false;
  terminal.write('\x1b[?25l');
  return {
    draw(lines: readonly string[]) {
      if (closed) return;
      const resized = columns !== terminal.columns || rows !== terminal.rows;
      let text = '';
      if (previous.length) {
        // A narrower terminal can reflow old rows; shrinking height can scroll their start away.
        const physicalRows = previous.reduce((sum, line) => sum +
          Math.max(1, Math.ceil(visibleWidth(line) / Math.max(1, terminal.columns))), 0);
        const rewind = resized ? Math.min(physicalRows - (inline ? 1 : 0), Math.max(0, terminal.rows - 1)) : previous.length - (inline ? 1 : 0);
        text = rewind ? `\x1b[${rewind}F` : '\r';
      }
      if (resized) text += '\x1b[J';
      columns = terminal.columns; rows = terminal.rows;
      const singleRow = rows === 1 && lines.length === 1;
      if (lines.length >= rows && !singleRow) {
        tall = true;
        if (resized) { terminal.write(text); previous = []; }
        return;
      }
      tall = false;
      const clipped = lines.map(line => clipLine(line, columns));
      for (const line of clipped) text += `${line}\x1b[K${singleRow ? '' : '\n'}`;
      const extra = resized ? 0 : Math.max(0, previous.length - clipped.length);
      text += '\x1b[2K\n'.repeat(extra);
      if (extra) text += `\x1b[${extra}F`;
      terminal.write(text); previous = clipped; inline = singleRow;
    },
    done(lines?: readonly string[]) {
      if (closed) return;
      closed = true;
      if (tall && lines) terminal.write(lines.map(line => clipLine(line, terminal.columns)).join('\n') + '\n');
      terminal.write('\x1b[?25h');
    },
  };
}

import type { Terminal } from './terminal.mts';

/** One retained block; a scrolling block is printed only when its final state is known. */
export function liveBlock(terminal: Pick<Terminal, 'rows' | 'write'>) {
  let drawn = 0, tall = false, closed = false;
  terminal.write('\x1b[?25l');
  return {
    draw(lines: readonly string[]) {
      if (closed) return;
      if (lines.length >= terminal.rows) { if (!drawn) tall = true; return; }
      tall = false;
      let text = drawn ? `\x1b[${drawn}F` : '';
      for (const line of lines) text += `${line}\x1b[K\n`;
      const extra = Math.max(0, drawn - lines.length);
      text += '\x1b[2K\n'.repeat(extra);
      if (extra) text += `\x1b[${extra}F`;
      terminal.write(text); drawn = lines.length;
    },
    done(lines?: readonly string[]) {
      if (closed) return;
      closed = true;
      if (tall && lines) terminal.write(lines.join('\n') + '\n');
      terminal.write('\x1b[?25h');
    },
  };
}

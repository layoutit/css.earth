import { WORDMARK } from '../banner.mts';
import { VERSION } from '../version.mts';
import { GLOBE_FRAMES } from './globe-frames.mts';
import { bold, dim, visibleWidth } from './style.mts';
import { liveBlock } from './live-block.mts';
import type { Terminal } from './terminal.mts';

const pitch = ["Browse the world's telescope archives and get real",
  'astronomy data: images, spectra and cubes from', 'ALMA, ESO, Hubble, JWST, Keck, Chandra and more.'];
const commands = [
  ['explore TARGET', 'Find observations and pick one'],
  ['get RUN --pick N', 'Retrieve a saved pick'],
  ['outputs ARTIFACT.json', 'List what it can become'],
  ['export RESULT --output TYPE', 'Make an image, viewer or table'],
] as const;
export const HELP_FINE_PRINT = 'Details: telescope help COMMAND · --json for scripts and agents';
const text = [...WORDMARK.map(bold), dim(`telescope v${VERSION} · by layoutit`), '', ...pitch];
const textWidth = Math.max(...text.map(visibleWidth));
export const HEADER_WIDTH = textWidth + 5 + Math.max(...GLOBE_FRAMES.flat().map(visibleWidth));

export function header(frame: number, columns: number): string[] {
  if (columns < HEADER_WIDTH) return ['', ...text];
  const globe = GLOBE_FRAMES[((frame % GLOBE_FRAMES.length) + GLOBE_FRAMES.length) % GLOBE_FRAMES.length]!;
  const height = Math.max(globe.length, text.length);
  const globeTop = Math.floor((height - globe.length) / 2), textTop = Math.floor((height - text.length) / 2);
  return ['', ...Array.from({ length: height }, (_, index) => {
    const line = text[index - textTop] ?? '';
    return line + ' '.repeat(textWidth - visibleWidth(line) + 5) + (globe[index - globeTop] ?? '');
  })];
}
export function renderHelp(frame: number, columns: number): string[] {
  return [...header(frame, columns), '', ...commands.map(([command, description]) =>
    `  ${bold(`telescope ${command}`.padEnd(38))}${description}`), '',
  `  ${dim('also: papers · leads · stars · skill · toolchain')}`, '', dim(HELP_FINE_PRINT)];
}
export async function helpScreen(terminal: Terminal): Promise<number> {
  const block = liveBlock(terminal), controller = new AbortController();
  let frame = 0, exitCode = 0, close = () => {};
  const draw = () => block.draw(renderHelp(frame, terminal.columns));
  try {
    close = terminal.listen(key => {
      if (key.ctrl && key.name === 'c') { exitCode = 130; controller.abort(); }
      else if (key.name === 'escape') controller.abort();
    }, draw);
    if (renderHelp(0, terminal.columns).length >= terminal.rows || terminal.columns < HEADER_WIDTH) {
      draw(); return exitCode;
    }
    for (frame = 0; frame < GLOBE_FRAMES.length; frame++) {
      draw();
      await terminal.delay(50, controller.signal);
      if (renderHelp(frame, terminal.columns).length >= terminal.rows || terminal.columns < HEADER_WIDTH) break;
    }
    frame = 0; draw();
    return exitCode;
  } catch (error) {
    if (!controller.signal.aborted) throw error;
    return exitCode;
  } finally {
    block.done(renderHelp(0, terminal.columns)); close();
  }
}

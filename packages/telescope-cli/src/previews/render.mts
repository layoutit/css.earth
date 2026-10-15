import { glyphChartLine, glyphChartPlot, renderGlyphChart } from '@glyphcss/charts';
import type { ImagePreview, PreviewState, SpectrumPreview } from './types.mts';
import { NO_PREVIEW } from './types.mts';

export const PREVIEW_COLUMNS = 40, PREVIEW_ROWS = 12;
const AXIS_COLUMN = 5, PLOT_COLUMNS = 34, RAMP = ' .:-=+*#%@';
const superscripts: Readonly<Record<string, string>> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const clean = (text: string) => text.replace(/[\x00-\x1f\x7f-\x9f]/gu, '');
const fit = (text: string) => Array.from(clean(text)).slice(0, PREVIEW_COLUMNS).join('').padEnd(PREVIEW_COLUMNS);
const axisAt = (line: string) => line.search(/[│┤└├┼]/u);

export function renderSpectrum(preview: SpectrumPreview): string[] {
  if (preview.x.length < 2 || preview.x.length !== preview.y.length || !preview.x.every(Number.isFinite) || !preview.y.every(Number.isFinite))
    throw new Error('Cannot render an invalid preview spectrum.');
  const peak = preview.y.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  const exponent = peak && (peak < 0.01 || peak >= 1e5) ? Math.floor(Math.log10(peak)) : 0;
  const unit = exponent ? `×10${Array.from(String(exponent), digit => superscripts[digit]).join('')} ${preview.yunit}` : preview.yunit;
  const divisor = 10 ** exponent;
  const spec = glyphChartPlot({ marks: [glyphChartLine(preview.x.map((x, i) => ({ x, y: preview.y[i]! / divisor })), { x: 'x', y: 'y' })],
    axes: { x: { line: false, title: '' }, y: { ticks: 3, title: '' } } });
  const draw = (width: number) => renderGlyphChart(spec, { target: 'terminal', charset: 'braille', color: 'none', width, height: 11 }).text.split('\n');
  const gutter = Math.max(...draw(PREVIEW_COLUMNS).map(axisAt));
  const chart = draw(gutter + 1 + PLOT_COLUMNS), axis = Math.max(...chart.map(axisAt));
  return [...chart.map(line => fit(' '.repeat(Math.max(0, AXIS_COLUMN - (axisAt(line) < 0 ? axis : axisAt(line)))) + line)), fit(`y ${unit} · x ${preview.xunit}`)];
}

export function renderImage(preview: ImagePreview): string[] {
  const height = preview.grid.length, width = preview.grid[0]?.length ?? 0;
  if (!height || !width || preview.grid.some(row => row.length !== width || row.some(value => !Number.isFinite(value)))) throw new Error('Cannot render an invalid preview image.');
  const lines = Array.from({ length: 11 }, (_, y) => Array.from({ length: 30 }, (_, x) => {
    const value = preview.grid[Math.floor(y * height / 11)]![Math.floor(x * width / 30)]!;
    return RAMP[Math.max(0, Math.min(9, Math.floor(value * 10)))]!;
  }).join(''));
  const caption = clean(preview.caption);
  return [...lines.map(fit), fit(caption.padStart(Math.max(caption.length, Math.floor((30 + caption.length) / 2)))).padEnd(PREVIEW_COLUMNS)];
}

/** The panel title belongs to the screen; every body, including transient states, occupies this same frame. */
export function renderPreview(state: PreviewState): string[] {
  const lines = state.kind === 'spectrum' ? renderSpectrum(state) : state.kind === 'image' ? renderImage(state)
    : state.kind === 'none' ? ['', 'no preview', state.reason || NO_PREVIEW]
      : state.kind === 'loading' ? ['', 'loading preview…'] : ['', 'preview unavailable', state.reason ?? 'the archive preview could not be read'];
  return Array.from({ length: PREVIEW_ROWS }, (_, i) => fit(lines[i] ?? ''));
}

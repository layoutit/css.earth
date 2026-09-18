/**
 * The printed column labels of a survey comparison figure, read from its pixels.
 *
 * Every Appendix B figure of Vernazza et al. (2021) prints each column's frame time, `YYYY-MM-DDTHH:MM:SS`, as the
 * first line of text at the top of its photograph panel, in one font at one size, as nineteen separate glyphs. A glyph
 * is read as its nearest glyph among labels already read by eye and confirmed against frame headers, such as Iris's.
 * A reading is only trusted once it names a real frame: the setup tool refuses a label that is not the exposure start
 * of one of the body's own frames to the second.
 */
import type { Box, Raster } from '../surface-observations/published-comparison.mts';

export const LABEL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u;
/** A pixel is ink when its brightest channel exceeds this, on the figure's black panels. */
const INK = 128;
/** Columns left out at each side of a panel: a band's last column can carry the figure's frame line, and labels stay 13 pixels in. */
const MARGIN = 4;

export interface LabelLine { top: number; bottom: number; glyphs: { x0: number; x1: number }[] }
export interface GlyphTemplate { char: string; width: number; height: number; pixels: Float32Array }

const level = (figure: Raster, x: number, y: number) => {
  const at = (y * figure.width + x) * figure.channels;
  let value = 0;
  for (let channel = 0; channel < Math.min(3, figure.channels); channel++) value = Math.max(value, Number(figure.data[at + channel]));
  return value;
};

/** The first line of text below the top of a panel, and the column span of each glyph on it. */
export function labelLine(figure: Raster, cell: Box): LabelLine {
  let top = -1, bottom = -1;
  const x0 = cell.x0 + MARGIN, x1 = cell.x1 - MARGIN;
  for (let y = cell.y0; y < cell.y1 && bottom < 0; y++) {
    let ink = false;
    for (let x = x0; x < x1 && !ink; x++) ink = level(figure, x, y) > INK;
    if (ink && top < 0) top = y;
    else if (!ink && top >= 0) bottom = y;
  }
  if (top < 0 || bottom < 0) throw new TypeError(`The panel at (${cell.x0}, ${cell.y0}) prints no label line.`);
  const glyphs: { x0: number; x1: number }[] = [];
  let start = -1;
  for (let x = x0; x <= x1; x++) {
    let ink = false;
    if (x < x1) for (let y = top; y < bottom && !ink; y++) ink = level(figure, x, y) > INK;
    if (ink && start < 0) start = x;
    else if (!ink && start >= 0) { glyphs.push({ x0: start, x1: x }); start = -1; }
  }
  return { top, bottom, glyphs };
}

function patch(figure: Raster, line: LabelLine, glyph: { x0: number; x1: number }): GlyphTemplate {
  const width = glyph.x1 - glyph.x0, height = line.bottom - line.top, pixels = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels[y * width + x] = level(figure, glyph.x0 + x, line.top + y) / 255;
  return { char: '', width, height, pixels };
}

/** Mean squared difference of two glyphs on a shared canvas, at the best of three horizontal and three vertical offsets. */
function difference(a: GlyphTemplate, b: GlyphTemplate) {
  const width = Math.max(a.width, b.width) + 2, height = Math.max(a.height, b.height) + 2;
  let best = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    let sum = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const ax = x - 1, ay = y - 1, bx = x - 1 - dx, by = y - 1 - dy;
      const va = ax >= 0 && ay >= 0 && ax < a.width && ay < a.height ? a.pixels[ay * a.width + ax] : 0;
      const vb = bx >= 0 && by >= 0 && bx < b.width && by < b.height ? b.pixels[by * b.width + bx] : 0;
      sum += (va - vb) ** 2;
    }
    best = Math.min(best, sum / (width * height));
  }
  return best;
}

/** Glyphs of labels already known, one template per printed character. */
export function glyphTemplates(figure: Raster, cells: readonly Box[], labels: readonly string[]): GlyphTemplate[] {
  if (cells.length !== labels.length) throw new TypeError('Each known label needs its panel.');
  return cells.flatMap((cell, index) => {
    const label = labels[index], line = labelLine(figure, cell);
    if (!LABEL_PATTERN.test(label)) throw new TypeError(`A known label reads ${label}, not a frame time.`);
    if (line.glyphs.length !== label.length) throw new TypeError(`The panel for known label ${label} prints ${line.glyphs.length} glyphs.`);
    return line.glyphs.map((glyph, position) => ({ ...patch(figure, line, glyph), char: label[position] }));
  });
}

/** One panel's label, each glyph read as its nearest template; the separators must fall where a frame time puts them. */
export function readLabel(figure: Raster, cell: Box, templates: readonly GlyphTemplate[]): string {
  const line = labelLine(figure, cell);
  if (line.glyphs.length !== 19) throw new TypeError(`The label at (${cell.x0}, ${cell.y0}) prints ${line.glyphs.length} glyphs, not the 19 of a frame time.`);
  const text = line.glyphs.map(glyph => {
    const read = patch(figure, line, glyph);
    let best = templates[0], score = Infinity;
    for (const template of templates) { const d = difference(read, template); if (d < score) { score = d; best = template; } }
    return best.char;
  }).join('');
  if (!LABEL_PATTERN.test(text)) throw new TypeError(`The label at (${cell.x0}, ${cell.y0}) reads ${text}, not a frame time.`);
  return text;
}

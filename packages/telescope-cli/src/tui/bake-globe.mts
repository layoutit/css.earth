/** Maintainer tool: CSSEARTH_WORKSPACE=/path/to/checkout node packages/telescope-cli/src/tui/bake-globe.mts
 * Reads the workspace's July Blue Marble and bakes 60 glyphcss frames; the command ships plain text only.
 */
import { compilePolygons } from '@glyphcss/compile';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WORKSPACE } from '@cssearth/telescope-core/node';

if (!WORKSPACE) throw new Error('Baking the globe requires a workspace containing Blue Marble.');
const width = 256, height = 128, longitudeSteps = 144, latitudeSteps = 72, count = 60;
const rgb = await sharp(resolve(WORKSPACE, 'src/objects/earth/source/blue-marble-july.jpg'))
  .resize(width, height, { fit: 'fill' }).removeAlpha().raw().toBuffer();
function isLand(longitude: number, latitude: number): boolean {
  const u = ((longitude / 360 + 0.5) % 1 + 1) % 1, v = 0.5 - latitude / 180;
  const index = (Math.min(height - 1, Math.floor(v * height)) * width + Math.floor(u * width)) * 3;
  const r = rgb[index]!, g = rgb[index + 1]!, b = rgb[index + 2]!;
  return r + g > b * 2.2 || r + g + b > 360;
}
function polygons(spin: number): Parameters<typeof compilePolygons>[0] {
  const point = (longitude: number, latitude: number): [number, number, number] => {
    const angle = (longitude + spin) * Math.PI / 180, tilt = latitude * Math.PI / 180;
    return [-Math.sin(tilt), Math.cos(tilt) * Math.sin(angle), Math.cos(tilt) * Math.cos(angle)];
  };
  const faces: Parameters<typeof compilePolygons>[0][number][] = [];
  for (let lat = 0; lat < latitudeSteps; lat++) for (let lon = 0; lon < longitudeSteps; lon++) {
    const lon0 = -180 + lon * 360 / longitudeSteps, lon1 = lon0 + 360 / longitudeSteps;
    const lat0 = -90 + lat * 180 / latitudeSteps, lat1 = lat0 + 180 / latitudeSteps;
    faces.push({ vertices: [point(lon0, lat0), point(lon1, lat0), point(lon1, lat1), point(lon0, lat1)],
      color: isLand((lon0 + lon1) / 2, (lat0 + lat1) / 2) ? '#ffffff' : '#304080' });
  }
  return faces;
}
const projected: string[][] = [];
for (let frame = 0; frame < count; frame++) {
  const { grid } = compilePolygons(polygons(-frame * 360 / count), {
    rotX: 0, rotY: 0, projection: 'orthographic', useColors: true,
    // The approved frames use bake-frames.mjs's column argument 24 (its default is 30).
    autoFit: { target: 24, by: 'cols' }, meshResolution: 'lossless',
  });
  if (!grid) throw new Error(`glyphcss returned no grid for frame ${frame}.`);
  const lines: string[] = [];
  for (let row = 0; row < grid.rows; row++) {
    let line = '';
    for (let column = 0; column < grid.cols; column++) {
      const index = row * grid.cols + column, glyph = grid.char[index], color = grid.color[index] ?? '';
      const valid = /^#[0-9a-f]{6}$/iu.test(color);
      const red = valid ? parseInt(color.slice(1, 3), 16) : 0, blue = valid ? parseInt(color.slice(5, 7), 16) : 1;
      line += !glyph || glyph === ' ' ? ' ' : blue > red * 1.4 ? '.' : '#';
    }
    lines.push(line.trimEnd());
  }
  projected.push(lines);
}
const outline = [[5, 12], [3, 16], [1, 20], [0, 22], [0, 22], [0, 22], [0, 22], [1, 20], [3, 16], [5, 12]] as const;
const rows = Math.max(...projected.map(frame => frame.length)), columns = Math.max(...projected.flat().map(line => line.length));
let top = rows, bottom = -1, left = columns, right = -1;
for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
  if (projected.some(frame => (frame[row]?.[column] ?? ' ') !== ' ')) {
    top = Math.min(top, row); bottom = Math.max(bottom, row); left = Math.min(left, column); right = Math.max(right, column);
  }
}
const rowScale = (bottom - top + 1) / outline.length;
const columnScale = (right - left + 1) / Math.max(...outline.map(([indent, size]) => indent + size));
const frames = projected.map(frame => outline.map(([indent, size], row) => {
  let line = ' '.repeat(indent);
  for (let column = indent; column < indent + size; column++) {
    const glyph = frame[top + Math.floor((row + 0.5) * rowScale)]?.[left + Math.floor((column + 0.5) * columnScale)];
    line += glyph === '#' ? '#' : '.';
  }
  return line;
}));
await writeFile(new URL('./globe-frames.mts', import.meta.url),
  '// Baked with glyphcss 0.3.0 from July Blue Marble; plain text, no runtime dependency.\n' +
  '// Regenerate with bake-globe.mts.\nexport const GLOBE_FRAMES: readonly (readonly string[])[] = [\n' +
  frames.map(frame => `  ${JSON.stringify(frame)},`).join('\n') + '\n];\n');
console.log(`Baked ${frames.length} frames, ${outline.length} rows each.`);

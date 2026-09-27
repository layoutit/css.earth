/** Snapshot a WWT WTML FITS collection with WWT's own parser for runtime-free lookup. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { basename } from 'node:path';

const parser = String.raw`
import importlib.metadata, json, sys
from wwt_data_formats.folder import Folder
version = importlib.metadata.version('wwt-data-formats')
if version != '0.18.1': raise RuntimeError('wwt-data-formats 0.18.1 is required, found ' + version)
folder = Folder.from_file(sys.argv[1])
rows = []
for _, _, subfolder in folder.walk(download=False):
  if not isinstance(subfolder, Folder): continue
  for _, _, image in subfolder.immediate_imagesets():
    if image.file_type.lower() not in ('.fits', '.fit'): continue
    rows.append({
        'name': image.name, 'urlTemplate': image.url, 'fileType': image.file_type,
        'dataSetType': image.data_set_type.value, 'projection': image.projection.value,
        'bandPass': image.band_pass.value, 'credits': image.credits,
        'creditsUrl': image.credits_url,
        'position': {
            'centerXDegrees': image.center_x, 'centerYDegrees': image.center_y,
            'offsetX': image.offset_x, 'offsetY': image.offset_y,
            'rotationDegrees': image.rotation_deg, 'baseDegreesPerTile': image.base_degrees_per_tile,
            'tileLevels': image.tile_levels, 'bottomsUp': image.bottoms_up,
        },
    })
json.dump(rows, sys.stdout, ensure_ascii=False, separators=(',', ':'))
`;

const [inputArgument, sourceUrl, outputArgument] = process.argv.slice(2);
if (!inputArgument || !sourceUrl || !outputArgument || process.argv.length !== 5 || new URL(sourceUrl).protocol !== 'https:')
  throw new TypeError('Usage: wwt-fits-catalog-build.mts INPUT.wtml HTTPS_SOURCE_URL OUTPUT.json');
const input = resolve(inputArgument), output = resolve(outputArgument);
const sourceBytes = await readFile(input);
const result = spawnSync(process.env.CSSEARTH_WWT_PYTHON ?? 'python3', ['-c', parser, input],
  { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
if (result.status !== 0) throw new Error(`WWT FITS catalog parse failed: ${result.error?.message ?? result.stderr}`);
const imagesets: unknown = JSON.parse(result.stdout);
if (!Array.isArray(imagesets) || !imagesets.length || imagesets.some(row => !row || typeof row !== 'object' ||
  typeof (row as Record<string, unknown>).name !== 'string' || typeof (row as Record<string, unknown>).urlTemplate !== 'string'))
  throw new TypeError('WWT parser found no FITS imagesets.');
const snapshot = { schema: 'cssearth-wwt-fits-catalog@1', source: { url: sourceUrl, file: basename(input),
  sha256: createHash('sha256').update(sourceBytes).digest('hex'), parser: 'wwt-data-formats@0.18.1' }, imagesets };
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
process.stdout.write(`${imagesets.length} WWT FITS imagesets -> ${output}\n`);

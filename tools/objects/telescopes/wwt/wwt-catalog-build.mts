/** Prepare a pinned WWT core-imageset index with WWT's own WTML reader.
 * Usage: CSSEARTH_WWT_PYTHON=python-with-wwt-data-formats node tools/objects/telescopes/wwt/wwt-catalog-build.mts IMAGESETS_DIR REVISION OUTPUT.jsonl
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REVISION = /^[a-f0-9]{40}$/u;
const parser = String.raw`
import importlib.metadata, json, pathlib, sys
from wwt_data_formats.folder import Folder
version = importlib.metadata.version('wwt-data-formats')
if version != '0.18.1':
    raise RuntimeError('wwt-data-formats 0.18.1 is required, found ' + version)
root = pathlib.Path(sys.argv[1])
rows = []
for path in sorted(root.glob('*.xml')):
    folder = Folder.from_file(str(path))
    for _, _, image in folder.immediate_imagesets():
        rows.append({
            'sourceFile': path.name,
            'name': image.name,
            'urlTemplate': image.url,
            'dataSetType': image.data_set_type.value,
            'referenceFrame': image.reference_frame,
            'bandPass': image.band_pass.value,
            'projection': image.projection.value,
            'position': {
                'centerXDegrees': image.center_x,
                'centerYDegrees': image.center_y,
                'offsetX': image.offset_x,
                'offsetY': image.offset_y,
                'rotationDegrees': image.rotation_deg,
                'baseDegreesPerTile': image.base_degrees_per_tile,
                'tileLevels': image.tile_levels,
                'bottomsUp': image.bottoms_up,
            },
            'credits': image.credits,
            'creditsUrl': image.credits_url,
            'thumbnailUrl': image.thumbnail_url,
        })
json.dump(rows, sys.stdout, ensure_ascii=False, separators=(',', ':'))
`;

const [sourceArgument, revision, outputArgument] = process.argv.slice(2);
if (!sourceArgument || !revision || !REVISION.test(revision) || !outputArgument)
  throw new TypeError('Usage: wwt-catalog-build.mts IMAGESETS_DIR 40_CHARACTER_REVISION OUTPUT.jsonl');
const source = resolve(sourceArgument), output = resolve(outputArgument);
const paths = (await readdir(source)).filter(name => name.endsWith('.xml')).sort();
if (!paths.length) throw new Error(`No WWT imageset XML files in ${source}.`);
const inputs = await Promise.all(paths.map(async path => ({ path: `imagesets/${path}`, sha256: createHash('sha256').update(await readFile(resolve(source, path))).digest('hex') })));
const result = spawnSync(process.env.CSSEARTH_WWT_PYTHON ?? 'python3', ['-c', parser, source], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
if (result.status !== 0) throw new Error(`WWT catalog parse failed: ${result.error?.message ?? result.stderr}`);
const imagesets: unknown = JSON.parse(result.stdout);
if (!Array.isArray(imagesets) || imagesets.length < paths.length || imagesets.some(row => !row || typeof row !== 'object' ||
    ['sourceFile', 'name', 'urlTemplate', 'dataSetType', 'referenceFrame', 'bandPass', 'projection', 'credits', 'creditsUrl', 'thumbnailUrl']
      .some(key => typeof (row as Record<string, unknown>)[key] !== 'string') ||
    !row.position || typeof row.position !== 'object'))
  throw new TypeError('WWT parser returned malformed imageset records.');
const header = {
  schema: 'cssearth-wwt-core-imagesets@1',
  source: { repository: 'WorldWideTelescope/wwt-core-catalogs', revision, license: 'MIT', parser: 'wwt-data-formats@0.18.1', inputs },
};
await writeFile(output, `${JSON.stringify(header)}\n${imagesets.map(row => JSON.stringify(row)).join('\n')}\n`);
process.stdout.write(`${imagesets.length} WWT imagesets from ${inputs.length} pinned XML files -> ${output}\n`);

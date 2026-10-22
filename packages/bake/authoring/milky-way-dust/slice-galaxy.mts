// Entry: node packages/bake/authoring/milky-way-dust/slice-galaxy.mts <object-directory> --reuse=<slabs-directory>
// Re-bake: CSSEARTH_TORCH_PYTHON=<Python with numpy/Pillow> node <this command> <object-directory> --field=<composed brick> --fit=<fit-crisp.json>
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { DENSITY_VOLUME_FORMAT, PREPARED_OBJECT_SCHEMA, parseDensityVolumeObjectDescriptor,
  parsePreparedDensityVolumeText, parsePreparedGalaxyStations, validatePreparedCssVolume } from '@cssearth/objects';
import { inventoryPreparedSubset } from '@cssearth/objects/node';
import { compileGalaxySliceVolume } from './galaxy-slice-compile.mts';
import { GALAXY_SLICES } from './galaxy-slice-source.mts';
import { galaxySlices, record } from './galaxy-slices.mts';
import { runGalaxyPython } from './galaxy-python.mts';
import { mergeOpticalCopies } from './galaxy-merged-copies.mts';
import { GALAXY_OUTSIDE_DISPLAY_SCALE } from './galaxy-outside-display.mts';

export function parseGalaxySliceControls(values: Readonly<Record<string, string | boolean | undefined>>) {
  if (values.mode !== undefined && values.mode !== 'outside-display') throw new TypeError('Only outside-display mode is supported.');
  const mode = 'outside-display', counts = typeof values.counts === 'string' ? values.counts.split(',').map(Number) : [26,26,26];
  if (counts.length !== 3 || counts.some(n => !Number.isInteger(n) || n <= 0) || counts.reduce((a,b)=>a+b,0)*3+16 > 500) throw new TypeError('Counts must fit 500 pieces.');
  for (const key of ['one-sided-pilot','two-layer-z','calibration-job','z-placement','defer-display-gain','display-scale','dust-alpha']) {
    if (values[key] !== undefined) throw new TypeError('Unsupported experimental option: ' + key);
  }
  return {mode,counts,axes:[0,1,2],displayScale:GALAXY_OUTSIDE_DISPLAY_SCALE,dustAlpha:1,
    ...(typeof values['in-plane-field'] === 'string' ? {inPlaneField:resolve(values['in-plane-field'])} : {})};
}

export async function main(args: readonly string[]): Promise<void> {
  const { positionals, values } = parseArgs({ args: [...args], allowPositionals: true, options: {
    'local-only': { type: 'boolean' }, mode: { type: 'string' }, counts: { type: 'string' },
    reuse: {type:'string'}, field:{type:'string'}, fit:{type:'string'}, frame:{type:'string'},
    'in-plane-field':{type:'string'}, 'merged-copies':{type:'boolean'},
  } });
  if (positionals.length !== 1 || (values.reuse ? values.field || values.fit : !values.field || !values.fit)) {
    throw new TypeError('Usage: slice-galaxy.mts <object-directory> --reuse=<slabs-directory> OR --field=<composed brick> --fit=<fit-crisp.json> [--frame=<physical-frame.json>]');
  }
  if (values['merged-copies'] && values.reuse) throw new TypeError('--merged-copies merges a fresh bake; a reused bank keeps its images.');
  const parsedControls = parseGalaxySliceControls({ ...values, 'merged-copies': undefined });
  const controls = parsedControls;
  const objectDirectory = resolve(positionals[0]!), prepared = resolve(objectDirectory, 'prepared');
  const descriptorValue = record(JSON.parse(readFileSync(resolve(objectDirectory, 'object.json'), 'utf8')));
  const descriptor = parseDensityVolumeObjectDescriptor(descriptorValue);
  if (descriptor.id !== 'milky-way-volume') throw new TypeError('This command prepares the Milky Way background volume.');
  const previous = parsePreparedDensityVolumeText(readFileSync(resolve(prepared, 'volume.json'), 'utf8'), descriptor);
  const destination = resolve(prepared, 'b30-slices');
  mkdirSync(destination, { recursive: true });
  // A new bake must produce its own files; a successful no-op cannot reuse an older prototype as fresh output.
  mkdirSync(resolve(objectDirectory,'.local'),{recursive:true});
  const staged = values.reuse ? null : mkdtempSync(resolve(objectDirectory,'.local/b30-slices-bake-'));
  try {
    if (staged) {
      const field = resolve(values.field!), fit = resolve(values.fit!);
      runGalaxyPython('galaxy_slices.py', [field, staged, fit, JSON.stringify(controls)], {}, { 'galaxy_slices.py': GALAXY_SLICES });
      if (values['merged-copies']) {
        console.log('MERGED OPTICAL COPIES', await mergeOpticalCopies(staged), 'slices');
        // The bank records its encoding, so a later --reuse of it keeps declaring the copies merged.
        const baked = record(JSON.parse(readFileSync(resolve(staged, 'prototype.json'), 'utf8')));
        writeFileSync(resolve(staged, 'prototype.json'), JSON.stringify({ ...baked, mergedOpticalCopies: 3 }));
      }
    }
    const source = values.reuse ? resolve(values.reuse) : staged!;
    const prototypeText = readFileSync(resolve(source, 'prototype.json'), 'utf8');
    const prototype = record(JSON.parse(prototypeText));
    if (Array.isArray(prototype.directionalSets) && prototype.directionalSets.length) throw new TypeError('Directional pilot has not passed native color and memory qualification; installation is refused.');
    if (parsedControls.mode === 'outside-display') {
      const baked = record(prototype.bakeControls);
      if (baked.mode !== 'outside-display' || baked.displayScale !== GALAXY_OUTSIDE_DISPLAY_SCALE || prototype.completedImageOpacity !== 1 || prototype.slabLocalTransfer !== true) {
        throw new TypeError('Outside installation requires the fixed face-exposed bank without NASA attenuation, with slab-local transfer.');
      }
    }
    const framePath = resolve(values.frame ?? resolve(objectDirectory, 'source/preparation/b30/physical-frame.json'));
    const frameInput = record(JSON.parse(readFileSync(framePath, 'utf8'))).frame;
    const { frame, slices, completedImageOpacity } = galaxySlices(prototype, frameInput, source);
    const properties = record(descriptorValue.properties), stationBinding = properties.galaxyStations;
    let stationIndexPath: string | undefined, stationIndexText: string | undefined;
    if (typeof stationBinding === 'string') {
      stationIndexPath = resolve(prepared, stationBinding);
      if (!stationIndexPath.startsWith(prepared + '/')) throw new TypeError('Station index must stay in the object prepared directory.');
      const stationIndex = record(JSON.parse(readFileSync(stationIndexPath, 'utf8')));
      const nextStationIndex = { ...stationIndex, farImageOpacity: completedImageOpacity };
      const parsedIndex = parsePreparedGalaxyStations(nextStationIndex);
      if (parsedIndex.farImageOpacity !== completedImageOpacity) throw new TypeError('Objects build must support the completed far image opacity before installation.');
      if (stationIndex.farImageOpacity !== completedImageOpacity) stationIndexText = JSON.stringify(nextStationIndex) + '\n';
    } else if (completedImageOpacity !== 1) throw new TypeError('Deferred gain needs the prepared station index binding.');
    if (prototype.mergedOpticalCopies !== undefined && prototype.mergedOpticalCopies !== 3) throw new TypeError('A merged bank holds exactly three optical copies.');
    const compiled = { ...compileGalaxySliceVolume(prototype, frameInput, source, descriptor.id), ...(prototype.mergedOpticalCopies === 3 ? { mergedOpticalCopies: 3 as const } : {}) };
    // Sky and catalogue files keep their existing, independent reference-frame binding.
    const skyPaths = new Set(previous.sky?.faces.map(face => face.texturePath) ?? []);
    const volume = validatePreparedCssVolume({ ...compiled, ...(previous.sky ? { sky: previous.sky } : {}),
      resources: [...compiled.resources, ...previous.resources.filter(resource => skyPaths.has(resource.path))] });
    for (const quad of slices.quads) {
      if (source === destination) continue;
      const relative = quad.texturePath.slice('b30-slices/'.length);
      mkdirSync(resolve(destination, relative.split('/')[0]!), { recursive: true });
      copyFileSync(resolve(source, relative), resolve(prepared, quad.texturePath));
    }
    // A smaller accepted bank must retire unreferenced runtime textures from its previous bank.
    const wanted = new Set(slices.quads.map(quad => quad.texturePath));
    for (const axis of ['x', 'y', 'z']) for (const filename of readdirSync(resolve(destination, axis))) {
      if (/^\d{3}\.png$/u.test(filename) && !wanted.has(`b30-slices/${axis}/${filename}`)) unlinkSync(resolve(destination, axis, filename));
    }
    writeFileSync(resolve(destination, 'prototype.json'), prototypeText);
    writeFileSync(resolve(destination, 'frame-input.json'), JSON.stringify(frameInput) + '\n');
    if (staged) {
      copyFileSync(resolve(values.field!, 'meta.json'), resolve(destination, 'field-input.json'));
      copyFileSync(resolve(values.fit!), resolve(destination, 'fit-input.json'));
    }
    const envelope = { schema: PREPARED_OBJECT_SCHEMA, id: volume.id, type: 'density-volume', format: DENSITY_VOLUME_FORMAT, data: volume };
    const nextDescriptor = { ...descriptorValue, properties: { ...properties, volume: frame } };
    const volumeText = JSON.stringify(envelope) + '\n';
    parsePreparedDensityVolumeText(volumeText, parseDensityVolumeObjectDescriptor(nextDescriptor));
    writeFileSync(resolve(prepared, 'volume.json'), volumeText);
    if (stationIndexPath && stationIndexText) writeFileSync(stationIndexPath, stationIndexText);
    writeFileSync(resolve(objectDirectory, 'object.json'), JSON.stringify(nextDescriptor, null, 2) + '\n');
    if (!values['local-only']) await inventoryPreparedSubset({ objectId: descriptor.id, objectDirectory,
      owns: filename => filename === 'volume.json' || filename === stationBinding || /^b30-slices\/[xyz]\/\d{3}\.png$/u.test(filename) });
    console.log('MILKY WAY LAYERS INSTALLED', volume.stacks.map(stack => [stack.axis, stack.leaves.length]),
      compiled.resources.reduce((sum, resource) => sum + resource.bytes, 0), 'texture bytes; local only, not published.');
  } finally { if (staged) rmSync(staged, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(process.argv.slice(2));

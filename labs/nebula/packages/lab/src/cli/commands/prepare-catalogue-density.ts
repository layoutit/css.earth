/** Bake an observed tracer catalogue in an existing physical frame, with no morphology fit. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDensityVolumeObjectDescriptor } from '@cssearth/objects';
import { cataloguePosition, METERS_PER_KPC } from '@cssearth/volume-core/coordinates/catalogue-position';
import type { Vector3, VolumeRecipe } from '@cssearth/volume-core/contracts/volume-recipe';
import { planFullDensityGrid } from '@cssearth/nebula-reconstruction/stars/full-density';
import { sha256, sourceBytes } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { prepareVolumeSlices } from '@cssearth/volume-bake/slices/density';
import { convertParticlesToDensityVolume } from '../../server/workflows/stars/particles.ts';
import { compileCssVolume } from '../../adapters/preparation/css-volume.ts';
type Pin = {
    path: string;
    sha256: string;
};
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError('Expected recipe object.');
    return value as Record<string, unknown>;
}
function pin(value: unknown): Pin {
    const p = object(value);
    if (typeof p.path !== 'string' || typeof p.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(p.sha256))
        throw new TypeError('Expected pinned file.');
    return { path: p.path, sha256: p.sha256 };
}
const json = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
export async function prepareCatalogueDensity(configPath: string) {
    const root = process.cwd(), configBytes = await readFile(configPath);
    const config = object(JSON.parse(configBytes.toString('utf8')) as unknown);
    if (!['cssearth-catalogue-density@1', 'cssearth-tracer-density@1'].includes(String(config.schema)) || typeof config.id !== 'string' ||
        !/^[a-z0-9-]+$/.test(config.id) || typeof config.outputDirectory !== 'string' ||
        !config.outputDirectory.startsWith('.local/nebula-lab/'))
        throw new TypeError('Invalid catalogue density recipe.');
    const output = resolve(root, config.outputDirectory);
    if (!relative(resolve(root, '.local/nebula-lab'), output) || relative(resolve(root, '.local/nebula-lab'), output).startsWith('..'))
        throw new TypeError('Output must be a child of the local lab cache.');
    if ((config.catalogue === undefined) === (config.particles === undefined)) throw new TypeError('Specify one catalogue or local particle source.');
    const particleMode = config.particles !== undefined;
    const catalogue = pin(particleMode ? config.particles : config.catalogue), receipt = pin(config.receipt), framePin = pin(config.frameObject);
    const [tableBytes, receiptBytes, frameBytes] = await Promise.all([
        sourceBytes(root, catalogue), sourceBytes(root, receipt), sourceBytes(root, framePin)
    ]);
    const descriptor = parseDensityVolumeObjectDescriptor(JSON.parse(frameBytes.toString('utf8')) as unknown);
    if (Math.abs(descriptor.volume.metersPerUnit / METERS_PER_KPC - 1) > 1e-12)
        throw new TypeError('Catalogue density grid units must be kpc.');
    const lines = particleMode ? [] : tableBytes.toString('utf8').trim().split(/\r?\n/), header = particleMode ? [] : lines.shift()!.split('\t');
    const columns = ['raDeg', 'decDeg', 'distanceKpc'].map(key => header.indexOf(key));
    if (!particleMode && (columns.some(index => index < 0) || !lines.length))
        throw new TypeError('Catalogue requires raDeg, decDeg, distanceKpc TSV columns.');
    if (particleMode && (!tableBytes.length || tableBytes.length % 16)) throw new TypeError('Expected float32 LE local XYZ-weight records.');
    const count = particleMode ? tableBytes.length / 16 : lines.length;
    const points = particleMode ? Buffer.from(tableBytes) : Buffer.alloc(count * 16), min: Vector3 = [Infinity, Infinity, Infinity], max: Vector3 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < lines.length; i++) {
        const cells = lines[i]!.split('\t');
        if (cells.length !== header.length || columns.some(c => !cells[c]?.trim()))
            throw new TypeError(`Invalid catalogue row ${i + 2}.`);
        const p = cataloguePosition(Number(cells[columns[0]!]!), Number(cells[columns[1]!]!), Number(cells[columns[2]!]!), descriptor.volume);
        for (let axis = 0; axis < 3; axis++) {
            points.writeFloatLE(p[axis]!, i * 16 + axis * 4);
            const value = points.readFloatLE(i * 16 + axis * 4);
            min[axis] = Math.min(min[axis]!, value);
            max[axis] = Math.max(max[axis]!, value);
        }
        points.writeFloatLE(1, i * 16 + 12); // Number counts, never stellar mass or luminosity.
    }
    if (particleMode) for (let i = 0; i < count; i++) {
        const weight = points.readFloatLE(i*16+12);
        if (!Number.isFinite(weight) || weight < 0) throw new TypeError('Invalid tracer weight.');
        for(let axis=0;axis<3;axis++){const v=points.readFloatLE(i*16+axis*4);if(!Number.isFinite(v))throw new TypeError('Invalid tracer position.');min[axis]=Math.min(min[axis]!,v);max[axis]=Math.max(max[axis]!,v);}
    }
    if (particleMode && (typeof config.interpretation !== 'string' || !Array.isArray(config.limitations) || !config.limitations.every(v => typeof v === 'string'))) throw new TypeError('Model particles require explicit interpretation and limitations.');
    const gridSettings = { maximumVoxels: 2000000, maximumAxisCells: 512, smoothingSigmaVoxels: 1.2, boundaryPaddingSigma: 4 };
    const plan = planFullDensityGrid({ min, max }, gridSettings), sourceDirectory = resolve(output, 'source'), prepared = resolve(output, 'prepared');
    await mkdir(sourceDirectory, { recursive: true });
    await mkdir(prepared, { recursive: true });
    const particlePath = resolve(sourceDirectory, 'catalogue.f32');
    await writeFile(particlePath, points);
    console.log(`CATALOGUE_DENSITY_GRID ${count} tracers; ${plan.dimensions.join('x')}`);
    const converted = await convertParticlesToDensityVolume({ particlePath, outputDirectory: sourceDirectory,
        dimensions: plan.dimensions, boundsKpc: plan.boundsKpc, smoothingSigmaVoxels: gridSettings.smoothingSigmaVoxels,
        normalizationQuantile: .999, encoding: 'sqrt-density-unorm8', fallbackColor: [0, 0, 0] });
    await json(resolve(sourceDirectory, 'particles-receipt.json'), { ...converted, interpretation: {
            ...converted.interpretation, density: particleMode ? 'Weighted model tracer deposition; weights are authored relative support, not measured gas or dust.' : 'Unit-weighted CIC deposition of observed tracer counts; mass fields in this generic deposition receipt mean counts, not physical stellar mass.'
        } });
    if (converted.particles.accepted !== count)
        throw new Error('Catalogue density lost tracers outside its grid.');
    const provenance = { schema: 'cssearth-catalogue-density-provenance@1', recipe: { path: relative(root, resolve(configPath)), sha256: sha256(configBytes) },
        catalogue, receipt, frame: framePin, inputReceipt: JSON.parse(receiptBytes.toString('utf8')) as unknown,
        count, grid: plan, gridSettings,
        interpretation: particleMode ? config.interpretation : 'Smoothed observed tracer number counts in photometric-distance space; not gas, dust, mass density or independently measured stellar depths.',
        limitations: particleMode ? config.limitations : ['Photometric scatter, population variation and extinction uncertainties broaden inferred line-of-sight structure.',
            'Survey footprint and selection affect number counts; missing observations do not imply empty space.',
            'No image-to-model scaling, rotation or translation is fitted. No photographic material has been applied.'] };
    const provenanceBytes = Buffer.from(JSON.stringify(provenance, null, 2) + '\n');
    await writeFile(resolve(sourceDirectory, 'provenance.json'), provenanceBytes);
    const recipe: VolumeRecipe = { schema: 'cssearth-volume-recipe@1', grid: { path: 'density.ktx2', sha256: converted.outputs.gridSha256,
            decodedSha256: converted.outputs.decodedSha256, dimensions: plan.dimensions, encoding: 'sqrt-density-unorm8', bounds: plan.boundsKpc },
        material: { emission: [{ channel: 3, color: [1, 1, 1], strength: 1 }], absorption: [], intensityScale: 1, stepScale: 1,
            stepMetric: 'source', exposureGain: .08, emissionTransfer: 'shared-opacity' },
        bake: { sliceCounts: { x: 48, y: 48, z: 48 }, unitsPerSourceUnit: 1, imageWidth: 512, samplesPerSlab: 2, cropTransparent: true,
            opticalWeight: 1, imageEncoding: { format: 'webp', quality: 90 } }, anchors: [],
        provenance: { path: 'provenance.json', sha256: sha256(provenanceBytes) } };
    const recipeBytes = Buffer.from(JSON.stringify(recipe, null, 2) + '\n');
    await writeFile(resolve(sourceDirectory, 'volume.json'), recipeBytes);
    const slices = await prepareVolumeSlices({ sourceDirectory, outputDirectory: prepared, recipe });
    const frame = { ...descriptor.volume, boundsUnits: plan.boundsKpc };
    const data = compileCssVolume({ id: config.id, frame, slices, recipe });
    const envelope = { schema: 'cssearth-prepared-object@1', id: config.id, type: 'density-volume', format: 'cssearth-density-volume@1', data };
    const preparedBytes = Buffer.from(JSON.stringify(envelope) + '\n');
    await writeFile(resolve(prepared, 'volume.json'), preparedBytes);
    await json(resolve(output, 'object.json'), { schema: 'cssearth-object@1', id: config.id, type: 'density-volume',
        properties: { volume: frame, preparation: { source: 'source/volume.json', sha256: sha256(recipeBytes) } },
        prepared: { format: envelope.format, url: 'prepared/volume.json', sha256: sha256(preparedBytes) } });
    await json(resolve(output, 'receipt.json'), { ...provenance, prepared: { sha256: sha256(preparedBytes), leaves: data.resources.length,
            bytes: data.resources.reduce((sum, r) => sum + r.bytes, 0) } });
    console.log(`CATALOGUE_DENSITY_READY ${config.id}: ${count} tracers, ${data.resources.length} leaves`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const [path, ...extra] = process.argv.slice(2);
    if (!path || extra.length)
        throw new TypeError('Usage: prepare-catalogue-density <recipe.json>');
    await prepareCatalogueDensity(path);
}

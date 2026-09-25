import {sampleJointDepth as sampleDepth} from '@cssearth/nebula-reconstruction/stars/joint-depth';
import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Offline preparation of the published Bonanos et al. (2009) massive LMC star sample. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { prepareStarPhotometry, STAR_PHOTOMETRY, rayToOverlayPlane, type ImageWcs } from '@cssearth/bake/volume';
import { catalogueColor } from '../../adapters/sources/stellar-color.ts';
import { createObservationMapping, type ObservationMapping } from '../../adapters/preparation/observation-prior.ts';
import { sampleEncoded, channelDensity } from '@cssearth/bake/volume/node';
import { loadStarCloudModel, type StarCloudModel } from '../../server/workflows/stars/lmc-star-cloud-model.ts';
import type { PreparedLmcStar, PreparedLmcStars } from '../../adapters/viewer/catalogue-stars';

const directory = 'labs/nebula/models/lmc/stars';
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const number = (line: string, first: number, last: number) => {
  const text = line.slice(first - 1, last).trim(); return text ? Number(text) : NaN;
};
export function sampleJointDepth(model: Pick<StarCloudModel, 'source'|'mapping'> & {
  cloud: Pick<StarCloudModel['cloud'], 'sample'|'supportBoundsKpc'>;
}, x0: number, y0: number, id: string): number {
 const rgba:[number,number,number,number]=[0,0,0,0];
 return sampleDepth({mapping:model.mapping,supportBounds:model.cloud.supportBoundsKpc,sampleEmission:model.cloud.sample,densityAt(x,y,z){sampleEncoded(model.source,x,y,z,rgba);return channelDensity(rgba[3],model.source.recipe.grid.encoding);}},x0,y0,id);
}
export function prepareCatalogue(table: string, frame: DensityVolumeFrame, wcs: ImageWcs, model: StarCloudModel): (PreparedLmcStar & {cloudSignal:number;cloudPartIds:string[]})[] {
  if (Math.abs(frame.metersPerUnit / 3.085677581491367e19 - 1) > 1e-12)
    throw new TypeError('Stellar density sampling requires kpc frame units.');
  const mapping = createObservationMapping(wcs, frame);
  const stars: (PreparedLmcStar & {cloudSignal:number;cloudPartIds:string[]})[] = [];
  for (const line of table.trimEnd().split('\n')) {
    const name = line.slice(0, 18).trim(), raDeg = number(line, 40, 49), decDeg = number(line, 51, 61);
    const magnitude = number(line, 89, 94), b = number(line, 76, 81);
    if (![raDeg, decDeg, magnitude].every(Number.isFinite) || magnitude > 16) continue;
    const a = raDeg * Math.PI / 180, d = decDeg * Math.PI / 180;
    const ray: [number, number, number] = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
    const tangent = rayToOverlayPlane(ray, frame);
    if (!mapping.uvAtTangent(tangent[0], tangent[1])) continue;
    const depth = sampleJointDepth(model, tangent[0], tangent[1], `Bonanos2009:${name}`);
    const positionUnits = mapping.pointAtDepth(tangent[0], tangent[1], depth);
    const cloudSignal=model.sampleSignal(...positionUnits), emission:[number,number,number]=[0,0,0];
    const cloudPartIds=model.cloud.parts.filter(part=>{part.sample(tangent[0],tangent[1],depth,emission);return Math.max(...emission)>0;}).map(part=>part.id).sort();
    if(!(cloudSignal>0 && cloudSignal<=1) || !cloudPartIds.some(id=>id.startsWith('extended:')))
      throw new Error(`Selected star has no prepared visible cloud support: ${name}`);
    const colorIndexBv = Number.isFinite(b) ? b - magnitude : null;
    const rgb = catalogueColor(NaN, colorIndexBv ?? NaN);
    const colorCss = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
    stars.push({ id: `Bonanos2009:${name}`, raDeg, decDeg, magnitude, colorIndexBv,
      spectralType: line.slice(273, 305).trim(), positionUnits, cloudSignal, cloudPartIds,
      colorCss, ...prepareStarPhotometry(magnitude, colorCss) });
  }
  return stars.sort((a, b) => a.magnitude - b.magnitude || a.id.localeCompare(b.id));
}
export async function prepareLmcStars() {
  const recipeBytes = await readFile('labs/nebula/models/lmc/clouds.json');
  const recipe = parseLabModelJson(recipeBytes.toString());
  const frameBytes = await readFile(recipe.frame.path);
  if (sha256(frameBytes) !== recipe.frame.sha256) throw new Error('LMC reference frame pin changed.');
  const frame = parseLabModelJson(frameBytes.toString()).properties.volume as DensityVolumeFrame;
  const manifest = parseLabModelJson(await readFile(`${directory}/source/catalogue.json`, 'utf8'));
  const sources = await Promise.all(manifest.files.map(async (entry: {path:string;sha256:string}) => {
    const bytes = await readFile(`${directory}/source/${entry.path}`);
    if (sha256(bytes) !== entry.sha256) throw new Error(`Catalogue pin changed: ${entry.path}`);
    return { ...entry, bytes: bytes.length };
  }));
  const model = await loadStarCloudModel(frame);
  const table = await readFile(`${directory}/source/table3.dat`, 'utf8');
  const stars = prepareCatalogue(table, frame, recipe.wcs, model);
  if (stars.length < 100 || stars.length > 1268) throw new Error(`Unexpected catalogue sample: ${stars.length}`);
  const payload: PreparedLmcStars = { schema: 'cssearth-lmc-stars@1', id: 'lmc-stars', frame, stars,
    magnitudeBand: 'V', sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/138/1003',
    credit: 'Bonanos et al. (2009), AJ 138, 1003; CDS/VizieR J/AJ/138/1003',
    depthAssumption: 'Published J2000 angular positions held fixed; individual depths unmeasured. Depths sample the joint reconstructed-cloud emission and simulation stellar density along each measured sightline. This cloud-contained display realization is not measured stellar distance or evidence of physical cloud membership.',
    provenance: { sources, photometry: STAR_PHOTOMETRY, depthModel: { ...model.provenance,
      method: 'Conditional depth PDF proportional to actual coherent extended cloud RGB emission maximum times decoded stellar density times (1+z/D)^2. 1536 intervals span cloud support; a fixed SHA-256 source-ID quantile inverts its piecewise-linear CDF. Chosen points must have strictly positive true joint support. No plane, added thickness, jitter or zero-support fallback.',
      coordinates: '(x,y,z)=(x0*(1+z/D),y0*(1+z/D),z); measured Earth rays are unchanged.',
      limitation: 'Cloud-conditioned display placement, not measured distances. The reconstructed emission and population-agnostic, clipped/quantized simulation mass density are model assumptions. No bright-star selection function or physical cloud membership is inferred.' }, paperUrl: 'https://arxiv.org/abs/0905.1328', doi: '10.1088/0004-6256/138/4/1003',
      selection: 'Table 3 published massive LMC stars with finite Johnson V <= 16, inside the full native SMASH WCS footprint. No foreground catalogue added; this is an incomplete massive-star sample, not all LMC stars.',
      inputRows: table.trimEnd().split('\n').length, selectedRows: stars.length,
      frame: recipe.frame, footprint: { recipe: 'labs/nebula/models/lmc/clouds.json', sha256: sha256(recipeBytes), wcs: recipe.wcs },
      color: 'Published B-V mapped through the existing catalogue display-color approximation; white when B absent. No dereddening. Point area and opacity preserve magnitude-derived relative display light with color compensation. Finite display sizes are not measured stellar diameters; the screen is not a radiometric instrument.' } };
  await mkdir(`${directory}/prepared`, { recursive: true });
  await writeFile(`${directory}/prepared/stars.json`, JSON.stringify(payload, null, 2) + '\n');
  console.log(JSON.stringify({ prepared: `${directory}/prepared/stars.json`, count: stars.length,
    magnitudeBand: payload.magnitudeBand, magnitudeRange: [stars[0].magnitude, stars.at(-1)!.magnitude] }));
}
if (process.argv[1] && /^prepare-lmc-stars\.(?:ts|mjs)$/.test(basename(process.argv[1]))) await prepareLmcStars();

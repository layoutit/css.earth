/** Offline preparation of the published Bonanos et al. (2009) massive LMC star sample. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { catalogueColor } from '../../../src/preparation/stars/color.js';
import { createObservationMapping } from './observation-prior.js';
import { rayToOverlayPlane, type ImageWcs } from './overlay-wcs.js';
import type { PreparedLmcStar, PreparedLmcStars } from './lmc-stars.js';

const directory = 'labs/nebula/models/lmc-stars';
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const number = (line: string, first: number, last: number) => {
  const text = line.slice(first - 1, last).trim(); return text ? Number(text) : NaN;
};
export interface CloudDepthPlane { interceptKpc: number; xSlope: number; ySlope: number; compression: number }
export function prepareCatalogue(table: string, frame: DensityVolumeFrame, wcs: ImageWcs, plane: CloudDepthPlane): PreparedLmcStar[] {
  if (!plane || ![plane.interceptKpc, plane.xSlope, plane.ySlope, plane.compression].every(Number.isFinite) ||
      plane.compression < 0 || plane.compression > 1 || Math.abs(frame.metersPerUnit / 3.085677581491367e19 - 1) > 1e-12)
    throw new TypeError('Cloud depth plane requires finite coefficients and kpc frame units.');
  const mapping = createObservationMapping(wcs, frame);
  const stars: PreparedLmcStar[] = [];
  for (const line of table.trimEnd().split('\n')) {
    const name = line.slice(0, 18).trim(), raDeg = number(line, 40, 49), decDeg = number(line, 51, 61);
    const magnitude = number(line, 89, 94), b = number(line, 76, 81);
    if (![raDeg, decDeg, magnitude].every(Number.isFinite) || magnitude > 16) continue;
    const a = raDeg * Math.PI / 180, d = decDeg * Math.PI / 180;
    const ray: [number, number, number] = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
    const tangent = rayToOverlayPlane(ray, frame);
    if (!mapping.uvAtTangent(tangent[0], tangent[1])) continue;
    // The cloud provenance stores coefficients AFTER compression; do not apply it again.
    // Measured sky rays are retained while unmeasured depths follow the same modeled tangent-coordinate plane.
    const depth = plane.interceptKpc + plane.xSlope * tangent[0] + plane.ySlope * tangent[1];
    const positionUnits = mapping.pointAtDepth(tangent[0], tangent[1], depth);
    const colorIndexBv = Number.isFinite(b) ? b - magnitude : null;
    const rgb = catalogueColor(NaN, colorIndexBv ?? NaN);
    // Authored point exposure/size, not physical stellar diameter or calibrated radiance.
    const relativeFlux = 10 ** (-.4 * (magnitude - 9));
    stars.push({ id: `Bonanos2009:${name}`, raDeg, decDeg, magnitude, colorIndexBv,
      spectralType: line.slice(273, 305).trim(), positionUnits,
      sizePx: Math.min(3, .9 + 1.8 * relativeFlux ** .25),
      colorCss: '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''), opacity: Math.min(1, .25 + .75 * relativeFlux ** .2) });
  }
  return stars.sort((a, b) => a.magnitude - b.magnitude || a.id.localeCompare(b.id));
}
export async function prepareLmcStars() {
  const recipeBytes = await readFile('labs/nebula/models/lmc-clouds.json');
  const recipe = JSON.parse(recipeBytes.toString());
  const frameBytes = await readFile(recipe.frame.path);
  if (sha256(frameBytes) !== recipe.frame.sha256) throw new Error('LMC reference frame pin changed.');
  const frame = JSON.parse(frameBytes.toString()).properties.volume as DensityVolumeFrame;
  const manifest = JSON.parse(await readFile(`${directory}/source/catalogue.json`, 'utf8'));
  const sources = await Promise.all(manifest.files.map(async (entry: {path:string;sha256:string}) => {
    const bytes = await readFile(`${directory}/source/${entry.path}`);
    if (sha256(bytes) !== entry.sha256) throw new Error(`Catalogue pin changed: ${entry.path}`);
    return { ...entry, bytes: bytes.length };
  }));
  const model = manifest.depthModel;
  const modelObjectBytes = await readFile(model.object.path), modelProvenanceBytes = await readFile(model.provenance.path);
  if (sha256(modelObjectBytes) !== model.object.sha256 || sha256(modelProvenanceBytes) !== model.provenance.sha256)
    throw new Error('Cloud depth model pin changed.');
  const modelObject = JSON.parse(modelObjectBytes.toString());
  if (modelObject.properties.preparation.sha256 !== model.provenance.sha256) throw new Error('Cloud object does not attest its depth model.');
  for (const key of ['referenceFrame', 'epochJdTt', 'originM', 'localToReferenceXyzw', 'metersPerUnit'])
    if (JSON.stringify(modelObject.properties.volume[key]) !== JSON.stringify(frame[key as keyof DensityVolumeFrame]))
      throw new Error('Cloud depth model frame differs from star frame.');
  const plane: CloudDepthPlane = JSON.parse(modelProvenanceBytes.toString()).volume.depthPlane;
  const table = await readFile(`${directory}/source/table3.dat`, 'utf8');
  const stars = prepareCatalogue(table, frame, recipe.wcs, plane);
  if (stars.length < 100 || stars.length > 1268) throw new Error(`Unexpected catalogue sample: ${stars.length}`);
  const payload: PreparedLmcStars = { schema: 'cssearth-lmc-stars@1', id: 'lmc-stars', frame, stars,
    magnitudeBand: 'V', sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/138/1003',
    credit: 'Bonanos et al. (2009), AJ 138, 1003; CDS/VizieR J/AJ/138/1003',
    depthAssumption: 'Published J2000 angular positions held fixed; individual depths unmeasured. Stars follow the same fitted tangent-coordinate depth plane as the reconstructed cloud. This is modeled placement, not measured stellar distance or proof of local cloud membership.',
    provenance: { sources, depthModel: { ...model, plane, coordinates: 'z = interceptKpc + xSlope*x0 + ySlope*y0; (x,y)=(x0,y0)*(1+z/D), where x0,y0 are calibrated tangent coordinates in kpc. Coefficients already include compression.' }, paperUrl: 'https://arxiv.org/abs/0905.1328', doi: '10.1088/0004-6256/138/4/1003',
      selection: 'Table 3 published massive LMC stars with finite Johnson V <= 16, inside the full native SMASH WCS footprint. No foreground catalogue added; this is an incomplete massive-star sample, not all LMC stars.',
      inputRows: table.trimEnd().split('\n').length, selectedRows: stars.length,
      frame: recipe.frame, footprint: { recipe: 'labs/nebula/models/lmc-clouds.json', sha256: sha256(recipeBytes), wcs: recipe.wcs },
      color: 'Published B-V mapped through the existing catalogue display-color approximation; white when B absent. No dereddening. Sizes and opacity are authored magnitude-dependent display values, not measured diameters or calibrated light.' } };
  await mkdir(`${directory}/prepared`, { recursive: true });
  await writeFile(`${directory}/prepared/stars.json`, JSON.stringify(payload, null, 2) + '\n');
  console.log(JSON.stringify({ prepared: `${directory}/prepared/stars.json`, count: stars.length,
    magnitudeBand: payload.magnitudeBand, magnitudeRange: [stars[0].magnitude, stars.at(-1)!.magnitude] }));
}
if (process.argv[1] && /^prepare-lmc-stars\.(?:ts|mjs)$/.test(basename(process.argv[1]))) await prepareLmcStars();

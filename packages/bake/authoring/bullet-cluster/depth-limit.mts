// Entry script: node packages/bake/authoring/bullet-cluster/depth-limit.mts [bank id, bullet-cluster-layers if none]
/**
 * The Bullet Cluster's drawn gas body against a measured limit.
 *
 * Mahdavi & Chang (2011) find, from Chandra and APEX-SZ data and with no assumption on shape, that half the pressure on
 * the sight line through the main component lies within a depth of at least 400 +/- 56 kpc, read within 182 kpc
 * (0.691 arcmin) of its X-ray centre, and that this depth is at least 0.92 of the half-pressure width on the sky.
 *
 * A body of revolution about a line in the plane of the sky is as deep as it is wide across that line, so the drawn
 * body's ratio is 1 by construction. This prints the depth itself: the length of sight line, about the middle of the
 * body's light, that holds half of it. The body's emission is read from a display picture, where X-ray light goes as
 * density squared; pressure at one temperature goes as density, so the root of the emission stands for it. Both
 * weightings are printed, since the picture's brightness is not calibrated emission.
 *
 * Input: the bank's recipe and pictures. Output: printed. Kiloparsecs are proper, in the paper's cosmology (H0 71,
 * matter 0.23, flat) at its redshift 0.296.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { imageLayerCollision, imageLayerView, parseImageLayerRecipe } from '@cssearth/bake/image-layers';

/** The paper's aperture about the main component's X-ray centre, arcsec, and its limit, kpc. */
const APERTURE = .691 * 60, LIMIT = '400 +/- 56';
const REDSHIFT = .296, HUBBLE = 71, MATTER = .23;

const source = resolve(import.meta.dirname, '../../../../src/objects', process.argv[2] ?? 'bullet-cluster-layers', 'source'), recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(source, 'recipe.json'), 'utf8')) as unknown), view = imageLayerView(recipe);
if (!recipe.geometry.collision) throw new TypeError(`${recipe.id} has no geometry.collision.`);
const [w, h] = recipe.source.dimensions, scale = recipe.bake.maxFacePixels / Math.max(w, h), W = Math.round(w * scale), H = Math.round(h * scale), pixelArcsec = recipe.observation.fieldOfViewDeg[0] * 3600 / W;
const pixel = (raDeg: number, decDeg: number): [number, number] => { const crop = view.crop(raDeg, decDeg); if (!crop) throw new TypeError(`${raDeg}, ${decDeg} is behind the photograph.`); return [(crop[0] + 1) / 2 * W - .5, (1 - crop[1]) / 2 * H - .5]; };
// The frame is 7 arcmin wide with north up to 0.02 degrees: a flat sky about the cluster's place serves here.
const centre = pixel(recipe.target.centerRaDeg, recipe.target.centerDecDeg), sky = (px: number, py: number): [number, number] => [-(px - centre[0]) * pixelArcsec, -(py - centre[1]) * pixelArcsec];
const model = await imageLayerCollision({ recipe, sourceDirectory: source, width: W, height: H, sky, pixel }), gas = model.bodies[0]!, main = recipe.geometry.collision.gas.from, [east, north] = sky(...pixel(main.raDeg, main.decDeg));
let comoving = 0; for (let i = 0; i < 2000; i++) { const z = (i + .5) * REDSHIFT / 2000; comoving += REDSHIFT / 2000 / Math.sqrt(MATTER * (1 + z) ** 3 + 1 - MATTER); }
const kpc = comoving * 299792.458 / HUBBLE / (1 + REDSHIFT) * 1000 * Math.PI / 648000;
/** The length of sight line about the middle of the light, summed over an aperture, that holds half of it. */
const halfDepth = (weight: (emission: number) => number, radius: number) => { const reach = model.reachArcsec, step = .25, count = Math.round(2 * reach / step), column = new Float64Array(count);
  for (let de = -radius; de <= radius; de += 2) for (let dn = -radius; dn <= radius; dn += 2) { if (Math.hypot(de, dn) > radius) continue; for (let k = 0; k < count; k++) column[k] += weight(gas.emission(east + de, north + dn, -reach + (k + .5) * step)); }
  let total = 0, moment = 0; for (let k = 0; k < count; k++) { total += column[k]!; moment += column[k]! * k; }
  const middle = Math.round(moment / total); let held = column[middle]!, out = 0; while (held < total / 2) { out++; held += (column[middle - out] ?? 0) + (column[middle + out] ?? 0); }
  return (2 * out + 1) * step; };
for (const [name, weight] of [['pressure at one temperature (the root of the emission)', Math.sqrt], ['X-ray emission', (emission: number) => emission]] as const) { const line = halfDepth(weight, 0), within = halfDepth(weight, APERTURE);
  console.log(`${name}: half lies within ${line.toFixed(1)} arcsec (${(line * kpc).toFixed(0)} kpc) on the sight line through the main cloud's middle, and within ${within.toFixed(1)} arcsec (${(within * kpc).toFixed(0)} kpc) over the paper's aperture of ${APERTURE.toFixed(1)} arcsec.`); }
console.log(`${kpc.toFixed(3)} kpc per arcsec. The measured limit is at least ${LIMIT} kpc. The body reaches ${model.reachArcsec.toFixed(0)} arcsec either side of the plane.`);

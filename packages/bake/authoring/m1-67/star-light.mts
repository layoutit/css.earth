/**
 * How far the central star's own light reaches in a bank's picture.
 *
 * A bright star spreads over the pixels about it, and that light belongs at the star, not on the nebula's walls. This
 * reads the picture in rings 0.1 arcsec wide about the star's pixel, each by the middle value of its brightest channel:
 * past the saturated rings, the star's light ends at the first ring that is no brighter than the middle of the ten rings
 * (1 arcsec) past it. The Southern Ring's fit uses the same rule (../ngc-3132/grid-fit.mts). The diffraction spikes are
 * narrow and do not move a ring's middle value: they are not measured here.
 *
 * Usage: node packages/bake/authoring/m1-67/star-light.mts <picture> <arcsec a pixel> <star x> <star y>
 */
import sharp from 'sharp';

const [picture = '', ...numbers] = process.argv.slice(2), [arcsec, starX, starY] = numbers.map(Number);
if (!picture || numbers.length !== 3 || !(arcsec! > 0) || !Number.isFinite(starX) || !Number.isFinite(starY)) throw new TypeError(`Usage: star-light.mts <picture> <arcsec a pixel> <star x> <star y>; got ${JSON.stringify(process.argv.slice(2))}.`);
const RING_ARCSEC = 0.1, RINGS = 120, SATURATED = 250;
const { data, info } = await sharp(picture).removeAlpha().raw().toBuffer({ resolveWithObject: true }), rings: number[][] = Array.from({ length: RINGS }, () => []);
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { const ring = Math.floor(Math.hypot(x - starX!, y - starY!) * arcsec! / RING_ARCSEC), at = 3 * (y * info.width + x); if (ring < RINGS) rings[ring]!.push(Math.max(data[at]!, data[at + 1]!, data[at + 2]!)); }
const middle = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0, levels = rings.map(middle);
const ends = levels.findIndex((level, ring) => level < SATURATED && ring + 10 < levels.length && level <= middle(levels.slice(ring + 1, ring + 11)));
if (ends < 0) throw new RangeError(`${picture}: the star's light does not end within ${RINGS * RING_ARCSEC} arcsec of pixel ${starX}, ${starY}.`);
console.log(`${picture}: ${info.width} x ${info.height} px at ${arcsec} arcsec a pixel; ring levels from the star ${levels.slice(0, 60).join(' ')}; the star's light ends ${(ends * RING_ARCSEC).toFixed(1)} arcsec from the star (${levels[ends]} of 255).`);

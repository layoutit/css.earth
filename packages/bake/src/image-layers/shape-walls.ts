import type { imageLayerShapeModel } from './shape.ts';

type Model = ReturnType<typeof imageLayerShapeModel>;
/** One surface the picture's light lies on: for each face pixel its depth along the sight line, the optical depth of
 * its light there and that light's color. `texels` is how many face pixels across a texel of a surface that holds only
 * smooth light may be; without it a texel is a face pixel. `around` is the surface's depth at pixels just past its
 * own, where the layer knows how it goes on (NaN elsewhere): a closed body's side curls round at the body's outline. */
export interface ShapeLayer { depth: Float32Array; tau: Float32Array; hue: Uint8Array; texels?: number; around?: Float32Array }
/** The picture's light on a nebula's walls, nearest surface first: the near wall, the surface between the walls where
 * the model has one, the far wall. Where a measured speed is its own depth the order is the reverse of the painting's
 * instead: the near measured surface, the far one, the near wall, the far wall. `sharp` has bit `k` set where layer `k` holds fine detail at a pixel. A pixel
 * outside the walls has a depth of NaN in every layer. */
export interface ShapeWalls { layers: ShapeLayer[]; sharp: Uint8Array; pixels: number }

/** How many face pixels of the smooth light's blur radius a texel of a surface that holds only smooth light is, at least. */
export const SMOOTH_PIXELS_A_TEXEL = 12;
const layerOf = (count: number): ShapeLayer => ({ depth: new Float32Array(count).fill(NaN), tau: new Float32Array(count), hue: new Uint8Array(3 * count) });
const tauOf = (alpha: number) => -Math.log(1 - alpha);

/**
 * A nebula's published walls take the picture's light inside their outline (./shape.ts): each pixel's light leaves the
 * flat picture (`base`, whose opacity is cleared there) for the wall in front of the star and the wall behind it.
 *
 * One picture cannot tell the two walls apart, so each takes half the optical depth of the smooth light (`floors`, the
 * lower envelope of `lights`), in its color, or the share of that the model gives the walls there. The fine detail goes where the model says (`detail`): to the near wall
 * without measurements, since dark knots show against the light behind them; to the far wall where measured speeds
 * recede; to the surface between the walls where the model has one. Seen from the Sun, the surfaces over one another
 * are the photograph: the last one a pixel's light is put on takes what the photograph still owes, seen through the
 * ones in front.
 *
 * `sky` gives a face pixel's offset from the star, east and north in arcseconds; `unitsPerArcsec` turns the model's
 * depths into the bank's units. `broad` is each channel's smooth light blurred much farther, for a model whose measured
 * speeds are their own depths.
 */
export function imageLayerShapeWalls(base: Buffer, width: number, height: number, lights: readonly Float32Array[], floors: readonly Float32Array[], model: Model, sky: (px: number, py: number) => readonly [number, number], unitsPerArcsec: number, broad?: readonly Float32Array[]): ShapeWalls {
  const count = width * height, near = layerOf(count), far = layerOf(count), mid = model.between ? layerOf(count) : null, sharp = new Uint8Array(count);
  // Where a measured speed is its own depth: the two surfaces the measured light lies on, in front of the plane and behind it.
  const lifted = model.shape.speeds?.depth === 'speed' ? [layerOf(count), layerOf(count)] as const : null;
  // The walls then hold smooth light alone, blurred over `smoothPixels`: a twelfth of that is texel enough, in a power of two.
  if (lifted) near.texels = far.texels = 2 ** Math.floor(Math.log2(Math.max(1, model.shape.smoothPixels / SMOOTH_PIXELS_A_TEXEL)));
  let pixels = 0;
  const hue = (layer: ShapeLayer, p: number, light: readonly number[], alpha: number) => { for (let c = 0; c < 3; c++) layer.hue[3 * p + c] = alpha > 0 ? Math.min(255, Math.round(255 * light[c]! / alpha)) : 0; };
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    const p = py * width + px; if (!base[4 * p + 3]) continue;
    const [east, north] = sky(px, py), ends = model.walls(east, north, [floors[0]![p]!, floors[1]![p]!, floors[2]![p]!]); if (!ends) continue;
    const where = mid ? model.detail(east, north, ends.near, ends.far) : null;
    const smooth = Math.max(floors[0]![p]!, floors[1]![p]!, floors[2]![p]!), whole = -Math.log(1 - Math.min(base[4 * p + 3]! / 255, .998)), halfTau = Math.min(whole, -Math.log(1 - Math.min(smooth, .998))) / 2, farTau = where ? halfTau * where.walls : halfTau, farAlpha = 1 - Math.exp(-farTau);
    // The far wall's light, and the near wall's: what the photograph has left once the far wall shows through it. Where
    // that would pass full brightness the near wall keeps a little more opacity instead.
    const behind = floors.map(floor => smooth > 0 ? floor[p]! / smooth * farAlpha : 0); let nearAlpha = 1 - Math.exp(-(whole - farTau)), front = [0, 0, 0];
    for (let pass = 0; pass < 2; pass++) { front = lights.map((light, c) => Math.max(0, light[p]! - (1 - nearAlpha) * behind[c]!)); nearAlpha = Math.min(.998, Math.max(nearAlpha, ...front)); }
    near.depth[p] = ends.near * unitsPerArcsec; far.depth[p] = ends.far * unitsPerArcsec; sharp[p] = 1;
    if (lifted && where?.lifted) {
      // The fine detail a speed places lies on the two measured surfaces, in the shares of what approaches and what
      // recedes there; what none places stays on the picture's plane. The smooth light is the shell's. One picture cannot
      // tell the shell's halves apart, and two copies of it come apart as soon as the camera is nearer than the Sun: so
      // the halves share only its broad part (`broad`), half each, and the far half holds the rest. The surfaces are
      // painted in one order from every side: the plane, the far wall, the near wall, the far measured surface, the near
      // one. Each carries the light it hides of those painted before it, in proportion to its own opacity: seen from
      // the Sun they are the photograph, and none is made brighter to shine through another.
      const glow = floors.map((floor, c) => Math.min(floor[p]!, lights[c]![p]!)), glowTau = Math.min(whole, -Math.log(1 - Math.min(Math.max(...glow), .998))), fineTau = whole - glowTau;
      const fine = lights.map((light, c) => light[p]! - glow[c]!), veil = glow.map((value, c) => Math.min(value, broad ? broad[c]![p]! : 0) / 2), own = [fine.map(value => where.mid * value), glow.map((value, c) => value - veil[c]!), veil, fine.map(value => where.far * value), fine.map(value => where.near * value)];
      const veilTau = Math.min(glowTau / 2, -Math.log(1 - Math.min(Math.max(...veil), .998))), taus = [where.mid * fineTau, glowTau - veilTau, veilTau, where.far * fineTau, where.near * fineTau], below = [0, 0, 0];
      const painted = own.map((light, index) => { let alpha = Math.min(.998, 1 - Math.exp(-taus[index]!)), shown = light;
        for (let pass = 0; pass < 2; pass++) { shown = light.map((value, c) => value + alpha * below[c]!); alpha = Math.min(.998, Math.max(alpha, ...shown)); }
        for (let c = 0; c < 3; c++) below[c]! += light[c]!;
        return { alpha, shown }; });
      for (const [layer, index] of [[far, 1], [near, 2], [lifted[1], 3], [lifted[0], 4]] as const) { layer.tau[p] = tauOf(painted[index]!.alpha); hue(layer, p, painted[index]!.shown, painted[index]!.alpha); }
      if (where.near > 0) lifted[0].depth[p] = where.lifted.near * unitsPerArcsec; if (where.far > 0) lifted[1].depth[p] = where.lifted.far * unitsPerArcsec;
      sharp[p] = (where.near > 0 ? 2 : 0) | (where.far > 0 ? 4 : 0);
      for (let c = 0; c < 3; c++) base[4 * p + c] = painted[0]!.alpha > 0 ? Math.min(255, Math.round(255 * painted[0]!.shown[c]! / painted[0]!.alpha)) : 0;
      base[4 * p + 3] = Math.round(255 * painted[0]!.alpha); pixels++; continue;
    } else if (!mid || !where || !(where.far > 0 || where.mid > 0)) { near.tau[p] = tauOf(nearAlpha); far.tau[p] = farTau; hue(near, p, front, nearAlpha); hue(far, p, behind, farAlpha); if (mid && where) mid.depth[p] = where.at * unitsPerArcsec; }
    else {
      // Detail off the near wall: that share of the near wall is its half of the smooth light alone. The surface
      // between the walls holds its share of the detail, seen through the near wall; the far wall is what the
      // photograph still owes, seen through both.
      const off = where.far + where.mid, frontAlpha = (1 - off) * nearAlpha + off * farAlpha, frontLight = front.map((light, c) => (1 - off) * light + off * behind[c]!);
      let midAlpha = where.mid > 0 ? Math.min(.998, where.mid * (1 - Math.exp(-(whole - 2 * farTau)))) : 0, midLight = [0, 0, 0];
      if (where.mid > 0) for (let pass = 0; pass < 2; pass++) { midLight = lights.map((light, c) => where.mid * Math.max(0, (light[p]! - behind[c]! - (1 - farAlpha) * (1 - midAlpha / where.mid) * behind[c]!) / (1 - farAlpha))); midAlpha = Math.min(.998, Math.max(midAlpha, ...midLight)); }
      const clear = (1 - frontAlpha) * (1 - midAlpha), backLight = lights.map((light, c) => Math.max(0, (light[p]! - frontLight[c]! - (1 - frontAlpha) * midLight[c]!) / clear));
      const backAlpha = Math.min(.998, Math.max((1 - where.far) * farAlpha + where.far * (1 - Math.exp(-(whole - farTau))), ...backLight));
      near.tau[p] = tauOf(frontAlpha); far.tau[p] = tauOf(backAlpha); hue(near, p, frontLight, frontAlpha); hue(far, p, backLight, backAlpha);
      mid.depth[p] = where.at * unitsPerArcsec; mid.tau[p] = tauOf(midAlpha); hue(mid, p, midLight, midAlpha);
      sharp[p] = (off < 1 ? 1 : 0) | (where.mid > 0 ? 2 : 0) | (where.far > 0 ? 4 : 0);
    }
    base[4 * p + 3] = 0; pixels++;
  }
  // A surface between the walls is the middle layer; without one the far wall's detail bit is the second.
  return { layers: lifted ? [lifted[0], lifted[1], near, far] : mid ? [near, mid, far] : [near, far], sharp, pixels };
}

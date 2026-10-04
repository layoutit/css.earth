import type { imageLayerShapeModel } from './shape.ts';

type Model = ReturnType<typeof imageLayerShapeModel>;
/** One surface the picture's light lies on: for each face pixel its depth along the sight line, the optical depth of
 * its light there and that light's color. */
export interface ShapeLayer { depth: Float32Array; tau: Float32Array; hue: Uint8Array }
/** The picture's light on a nebula's walls, nearest surface first: the near wall, the surface between the walls where
 * the model has one, the far wall. `sharp` has bit `k` set where layer `k` holds fine detail at a pixel. A pixel
 * outside the walls has a depth of NaN in every layer. */
export interface ShapeWalls { layers: ShapeLayer[]; sharp: Uint8Array; pixels: number }

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
 * depths into the bank's units.
 */
export function imageLayerShapeWalls(base: Buffer, width: number, height: number, lights: readonly Float32Array[], floors: readonly Float32Array[], model: Model, sky: (px: number, py: number) => readonly [number, number], unitsPerArcsec: number): ShapeWalls {
  const count = width * height, near = layerOf(count), far = layerOf(count), mid = model.between ? layerOf(count) : null, sharp = new Uint8Array(count);
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
    if (!mid || !where || !(where.far > 0 || where.mid > 0)) { near.tau[p] = tauOf(nearAlpha); far.tau[p] = farTau; hue(near, p, front, nearAlpha); hue(far, p, behind, farAlpha); if (mid && where) mid.depth[p] = where.at * unitsPerArcsec; }
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
  return { layers: mid ? [near, mid, far] : [near, far], sharp, pixels };
}

import type { ImageLayerRecipe } from './config.ts';
import { rad } from './disc.ts';
import { ellipsoid } from './shape.ts';

type Body = NonNullable<ImageLayerRecipe['geometry']['body']>;

/** A nebula's published filled body (`geometry.body`): gas that fills a spheroid and the envelope around it, with
 * cavities in the spheroid where it emits less. A sight line's light is spread along the line through that gas, less
 * inside a cavity; how much the gas emits at each distance from the star, the bake reads from the picture.
 *
 * The cavities run along the body's pole. Where a sight line passes the pole's line, it is nearer than the star on the
 * side the near pole leans to and farther on the other side; a cavity on a sight line is centred at that depth. Between
 * the position angles `farBetweenPaDeg` the cavity lies behind the star, elsewhere in front of it, as the paper reads
 * its velocity channels. How long a cavity is along a sight line is not in the model: the bake reads it from how dim
 * the picture is there. Where the picture is brighter than an evenly filled body, the gas is denser about the body's
 * equatorial plane, which a sight line meets behind the star on the side the near pole leans to.
 *
 * The frame is the bake's: x east, y north, z along the sight line away from the Sun, in arcseconds from the star. */
/** Over how many degrees of position angle, about the first of `farBetweenPaDeg`, the near lobe is led into the far one.
 * The paper gives two lobes there, not the wall a sudden change would stand between them: a presentation choice. */
export const LOBES_JOIN_OVER_DEG = 30;

export function imageLayerBodyModel(body: Body) {
  const core = ellipsoid(body.semiPolarArcsec, body.semiEquatorialArcsec, body.semiEquatorialArcsec, body.polarTiltDeg, body.polarLeansToPaDeg, body.polarLeansToPaDeg + 90);
  const around = body.envelope ? ellipsoid(body.envelope.radiusArcsec, body.envelope.radiusArcsec, body.envelope.radiusArcsec, 0, 0, 90) : null;
  const lean = rad(body.polarLeansToPaDeg), slope = Math.tan(rad(body.polarTiltDeg)), far = body.cavities?.farBetweenPaDeg;
  /** Where a sight line crosses the envelope and the body, and the depths its cavity is centred at and it meets the equatorial plane at; null outside both. */
  const along = (east: number, north: number): { envelope: [number, number] | null; body: [number, number] | null; cavityAt: number; equatorAt: number } | null => {
    const inner = core.span(east, north), outer = around ? around.span(east, north) : null;
    if (!inner && !outer) return null;
    // The pole's line passes this sight line at a depth of the offset along the lean over the tilt's tangent.
    const offset = east * Math.sin(lean) + north * Math.cos(lean), depth = slope > 0 ? Math.abs(offset) / slope : 0;
    const pa = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
    if (!far) return { envelope: outer, body: inner, cavityAt: offset < 0 ? depth : -depth, equatorAt: offset * slope };
    // From the near side to the far side across the start of the far range; at its end the pole's line is at the star's depth.
    const from = ((pa - far[0] + 540) % 360) - 180, within = (pa - far[0] + 360) % 360 <= (far[1] - far[0] + 360) % 360;
    const t = Math.max(0, Math.min(1, from / LOBES_JOIN_OVER_DEG + 0.5)), side = Math.abs(from) < LOBES_JOIN_OVER_DEG / 2 ? 2 * t * t * (3 - 2 * t) - 1 : within ? 1 : -1;
    return { envelope: outer, body: inner, cavityAt: side * depth, equatorAt: offset * slope };
  };
  /** How far the body or its envelope reaches along the sight line either side of the star. */
  const reach = Math.max(core.height, around ? around.height : 0);
  return { body, along, reach };
}

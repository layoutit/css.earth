import type { Point3, PreparedStar, PreparedStarNode, Rgb } from './types.ts';
import { nearestColor } from './color.ts';
import { hierarchyPosition, hierarchyMagnitude, hierarchyRadius } from './precision.ts';

/** Every input row occurs exactly once in the reordered array. Internal bounds contain its actual members. */
export function prepareStarHierarchy(input: readonly PreparedStar[], colors: readonly Rgb[], leafSize: number, maximumDepth: number) {
  if (!input.length || !Number.isSafeInteger(leafSize) || leafSize < 1) throw new TypeError('Star hierarchy requires rows and a positive leaf size.');
  const stars: PreparedStar[] = [], nodes: PreparedStarNode[] = [];
  function append(rows: readonly PreparedStar[], min: Point3, max: Point3, depth: number): number {
    const index = nodes.length, first = stars.length;
    let flux = 0, px = 0, py = 0, pz = 0, red = 0, green = 0, blue = 0;
    for (const row of rows) {
      const weight = 10 ** (-.4 * row.absoluteMagnitude), color = colors[row.colorIndex];
      if (!color || !Number.isFinite(weight) || !(weight > 0)) throw new TypeError('Invalid star luminosity or color.');
      flux += weight; px += row.positionUnits[0]*weight; py += row.positionUnits[1]*weight; pz += row.positionUnits[2]*weight;
      red += color[0]*weight; green += color[1]*weight; blue += color[2]*weight;
    }
    const positionUnits = hierarchyPosition([px/flux, py/flux, pz/flux]);
    let radiusUnits = 0;
    for (const row of rows) radiusUnits = Math.max(radiusUnits, Math.hypot(row.positionUnits[0]-positionUnits[0], row.positionUnits[1]-positionUnits[1], row.positionUnits[2]-positionUnits[2]));
    const children: number[] = [];
    nodes.push({ positionUnits, radiusUnits: hierarchyRadius(radiusUnits), absoluteMagnitude: hierarchyMagnitude(-2.5*Math.log10(flux)), colorIndex: nearestColor([red/flux,green/flux,blue/flux], colors), first, count: rows.length, children });
    if (rows.length <= leafSize) stars.push(...rows);
    else {
      const mid: Point3 = [(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2];
      const bins: PreparedStar[][] = Array.from({ length: 8 }, () => []);
      for (const row of rows) { const p = row.positionUnits; bins[(p[0]>=mid[0]?1:0)|(p[1]>=mid[1]?2:0)|(p[2]>=mid[2]?4:0)]!.push(row); }
      if (depth >= maximumDepth) {
        // Coincident rows still need bounded leaves; stable source order breaks ties without fabricated positions.
        for (let offset = 0; offset < rows.length; offset += leafSize) children.push(append(rows.slice(offset, offset+leafSize), min, max, depth+1));
      } else bins.forEach((bin, octant) => {
        if (!bin.length) return;
        const lo: Point3 = [octant&1?mid[0]:min[0],octant&2?mid[1]:min[1],octant&4?mid[2]:min[2]];
        const hi: Point3 = [octant&1?max[0]:mid[0],octant&2?max[1]:mid[1],octant&4?max[2]:mid[2]];
        children.push(append(bin, lo, hi, depth+1));
      });
    }
    return index;
  }
  let maximum = 0;
  for (const row of input) for (const component of row.positionUnits) maximum = Math.max(maximum, Math.abs(component));
  const extent = 2 ** Math.ceil(Math.log2(maximum));
  if (!Number.isFinite(extent) || extent <= 0) throw new TypeError('Invalid catalogue extent.');
  append(input, [-extent,-extent,-extent], [extent,extent,extent], 0);
  return { stars, nodes, boundsUnits: { min: [-extent,-extent,-extent] as Point3, max: [extent,extent,extent] as Point3 } };
}

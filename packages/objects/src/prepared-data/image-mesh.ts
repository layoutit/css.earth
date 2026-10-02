import { parseDensityVolumeFrame, type DensityVolumeFrame } from '../density-volume.js';

export const IMAGE_MESH_SCHEMA = 'cssearth-image-mesh@1';

const LEAF_STYLE = ['width', 'height', 'transform', 'backgroundSize', 'backgroundPosition'] as const;
export interface PreparedImageMesh {
  readonly id: string; readonly name: string; readonly frame: DensityVolumeFrame; readonly radiusUnits: number; readonly texturePath: string;
  /** A camera-facing plate over the sphere that darkens toward its outline; the outline sits at `edge` of the plate's half-width. */
  readonly limb: { readonly path: string; readonly edge: number } | null;
  /** How far what the sphere holds reaches: a hidden sphere's caption sits below it. */
  readonly holdsRadiusUnits: number | null;
  /** The hemisphere a cutaway opens (its leaves are marked `cut`), and the opacities the rest's inside and outside are drawn
   * at while it is open. */
  readonly cutaway: { readonly hemisphere: 'north' | 'south'; readonly interiorOpacity: number; readonly exteriorOpacity: number } | null;
  readonly leaves: readonly { readonly cut: boolean; readonly style: Readonly<Record<(typeof LEAF_STYLE)[number], string> & { borderRadius?: string }> }[];
}

/** A `cssearth-image-mesh@1` bank (packages/bake/cli/prepare-map-sphere.mts): patches of one atlas around a centre. */
export function parseImageMesh(value: unknown, at = 'image mesh'): PreparedImageMesh {
  const data = value as { schema?: unknown; id?: unknown; name?: unknown; frame?: unknown; radiusUnits?: unknown; holds?: { radiusUnits?: unknown }; texture?: { path?: unknown };
    limb?: { path?: unknown; edge?: unknown }; cutaway?: { hemisphere?: unknown; interiorOpacity?: unknown; exteriorOpacity?: unknown }; leaves?: unknown } | null;
  if (!data || data.schema !== IMAGE_MESH_SCHEMA || typeof data.id !== 'string' || !data.id) throw new TypeError(`${at}: expected a ${IMAGE_MESH_SCHEMA} bank with an id.`);
  if (typeof data.name !== 'string' || !data.name.trim()) throw new TypeError(`${data.id}: the mesh needs the name its caption shows.`);
  const path = (candidate: unknown) => typeof candidate === 'string' && /^[a-z0-9-]+(\/[a-z0-9.-]+)+$/u.test(candidate);
  const texturePath = data.texture?.path;
  if (!path(texturePath)) throw new TypeError(`${data.id}: the mesh needs its texture path.`);
  const limb = data.limb === undefined ? null : data.limb;
  if (limb !== null && (!path(limb.path) || typeof limb.edge !== 'number' || !(limb.edge > 0.5 && limb.edge <= 1))) {
    throw new TypeError(`${data.id}: the limb plate needs its image path and the outline's place on it (edge, above 0.5 and at most 1), not ${JSON.stringify(limb)}.`);
  }
  const cutaway = data.cutaway === undefined ? null : data.cutaway;
  if (cutaway !== null && ((cutaway.hemisphere !== 'north' && cutaway.hemisphere !== 'south') || typeof cutaway.interiorOpacity !== 'number'
    || !(cutaway.interiorOpacity > 0 && cutaway.interiorOpacity <= 1)
    || (cutaway.exteriorOpacity !== undefined && (typeof cutaway.exteriorOpacity !== 'number' || !(cutaway.exteriorOpacity > 0 && cutaway.exteriorOpacity <= 1))))) {
    throw new TypeError(`${data.id}: a cutaway names the hemisphere it opens (north or south) and its inside and outside opacities in (0, 1], not ${JSON.stringify(cutaway)}.`);
  }
  if (typeof data.radiusUnits !== 'number' || !(data.radiusUnits > 0)) throw new TypeError(`${data.id}: the mesh needs a positive radius.`);
  const holds = data.holds?.radiusUnits;
  if (data.holds !== undefined && (typeof holds !== 'number' || !(holds > 0 && holds < data.radiusUnits))) {
    throw new TypeError(`${data.id}: what the mesh holds reaches a positive radius inside its own, not ${JSON.stringify(data.holds)}.`);
  }
  if (!Array.isArray(data.leaves) || !data.leaves.length || data.leaves.length > 1536) throw new TypeError(`${data.id}: the mesh holds 1 to 1536 leaves.`);
  const leaves = data.leaves.map((raw: unknown, index: number) => {
    const leaf = raw as { style?: Record<string, unknown>; cut?: unknown } | null, style = leaf?.style;
    if (leaf?.cut !== undefined && leaf.cut !== true) throw new TypeError(`${data.id}: leaf ${index} is marked cut only with true.`);
    if (leaf?.cut === true && cutaway === null) throw new TypeError(`${data.id}: leaf ${index} is marked cut but the mesh declares no cutaway.`);
    if (!style || !LEAF_STYLE.every(key => typeof style[key] === 'string' && style[key])) throw new TypeError(`${data.id}: leaf ${index} needs its ${LEAF_STYLE.join(', ')}.`);
    // A polar cap of the standard sphere is its square plate rounded to a disc (packages/bake/src/scene/polar-cap.ts).
    if (style.borderRadius !== undefined && style.borderRadius !== '50%') throw new TypeError(`${data.id}: leaf ${index} rounds only to a disc (border-radius 50%).`);
    return Object.freeze({ cut: leaf?.cut === true, style: Object.freeze(Object.fromEntries([...LEAF_STYLE, ...(style.borderRadius ? ['borderRadius' as const] : [])]
      .map(key => [key, style[key] as string]))) as PreparedImageMesh['leaves'][number]['style'] });
  });
  return Object.freeze({ id: data.id, name: data.name, frame: parseDensityVolumeFrame(data.frame), radiusUnits: data.radiusUnits, texturePath: texturePath as string,
    limb: limb ? Object.freeze({ path: limb.path as string, edge: limb.edge as number }) : null, holdsRadiusUnits: typeof holds === 'number' ? holds : null,
    cutaway: cutaway ? Object.freeze({ hemisphere: cutaway.hemisphere as 'north' | 'south', interiorOpacity: cutaway.interiorOpacity as number,
      exteriorOpacity: (cutaway.exteriorOpacity as number | undefined) ?? 1 }) : null,
    leaves: Object.freeze(leaves) });
}

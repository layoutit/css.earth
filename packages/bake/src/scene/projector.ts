import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, formatCssLength } from '@layoutit/polycss';
import type { ComputeTextureAtlasPlanOptions, Polygon } from '@layoutit/polycss';
import type { SurfacePatch } from '@cssearth/objects';
import { createProjectiveSurfaceRasterPresentation, fitTextureGeometry, fitProjectiveTextureGeometryToStableLayout, leafRasterScale, prepareProjectiveTextureLayer } from './projective-surface-raster.ts';
import type { GeometryProfile } from './profile.ts';
import { prepareLeafSeamOutset, type PreparedLeafSeamOutset } from './seam-outset.ts';
import { POLAR_CAP_STYLE, requireOutwardCap } from './polar-cap.ts';

export interface PreparedLeaf {
  tag: 's'; className: string; style: string; polarCap?: string | null;
  longitudeIndex?: number | null; latitudeIndex?: number; longitudeDegrees?: number;
  projectiveTextureLayer?: ReturnType<typeof prepareProjectiveTextureLayer> & { seamOutset?: PreparedLeafSeamOutset };
}
export const rendererPolygon = (patch: SurfacePatch): Polygon => ({ ...patch,
  texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' } });

/** A surface too large to decode as one image is published as pages of whole bands (preparation/raster/pages.ts). */
export interface LeafPages { bandsPerPage: number; pageCount: number }

/** The pixel width of the widest published image that can stand in a leaf's texture, by the url the leaf's patch names:
 * every lens, texture level and page (leaf-images.ts measures them). */
export type LeafImagePixels = (url: string) => number;

interface LeafGeometry { matrix: string; leafWidth: number; leafHeight: number; backgroundPosition: readonly number[]; backgroundSize: readonly number[] }
/** A plain leaf has no projective layer to carry a raster scale, so a scale below one is drawn into its geometry: the box
 * and background addresses shrink by it and the matrix's first two columns grow by its inverse. Leaves transform from
 * their top-left corner (transform-origin 0 0), so every texel lands where it did. */
export function scalePlainLeafGeometry<G extends LeafGeometry>(geometry: G, scale: number): G {
  if (scale === 1) return geometry;
  const matrix = geometry.matrix.split(',').map(Number);
  if (matrix.length !== 16 || matrix.some(value => !Number.isFinite(value)) || !(scale > 0 && scale < 1)) {
    throw new RangeError(`A plain leaf only shrinks, by a scale between 0 and 1 (${scale}), and needs a finite matrix3d (${geometry.matrix}).`);
  }
  return { ...geometry, matrix: matrix.map((value, index) => index < 8 ? value / scale : value).join(','),
    leafWidth: geometry.leafWidth * scale, leafHeight: geometry.leafHeight * scale,
    backgroundPosition: geometry.backgroundPosition.map(value => value * scale), backgroundSize: geometry.backgroundSize.map(value => value * scale) };
}

export function createLeafProjector(profile: GeometryProfile, direction: [number, number, number], pages: LeafPages | null, imagePixels: LeafImagePixels) {
  const p = profile.projection, surface = profile.surface, ns = profile.namespace;
  // Every leaf shows the widest image that can stand in its texture at two texels per CSS pixel (leafRasterScale). The
  // recipe's raster scale is the ceiling of a projective leaf and still quantizes the patch overlap (createSurfacePatches in
  // scene/index.ts); a plain leaf is never enlarged.
  const rasterScale = (patch: SurfacePatch, backgroundWidth: number, ceiling: number) =>
    leafRasterScale(imagePixels(patch.textureImageSource.url), backgroundWidth, ceiling);
  if (pages && surface.latitudeSegments !== pages.bandsPerPage * pages.pageCount) {
    throw new TypeError(`${ns}: pages of ${pages.bandsPerPage} bands need ${pages.bandsPerPage * pages.pageCount} latitude bands, not ${surface.latitudeSegments}.`);
  }
  const options: ComputeTextureAtlasPlanOptions & { textureLighting: 'baked' } = { tileSize: p.tileSize, layerElevation: p.layerElevation,
    textureLighting: 'baked', seamBleed: 0,
    directionalLight: { direction, color: p.lightColor, intensity: Math.PI },
    ambientLight: { color: p.lightColor, intensity: p.ambientIntensity * Math.PI } };
  const resolve = (patch: SurfacePatch, index: number, seamBleed: number, sharedEdges?: Set<number>) => {
    const plan = computeTextureAtlasPlanPublic(rendererPolygon(patch), index, { ...options, seamBleed,
      ...(sharedEdges ? { seamEdges: sharedEdges } : {}) });
    const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
    if (!geometry) throw new Error(`Texture leaf ${index} could not be prepared.`);
    return geometry;
  };
  return {
    surface(patch: SurfacePatch, index: number, sharedEdges?: Set<number>, className?: string): PreparedLeaf {
      const geometry = resolve(patch, index, patch.pole ? 0 : p.seamBleed, sharedEdges);
      const initial = p.fitToSource ? fitTextureGeometry(geometry, patch.textureImageSource.sourceRect.width, patch.textureImageSource.sourceRect.height) : geometry;
      // Surface leaves, and caps where the profile asks for it, carry a projective layer; any other cap is a plain leaf.
      const projective = !patch.pole || p.projectivePoles;
      const stable = patch.pole ? initial : fitProjectiveTextureGeometryToStableLayout(initial);
      const fitted = projective ? stable : scalePlainLeafGeometry(stable, rasterScale(patch, stable.backgroundSize[0]!, 1));
      const raster = patch.pole ? fitted : createProjectiveSurfaceRasterPresentation({
        sourceWidth: surface.surface.width, sourceHeight: surface.surfaceLatitudeHeight,
        sourceRect: patch.surfaceSourceRect ?? patch.textureImageSource.sourceRect,
        addressSourceWidth: patch.textureImageSource.width, addressSourceHeight: patch.textureImageSource.height,
        addressSourceRect: patch.textureImageSource.sourceRect, backgroundPosition: fitted.backgroundPosition,
        backgroundSize: fitted.backgroundSize, leafWidth: fitted.leafWidth, leafHeight: fitted.leafHeight,
        bandCount: surface.latitudeSegments, gutter: p.rasterGutter, overscan: p.rasterOverscan });
      // A paged band reads its page: the same atlas address, moved up by the bands above the page and cut to its height.
      const band = surface.latitudeSegments - 1 - patch.latitudeIndex, page = pages && !patch.pole ? Math.floor(band / pages.bandsPerPage) : null;
      const pageRows = page === null ? 0 : raster.backgroundSize[1]! / surface.latitudeSegments * pages!.bandsPerPage;
      const address = page === null ? raster : { backgroundPosition: [raster.backgroundPosition[0]!, raster.backgroundPosition[1]! + page * pageRows],
        backgroundSize: [raster.backgroundSize[0]!, pageRows] };
      const position = address.backgroundPosition.map(value => value === 0 ? '0px' : formatCssLength(value)).join(' ');
      // formatCssLength's second argument is its decimals: never hand it Array.map's index.
      const size = address.backgroundSize.map(value => formatCssLength(value)).join(' ');
      // A leaf names no image of its own. Every lens reaches it through the texture that lens's variant writes on the body
      // (composite.ts, emissive.ts): a band draws the lens's surface, or its page of a paged surface, and a cap its poles.
      // Leaves that inlined the profile's image drew it under every lens: Uranus's and Neptune's lenses never changed them.
      const image = `var(--${ns}-${patch.pole ? 'poles-image' : page === null ? 'surface-image' : `surface-page-${page}`})`;
      // Every lane's caps follow one rule (polar-cap.ts): a disc, facing out, culled when it turns away.
      if (patch.pole) requireOutwardCap(ns, patch.pole, fitted.matrix, patch.inner);
      const caps = patch.pole ? POLAR_CAP_STYLE : '';
      const style = `transform:matrix3d(${fitted.matrix});--polycss-atlas-width:${formatCssLength(fitted.leafWidth)};--polycss-atlas-height:${formatCssLength(fitted.leafHeight)};background-image:${image};background-position:${position};background-size:${size}${caps}`;
      return { tag: 's', className: className ?? (patch.pole ? `${ns}-polar ${ns}-polar-${patch.pole}${patch.inner ? ` ${ns}-polar-inner` : ''}` : ''), style,
        ...(projective ? { projectiveTextureLayer: { ...prepareProjectiveTextureLayer(fitted.matrix,
          rasterScale(patch, address.backgroundSize[0]!, p.rasterScale)),
          // Surface leaves tile exactly; the body publishes the outset that closes their antialiased seams.
          ...(p.seamOutset && !patch.pole ? { seamOutset: prepareLeafSeamOutset(fitted.matrix, fitted.leafWidth, fitted.leafHeight, 2 * surface.radius * p.tileSize) } : {}) } } : {}),
        polarCap: patch.pole ?? null, longitudeIndex: patch.longitudeIndex ?? null, latitudeIndex: patch.latitudeIndex };
    },
    interior(patch: SurfacePatch, index: number, className: string, dimensions?: readonly [number, number]): PreparedLeaf {
      const geometry = resolve(patch, index, dimensions ? 0 : patch.pole ? 0 : p.interiorSeamBleed);
      const initial = fitTextureGeometry(geometry, dimensions?.[0] ?? patch.textureImageSource.sourceRect.width,
        dimensions?.[1] ?? patch.textureImageSource.sourceRect.height);
      const stable = patch.pole || dimensions ? initial : fitProjectiveTextureGeometryToStableLayout(initial);
      // A section is a plain leaf at its presentation size; core bands and caps are projective.
      const fitted = dimensions ? scalePlainLeafGeometry(stable, rasterScale(patch, stable.backgroundSize[0]!, 1)) : stable;
      const cap = patch.pole && !dimensions;
      if (cap) requireOutwardCap(ns, patch.pole!, fitted.matrix, true);
      return { tag: 's', className,
        style: `transform:matrix3d(${fitted.matrix});background-image:var(--${ns}-${patch.pole ? 'poles' : 'surface'}-image);background-position:${fitted.backgroundPosition.map(value => formatCssLength(value)).join(' ')};background-size:${fitted.backgroundSize.map(value => formatCssLength(value)).join(' ')};--polycss-atlas-width:${fitted.leafWidth}px;--polycss-atlas-height:${fitted.leafHeight}px${dimensions ? ';backface-visibility:visible' : cap ? POLAR_CAP_STYLE : ''}`,
        ...(!dimensions ? { projectiveTextureLayer: prepareProjectiveTextureLayer(fitted.matrix,
          rasterScale(patch, fitted.backgroundSize[0]!, p.rasterScale)), polarCap: patch.pole ?? null } : {}) };
    },
  };
}

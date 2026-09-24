import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, formatCssLength } from '@layoutit/polycss';
import type { ComputeTextureAtlasPlanOptions, Polygon } from '@layoutit/polycss';
import type { SurfacePatch } from '@cssearth/objects';
import { createProjectiveSurfaceRasterPresentation, fitTextureGeometry, fitProjectiveTextureGeometryToStableLayout, prepareProjectiveTextureLayer, polarCapRasterScale } from '../../../../platform/projective-surface-raster.mts';
import type { GeometryProfile } from './profile.js';
import { prepareLeafSeamOutset, type PreparedLeafSeamOutset } from './seam-outset.js';

export interface PreparedLeaf {
  tag: 's'; className: string; style: string; polar?: string | null; polarCap?: string | null;
  longitudeIndex?: number | null; latitudeIndex?: number; longitudeDegrees?: number;
  projectiveTextureLayer?: ReturnType<typeof prepareProjectiveTextureLayer> & { seamOutset?: PreparedLeafSeamOutset };
}
export const rendererPolygon = (patch: SurfacePatch): Polygon => ({ ...patch,
  texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' } });

export function createLeafProjector(profile: GeometryProfile, direction: [number, number, number]) {
  const p = profile.projection, surface = profile.surface, ns = profile.namespace;
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
      const fitted = patch.pole ? initial : fitProjectiveTextureGeometryToStableLayout(initial);
      const raster = patch.pole ? fitted : createProjectiveSurfaceRasterPresentation({
        sourceWidth: surface.surface.width, sourceHeight: surface.surfaceLatitudeHeight,
        sourceRect: patch.surfaceSourceRect ?? patch.textureImageSource.sourceRect,
        addressSourceWidth: patch.textureImageSource.width, addressSourceHeight: patch.textureImageSource.height,
        addressSourceRect: patch.textureImageSource.sourceRect, backgroundPosition: fitted.backgroundPosition,
        backgroundSize: fitted.backgroundSize, leafWidth: fitted.leafWidth, leafHeight: fitted.leafHeight,
        bandCount: surface.latitudeSegments, gutter: p.rasterGutter, overscan: p.rasterOverscan });
      const position = raster.backgroundPosition.map(value => value === 0 ? '0px' : formatCssLength(value)).join(' ');
      const size = raster.backgroundSize.map(formatCssLength).join(' ');
      const variable = patch.pole ? `--${ns}-pole-position` : `--${ns}-surface-position`;
      // A polar cap closes the top of the band mesh. Its fitted plate can come out with the opposite winding to the
      // bands around it, and a culled cap leaves a hole at the pole through which the body's interior fill shows as a
      // flat disc. A cap is only ever seen from outside the body, so it is drawn from both sides.
      const caps = patch.pole ? ';backface-visibility:visible' : '';
      const style = p.positionVariables
        ? `transform:matrix3d(${fitted.matrix});${variable}:${position};background-position:var(${variable});background-size:${size};--polycss-atlas-width:${fitted.leafWidth}px;--polycss-atlas-height:${fitted.leafHeight}px${caps}`
        : `transform:matrix3d(${fitted.matrix});--polycss-atlas-width:${formatCssLength(fitted.leafWidth)};--polycss-atlas-height:${formatCssLength(fitted.leafHeight)};background-image:url(${fitted.url});background-position:${position};background-size:${size}${caps}`;
      return { tag: 's', className: className ?? (patch.pole ? `${ns}-polar ${ns}-polar-${patch.pole}${patch.inner ? ` ${ns}-polar-inner` : ''}` : ''), style,
        ...(!patch.pole || p.projectivePoles ? { projectiveTextureLayer: { ...prepareProjectiveTextureLayer(fitted.matrix,
          patch.pole ? polarCapRasterScale(p.rasterScale, patch.textureImageSource.sourceRect.width, fitted.leafWidth) : p.rasterScale),
          // Surface leaves tile exactly; the body publishes the outset that closes their antialiased seams.
          ...(p.seamOutset && !patch.pole ? { seamOutset: prepareLeafSeamOutset(fitted.matrix, fitted.leafWidth, fitted.leafHeight, 2 * surface.radius * p.tileSize) } : {}) } } : {}),
        ...(p.positionVariables ? { polar: patch.pole ?? null } : { polarCap: patch.pole ?? null, longitudeIndex: patch.longitudeIndex ?? null, latitudeIndex: patch.latitudeIndex }) };
    },
    interior(patch: SurfacePatch, index: number, className: string, dimensions?: readonly [number, number]): PreparedLeaf {
      const geometry = resolve(patch, index, dimensions ? 0 : patch.pole ? 0 : p.interiorSeamBleed);
      const initial = fitTextureGeometry(geometry, dimensions?.[0] ?? patch.textureImageSource.sourceRect.width,
        dimensions?.[1] ?? patch.textureImageSource.sourceRect.height);
      const fitted = patch.pole || dimensions ? initial : fitProjectiveTextureGeometryToStableLayout(initial);
      return { tag: 's', className,
        style: `transform:matrix3d(${fitted.matrix});background-position:${fitted.backgroundPosition.map(formatCssLength).join(' ')};background-size:${fitted.backgroundSize.map(formatCssLength).join(' ')};--polycss-atlas-width:${fitted.leafWidth}px;--polycss-atlas-height:${fitted.leafHeight}px${dimensions ? ';backface-visibility:visible' : ''}`,
        ...(!dimensions ? { projectiveTextureLayer: prepareProjectiveTextureLayer(fitted.matrix,
          patch.pole ? polarCapRasterScale(p.rasterScale, patch.textureImageSource.sourceRect.width, fitted.leafWidth) : p.rasterScale), polar: patch.pole ?? null } : {}) };
    },
  };
}

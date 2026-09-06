import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, formatCssLength } from '@layoutit/polycss';
import type { ComputeTextureAtlasPlanOptions, PolyTextureLeafGeometry, Polygon } from '@layoutit/polycss';
import type { SurfacePatch } from '@cssearth/objects';
import { createProjectiveSurfaceRasterPresentation, fitProjectiveTextureGeometryToStableLayout, prepareProjectiveTextureLayer } from './projective.js';
import type { GeometryProfile } from './profile.js';

export interface PreparedLeaf {
  tag: 's'; className: string; style: string; polar?: string | null; polarCap?: string | null;
  longitudeIndex?: number | null; latitudeIndex?: number; longitudeDegrees?: number;
  projectiveTextureLayer?: ReturnType<typeof prepareProjectiveTextureLayer>;
}
export const rendererPolygon = (patch: SurfacePatch): Polygon => ({ ...patch,
  texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' } });

export function fitSourceGeometry(geometry: PolyTextureLeafGeometry, leafWidth: number, leafHeight: number): PolyTextureLeafGeometry {
  const matrix = String(geometry.matrix).split(',').map(Number);
  if (matrix.length !== 16 || matrix.some(value => !Number.isFinite(value))) throw new TypeError('Texture matrix is invalid.');
  const scaleX = geometry.leafWidth / leafWidth, scaleY = geometry.leafHeight / leafHeight;
  for (const index of [0, 1, 2, 3]) matrix[index] *= scaleX;
  for (const index of [4, 5, 6, 7]) matrix[index] *= scaleY;
  const rasterX = leafWidth / geometry.leafWidth, rasterY = leafHeight / geometry.leafHeight;
  return { ...geometry, matrix: matrix.map(value => Number(value.toFixed(6))).join(','), leafWidth, leafHeight,
    backgroundPosition: [geometry.backgroundPosition[0] * rasterX, geometry.backgroundPosition[1] * rasterY],
    backgroundSize: [geometry.backgroundSize[0] * rasterX, geometry.backgroundSize[1] * rasterY] };
}

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
      const initial = p.fitToSource ? fitSourceGeometry(geometry, patch.textureImageSource.sourceRect.width, patch.textureImageSource.sourceRect.height) : geometry;
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
      const style = p.positionVariables
        ? `transform:matrix3d(${fitted.matrix});${variable}:${position};background-position:var(${variable});background-size:${size};--polycss-atlas-width:${fitted.leafWidth}px;--polycss-atlas-height:${fitted.leafHeight}px`
        : `transform:matrix3d(${fitted.matrix});--polycss-atlas-width:${formatCssLength(fitted.leafWidth)};--polycss-atlas-height:${formatCssLength(fitted.leafHeight)};background-image:url(${fitted.url});background-position:${position};background-size:${size}`;
      return { tag: 's', className: className ?? (patch.pole ? `${ns}-polar ${ns}-polar-${patch.pole}${patch.inner ? ` ${ns}-polar-inner` : ''}` : ''), style,
        ...(!patch.pole || p.projectivePoles ? { projectiveTextureLayer: prepareProjectiveTextureLayer(fitted.matrix, p.rasterScale) } : {}),
        ...(p.positionVariables ? { polar: patch.pole ?? null } : { polarCap: patch.pole ?? null, longitudeIndex: patch.longitudeIndex ?? null, latitudeIndex: patch.latitudeIndex }) };
    },
    interior(patch: SurfacePatch, index: number, className: string, dimensions?: readonly [number, number]): PreparedLeaf {
      const geometry = resolve(patch, index, dimensions ? 0 : patch.pole ? 0 : p.interiorSeamBleed);
      const initial = fitSourceGeometry(geometry, dimensions?.[0] ?? patch.textureImageSource.sourceRect.width,
        dimensions?.[1] ?? patch.textureImageSource.sourceRect.height);
      const fitted = patch.pole || dimensions ? initial : fitProjectiveTextureGeometryToStableLayout(initial);
      return { tag: 's', className,
        style: `transform:matrix3d(${fitted.matrix});background-position:${fitted.backgroundPosition.map(formatCssLength).join(' ')};background-size:${fitted.backgroundSize.map(formatCssLength).join(' ')};--polycss-atlas-width:${fitted.leafWidth}px;--polycss-atlas-height:${fitted.leafHeight}px${dimensions ? ';backface-visibility:visible' : ''}`,
        ...(!dimensions ? { projectiveTextureLayer: prepareProjectiveTextureLayer(fitted.matrix, p.rasterScale), polar: patch.pole ?? null } : {}) };
    },
  };
}

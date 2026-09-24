export type Point3 = [number, number, number];
export type Point2 = [number, number];
export type Pole = 'north' | 'south';
export interface RasterRectangle { x: number; y: number; width: number; height: number; }
export interface RasterReference { url: string; width: number; height: number; }
export interface SurfacePatch {
  vertices: Point3[]; uvs: Point2[]; texture: string;
  textureImageSource: RasterReference & { sourceRect: RasterRectangle };
  surfaceSourceRect?: RasterRectangle; color: string;
  latitudeIndex: number; longitudeIndex?: number; pole?: Pole; inner?: boolean;
}
export interface SurfaceGeometryProfile {
  radius: number; polarRadius: number; latitudeSegments: number; longitudeSegments: number;
  surface: RasterReference; surfaceLatitudeHeight: number; packedBandGutter: number;
  poles: RasterReference; polarTileSize: number; polarRadiusScale: number; polarOffset: number;
  innerPoles?: { radiusScale: number; offset: number };
  uv: 'global' | 'cell'; color: string; closeSeamAtZero?: boolean;
}

/** Numeric ellipsoid patches and source rectangles, independent of any renderer. */
export function ellipsoidPoint(radius: number, polarRadius: number, latitude: number, longitude: number): Point3 {
  const latitudeRadius = Math.cos(latitude);
  return [radius * latitudeRadius * Math.cos(longitude), radius * latitudeRadius * Math.sin(longitude),
    polarRadius * Math.sin(latitude)];
}

export function createPolarPatch(profile: SurfaceGeometryProfile, pole: Pole, inner = false): SurfacePatch {
  const north = pole === 'north', sign = north ? 1 : -1;
  const boundaryLatitude = Math.PI / 2 - Math.PI / profile.latitudeSegments;
  const parameters = inner ? profile.innerPoles : { radiusScale: profile.polarRadiusScale, offset: profile.polarOffset };
  if (!parameters) throw new TypeError('Inner polar patches need a prepared profile.');
  const radius = profile.radius * Math.cos(boundaryLatitude) * parameters.radiusScale;
  const z = sign * (profile.polarRadius * Math.sin(boundaryLatitude) + parameters.offset);
  return {
    latitudeIndex: north ? profile.latitudeSegments - 1 : 0, pole, inner,
    vertices: north ? [[-radius, -radius, z], [radius, -radius, z], [radius, radius, z], [-radius, radius, z]]
      : [[-radius, radius, z], [radius, radius, z], [radius, -radius, z], [-radius, -radius, z]],
    uvs: north ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: profile.poles.url, textureImageSource: { ...profile.poles,
      sourceRect: { x: north ? 0 : profile.polarTileSize, y: 0, width: profile.polarTileSize, height: profile.polarTileSize } },
    color: profile.color,
  };
}

/** `texelsPerUnit`: raster texels per surface unit. The overlap is rounded to whole texels per axis, because the renderer
 * sizes each patch's texture in whole texels: a fractional growth would rescale it and shift texels across the map. */
export function createSurfacePatches(profile: SurfaceGeometryProfile, overlap = 0, texelsPerUnit = 1): SurfacePatch[] {
  if (![profile.radius, profile.polarRadius, profile.surface.width, profile.surfaceLatitudeHeight,
    profile.poles.width, profile.poles.height, profile.polarTileSize].every(value => Number.isFinite(value) && value > 0) ||
    !Number.isInteger(profile.latitudeSegments) || profile.latitudeSegments < 3 ||
    !Number.isInteger(profile.longitudeSegments) || profile.longitudeSegments < 3 ||
    !Number.isFinite(overlap) || overlap < 0 || overlap > .5 || !(texelsPerUnit > 0) ||
    !Number.isFinite(profile.packedBandGutter) || profile.packedBandGutter < 0) {
    throw new TypeError('Surface patches need finite dimensions, bounded overlap and valid segmentation.');
  }
  const output: SurfacePatch[] = [];
  const cellWidth = profile.surface.width / profile.longitudeSegments;
  const cellHeight = profile.surfaceLatitudeHeight / profile.latitudeSegments;
  const wholeTexels = (cell: number) => Math.round(overlap * cell * texelsPerUnit) / (cell * texelsPerUnit);
  const overlapX = wholeTexels(cellWidth), overlapY = wholeTexels(cellHeight);
  for (let latitudeIndex = 0; latitudeIndex < profile.latitudeSegments; latitudeIndex++) {
    if (latitudeIndex === 0 || latitudeIndex === profile.latitudeSegments - 1) {
      output.push(createPolarPatch(profile, latitudeIndex === 0 ? 'south' : 'north')); continue;
    }
    const v0 = latitudeIndex / profile.latitudeSegments, v1 = (latitudeIndex + 1) / profile.latitudeSegments;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI, latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0; longitudeIndex < profile.longitudeSegments; longitudeIndex++) {
      const u0 = longitudeIndex / profile.longitudeSegments, u1 = (longitudeIndex + 1) / profile.longitudeSegments;
      const latitudeOverlap = Math.PI / profile.latitudeSegments * overlapY;
      const longitudeOverlap = Math.PI * 2 / profile.longitudeSegments * overlapX;
      const lowLatitude = latitude0 - latitudeOverlap, highLatitude = latitude1 + latitudeOverlap;
      const lowLongitude = u0 * Math.PI * 2 - longitudeOverlap;
      const highLongitude = profile.closeSeamAtZero !== false && overlapX === 0 && longitudeIndex === profile.longitudeSegments - 1 ? 0 : u1 * Math.PI * 2 + longitudeOverlap;
      // The overlap enlarges the patch by a fraction of its cell on every side; its texture grows by the same fraction,
      // read from the packed gutters, so neighbours place every texel where the other does instead of stretching it.
      const sourceRect = { x: (longitudeIndex - overlapX) * cellWidth, y: (profile.latitudeSegments - 1 - latitudeIndex - overlapY) * cellHeight,
        width: cellWidth * (1 + 2 * overlapX), height: cellHeight * (1 + 2 * overlapY) };
      output.push({ latitudeIndex, longitudeIndex,
        vertices: [ellipsoidPoint(profile.radius, profile.polarRadius, lowLatitude, lowLongitude),
          ellipsoidPoint(profile.radius, profile.polarRadius, lowLatitude, highLongitude),
          ellipsoidPoint(profile.radius, profile.polarRadius, highLatitude, highLongitude),
          ellipsoidPoint(profile.radius, profile.polarRadius, highLatitude, lowLongitude)],
        uvs: profile.uv === 'global' ? [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] : [[0, 0], [1, 0], [1, 1], [0, 1]],
        texture: profile.surface.url, surfaceSourceRect: sourceRect,
        textureImageSource: { ...profile.surface, sourceRect: { ...sourceRect,
          y: (profile.latitudeSegments - 1 - latitudeIndex) * (cellHeight + 2 * profile.packedBandGutter) + profile.packedBandGutter - overlapY * cellHeight } },
        color: profile.color,
      });
    }
  }
  return output;
}

export function outsideCutaway(patch: SurfacePatch, longitudeSegments: number, centreDegrees: number, widthDegrees: number): boolean {
  if (patch.pole !== undefined) return true;
  if (patch.longitudeIndex === undefined || !Number.isFinite(centreDegrees) || !(widthDegrees > 0 && widthDegrees < 360)) {
    throw new TypeError('A cutaway needs a longitude-addressed surface and bounded angular width.');
  }
  const longitude = (patch.longitudeIndex + .5) * 360 / longitudeSegments;
  const delta = ((longitude - centreDegrees + 180) % 360 + 360) % 360 - 180;
  return Math.abs(delta) > widthDegrees / 2;
}

export function createSectionPatch(radius: number, longitudeDegrees: number, source: RasterReference, index: number, color: string): SurfacePatch {
  const longitude = longitudeDegrees * Math.PI / 180, x = Math.cos(longitude) * radius, y = Math.sin(longitude) * radius;
  return { latitudeIndex: 0, vertices: [[0, 0, -radius], [x, y, -radius], [x, y, radius], [0, 0, radius]],
    uvs: [[0, 1], [1, 1], [1, 0], [0, 0]], texture: source.url,
    textureImageSource: { ...source, sourceRect: { x: index * source.width / 2, y: 0, width: source.width / 2, height: source.height } }, color };
}

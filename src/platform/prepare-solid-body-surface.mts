import type { Polygon, Vec3, Vec2, ComputeTextureAtlasPlanOptions } from "@layoutit/polycss";
import type { RasterRect } from "./projective-surface-raster.mts";
interface SurfaceRasterOptions { width: number; height: number; latitudeSegments?: number; longitudeSegments?: number; seamOverlap?: number; sampling?: "bilinear" | "nearest"; }
interface PoleRasterOptions extends SurfaceRasterOptions { tileSize?: number; radius?: number; polarRadius?: number; }
interface SolidSurfaceOptions { id: string; radius?: number; polarRadius?: number; secondaryRadius?: number; mapUrl: string; polesUrl: string; latitudeSegments?: number; longitudeSegments?: number; sourceWidth?: number; sourceHeight?: number; poleTileSize?: number; seamOverlap?: number; gutter?: number;
  /** Pixel widths of the widest surface and pole images any lens binds to these leaves, measured from the published files:
   * each leaf holds its image at TEXELS_PER_CSS_PIXEL (leafRasterScale). */
  mapPixelWidth: number; polesPixelWidth: number; }
type SurfacePolygon = Polygon & { latitudeIndex: number; longitudeIndex?: number; polar?: string; inner?: boolean; className?: string; textureImageSource: { url: string; width: number; height: number; sourceRect: RasterRect } };
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, formatCssLength } from "@layoutit/polycss";
import { createProjectiveSurfaceRasterPresentation, fitTextureGeometry, fitProjectiveTextureGeometryToStableLayout, leafRasterScale, prepareProjectiveTextureLayer } from "./projective-surface-raster.mts";

// A latitude trapezoid uses projective UVs: tan(latitude), rather than latitude,
// varies linearly down its texture. Bake the inverse mapping into each band so
// the published equirectangular image lands at the correct surface coordinates.
export function reprojectSolidBodySurfaceRaster(source: Buffer, { width, height,
  latitudeSegments = 16, longitudeSegments = 32, seamOverlap = 0.005, sampling = "bilinear" }: SurfaceRasterOptions) {
  if (!["bilinear", "nearest"].includes(sampling)) throw new TypeError("Unsupported surface raster sampling.");
  const output = Buffer.from(source);
  const cellWidth = width / longitudeSegments, cellHeight = height / latitudeSegments;
  const latitudeStep = Math.PI / latitudeSegments, longitudeStep = 2 * Math.PI / longitudeSegments;
  const columns = Array.from({ length: width }, (_, x) => {
    const cell = Math.floor(x / cellWidth), u = (x % cellWidth + 0.5) / cellWidth;
    const left = (cell - seamOverlap) * longitudeStep, right = (cell + 1 + seamOverlap) * longitudeStep;
    const px = (1 - u) * Math.cos(left) + u * Math.cos(right);
    const py = (1 - u) * Math.sin(left) + u * Math.sin(right);
    return { longitude: Math.atan2(py, px), radius: Math.hypot(px, py) };
  });
  for (let band = 1; band < latitudeSegments - 1; band++) {
    const north = Math.PI / 2 - (band - seamOverlap) * latitudeStep;
    const south = Math.PI / 2 - (band + 1 + seamOverlap) * latitudeStep;
    for (let row = 0; row < cellHeight; row++) {
      const t = 1 - (row + 0.5) / cellHeight;
      const z = (1 - t) * Math.tan(south) + t * Math.tan(north);
      for (let x = 0; x < width; x++) {
        const column = columns[x];
        sampleMap(source, width, height, column.longitude, Math.atan2(z, column.radius),
          output, ((band * cellHeight + row) * width + x) * 4, sampling);
      }
    }
  }
  return output;
}

export function prepareSolidBodyPoleRaster(source: Buffer, { width, height, tileSize = 512,
  radius = 230, polarRadius = radius, latitudeSegments = 16, sampling = "bilinear" }: PoleRasterOptions) {
  if (!["bilinear", "nearest"].includes(sampling)) throw new TypeError("Unsupported pole raster sampling.");
  const output = Buffer.alloc(tileSize * tileSize * 2 * 4);
  const boundary = Math.PI / 2 - Math.PI / latitudeSegments;
  const capRadius = radius * Math.cos(boundary) * 1.035;
  const capHeight = polarRadius * Math.sin(boundary) + 0.1;
  for (let pole = 0; pole < 2; pole++) for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
    const dx = (x + 0.5) / tileSize * 2 - 1, dy = (y + 0.5) / tileSize * 2 - 1;
    const r = Math.hypot(dx, dy);
    if (r > 1) continue;
    sampleMap(source, width, height, Math.atan2(pole === 0 ? dy : -dy, dx),
      (pole === 0 ? 1 : -1) * Math.atan2(capHeight / polarRadius, r * capRadius / radius),
      output, (y * tileSize * 2 + pole * tileSize + x) * 4, sampling);
  }
  return output;
}

function sampleMap(source: Buffer, width: number, height: number, longitude: number, latitude: number, output: Buffer, offset: number, sampling: "bilinear" | "nearest") {
  const sx = ((longitude / (2 * Math.PI) + 1) % 1) * width - 0.5;
  const sy = Math.max(0, Math.min(height - 1, (0.5 - latitude / Math.PI) * height - 0.5));
  // Category IDs have already become presentation colors: select one source
  // cell, never a new mixture that can be mistaken for a different map unit.
  if (sampling === "nearest") {
    const x = (Math.floor(sx + 0.5) + width) % width;
    const y = Math.min(height - 1, Math.floor(sy + 0.5));
    source.copy(output, offset, (y * width + x) * 4, (y * width + x + 1) * 4);
    return;
  }
  const x0 = (Math.floor(sx) + width) % width, x1 = (x0 + 1) % width;
  const y0 = Math.floor(sy), y1 = Math.min(height - 1, y0 + 1);
  const u = sx - Math.floor(sx), v = sy - y0;
  for (let channel = 0; channel < 4; channel++) {
    const top = source[(y0 * width + x0) * 4 + channel] * (1 - u) + source[(y0 * width + x1) * 4 + channel] * u;
    const bottom = source[(y1 * width + x0) * 4 + channel] * (1 - u) + source[(y1 * width + x1) * 4 + channel] * u;
    output[offset + channel] = Math.round(top * (1 - v) + bottom * v);
  }
}

/** The largest raster scale a solid-body leaf takes: the scale every band leaf had before the texel rule. A leaf whose image
 * holds more than two texels per CSS pixel at this scale keeps it. */
const SOLID_SURFACE_RASTER_CEILING = 4;

// Mercury's projective latitude-band geometry, parameterized for solid bodies.
// All mesh construction runs during preparation; the runtime receives leaves.
export function prepareSolidBodySurface({ id, radius = 230, polarRadius = radius, secondaryRadius = radius,
  mapUrl, polesUrl, latitudeSegments = 16, longitudeSegments = 32,
  sourceWidth = 2048, sourceHeight = 1024, poleTileSize = 256, seamOverlap = 0.005,
  gutter = sourceHeight / latitudeSegments / 4, mapPixelWidth, polesPixelWidth }: SolidSurfaceOptions) {
  if (![mapPixelWidth, polesPixelWidth].every(width => Number.isFinite(width) && width > 0)) {
    throw new TypeError(`${id}: solid-body leaves need the measured pixel widths of their widest map and pole images, not mapPixelWidth=${mapPixelWidth}, polesPixelWidth=${polesPixelWidth}.`);
  }
  const cellWidth = sourceWidth / longitudeSegments, cellHeight = sourceHeight / latitudeSegments;
  const planOptions: ComputeTextureAtlasPlanOptions & { textureLighting: "baked" } = { tileSize: 50, layerElevation: 50, textureLighting: "baked", seamBleed: 0 };
  const polygons = createSpherePolygons(seamOverlap);
  return [...polygons, ...["north", "south"].map(pole => createPolarCapPolygon(pole, true))]
    .map((polygon, index) => prepareLeaf(polygon, index));
  function spherePoint(latitude: number, longitude: number): Vec3 {
    const latitudeRadius = Math.cos(latitude);
    return [
      radius * latitudeRadius * Math.cos(longitude),
      secondaryRadius * latitudeRadius * Math.sin(longitude),
      polarRadius * Math.sin(latitude),
    ];
  }

  function createSpherePolygons(overlap: number): SurfacePolygon[] {
    const output: SurfacePolygon[] = [];
    for (let latitudeIndex = 0; latitudeIndex < latitudeSegments; latitudeIndex += 1) {
      if (latitudeIndex === 0 || latitudeIndex === latitudeSegments - 1) {
        output.push(createPolarCapPolygon(
          latitudeIndex === 0 ? "south" : "north",
          false,
        ));
        continue;
      }
      const v0 = latitudeIndex / latitudeSegments;
      const v1 = (latitudeIndex + 1) / latitudeSegments;
      const latitude0 = -Math.PI / 2 + v0 * Math.PI;
      const latitude1 = -Math.PI / 2 + v1 * Math.PI;
      for (let longitudeIndex = 0; longitudeIndex < longitudeSegments; longitudeIndex += 1) {
        const u0 = longitudeIndex / longitudeSegments;
        const u1 = (longitudeIndex + 1) / longitudeSegments;
        const latitudeOverlap = Math.PI / latitudeSegments * overlap;
        const longitudeOverlap = Math.PI * 2 / longitudeSegments * overlap;
        const surfaceLatitude0 = latitude0 - latitudeOverlap;
        const surfaceLatitude1 = latitude1 + latitudeOverlap;
        const surfaceLongitude0 = u0 * Math.PI * 2 - longitudeOverlap;
        const surfaceLongitude1 = overlap === 0 &&
            longitudeIndex === longitudeSegments - 1
          ? 0
          : u1 * Math.PI * 2 + longitudeOverlap;
        output.push({
          latitudeIndex,
          longitudeIndex,
          vertices: [
            spherePoint(surfaceLatitude0, surfaceLongitude0),
            spherePoint(surfaceLatitude0, surfaceLongitude1),
            spherePoint(surfaceLatitude1, surfaceLongitude1),
            spherePoint(surfaceLatitude1, surfaceLongitude0),
          ],
          uvs: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
          texture: mapUrl,
          textureImageSource: {
            url: mapUrl,
            width: sourceWidth,
            height: sourceHeight,
            sourceRect: {
              x: longitudeIndex * cellWidth,
              y: (latitudeSegments - 1 - latitudeIndex) * cellHeight,
              width: cellWidth,
              height: cellHeight,
            },
          },
          texturePresentation: {
            backend: "image",
            lighting: "source",
            projection: "projective",
          },
          color: "#888888",
        });
      }
    }
    return output;
  }

  function createPolarCapPolygon(pole: string, inner: boolean): SurfacePolygon {
    const north = pole === "north";
    const sign = north ? 1 : -1;
    const boundaryLatitude = Math.PI / 2 - Math.PI / latitudeSegments;
    const boundaryRadius = radius * Math.cos(boundaryLatitude);
    const capRadius = boundaryRadius * (inner ? 1.05 : 1.035);
    const z = sign * (polarRadius * Math.sin(boundaryLatitude) +
      (inner ? -2.4 : 0.1));
    const vertices: Vec3[] = north
      ? [[-capRadius, -capRadius, z], [capRadius, -capRadius, z],
        [capRadius, capRadius, z], [-capRadius, capRadius, z]]
      : [[-capRadius, capRadius, z], [capRadius, capRadius, z],
        [capRadius, -capRadius, z], [-capRadius, -capRadius, z]];
    const uvs: Vec2[] = north
      ? [[0, 0], [1, 0], [1, 1], [0, 1]]
      : [[0, 1], [1, 1], [1, 0], [0, 0]];
    const sourceX = (north ? 0 : 1) * poleTileSize;
    return {
      latitudeIndex: north ? latitudeSegments - 1 : 0,
      polar: pole,
      inner,
      vertices,
      uvs,
      texture: polesUrl,
      textureImageSource: {
        url: polesUrl,
        width: poleTileSize * 2,
        height: poleTileSize,
        sourceRect: {
          x: sourceX,
          y: 0,
          width: poleTileSize,
          height: poleTileSize,
        },
      },
      texturePresentation: {
        backend: "image",
        lighting: "source",
        projection: "projective",
      },
      color: "#888888",
    };
  }

  function prepareLeaf(polygon: SurfacePolygon, index: number) {
    if (polygon.polar && secondaryRadius !== radius) polygon = { ...polygon, vertices: polygon.vertices.map(([x, y, z]) => [x, y * secondaryRadius / radius, z]) };
    const plan = computeTextureAtlasPlanPublic(polygon, index, {
      ...planOptions,
    });
    const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
      backend: "image",
      lighting: "source",
      projection: "projective",
    });
    if (!geometry) throw new Error(`Solid-body texture leaf ${index} did not prepare.`);
    const sourceFitted = fitTextureGeometry(
      geometry,
      polygon.polar ? poleTileSize : cellWidth,
      polygon.polar ? poleTileSize : cellHeight,
    );
    const fitted = polygon.polar
      ? sourceFitted
      : fitProjectiveTextureGeometryToStableLayout(sourceFitted);
    const rasterPresentation = polygon.polar
      ? fitted
      : createProjectiveSurfaceRasterPresentation({
        sourceWidth: sourceWidth,
        sourceHeight: sourceHeight,
        sourceRect: polygon.textureImageSource.sourceRect,
        addressSourceWidth: polygon.textureImageSource.width,
        addressSourceHeight: polygon.textureImageSource.height,
        addressSourceRect: polygon.textureImageSource.sourceRect,
        backgroundPosition: fitted.backgroundPosition,
        backgroundSize: fitted.backgroundSize,
        leafWidth: fitted.leafWidth,
        leafHeight: fitted.leafHeight,
        bandCount: latitudeSegments,
        gutter: gutter,
        overscan: 0,
      });
    const backgroundPosition = rasterPresentation.backgroundPosition
      .map((value) => value === 0 ? "0px" : formatCssLength(value))
      .join(" ");
    const backgroundSize = rasterPresentation.backgroundSize
      .map((value) => formatCssLength(value)).join(" ");
    const variable = polygon.polar
      ? `--${id}-pole-position:${backgroundPosition};`
      : `--${id}-surface-position:${backgroundPosition};`;
    return Object.freeze({
      tag: "s",
      className: polygon.className ?? (polygon.polar
        ? `${id}-polar ${id}-polar-${polygon.polar}${polygon.inner ? ` ${id}-polar-inner` : ""}`
        : ""),
      style: `transform:matrix3d(${fitted.matrix});${variable}` +
        `background-position:var(${polygon.polar ? `--${id}-pole-position` : `--${id}-surface-position`});` +
        `background-size:${backgroundSize};` +
        `--polycss-atlas-width:${fitted.leafWidth}px;` +
        `--polycss-atlas-height:${fitted.leafHeight}px`,
      // Each leaf holds its widest image at two texels per CSS pixel (leafRasterScale), capped at the lane's former fixed scale.
      // Haumea's 3096-px maps on a 1548-px band background keep the 32 × 24 layout box where scale 4 drew 128 × 96.
      projectiveTextureLayer: prepareProjectiveTextureLayer(
        fitted.matrix,
        leafRasterScale(polygon.polar ? polesPixelWidth : mapPixelWidth, rasterPresentation.backgroundSize[0]!, SOLID_SURFACE_RASTER_CEILING),
      ),
      polar: polygon.polar ?? null,
    });
  }
}

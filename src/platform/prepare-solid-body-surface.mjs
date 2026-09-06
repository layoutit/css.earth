import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, formatCssLength } from "@layoutit/polycss";
import { createProjectiveSurfaceRasterPresentation, fitProjectiveTextureGeometryToStableLayout, prepareProjectiveTextureLayer } from "./projective-surface-raster.mjs";

// Mercury's projective latitude-band geometry, parameterized for solid bodies.
// All mesh construction runs during preparation; the runtime receives leaves.
export function prepareSolidBodySurface({ id, radius = 230, polarRadius = radius,
  mapUrl, polesUrl, latitudeSegments = 16, longitudeSegments = 32 }) {
  const sourceWidth = 2048, sourceHeight = 1024, poleTileSize = 256;
  const cellWidth = sourceWidth / longitudeSegments, cellHeight = sourceHeight / latitudeSegments;
  const gutter = cellHeight / 4;
  const planOptions = { tileSize: 50, layerElevation: 50, textureLighting: "baked", seamBleed: 0 };
  const polygons = createSpherePolygons(0.005);
  return [...polygons, ...["north", "south"].map(pole => createPolarCapPolygon(pole, true))]
    .map((polygon, index) => prepareLeaf(polygon, index));
  function spherePoint(latitude, longitude) {
    const latitudeRadius = Math.cos(latitude);
    return [
      radius * latitudeRadius * Math.cos(longitude),
      radius * latitudeRadius * Math.sin(longitude),
      polarRadius * Math.sin(latitude),
    ];
  }

  function createSpherePolygons(overlap) {
    const output = [];
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

  function createPolarCapPolygon(pole, inner) {
    const north = pole === "north";
    const sign = north ? 1 : -1;
    const boundaryLatitude = Math.PI / 2 - Math.PI / latitudeSegments;
    const boundaryRadius = radius * Math.cos(boundaryLatitude);
    const capRadius = boundaryRadius * (inner ? 1.05 : 1.035);
    const z = sign * (polarRadius * Math.sin(boundaryLatitude) +
      (inner ? -2.4 : 0.1));
    const vertices = north
      ? [[-capRadius, -capRadius, z], [capRadius, -capRadius, z],
        [capRadius, capRadius, z], [-capRadius, capRadius, z]]
      : [[-capRadius, capRadius, z], [capRadius, capRadius, z],
        [capRadius, -capRadius, z], [-capRadius, -capRadius, z]];
    const uvs = north
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

  function prepareLeaf(polygon, index) {
    const plan = computeTextureAtlasPlanPublic(polygon, index, {
      ...planOptions,
    });
    const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
      backend: "image",
      lighting: "source",
      projection: "projective",
    });
    if (!geometry) throw new Error(`Solid-body texture leaf ${index} did not prepare.`);
    const sourceFitted = fitGeometry(
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
      .map(formatCssLength).join(" ");
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
      projectiveTextureLayer: prepareProjectiveTextureLayer(
        fitted.matrix,
        4,
      ),
      polar: polygon.polar ?? null,
    });
  }

  function fitGeometry(geometry, leafWidth, leafHeight) {
    const matrix = String(geometry.matrix).split(",").map(Number);
    if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
      throw new Error("Solid-body texture matrix is invalid.");
    }
    const matrixScaleX = geometry.leafWidth / leafWidth;
    const matrixScaleY = geometry.leafHeight / leafHeight;
    for (const index of [0, 1, 2, 3]) matrix[index] *= matrixScaleX;
    for (const index of [4, 5, 6, 7]) matrix[index] *= matrixScaleY;
    const rasterScaleX = leafWidth / geometry.leafWidth;
    const rasterScaleY = leafHeight / geometry.leafHeight;
    return {
      ...geometry,
      matrix: matrix.map((value) => Number(value.toFixed(6))).join(","),
      leafWidth,
      leafHeight,
      backgroundPosition: [
        geometry.backgroundPosition[0] * rasterScaleX,
        geometry.backgroundPosition[1] * rasterScaleY,
      ],
      backgroundSize: [
        geometry.backgroundSize[0] * rasterScaleX,
        geometry.backgroundSize[1] * rasterScaleY,
      ],
    };
  }

}

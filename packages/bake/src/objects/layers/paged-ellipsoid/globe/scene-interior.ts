import {requireFiniteNumber} from '@cssearth/core';
import type { RasterPolygon } from '../scene-contract.ts';
import type { PagedSceneContext } from './scene-context.ts';
import { countLeaves, groupPreparedEntries, prepareSphereLeaves, textureStyle } from './scene-leaves.ts';

export function normalizeDegrees(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function interiorLongitudeRemoved(ctx: PagedSceneContext, longitudeDegrees: number) {
  const { INTERIOR_CUTAWAY } = ctx;
  return Math.abs(normalizeDegrees(
    longitudeDegrees - INTERIOR_CUTAWAY.centerLongitudeDegrees,
  )) <= INTERIOR_CUTAWAY.widthDegrees / 2;
}

export function prepareInteriorPlan(ctx: PagedSceneContext) {
  const { profile, interiorSource, BODY_LATITUDE_SEGMENTS, BODY_LONGITUDE_SEGMENTS, EQUATORIAL_RADIUS, INTERIOR_LATITUDE_SEGMENTS, INTERIOR_LONGITUDE_SEGMENTS, surfacePageUrls, POLAR_RADIUS, INTERIOR_CUTAWAY, bodyConfig, surfaceRasterPlan } = ctx;
  const outerEntries = prepareSphereLeaves(ctx, {
    ...bodyConfig,
    polarCapBandSpan: 1,
    poles: Object.freeze({
      ...bodyConfig.poles,
      width: 256,
      height: 128,
    }),
  }).filter((entry) => {
    if (typeof entry.longitudeIndex === "number" && Number.isSafeInteger(entry.longitudeIndex)) {
      return !interiorLongitudeRemoved(ctx,
        (entry.longitudeIndex + 0.5) * 360 / BODY_LONGITUDE_SEGMENTS,
      );
    }
    return entry.polarCap;
  }).map((entry) => Object.freeze({
    ...entry,
    leaf: Object.freeze({
      ...entry.leaf,
      ...(entry.polarCap ? {
        className: `${profile.namespace}-interior-outer-polar ${profile.namespace}-interior-outer-polar-${entry.polarCap}`,
        asset: Object.freeze({
          one: `${profile.publicBase}${profile.namespace}-interior-outer-poles.webp`,
          two: `${profile.publicBase}${profile.namespace}-interior-outer-poles@2x.webp`,
        }),
      } : {}),
    }),
  }));
  const outerBodyBands = groupPreparedEntries(
    outerEntries,
    BODY_LATITUDE_SEGMENTS,
    72,
  );
  const shellLayers = interiorSource.layers.slice(1);
  const shells = Object.freeze(shellLayers.map((layer, index) => {
    const radiusScale = layer.outerRadiusKm / requireFiniteNumber(interiorSource[profile.interiorRadiusKey], "Interior radius");
    const cutaway = interiorSource.presentation?.cutThroughCenter || index < shellLayers.length - 1;
    const id = layer.id;
    const config = Object.freeze({
      latitudeSegments: INTERIOR_LATITUDE_SEGMENTS,
      longitudeSegments: INTERIOR_LONGITUDE_SEGMENTS,
      equatorialRadius: EQUATORIAL_RADIUS * radiusScale,
      polarRadius: POLAR_RADIUS * radiusScale,
      texture: Object.freeze({
        one: `${profile.publicBase}${profile.namespace}-interior-${id}.webp`,
        two: `${profile.publicBase}${profile.namespace}-interior-${id}@2x.webp`,
        width: 1024,
        height: 512,
        presentationCellSize: 32,
      }),
      poles: Object.freeze({
        one: `${profile.publicBase}${profile.namespace}-interior-${id}-poles.webp`,
        two: `${profile.publicBase}${profile.namespace}-interior-${id}-poles@2x.webp`,
        width: 256,
        height: 128,
      }),
      surfaceClassName: `${profile.namespace}-interior-${id}-leaf`,
      polarClassName: `${profile.namespace}-interior-${id}-polar`,
      surfaceOverlap: 0,
      textureSeamBleed: 0,
    });
    const leaves = prepareSphereLeaves(ctx, config).filter((entry) =>
      !cutaway || !(typeof entry.longitudeIndex === "number" && Number.isSafeInteger(entry.longitudeIndex)) ||
        !interiorLongitudeRemoved(ctx,
          (entry.longitudeIndex + 0.5) *
            360 / INTERIOR_LONGITUDE_SEGMENTS,
        )).map(({ leaf, polarCap }) => Object.freeze({
          ...leaf,
          asset: polarCap ? config.poles : config.texture,
        }));
    return Object.freeze({
      id,
      label: layer.label,
      radiusScale,
      cutaway,
      className: `${profile.namespace}-interior-shell-${id}`,
      leaves: Object.freeze(leaves),
    });
  }));
  const sectionLeaves = prepareInteriorSectionLeaves(ctx);
  const leafCount = countLeaves(outerBodyBands) +
    shells.reduce((count, shell) => count + shell.leaves.length, 0) +
    sectionLeaves.length;
  return Object.freeze({
    schema: `cssearth-prepared-cutaway@2`,
    qualification: INTERIOR_CUTAWAY.qualification,
    source: Object.freeze({
      sourceUrl: interiorSource.sourceUrl,
      sourceId: interiorSource.sourceId,
      earthRadiusKm: interiorSource[profile.interiorRadiusKey],
      layers: Object.freeze(interiorSource.layers.map((layer) =>
        Object.freeze({ ...layer }))),
    }),
    cutaway: INTERIOR_CUTAWAY,
    outerBodyBands,
    outerAssets: Object.freeze({
      surface: Object.freeze({
        one: `${profile.publicBase}${profile.namespace}-interior-outer.webp`,
        two: `${profile.publicBase}${profile.namespace}-interior-outer@2x.webp`,
        oneUrls: surfacePageUrls(`${profile.namespace}-interior-outer`, surfaceRasterPlan.pages.length),
        twoUrls: surfacePageUrls(`${profile.namespace}-interior-outer`, surfaceRasterPlan.pages.length, "@2x"),
      }),
      poles: Object.freeze({
        one: `${profile.publicBase}${profile.namespace}-interior-outer-poles.webp`,
        two: `${profile.publicBase}${profile.namespace}-interior-outer-poles@2x.webp`,
      }),
      litSurface: Object.freeze({
        urls: surfacePageUrls(`${profile.namespace}-interior-outer-lit`, surfaceRasterPlan.pages.length, "@2x"),
      }),
      litPoles: Object.freeze({
        one: `${profile.publicBase}${profile.namespace}-interior-outer-lit-poles.webp`,
        two: `${profile.publicBase}${profile.namespace}-interior-outer-lit-poles@2x.webp`,
      }),
    }),
    shells,
    sectionLeaves,
    leafCount,
    runtimeGeometry: false,
    runtimeRasterization: false,
  });
}

export function prepareInteriorSectionLeaves(ctx: PagedSceneContext) {
  const { profile, EQUATORIAL_RADIUS, POLAR_RADIUS, INTERIOR_CUTAWAY } = ctx;
  const asset = Object.freeze({
    one: `${profile.publicBase}${profile.namespace}-interior-section.webp`,
    two: `${profile.publicBase}${profile.namespace}-interior-section@2x.webp`,
    width: 1024,
    height: 512,
  });
  return Object.freeze([
    INTERIOR_CUTAWAY.centerLongitudeDegrees -
      INTERIOR_CUTAWAY.widthDegrees / 2,
    INTERIOR_CUTAWAY.centerLongitudeDegrees +
      INTERIOR_CUTAWAY.widthDegrees / 2,
  ].map((longitudeDegrees, faceIndex) => {
    const longitude = longitudeDegrees * Math.PI / 180;
    const direction = [Math.cos(longitude), Math.sin(longitude)];
    const polygon: RasterPolygon = {
      vertices: [
        [0, 0, -POLAR_RADIUS],
        [direction[0] * EQUATORIAL_RADIUS,
          direction[1] * EQUATORIAL_RADIUS, -POLAR_RADIUS],
        [direction[0] * EQUATORIAL_RADIUS,
          direction[1] * EQUATORIAL_RADIUS, POLAR_RADIUS],
        [0, 0, POLAR_RADIUS],
      ],
      uvs: [[0, 1], [1, 1], [1, 0], [0, 0]],
      texture: asset.one,
      textureImageSource: {
        url: asset.one,
        width: asset.width,
        height: asset.height,
        sourceRect: {
          x: faceIndex * asset.width / 2,
          y: 0,
          width: asset.width / 2,
          height: asset.height,
        },
      },
      texturePresentation: {
        backend: "image",
        lighting: "source",
        projection: "projective",
      },
      presentationCellSize: 256,
    };
    return Object.freeze({
      tag: "s",
      className: `${profile.namespace}-interior-section-face`,
      ...textureStyle(ctx, polygon, faceIndex, null, 0),
      asset,
      backfaceVisible: true,
    });
  }));
}

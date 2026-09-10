// Prepared scene presentation only: all assets and astronomical records are
// supplied by their preparation owners, never looked up by a runtime object id.
import { canonicalPreparedAsset } from "../../src/platform/prepared-object-assets.mjs";
import { DEFAULT_LABEL_POLICY } from "../../src/platform/label-field.mjs";
import { STAR_LABEL_POLICY } from "../../src/platform/star-labels.mjs";
import { POINT_MIN_RADIUS_PX } from "../../src/platform/star-photometry.mjs";

export function prepareSolarSystemPresentation({
  bodyId, plan, navigationMarkers, markerAtlasUrl, systemMarkerStrip,
  phaseAtlas, captionNames, catalogue,
}) {
  const navigationMarker = navigationMarkers?.[bodyId];
  if (!(navigationMarker?.presentation?.size > 0) || plan?.bodyId !== bodyId ||
      typeof markerAtlasUrl !== "string" || !markerAtlasUrl.startsWith("/") ||
      !Array.isArray(catalogue?.stars)) throw new TypeError("Solar-system presentation inputs are invalid.");
  if (!(phaseAtlas?.columns > 0) || !(phaseAtlas.rowCount > 0) || !(phaseAtlas.frameCount > 1) ||
      phaseAtlas.columns * phaseAtlas.rowCount < phaseAtlas.frameCount ||
      !(phaseAtlas.minimumLightViewZ < phaseAtlas.maximumLightViewZ) ||
      !Number.isFinite(phaseAtlas.baseLightAzimuthDegrees) || typeof phaseAtlas.url !== "string") {
    throw new TypeError("Solar-system markers need a prepared phase atlas.");
  }
  const atlasSprite = id => {
    if (typeof captionNames?.[id] !== "string" || !captionNames[id]) throw new TypeError(`No prepared caption for ${id}.`);
    const marker = navigationMarkers[id];
    if (marker?.presentation?.size > 0) return { url: marker.url, index: marker.index, count: marker.count, size: marker.presentation.size };
    const tile = systemMarkerStrip?.tiles?.[id];
    if (!tile) throw new Error(`No prepared marker for ${id}.`);
    return { url: canonicalPreparedAsset(systemMarkerStrip.density1.url, systemMarkerStrip.density2.url),
      index: tile.index, count: tile.count, size: tile.size };
  };
  if (!captionNames?.[bodyId]) throw new TypeError("The focused body needs a prepared caption.");
  const namedStars = catalogue.stars.flatMap((star, index) => star.name ? [{ id: `star:${index}`,
    hip: star.hip, name: star.name, direction: star.direction, magnitude: star.magnitude }] : []);
  return {
    plan,
    bodyMarker: { url: navigationMarker.url, index: navigationMarker.index,
      count: navigationMarker.count, size: 2 * POINT_MIN_RADIUS_PX },
    systemMarkers: { url: markerAtlasUrl, sun: atlasSprite("sun"),
      bodies: Object.fromEntries(plan.system.bodies.map(body => [body.id, atlasSprite(body.id)])),
      phase: { url: phaseAtlas.url, columns: phaseAtlas.columns, rowCount: phaseAtlas.rowCount,
        frameCount: phaseAtlas.frameCount, minimumLightViewZ: phaseAtlas.minimumLightViewZ,
        maximumLightViewZ: phaseAtlas.maximumLightViewZ, baseLightAzimuthDegrees: phaseAtlas.baseLightAzimuthDegrees } },
    labels: { policy: { ...DEFAULT_LABEL_POLICY }, names: Object.fromEntries([...new Set([bodyId, 'sun', ...plan.system.bodies.map(body => body.id)])].map(id => [id, captionNames[id]])),
      stars: { policy: { ...STAR_LABEL_POLICY }, exposure: { ...catalogue.exposure }, records: namedStars } },
  };
}

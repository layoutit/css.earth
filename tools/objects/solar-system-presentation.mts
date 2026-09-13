import type {PreparedNavigationMarker} from '../../src/navigation/marker-presentation.mts';
import { isArray } from '../../src/platform/is-array.mts';
import type {HeliocentricViewPlan} from '../../src/platform/heliocentric-view.mts';
import type {PreparedCatalogueStars} from '../../src/platform/prepare-catalogue-stars.mts';
import type {prepareSolarSystemMarkerStrip} from './solar-system-markers.mts';
interface PresentationOptions {bodyId:string;plan:HeliocentricViewPlan;navigationMarkers:Readonly<Record<string,PreparedNavigationMarker>>;markerAtlasUrl:string;systemMarkerStrip?:Awaited<ReturnType<typeof prepareSolarSystemMarkerStrip>>['plan'];phaseAtlas:{url:string;columns:number;rowCount:number;frameCount:number;minimumLightViewZ:number;maximumLightViewZ:number;baseLightAzimuthDegrees:number};captionNames:Record<string,string>;catalogue:Pick<PreparedCatalogueStars,'stars'|'exposure'>;}
// Prepared scene presentation only: all assets and astronomical records are
// supplied by their preparation owners, never looked up by a runtime object id.
import { DEFAULT_LABEL_POLICY } from "../../src/platform/label-field.mts";
import { STAR_LABEL_POLICY } from "../../src/platform/star-labels.mts";
import { POINT_MIN_RADIUS_PX } from "../../src/platform/star-photometry.mts";

export function prepareSolarSystemPresentation({
  bodyId, plan, navigationMarkers, markerAtlasUrl, systemMarkerStrip,
  phaseAtlas, captionNames, catalogue,
}:PresentationOptions) {
  const navigationMarker = navigationMarkers?.[bodyId];
  if (!(navigationMarker?.presentation?.size > 0) || plan?.bodyId !== bodyId ||
      typeof markerAtlasUrl !== "string" || !markerAtlasUrl.startsWith("/") ||
      !isArray(catalogue?.stars)) throw new TypeError("Solar-system presentation inputs are invalid.");
  if (!(phaseAtlas?.columns > 0) || !(phaseAtlas.rowCount > 0) || !(phaseAtlas.frameCount > 1) ||
      phaseAtlas.columns * phaseAtlas.rowCount < phaseAtlas.frameCount ||
      !(phaseAtlas.minimumLightViewZ < phaseAtlas.maximumLightViewZ) ||
      !Number.isFinite(phaseAtlas.baseLightAzimuthDegrees) || typeof phaseAtlas.url !== "string") {
    throw new TypeError("Solar-system markers need a prepared phase atlas.");
  }
  const atlasSprite = (id:string) => {
    if (typeof captionNames?.[id] !== "string" || !captionNames[id]) throw new TypeError(`No prepared caption for ${id}.`);
    const marker = navigationMarkers[id];
    if (marker?.presentation?.size > 0) return { url: marker.url, index: marker.index, count: marker.count, size: marker.presentation.size };
    const tile = systemMarkerStrip?.tiles?.[id];
    if (!tile || !systemMarkerStrip) throw new Error(`No prepared marker for ${id}.`);
    return { url: systemMarkerStrip.asset.url, index: tile.index, count: tile.count, size: tile.size };
  };
  if (!captionNames?.[bodyId]) throw new TypeError("The focused body needs a prepared caption.");
  if(!plan.system)throw new TypeError("Solar-system presentation requires its prepared bodies.");
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

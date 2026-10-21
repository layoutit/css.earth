import { catalogueDiscOpacity, catalogueLevelOpacity } from './catalogue-proximity.js';
import type { PreparedUniverseOptions } from './prepared-universe-types.js';
import { ALL_WORLD_LAYERS_SHOWN, type WorldLayerVisibility } from './world-layers.js';
import { writeData } from '../rendering/dom/retained-write.js';
import { eyeAnchor, eyeDistanceM, type WorldCameraPose } from '@cssearth/engine';
import type { SceneLifetime } from '@cssearth/engine';
import type { PreparedCssVolume, PreparedWorldContext } from '@cssearth/objects';
import type { WorldCameraViewport } from '../navigation/camera/world-camera.js';
import { mountPreparedVolumeLod } from '../volume/prepared-volume-lod.js';
import { projectedVolumeOpacity, volumeFramingRadiusUnits } from '../volume/projected-volume-visibility.js';
import { mountPreparedCssSky } from '../sky/prepared-sky-runtime.js';
import { prefetchPreparedResources } from '../rendering/loading/prepared-prefetch.js';
import { mountCataloguePoints } from './catalogue-points.js';
import { fetchPreparedCatalogueBank } from './catalogue-point-transport.js';
import { catalogueDotsOpacity, galaxyOutsideFade, logarithmicFade, preparedVolumeOpacity, starFieldFade } from './world-context/context-scale.js';
import { mountGalaxyStations, type GalaxyStationBackgroundOptions } from './galaxy-stations.js';
import { starFieldAroundPicture } from './context-presentation-policy.js';
import { galaxyAutoExposure } from './galaxy-auto-exposure.js';
import { createSettlePacer, type SettlePacerOptions } from '../rendering/loading/settle-pacer.js';

/** Retained sky and galaxy share one exposure-aware handoff. */
export function createUniverseBackground({ root, end, lifetime, plan, payload, sky, resolveResource,
  prefetchUrls, prefetchDistanceM, cataloguePointUrls = [], catalogueProximity, stations, requestPublication, settle }: {
  root: HTMLElement; end: Node; lifetime: SceneLifetime; plan: PreparedWorldContext;
  payload: PreparedCssVolume; sky: boolean;
  resolveResource(path: string): string;
  prefetchUrls: readonly string[]; prefetchDistanceM: number;
  /** Published star catalogues inside the galaxy, drawn as dust with it (PreparedUniverseOptions.galaxyCataloguePoints). */
  cataloguePointUrls?: readonly string[];
  catalogueProximity?: PreparedUniverseOptions['galaxyCatalogueProximity'];
  stations?: GalaxyStationBackgroundOptions;
  requestPublication?: () => unknown;
  /** The far picture's settle pacing: the document's by default (a test passes its own frame and clock). */
  settle?: Pick<SettlePacerOptions, 'frame' | 'clock' | 'later'>;
}) {
  const document = root.ownerDocument;
  const volumeHost = document.createElement('div');
  // The galaxy's opaque backdrop and its image layer fill the universe root (volume.css); the host's display and both
  // opacities change inline.
  volumeHost.className = 'prepared-volume-context';
  volumeHost.style.display = 'none';
  root.insertBefore(volumeHost, end);
  const volumeImage = document.createElement('div');
  volumeImage.className = 'prepared-volume-image';
  // An opaque completed image allows a baked display gain to be applied once, after optical compositing.
  if (stations?.farImageOpacity !== undefined && stations.farImageOpacity < 1) volumeImage.style.background = '#000';
  volumeHost.appendChild(volumeImage);
  const volumeEnd = document.createElement('span'); volumeEnd.hidden = true; volumeImage.appendChild(volumeEnd);
  let skyLayer: ReturnType<typeof mountPreparedCssSky> | null = null;
  let volumeLayer: ReturnType<typeof mountPreparedVolumeLod> | null = null;
  const cataloguePoints: ReturnType<typeof mountCataloguePoints>[] = [];
  const levels = catalogueProximity?.plan.levels.map((level,index) => ({url:catalogueProximity.resolve(level.file),index,mounted:null as ReturnType<typeof mountCataloguePoints>|null})) ?? [];
  let publishedVolumeAlpha = NaN, publishedImageAlpha = NaN, publishedSkyAlpha = NaN;
  let publishedVolumeOpacity = NaN;
  let publishedVolumeVisible: boolean | undefined;
  let publishedImageShown: boolean | undefined;
  const volumeFramingUnits = volumeFramingRadiusUnits(payload.frame);
  const prefetchAbort = new AbortController();
  lifetime.onDispose(() => prefetchAbort.abort());
  let galaxyPrefetched = false;
  let coasting = false;
  const stationHost = document.createElement('div');
  stationHost.className = 'prepared-galaxy-stations';
  stationHost.style.cssText = 'position:absolute;inset:0;transform-style:flat;pointer-events:none';
  const stationLayer = stations ? mountGalaxyStations({ host: stationHost, stations: stations.stations,
    interpolation: stations.interpolation,
    load: id => stations.load(id, document), hysteresisM: stations.hysteresisM, fadeMs: stations.fadeMs,
    coasting: () => coasting, requestPublication: () => { requestPublication?.(); } }) : null;
  lifetime.onDispose(() => stationLayer?.destroy());
  let stationAlpha = NaN;
  let lastView: { outside: number; layers: number; detail: number; nearestStationM: number; exposure: number } | null = null;
  // The far picture leaves under a complete inside scene only once the camera has stopped: its slices left in one frame
  // of a wheel zoom from the Local Group, 390 layers and 87 MB on the iPad (2026-10-21). Until then the opaque inside
  // scene covers it.
  let farCovered = false;
  const farRetire = createSettlePacer((_budget, moving) => {
    if (lifetime.disposed || moving || coasting || !farCovered || volumeImage.parentNode !== volumeHost) return 0;
    volumeImage.remove();
    return 1;
  }, settle);
  lifetime.onDispose(() => farRetire.destroy());
  // The view the pacer last counted as motion: a republication of an unchanged camera must not postpone it forever.
  // The eye's place is its position and exact anchor (sameEyePlace): a slow zoom near a small body can keep `positionM`.
  const lastCamera = new Float64Array(18).fill(NaN);
  let cameraChanged = false;
  const keep = (index: number, value: number) => { if (!Object.is(lastCamera[index], value)) { lastCamera[index] = value; cameraChanged = true; } };
  const cameraMoved = ({ pose }: WorldCameraPose, viewport: WorldCameraViewport) => {
    const { originM, offsetM } = eyeAnchor(pose), q = pose.orientationXyzw;
    cameraChanged = false;
    for (let axis = 0; axis < 3; axis++) { keep(axis, pose.positionM[axis]!); keep(3 + axis, originM[axis]!); keep(6 + axis, offsetM[axis]!); }
    keep(9, q[0]!); keep(10, q[1]!); keep(11, q[2]!); keep(12, q[3]!);
    keep(13, viewport.focalPixels); keep(14, viewport.widthPixels ?? NaN); keep(15, viewport.heightPixels ?? NaN);
    keep(16, viewport.principalOffsetPixels[0]); keep(17, viewport.principalOffsetPixels[1]);
    return cameraChanged;
  };

  return {
    dotOpacity(world: WorldCameraPose) { return catalogueProximity ? catalogueDiscOpacity(catalogueProximity.plan,world) : 1; },
    setCoasting(value: boolean) { coasting = value; },
    stationStats() { return stationLayer?.stats() ?? null; },
    inspect() { return lastView ? {...lastView} : null; },
    // Separate host placement from layer mounting to retain startup and DOM order.
    mount() {
      if (sky && payload.sky) {
        skyLayer = mountPreparedCssSky({ host: root, before: volumeHost, payload: payload.sky, resources: payload.resources, resolveResource, opacityOnly: !!stations?.interpolation });
        lifetime.onDispose(() => skyLayer?.destroy());
      }
      // The prepared XYZ slabs carry the outside view; the host fades them out as the inside banks take over.
      volumeLayer = mountPreparedVolumeLod({ host: volumeImage, before: volumeEnd, payload, resolveResource, residentStacks: true }, () => 1);
      // Completed stack images keep their opaque mattes: cumulative source-over then dissolves light linearly.
      lifetime.onDispose(() => volumeLayer?.destroy());
      // Their own layer over the galaxy's: the dots show from just past the Solar System, where the galaxy volume is still clear.
      for (const url of catalogueProximity ? [] : cataloguePointUrls) {
        const points = mountCataloguePoints({ host: root, before: end, url, loadBank: target => fetchPreparedCatalogueBank(target) });
        cataloguePoints.push(points);
        lifetime.onDispose(() => points.destroy());
      }
    },
    prefetch(distanceM: number) {
      if (lifetime.disposed || galaxyPrefetched || distanceM < prefetchDistanceM) return;
      galaxyPrefetched = true;
      const target = document.defaultView;
      if (typeof target?.fetch === 'function') void prefetchPreparedResources(prefetchUrls, target.fetch.bind(target), prefetchAbort.signal);
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, distanceM: number,
      selectedPositionM: readonly number[], detailContextOpacity: number, withoutM: readonly (readonly number[])[] | null = null,
      attachedReachM = 0, worldLayers: WorldLayerVisibility = ALL_WORLD_LAYERS_SHOWN): number {
      if (lifetime.disposed) return 0;
      // Every placed body starts inside the galaxy, so its own distance gates the volume.
      const volumeDistanceM = eyeDistanceM(world.pose, selectedPositionM);
      // The galaxy's nebulae and catalogue images keep their own distance fade; it is what this returns.
      const volumeOpacity = preparedVolumeOpacity(volumeDistanceM, plan.volume.opacityProfile);
      // Inside the galaxy the NASA band and octrees take over; outside it the galaxy is the prepared slab volume.
      const field = stations?.insideSkyFade;
      const outside = field ? logarithmicFade(eyeDistanceM(world.pose, field.centerM), field.startM, field.endM)
        : galaxyOutsideFade(volumeDistanceM, plan.volume.discHalfHeightM);
      const exposure = stations?.autoExposure ? galaxyAutoExposure(stations.autoExposure, world) : 1;
      // Inside the galaxy its clouds draw it; its layers are its picture from outside (galaxyLayersFade).
      let nearestStationM = Infinity;
      for (const station of stations?.stations ?? []) nearestStationM = Math.min(nearestStationM, eyeDistanceM(world.pose, station.positionM));
      // The shared Sun anchor owns the outside/inside transition. A nearest-station distance falls and rises
      // during a straight approach, making the far picture disappear and return at every station.
      // Nearest position still chooses the inside scene, independently of this one-way radial handover.
      let layers = stations ? logarithmicFade(field ? eyeDistanceM(world.pose, field.centerM) : nearestStationM, stations.farFadeStartM, stations.farFullDistanceM)
        : 1;
      for (const place of stations?.interpolation?.insidePlaces ?? []) {
        layers = Math.min(layers, logarithmicFade(eyeDistanceM(world.pose, place.positionM), place.fadeStartM, place.fullDistanceM));
      }
      lastView = { outside, layers, detail: detailContextOpacity, nearestStationM, exposure };
      // The complete inside scene dissolves over the complete far scene inside their COMMON opacity host.
      // Applying complementary opacities to separate opaque roots would darken their equal-brightness overlap.
      stationLayer?.setExposure(exposure);
      stationLayer?.publish({ world, viewport });
      const stationReady = (stationLayer?.stats().resident.length ?? 0) > 0;
      const stationShown = worldLayers.sky && stationReady && layers < 1 && outside > 0;
      if (!coasting) {
        if (stationShown && stationHost.parentNode !== volumeHost) volumeHost.append(stationHost);
        else if (!stationShown && stationHost.parentNode) stationHost.remove();
      }
      if (cameraMoved(world, viewport)) farRetire.published();
      farCovered = Boolean(stationLayer) && stationShown && layers === 0 && stationHost.parentNode === volumeHost;
      if (stationLayer && !coasting) {
        if (farCovered) { if (volumeImage.parentNode === volumeHost) farRetire.request(); }
        else if (volumeImage.parentNode !== volumeHost) volumeHost.prepend(volumeImage);
      }
      // A frozen coast keeps the complete scene that is actually resident until its replacement can join.
      const stationWeight = stationHost.parentNode === volumeHost
        ? volumeImage.parentNode === volumeHost ? 1 - layers : 1 : 0;
      // Each station has already received this frame's common display gain, relative to its baked anchor.
      if (stationWeight !== stationAlpha) { stationHost.style.opacity = String(stationWeight); stationAlpha = stationWeight; }
      const volumeSize = projectedVolumeOpacity(world, viewport, payload.frame, volumeFramingUnits);
      const volumeVisible = worldLayers.galaxies && outside * (stationLayer ? 1 : layers) * detailContextOpacity > 0;
      if (!coasting && volumeVisible !== publishedVolumeVisible) { volumeHost.style.display = volumeVisible ? '' : 'none'; publishedVolumeVisible = volumeVisible; }
      if (!coasting && outside !== publishedVolumeOpacity) { volumeHost.dataset.volumeOpacity = String(outside); publishedVolumeOpacity = outside; }
      // A detailed focus suppresses the volume without brightening the sky behind it.
      const completedContribution = outside;
      const alpha = worldLayers.galaxies ? completedContribution * detailContextOpacity : 0;
      const hostAlpha = alpha * (stationLayer ? 1 : layers);
      if (hostAlpha !== publishedVolumeAlpha) { volumeHost.style.opacity = String(hostAlpha); publishedVolumeAlpha = hostAlpha; }
      if (skyLayer && !coasting) writeData(skyLayer.root, 'skyContribution', String(1 - completedContribution));
      const imageAlpha = volumeSize * (stations?.farImageOpacity ?? 1) * exposure;
      if (imageAlpha !== publishedImageAlpha) {
        volumeImage.style.opacity = skyLayer && imageAlpha === 1 ? '' : String(imageAlpha);
        publishedImageAlpha = imageAlpha;
      }
      const imageShown = imageAlpha > 0;
      if (!coasting && imageShown !== publishedImageShown) {
        volumeImage.style.display = imageShown ? '' : 'none'; publishedImageShown = imageShown;
      }
      const skyAlpha = worldLayers.sky && alpha < 1 ? (1 - completedContribution) / (1 - alpha) : 0;
      if (skyLayer && skyAlpha !== publishedSkyAlpha) { skyLayer.root.style.opacity = String(skyAlpha); publishedSkyAlpha = skyAlpha; }
      // A sky turned off leaves the layout, as a hidden volume host does; it is not published until it is back.
      skyLayer?.publish(world, viewport, completedContribution < 1);
      if (volumeVisible && volumeSize > 0) volumeLayer?.publish({ world, viewport });
      // The catalogue dots are the stars around the Solar System (starFieldFade), whole before the host stars give way to
      // them past the system (world-context-planner.ts); measured like them from the selected body. A detailed focus (a
      // nebula's or a galaxy's picture) keeps them, as it keeps the stars' markers: they are the sky around it.
      const starField = starFieldAroundPicture(starFieldFade(volumeDistanceM, plan.system), volumeDistanceM, attachedReachM);
      const shownDots = worldLayers.stars ? catalogueDotsOpacity(starField) : 0;
      // A star the world draws as a body is its marker's to draw: its own dot in the galaxy's bank is left out.
      for (const points of cataloguePoints) points.publish({ world, viewport }, shownDots, withoutM);
      for (const level of levels) {
        const opacity = shownDots * catalogueLevelOpacity(catalogueProximity!.plan,level.index,world);
        if (!level.mounted && opacity > 0 && !coasting) {
          level.mounted = mountCataloguePoints({host:root,before:end,url:level.url,loadBank:target=>fetchPreparedCatalogueBank(target),fullDetail:true,coasting:()=>coasting});
          lifetime.onDispose(()=>level.mounted?.destroy());
        }
        level.mounted?.publish({world,viewport},opacity,withoutM);
      }
      return volumeOpacity;
    },
  };
}

import type { SceneLifetime } from '@cssearth/engine';
import type { PreparedCssVolume, VolumeCameraPublication } from '../volume/types.js';
import type { PreparedPointAppearance } from '../stars/types.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { mountPreparedVolumeLod } from '../volume/prepared-volume-lod.js';
import { projectedVolumeOpacity, volumeFramingRadiusUnits } from '../volume/projected-volume-visibility.js';
import { mountPreparedCssSky } from '../sky/prepared-sky-runtime.js';
import { prefetchPreparedResources } from '../rendering/prepared-prefetch.js';
import { mountStellarPoints, stellarPointsOpacity } from './stellar-points.js';
import { fetchPreparedJson, mountCataloguePoints } from './catalogue-points.js';
import { mountGalaxyBacking, parseGalaxyBacking } from './galaxy-backing.js';
import { galaxyOutsideFade, logarithmicFade, preparedVolumeOpacity, starFieldFade } from './world-context/context-scale.js';
import type { PreparedWorldContext } from '../prepared-data/world-context.js';

/** Retained sky, stellar sample and galaxy share one exposure-aware handoff. */
export function createUniverseBackground({ root, end, lifetime, plan, payload, pointAppearance, sky, resolveResource,
  prefetchUrls, prefetchDistanceM, cataloguePointUrls = [], backingUrl }: {
  root: HTMLElement; end: Node; lifetime: SceneLifetime; plan: PreparedWorldContext;
  payload: PreparedCssVolume; pointAppearance: PreparedPointAppearance; sky: boolean;
  resolveResource(path: string): string;
  prefetchUrls: readonly string[]; prefetchDistanceM: number;
  /** Published star catalogues inside the galaxy, drawn as dust with it (PreparedUniverseOptions.galaxyCataloguePoints). */
  cataloguePointUrls?: readonly string[];
  /** A face-on image of the galaxy under its catalogue dots, shown with them (PreparedUniverseOptions.galaxyBacking). */
  backingUrl?: string;
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
  volumeHost.appendChild(volumeImage);
  const volumeEnd = document.createElement('span'); volumeEnd.hidden = true; volumeImage.appendChild(volumeEnd);
  let skyLayer: ReturnType<typeof mountPreparedCssSky> | null = null;
  let stellarPoints: ReturnType<typeof mountStellarPoints> = null;
  let volumeLayer: ReturnType<typeof mountPreparedVolumeLod> | null = null;
  const cataloguePoints: ReturnType<typeof mountCataloguePoints>[] = [];
  let backing: ReturnType<typeof mountGalaxyBacking> | null = null, backingLoading = false, publishedBacking = NaN;
  let stellarEnabled = true, stellarPublication: VolumeCameraPublication | null = null, stellarOpacity = 0;
  let publishedVolumeAlpha = NaN, publishedImageAlpha = NaN, publishedSkyAlpha = NaN;
  let publishedVolumeOpacity = NaN;
  let publishedVolumeVisible: boolean | undefined;
  const volumeFramingUnits = volumeFramingRadiusUnits(payload.frame);
  const prefetchAbort = new AbortController();
  lifetime.onDispose(() => prefetchAbort.abort());
  let galaxyPrefetched = false;

  return {
    // Separate host placement from layer mounting to retain startup and DOM order.
    mount() {
      if (sky && payload.sky) {
        skyLayer = mountPreparedCssSky({ host: root, before: volumeHost, payload: payload.sky, resources: payload.resources, resolveResource });
        lifetime.onDispose(() => skyLayer?.destroy());
      }
      stellarPoints = mountStellarPoints({ host: root, before: volumeHost, field: pointAppearance });
      lifetime.onDispose(() => stellarPoints?.destroy());
      // The galaxy is its bulge slices and one flat disc plane at every distance; it has no impostor views.
      volumeLayer = mountPreparedVolumeLod({ host: volumeImage, before: volumeEnd, payload, resolveResource }, () => 1);
      lifetime.onDispose(() => volumeLayer?.destroy());
      // Their own layer over the galaxy's: the dots show from just past the Solar System, where the galaxy volume is still clear.
      for (const url of cataloguePointUrls) {
        const points = mountCataloguePoints({ host: root, before: end, url, fetchJson: fetchPreparedJson });
        cataloguePoints.push(points);
        lifetime.onDispose(() => points.destroy());
      }
    },
    setStellarPointsEnabled(enabled: boolean) {
      const next = enabled === true;
      if (lifetime.disposed || stellarEnabled === next) return false;
      stellarEnabled = next;
      return true;
    },
    publishStellarPoints() {
      if (!lifetime.disposed && stellarPublication) stellarPoints?.publish(stellarPublication, stellarEnabled ? stellarOpacity : 0);
    },
    prefetch(distanceM: number) {
      if (lifetime.disposed || galaxyPrefetched || distanceM < prefetchDistanceM) return;
      galaxyPrefetched = true;
      const target = document.defaultView;
      if (typeof target?.fetch === 'function') void prefetchPreparedResources(prefetchUrls, target.fetch.bind(target), prefetchAbort.signal);
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, distanceM: number,
      selectedPositionM: readonly number[], detailContextOpacity: number): number {
      if (lifetime.disposed) return 0;
      const starsHandoff = logarithmicFade(distanceM, plan.stars.fadeStartDistanceM, plan.stars.fullDistanceM);
      // Every placed body starts inside the galaxy, so its own distance gates the volume.
      const volumeDistanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - selectedPositionM[axis]!));
      // The galaxy's nebulae and catalogue images keep their own distance fade; it is what this returns.
      const volumeOpacity = preparedVolumeOpacity(volumeDistanceM, plan.volume.opacityProfile);
      // Inside the galaxy the NASA band is the sky; outside it the galaxy is its slices and face-on image.
      const outside = galaxyOutsideFade(volumeDistanceM, plan.volume.discHalfHeightM);
      const volumeSize = projectedVolumeOpacity(world, viewport, payload.frame, volumeFramingUnits);
      const volumeVisible = outside * detailContextOpacity > 0;
      if (volumeVisible !== publishedVolumeVisible) { volumeHost.style.display = volumeVisible ? '' : 'none'; publishedVolumeVisible = volumeVisible; }
      if (outside !== publishedVolumeOpacity) { volumeHost.dataset.volumeOpacity = String(outside); publishedVolumeOpacity = outside; }
      // A detailed focus suppresses the volume without brightening the sky behind it.
      const completedContribution = outside;
      const alpha = completedContribution * detailContextOpacity;
      if (alpha !== publishedVolumeAlpha) { volumeHost.style.opacity = String(alpha); publishedVolumeAlpha = alpha; }
      if (skyLayer) skyLayer.root.dataset.skyContribution = String(1 - completedContribution);
      const imageAlpha = volumeSize;
      if (imageAlpha !== publishedImageAlpha) {
        volumeImage.style.opacity = skyLayer && imageAlpha === 1 ? '' : String(imageAlpha);
        volumeImage.style.display = imageAlpha > 0 ? '' : 'none';
        publishedImageAlpha = imageAlpha;
      }
      const skyAlpha = alpha < 1 ? (1 - completedContribution) / (1 - alpha) : 0;
      if (skyLayer && skyAlpha !== publishedSkyAlpha) { skyLayer.root.style.opacity = String(skyAlpha); publishedSkyAlpha = skyAlpha; }
      skyLayer?.publish(world, viewport, completedContribution < 1);
      stellarPublication = { world, viewport };
      stellarOpacity = stellarPointsOpacity(starsHandoff, completedContribution) * detailContextOpacity;
      stellarPoints?.publish(stellarPublication, stellarEnabled ? stellarOpacity : 0);
      if (volumeVisible && volumeSize > 0) volumeLayer!.publish({ world, viewport });
      // The catalogue dots are the stars around the Solar System (starFieldFade), whole before the host stars give way to
      // them past the system (world-context-planner.ts); measured like them from the selected body. The backing is the
      // galaxy seen from outside, drawn with the rest of the volume.
      const shownDots = detailContextOpacity * starFieldFade(volumeDistanceM, plan.system);
      for (const points of cataloguePoints) points.publish({ world, viewport }, shownDots);
      const shownBacking = volumeVisible && volumeSize > 0 ? 1 : 0;
      if (backing) {
        if (shownBacking !== publishedBacking) {
          backing.root.style.opacity = String(shownBacking); backing.root.style.display = shownBacking > 0 ? '' : 'none'; publishedBacking = shownBacking;
        }
        if (shownBacking > 0) backing.publish({ world, viewport });
      } else if (shownBacking > 0 && backingUrl && !backingLoading) {
        // Fetched the first time the dots show; drawn under them from the next frame on.
        backingLoading = true;
        void fetchPreparedJson(backingUrl).then(value => {
          if (lifetime.disposed) return;
          backing = mountGalaxyBacking({ host: volumeImage, before: volumeEnd, payload: parseGalaxyBacking(value, backingUrl), resolveResource });
          lifetime.onDispose(() => backing?.destroy());
        }).catch(error => console.error(`Galaxy backing ${backingUrl} failed`, error));
      }
      return volumeOpacity;
    },
  };
}

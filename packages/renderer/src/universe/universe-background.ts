import { writeData } from '../rendering/retained-write.js';
import { eyeDistanceM, type WorldCameraPose } from '@cssearth/engine';
import type { SceneLifetime } from '@cssearth/engine';
import { parseGalaxyBacking, type PreparedCssVolume, type PreparedWorldContext, type BackingNearFade } from '@cssearth/objects';
import type { WorldCameraViewport } from '../navigation/world-camera.js';
import { mountPreparedVolumeLod } from '../volume/prepared-volume-lod.js';
import { projectedVolumeOpacity, volumeFramingRadiusUnits } from '../volume/projected-volume-visibility.js';
import { mountPreparedCssSky } from '../sky/prepared-sky-runtime.js';
import { prefetchPreparedResources } from '../rendering/prepared-prefetch.js';
import { mountCataloguePoints } from './catalogue-points.js';
import { fetchPreparedCatalogueBank, fetchPreparedJson } from './catalogue-point-transport.js';
import { mountGalaxyBacking } from './galaxy-backing.js';
import { revealLayer } from '../rendering/layer-reveal.js';
import { afterStartup } from '../rendering/startup-gate.js';
import { galaxyOutsideFade, logarithmicFade, preparedVolumeOpacity, starFieldFade } from './world-context/context-scale.js';

const PARSEC_M = 3.085677581491367e16;
/** Inside the Solar System a faint share of the galaxy's dots stays, so its sky is never empty; past the planets they
 * rise to full with the star field (starFieldFade). A presentation choice, by eye on 2026-09-30. */
const SOLAR_SYSTEM_DOTS = .3;
/** From among the local stars the flat face-on image is seen edge-on, a line across the view: it fades in as the camera
 * pulls out from 0.05 to 5 pc from the viewed body. A presentation choice, by eye on 2026-09-30. */
const BACKING_FADE_IN_M = [.05 * PARSEC_M, 5 * PARSEC_M] as const;

/** Retained sky and galaxy share one exposure-aware handoff. */
export function createUniverseBackground({ root, end, lifetime, plan, payload, sky, resolveResource,
  prefetchUrls, prefetchDistanceM, cataloguePointUrls = [], backingUrl }: {
  root: HTMLElement; end: Node; lifetime: SceneLifetime; plan: PreparedWorldContext;
  payload: PreparedCssVolume; sky: boolean;
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
  // The face-on image lies under the catalogue dots and shows with them, inside the galaxy or out: its rings dim where it blurs.
  const backingHost = document.createElement('div');
  backingHost.className = 'prepared-galaxy-backing';
  backingHost.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  const backingEnd = document.createElement('span'); backingEnd.hidden = true; backingHost.appendChild(backingEnd);
  // Right over the galaxy's own layer and under everything added after it: the image's black square must never hide the
  // galaxies, clouds or dots drawn later.
  root.insertBefore(backingHost, end);
  let skyLayer: ReturnType<typeof mountPreparedCssSky> | null = null;
  let volumeLayer: ReturnType<typeof mountPreparedVolumeLod> | null = null;
  const cataloguePoints: ReturnType<typeof mountCataloguePoints>[] = [];
  // The whole image and its sections over it, each with the opacity it keeps close up.
  let backing: { plane: ReturnType<typeof mountGalaxyBacking>; fade: BackingNearFade | undefined; opacity: number; image: string }[] | null = null;
  let backingLoading = false;
  // The last frame the backing was published for: a layer that loads while the camera rests is placed from it at once.
  let backingFrame: { world: WorldCameraPose; viewport: WorldCameraViewport; distanceM: number; shown: number } | null = null;
  // The backing's centre and the range it fades out over as the camera closes on it (galaxy-backing.ts centreFadeM).
  let backingCentre: { originM: readonly number[]; fadeM: readonly [number, number] } | null = null;
  const publishBacking = ({ world, viewport, distanceM, shown }: NonNullable<typeof backingFrame>) => {
    const centre = backingCentre ? logarithmicFade(eyeDistanceM(world.pose, backingCentre.originM),
      backingCentre.fadeM[1], backingCentre.fadeM[0]) : 1;
    // Close up the image's pixels blow up and blur: each layer dims toward its near opacity over its own range.
    for (const layer of backing ?? []) {
      const fade = layer.fade, far = fade ? logarithmicFade(distanceM, fade.fadeM[1], fade.fadeM[0]) : 1;
      const opacity = shown * centre * (fade ? fade.nearOpacity + (1 - fade.nearOpacity) * far : 1);
      // The camera first, then the layer shows: a plane never paints before it is placed.
      if (opacity > 0) layer.plane.publish({ world, viewport });
      if (opacity !== layer.opacity) {
        const display = opacity > 0 ? '' : 'none';
        // A plane switching on waits for its decoded image and its own frame (layer-reveal.ts).
        if (display === '' && layer.plane.root.style.display === 'none') revealLayer(layer.plane.root, layer.image);
        layer.plane.root.style.opacity = String(opacity); layer.plane.root.style.display = display; layer.opacity = opacity;
      }
    }
  };
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
      // The galaxy is its bulge slices and one flat disc plane at every distance; it has no impostor views.
      volumeLayer = mountPreparedVolumeLod({ host: volumeImage, before: volumeEnd, payload, resolveResource }, () => 1);
      lifetime.onDispose(() => volumeLayer?.destroy());
      // Their own layer over the galaxy's: the dots show from just past the Solar System, where the galaxy volume is still clear.
      for (const url of cataloguePointUrls) {
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
      selectedPositionM: readonly number[], detailContextOpacity: number, withoutM: readonly (readonly number[])[] | null = null): number {
      if (lifetime.disposed) return 0;
      // Every placed body starts inside the galaxy, so its own distance gates the volume.
      const volumeDistanceM = eyeDistanceM(world.pose, selectedPositionM);
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
      if (skyLayer) writeData(skyLayer.root, 'skyContribution', String(1 - completedContribution));
      const imageAlpha = volumeSize;
      if (imageAlpha !== publishedImageAlpha) {
        volumeImage.style.opacity = skyLayer && imageAlpha === 1 ? '' : String(imageAlpha);
        volumeImage.style.display = imageAlpha > 0 ? '' : 'none';
        publishedImageAlpha = imageAlpha;
      }
      const skyAlpha = alpha < 1 ? (1 - completedContribution) / (1 - alpha) : 0;
      if (skyLayer && skyAlpha !== publishedSkyAlpha) { skyLayer.root.style.opacity = String(skyAlpha); publishedSkyAlpha = skyAlpha; }
      skyLayer?.publish(world, viewport, completedContribution < 1);
      if (volumeVisible && volumeSize > 0) volumeLayer!.publish({ world, viewport });
      // The catalogue dots are the stars around the Solar System (starFieldFade), whole before the host stars give way to
      // them past the system (world-context-planner.ts); measured like them from the selected body. A detailed focus (a
      // nebula's or a galaxy's picture) keeps them, as it keeps the stars' markers: they are the sky around it.
      const starField = starFieldFade(volumeDistanceM, plan.system);
      const shownDots = SOLAR_SYSTEM_DOTS + (1 - SOLAR_SYSTEM_DOTS) * starField;
      // A star the world draws as a body is its marker's to draw: its own dot in the galaxy's bank is left out.
      for (const points of cataloguePoints) points.publish({ world, viewport }, shownDots, withoutM);
      // The backing shows with the dots, and gives way to a detailed focus as the galaxy's volume does.
      const shownBacking = detailContextOpacity * starField * volumeSize * logarithmicFade(volumeDistanceM, BACKING_FADE_IN_M[0], BACKING_FADE_IN_M[1]);
      backingFrame = { world, viewport, distanceM: volumeDistanceM, shown: shownBacking };
      if (backing) publishBacking(backingFrame);
      else if (shownBacking > 0 && backingUrl && !backingLoading) {
        // Fetched the first time the dots show; each layer mounts hidden and is placed from the latest frame at once.
        backingLoading = true;
        afterStartup(document.defaultView, () => { if (!lifetime.disposed) void fetchPreparedJson(backingUrl).then(value => {
          if (lifetime.disposed) return;
          const payload = parseGalaxyBacking(value, backingUrl);
          const layers = [{ texturePath: payload.leaf.texturePath, fade: payload.nearFade }, ...(payload.sections ?? []).map(section => ({ texturePath: section.texturePath, fade: section }))];
          // Every layer's image must resolve before any mounts: a failure leaves no plane behind.
          for (const layer of layers) resolveResource(layer.texturePath);
          backing = layers.map(layer => ({
            plane: mountGalaxyBacking({ host: backingHost, before: backingEnd, payload: { ...payload, leaf: { ...payload.leaf, texturePath: layer.texturePath } }, resolveResource }),
            fade: layer.fade, opacity: NaN, image: resolveResource(layer.texturePath) }));
          for (const layer of backing) layer.plane.root.style.display = 'none';
          if (payload.centreFadeM) backingCentre = { originM: payload.frame.originM, fadeM: payload.centreFadeM };
          lifetime.onDispose(() => { for (const layer of backing ?? []) layer.plane.destroy(); });
          if (backingFrame) publishBacking(backingFrame);
        }).catch(error => console.error(`Galaxy backing ${backingUrl} failed`, error)); });
      }
      return volumeOpacity;
    },
  };
}

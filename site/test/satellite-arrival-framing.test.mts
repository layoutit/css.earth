import { parsePreparedObjectRuntime } from '@cssearth/objects';
import { readSystemViewFile } from './system-view-file.mts';

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';

import { selectPreparedResponsiveZoom } from '@cssearth/renderer/navigation/camera-layout.ts';
import type { CameraViewport } from '@cssearth/renderer/navigation/camera-viewport.ts';
import type { SceneFactory } from '../browser/browser-types.mts';
import { SCENE_OBJECTS } from '../objects.mts';
import { allSatelliteSystems } from '../satellite-systems.mts';
import { satelliteSelectionAtCamera } from '../satellite-selection.mts';
import { createPreparedWorldNavigation } from '../prepared-world-navigation.mts';
import { loadSystemView } from '../system-framing.mts';
import { navigationFixture, required, unusedSharedView } from './navigation-test-values.mts';

const test = sourceTest();
const source = required(SCENE_OBJECTS.find(object => object.id === 'earth'));
const read = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

for (const [width, height, mobile] of [[390, 844, true], [820, 1080, true], [1440, 900, false]] as const) {
  test(`satellite arrivals retain their selection with destination framing at ${width}x${height}`, async () => {
    const focalPixels = width * Math.sqrt(3) / 2;
    const cameraViewport: CameraViewport = {
      read: () => ({ bounds: { x: 0, y: 0, left: 0, top: 0, width, height }, focalPixels,
        previewTop: height * .75, openArea: { top: 80, bottom: height * .75 } }),
      subscribe: () => () => {}, destroy() {},
    };
    const optics = { focalPixels, framingRadiusPixels: width * .3, detailHandoffDiameterPixels: 14,
      principalOffsetPixels: [0, 0] as const, visibleRect: null, widthPixels: width, heightPixels: height };
    const from = { referenceFrame: source.worldFrame.referenceFrame, epochJdTt: source.worldFrame.epochJdTt,
      pose: { positionM: [source.worldFrame.originM[0], source.worldFrame.originM[1], source.worldFrame.originM[2] + 1e8] as const, orientationXyzw: [0, 0, 0, 1] as const } };
    const owner = navigationFixture(source.worldFrame, () => from, () => optics);
    const navigation = createPreparedWorldNavigation({ objects: SCENE_OBJECTS,
      documentTarget: new EventTarget() as Document,
      windowTarget: { matchMedia: () => ({ matches: mobile }), performance,
        requestAnimationFrame() { throw new Error('Reduced-motion preparation must not schedule a flight.'); } } as unknown as Window });
    for (const { hostId } of allSatelliteSystems()) {
      const object = required(SCENE_OBJECTS.find(object => object.id === hostId));
      await loadSystemView(hostId, readSystemViewFile);
      const data = await read(`../../src/objects/${hostId}/prepared/runtime.json`);
      const definition = parsePreparedObjectRuntime(data), { camera } = definition;
      const fit = selectPreparedResponsiveZoom({ plan: camera, viewport: cameraViewport, mobile });
      const framingRadiusPixels = fit.zoom / camera.defaultZoom * camera.logicalBodyDiameter / 2;
      const factory = Object.assign((() => { throw new Error('Only preparation is exercised here.'); }) as SceneFactory, {
        navigation: { frame: object.worldFrame, framingRadius: async () => framingRadiusPixels,
          prepare: async () => ({ resources: { destroy() {} }, destroy() {}, projection: () => undefined, prepareView: async () => {} }) },
      });
      const controller = new AbortController();
      // Deliberately unlike the destination: this is the outgoing body's fit.
      const provisional = required(navigation.systemTarget({ objectId: hostId, fromId: 'earth',
        mount: { sharedView: unusedSharedView, navigation: owner }, force: true }));
      const handoff = await navigation.prepare({ fromId: 'earth', toId: hostId,
        fromMount: { sharedView: unusedSharedView, navigation: owner }, toFactory: factory,
        targetWorldCamera: provisional, centerSelection: true, cameraViewport,
        url: `https://css.earth/${hostId}-system/`, reducedMotion: true, signal: controller.signal });
      const target = required(handoff.mountOptions.initialWorldCamera);
      assert.equal(satelliteSelectionAtCamera(target, { ...optics, framingRadiusPixels }, SCENE_OBJECTS,
        { objectId: `${hostId}-system` }), null, `${hostId} must not change its card at rest`);
      assert.deepEqual(target.pose.orientationXyzw, from.pose.orientationXyzw, `${hostId} keeps the departure angle`);
      controller.abort();
    }
  });
}

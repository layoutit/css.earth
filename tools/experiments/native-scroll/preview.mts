import { createServer } from 'node:http';
import { parseHTML } from 'linkedom';
import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedCssObject, initialObjectSelection } from '../../../src/renderers/css/dist/index.js';
import { parsePreparedWorldCameraFrame, parseSharedView, formatSharedView } from '../../../src/renderers/css/dist/navigation.js';
import { preparedSceneMatrix } from '../../../src/renderers/css/navigation/prepared-camera-basis.js';
import { serializePreparedMatrix4 } from '../../../src/renderers/css/solar-system/prepared-ellipsoid-projection.js';
import { distanceForSilhouetteRadius } from '../../../src/renderers/css/solar-system/heliocentric-geometry.js';
import { addNativeSolarContext, solarMaximumDistanceM } from './context.mts';
import { serializePreparedScene } from '../../serialize-prepared-scene.mts';
import { publishPreparedNativeView } from '../../../src/renderers/css/rendering/prepared-native-view.js';
import type { SharedView } from '../../../src/renderers/css/navigation/view-url.js';

const origin = process.argv[2] ?? 'http://127.0.0.1:4349';
const port = Number(process.argv[3] ?? 4350);
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname) || !Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new TypeError('Use a localhost upstream URL and a port between 1024 and 65535.');
}
// Captured starting view for the Saturn experiment; other arrivals use the shared silhouette fit.
const initialSaturnView = 'MMZBJDALq2Er6kFCxzNAAAAAP9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const read = async (path: string) => {
  const response = await fetch(new URL(path, origin));
  if (!response.ok) throw new Error(`Missing prepared resource: ${path}`);
  return response.arrayBuffer();
};
const css = (distanceM: number, metersPerUnit: number, radiusM: number) => `
@property --native-log-distance { syntax: '<number>'; inherits: true; initial-value: 0; }
@keyframes native-scroll-distance {
  0% { --native-log-distance: ${Math.log(.5)}; }
  10% { --native-log-distance: 0; }
  100% { --native-log-distance: ${Math.log(solarMaximumDistanceM / distanceM)}; }
}
.planet-viewport {
  container-type: size;
  --native-focal: 86.60254037844386cqw;
  --native-distance-m: calc(${distanceM} * exp(var(--native-log-distance)));
  --native-dolly-m: calc(var(--native-distance-m) - ${distanceM});
  --native-disc-share: calc(${radiusM * 2} * var(--native-focal) / var(--native-distance-m) / 100cqh);
  --native-orbit-alpha: clamp(0, (0.3 - var(--native-disc-share)) / 0.18, 1);
}
.native-context-link { position: absolute; width: 44px; height: 44px; pointer-events: auto;
  font-weight: normal; color: inherit; text-decoration: none; }
.native-context-link:hover [data-context-body]::after,
.native-context-link:focus-visible [data-context-body]::after { opacity: 1; text-decoration: underline; }
.native-context-link:focus-visible { outline: 1px solid currentColor; outline-offset: 2px; border-radius: 50%; }
@supports (animation-timeline: scroll()) and (scroll-initial-target: nearest) {
  .planet-viewport { timeline-scope: --native-zoom;
    animation: native-scroll-distance linear both; animation-timeline: --native-zoom; }
  .planet-input-surface { overflow-x: hidden; overflow-y: auto; scrollbar-width: none; touch-action: pan-y;
    overscroll-behavior: contain; scroll-timeline: --native-zoom y; }
  .planet-input-surface::-webkit-scrollbar { display: none; }
  .planet-input-surface::before { content: ''; display: block; height: 400px; }
  .planet-input-surface::after { content: ''; display: block; height: 3600px; }
  .native-zoom-start { display: block; height: 100%; scroll-initial-target: nearest; scroll-snap-align: start; }
  .polycss-scene { translate: 0 0 calc(var(--native-dolly-m) / ${metersPerUnit} * -1px); }
}
`;

createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', origin);
    if (url.pathname === '/saturn/' && !url.searchParams.has('v')) url.searchParams.set('v', initialSaturnView);
    // Publish the physical pose here; do not depend on a server-side saved-view route.
    const upstreamUrl = new URL(url); upstreamUrl.searchParams.delete('v');
    const upstream = await fetch(upstreamUrl);
    const headers = new Headers(upstream.headers);
    headers.delete('content-length'); headers.delete('content-encoding');
    headers.set('cache-control', 'no-cache');
    headers.set('content-security-policy', "script-src 'none'");
    let body: string | Uint8Array;
    if (headers.get('content-type')?.includes('text/html') && upstream.ok) {
      const { document } = parseHTML(await upstream.text());
      const descriptorNode = document.querySelector('script[data-prepared-descriptor]');
      if (!descriptorNode) { response.writeHead(upstream.status, Object.fromEntries(headers)); response.end(document.toString()); return; }
      const descriptor = parseObjectDescriptor(JSON.parse(descriptorNode.textContent ?? ''));
      const frame = parsePreparedWorldCameraFrame(descriptor.properties.worldFrame);
      if (!frame || !descriptor.prepared) throw new Error('The physical object frame is missing.');
      const prepared = descriptor.prepared;
      const definition = await loadPreparedCssObject(descriptor, {
        read: () => read(`/objects/${descriptor.id}/${prepared.sha256}.json`),
        readShared: reference => read(`/shared/${reference.kind}/${reference.sha256}.json`),
      });
      let saved = parseSharedView(url.search);
      if (!saved) {
        // Shared silhouette fitting and prepared orientation, at a fixed reference
        // focal length. This proof does not add a device-specific view.
        saved = {
          camera: { distanceKilometers: distanceForSilhouetteRadius(frame.bodyRadiusM, 1000, 200, [0, 0]) / 1000,
            pose: { schema: 'cssearth-camera-pose@2', scene: serializePreparedMatrix4(preparedSceneMatrix(definition.camera,
              definition.camera.defaultControlPitchDegrees, definition.camera.defaultControlYawDegrees)) } },
          playback: { speed: 1, motionRequested: false, times: (definition.motion ?? []).map(() => 0) },
          preparedEpochJdTt: frame.epochJdTt,
        } satisfies SharedView;
      }
      const stage = document.querySelector<HTMLElement>('.planet-stage');
      if (!stage || stage.dataset.objectId !== descriptor.id) throw new Error('The retained scene identity is missing.');
      const lensId = url.searchParams.get('dataset') ?? undefined;
      const markup = serializePreparedScene(definition, lensId);
      stage.className = ['planet-stage', 'example-stage', ...markup.classes].join(' ');
      stage.setAttribute('style', markup.style);
      for (const [name, value] of Object.entries(markup.attributes)) stage.setAttribute(name, value);
      stage.innerHTML = markup.html;
      publishPreparedNativeView(definition, initialObjectSelection(definition.controls, lensId), stage, frame, saved);
      stage.dataset.preparedView = formatSharedView(saved).slice(2);
      const surface = document.querySelector('.planet-input-surface');
      if (!surface || !document.querySelector('.polycss-scene')) throw new Error('The existing prepared scene is missing.');
      const rules = addNativeSolarContext(document, frame, saved, descriptor.id);
      const style = document.createElement('style');
      style.textContent = css(saved.camera.distanceKilometers! * 1000, frame.metersPerUnit, frame.bodyRadiusM) + rules;
      document.head.append(style);
      const initial = document.createElement('span'); initial.className = 'native-zoom-start'; initial.setAttribute('aria-hidden', 'true'); surface.append(initial);
      surface.setAttribute('aria-label', `Scroll to zoom ${descriptor.id}`);
      body = document.toString();
    } else body = new Uint8Array(await upstream.arrayBuffer());
    response.writeHead(upstream.status, Object.fromEntries(headers)); response.end(body);
  })().catch(error => { console.error(error); response.writeHead(500, { 'content-type': 'text/plain' }); response.end(String(error)); });
}).listen(port, '127.0.0.1', () => console.log(`Native scroll experiment: http://127.0.0.1:${port}/saturn/ (upstream ${origin})`));

import { opacityClockFor, type OpacityWindow } from '../stars/opacity-clock.js';
import type { SceneLifetime } from '@cssearth/engine';

export function waitForScenePaint(lifetime: SceneLifetime, windowTarget: OpacityWindow = window): Promise<void> {
  if (lifetime.disposed) return Promise.resolve();
  // The document's one frame clock (opacity-clock.ts).
  const clock = opacityClockFor(windowTarget);
  return new Promise(resolve => {
    let frame = 0;
    lifetime.onDispose(() => {
      if (frame) clock.cancel(frame);
      frame = 0;
      resolve();
    });
    frame = clock.request(() => {
      frame = 0;
      if (lifetime.disposed) return;
      frame = clock.request(() => { frame = 0; resolve(); });
    });
  });
}

export function waitForSceneDocument(lifetime: SceneLifetime, documentTarget: Document = document): Promise<void> {
  if (lifetime.disposed || documentTarget.readyState !== 'loading') return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { documentTarget.removeEventListener('DOMContentLoaded', done); resolve(); };
    lifetime.onDispose(done);
    documentTarget.addEventListener('DOMContentLoaded', done, { once: true });
  });
}

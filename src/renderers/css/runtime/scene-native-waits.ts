import type { SceneLifetime } from '@cssearth/engine';

export function waitForScenePaint(lifetime: SceneLifetime, windowTarget: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'> = window): Promise<void> {
  if (lifetime.disposed) return Promise.resolve();
  return new Promise(resolve => {
    let frame = 0;
    lifetime.onDispose(() => {
      if (frame) windowTarget.cancelAnimationFrame(frame);
      frame = 0;
      resolve();
    });
    frame = windowTarget.requestAnimationFrame(() => {
      frame = 0;
      if (lifetime.disposed) return;
      frame = windowTarget.requestAnimationFrame(() => { frame = 0; resolve(); });
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

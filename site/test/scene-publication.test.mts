import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createScenePublication } from '../scene/scene-publication.mts';
import type { SceneSessionState } from '../scene/scene-session.mts';
import type { BrowserWindow } from '../browser/browser-types.mts';
import { unusedSharedView } from './navigation-test-values.mts';

test('readiness stays observable without publishing body lifecycle classes', () => {
  const { document, window } = parseHTML('<html><body class="application"><div class="object-viewport"><main></main></div></body></html>');
  const stage = document.querySelector('main')!;
  let state: SceneSessionState = { kind: 'loading', activation: 'idle', mount: null };
  const publication = createScenePublication({ stage, documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    getShell: () => null, getWorld: () => null,
    read: () => ({ state, pending: null, objectId: 'earth', subject: { kind: 'object', objectId: 'earth' },
      motionEnabled: false, lightCurvesEnabled: true, reducedMotionActive: false, mountedObjectCount: 0, playing: false, hasPresented: true }),
  });
  publication.publish();
  assert.equal(document.documentElement.dataset.ready, 'loading');
  assert.equal(stage.ariaBusy, 'true');
  assert.equal(document.body.className, 'application');
  state = { kind: 'ready', mount: { ready: Promise.resolve(), sharedView: unusedSharedView, pause() {}, resume() {}, destroy() {} } };
  assert.equal(publication.publish().ready, true);
  assert.equal(document.documentElement.dataset.ready, 'true');
  assert.equal(document.body.className, 'application');
  assert.equal(stage.ariaBusy, 'false');
  state = { kind: 'loading', activation: 'idle', mount: null };
  publication.publish();
  state = { kind: 'failed', error: new Error('failed mount') };
  assert.equal(publication.publish().error, 'failed mount');
  assert.equal(document.documentElement.dataset.ready, 'error');
  assert.equal(document.body.className, 'application');
  state = { kind: 'disposed' };
  publication.publish();
  assert.equal(document.documentElement.dataset.ready, undefined);
  assert.equal(document.body.className, 'application');
});

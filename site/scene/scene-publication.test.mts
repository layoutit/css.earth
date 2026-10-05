import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createScenePublication } from './scene-publication.mts';
import type { SceneSessionState } from './scene-session.mts';
import type { BrowserWindow } from '../browser/browser-types.mts';
import type { ObjectShell } from '../shell/object-shell-types.mts';
import { unusedSharedView } from '../navigation/navigation-test-values.test-support.mts';

test('readiness stays observable without publishing body lifecycle classes', () => {
  const { document, window } = parseHTML('<html><body class="application"><div class="object-viewport"><main></main></div></body></html>');
  const stage = document.querySelector('main')!;
  let state: SceneSessionState = { kind: 'loading', activation: 'idle', mount: null };
  const publication = createScenePublication({ stage, documentTarget: document, windowTarget: window as unknown as BrowserWindow,
    getShell: () => null, getWorld: () => null,
    read: () => ({ state, pending: null, objectId: 'earth', subject: { objectId: 'earth', view: 'body' },
      motionEnabled: false, lightCurvesEnabled: true, reducedMotionActive: false, mountedObjectCount: 0, playing: false, hasPresented: true, covered: false, datasetLoading: false }),
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

test('the header line runs while a photograph covers a cold page or a chosen dataset is prepared; the readout is told only of a flight', () => {
  const { document, window } = parseHTML('<html><body><div class="object-viewport"><main></main></div></body></html>');
  let covered = true, datasetLoading = false;
  const calls: string[] = [];
  const shell = {
    setNavigationInFlight(active: boolean) { calls.push(`flight:${active}`); },
    setDestinationLoading(active: boolean) { calls.push(`loading:${active}`); },
  } as unknown as ObjectShell;
  const publication = createScenePublication({ stage: document.querySelector('main')!, documentTarget: document,
    windowTarget: window as unknown as BrowserWindow, getShell: () => shell, getWorld: () => null,
    read: () => ({ state: { kind: 'loading', activation: 'idle', mount: null }, pending: null, objectId: 'earth',
      subject: { objectId: 'earth', view: 'body' }, motionEnabled: false, lightCurvesEnabled: true, reducedMotionActive: false,
      mountedObjectCount: 0, playing: false, hasPresented: true, covered, datasetLoading }),
  });
  publication.publish();
  assert.deepEqual(calls, ['flight:false', 'loading:true']);
  // The detail replaced the photograph.
  covered = false; calls.length = 0;
  publication.publish();
  assert.deepEqual(calls, ['flight:false', 'loading:false']);
  // A chosen dataset is being prepared: the line runs until it is drawn, and no flight is announced.
  datasetLoading = true; calls.length = 0;
  publication.publish();
  assert.deepEqual(calls, ['flight:false', 'loading:true']);
  datasetLoading = false; calls.length = 0;
  publication.publish();
  assert.deepEqual(calls, ['flight:false', 'loading:false']);
});

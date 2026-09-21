import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreparedContextNavigation } from '../prepared-context-navigation.mts';
import { isPreparedCluster } from '@cssearth/catalog';
import type { PreparedFocusPresentation } from '../prepared-context-navigation.mts';
import type { PreparedCatalogObject, PreparedGalaxyRecord, PreparedClusterRecord, SpatialCatalogSource, SpatialCitation } from '@cssearth/catalog';
import type { ObjectWorldNavigation } from '../../src/renderers/css/runtime/world-navigation-types.ts';
import type { PreparedNavigationFocus } from '../../src/renderers/css/navigation/prepared-focus.ts';
import type { PreparedVolumeLensState } from '../../src/renderers/css/volume/prepared-volume-lenses.ts';
import type { DensityVolumeFrame } from '@cssearth/objects';
type ContextLayer = Parameters<typeof createPreparedContextNavigation>[0]['layer'];
type Content = { record: PreparedCatalogObject | null; references: readonly SpatialCitation[]; presentation: PreparedFocusPresentation | null };
type FixtureOptions = { object?: Partial<PreparedGalaxyRecord> & Partial<Pick<PreparedClusterRecord, 'kind' | 'classification'>>;
  unavailableObjectIds?: readonly string[];
  imageLayerFrames?: ContextLayer['imageLayerFrames']; volumeLensFrames?: ContextLayer['volumeLensFrames']; volumeBank?: PreparedVolumeLensState | null;
  deferredVolumeBank?: PreparedVolumeLensState | null;
  cameraPositionM?: readonly [number, number, number] };
const baseFrame: DensityVolumeFrame = { referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [0,0,0], localToReferenceXyzw: [0,0,0,1],
  metersPerUnit: 1e18, boundsUnits: { min: [-500,-500,-500], max: [500,500,500] } };
function required<T>(value: T | null | undefined): T { assert.ok(value !== null && value !== undefined); return value; }
function last<T>(values: T[]): T { return required(values.at(-1)); }


function fixture({ object = {}, imageLayerFrames = {}, volumeLensFrames = {}, volumeBank = null, deferredVolumeBank = null,
  unavailableObjectIds = [], cameraPositionM = [1e20, 0, 1e19] }: FixtureOptions = {}) {
  let current: PreparedNavigationFocus | null = null, signal: AbortSignal | undefined;
  const flights: {id:string; reducedMotion?:boolean}[] = [];
  const callbacks = new Set<() => void>(), errors: Error[] = [], selections: (string | null)[] = [], writes: (string | URL)[] = [], content: Content[] = [];
  const windowTarget = { location: new URL('https://example.test/mercury/?focus=catalogue:a&v=saved'),
    history: { state: {}, replaceState(state: unknown, _: string, url?: string | URL | null) { assert.ok(url); windowTarget.location = new URL(url, windowTarget.location); writes.push(url); } } };
  const owner = { frame: { referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [0,0,0],
      presentationToReference: [1,0,0,0,-1,0,0,0,1], metersPerUnit: 1e18, bodyRadiusM: 1e18 },
    capture: () => ({ referenceFrame: 'sun-icrf', epochJdTt: 1,
      pose: { positionM: cameraPositionM, orientationXyzw: [0,0,0,1] } }),
    optics: () => ({ focalPixels: 1000, widthPixels: 1000, heightPixels: 1000, principalOffsetPixels: [0,0],
      framingRadiusPixels: 400, visibleRect: {left:-500,right:500,top:-500,bottom:500}, detailHandoffDiameterPixels: 20 }),
    preparedFocus: () => current,
    setPreparedFocus(focus: PreparedNavigationFocus | null) { current = focus; for (const callback of callbacks) callback(); },
    subscribe(callback: () => void) { callbacks.add(callback); callback(); return () => callbacks.delete(callback); },
    flyToPreparedFocus(focus: PreparedNavigationFocus, options: { signal?: AbortSignal; reducedMotion?: boolean } = {}) { signal = required(options.signal); this.setPreparedFocus(focus);
      flights.push({id:focus.id,reducedMotion:options.reducedMotion});
      if (options.reducedMotion) return Promise.resolve({completed:true});
      return new Promise<{ completed: boolean }>(resolve => required(signal).addEventListener('abort', () => resolve({ completed: false }), { once: true })); } };
  // The real `subscribeVolumeLens` hands the listener the bank state, so a deferred bank can replay a
  // notification once its payload arrives; a no-argument listener no longer satisfies that signature.
  const lensCallbacks = new Set<(state: PreparedVolumeLensState) => void>(), lensWrites: string[] = [];
  let bankState = volumeBank, pendingLens: string | null = null;
  const applyBank = (change: Partial<PreparedVolumeLensState>) => { bankState = { ...required(bankState), ...change }; for (const callback of lensCallbacks) callback(required(bankState)); };
  const layer = { imageLayerFrames, volumeLensFrames,
    volumeLensState: (objectId: string) => objectId === bankState?.objectId ? bankState : null,
    selectVolumeLens(objectId: string, id: string) {
      assert.equal(objectId, bankState?.objectId ?? required(deferredVolumeBank).objectId);
      lensWrites.push(id);
      if (!bankState) { pendingLens = id; return; }
      assert.ok(bankState.lenses.some(lens => lens.id === id)); applyBank({ id, selectedLens: id });
    },
    subscribeVolumeLens(objectId: string, listener: (state: PreparedVolumeLensState) => void) {
      assert.equal(objectId, bankState?.objectId ?? required(deferredVolumeBank).objectId);
      lensCallbacks.add(listener); return () => { lensCallbacks.delete(listener); };
    },
    selectGalaxy: (id: string | null) => selections.push(id),
    resolveGalaxy: (id: string): PreparedCatalogObject | null => {
      if (!['catalogue:a','catalogue:b'].includes(id)) return null;
      const galaxy: PreparedGalaxyRecord = { id, name: id, aliases: [], status: 'confirmed', positionM: [1e20,0,0],
        skyPosition: { raDeg: 0, decDeg: 0, sourceRef: 'positions:row' },
        distance: { valuePc: 1, method: 'Published distance', sourceRef: 'PublishedBibliographicKey' },
        membership: { group: 'local-group', subgroup: 'field', basis: 'Published membership', sourceRef: 'membership:row' }, ...object };
      if (object.kind !== 'galaxy-cluster') return galaxy;
      return { ...galaxy, kind: 'galaxy-cluster', classification: required(object.classification),
        redshift: { value: .01, type: 'spectroscopic', sourceRef: 'positions:row' },
        aperture: { definition: 'R500', properRadiusM: 1e22, comovingRadiusM: 1e22, sourceRef: 'positions:row' } };
    } } satisfies Pick<ContextLayer, 'imageLayerFrames' | 'volumeLensFrames' | 'selectVolumeLens' | 'subscribeVolumeLens' | 'selectGalaxy' | 'resolveGalaxy'> & { volumeLensState(id: string): PreparedVolumeLensState | null };
  const sources: SpatialCatalogSource[] = [{ id: 'positions', url: 'https://example.test/positions', sha256: '0'.repeat(64), bytes: 1, citation: 'Published positions', references: [{ id: 'PublishedBibliographicKey', url: 'https://example.test/paper', citation: 'Distance paper' }] },
    { id: 'membership', url: 'https://example.test/membership', sha256: '0'.repeat(64), bytes: 1, citation: 'Published membership' },
    { id: 'unrelated', url: 'https://example.test/unrelated', sha256: '0'.repeat(64), bytes: 1, citation: 'Unused audit input' }];
  // Narrow test doubles intentionally expose only this controller's browser/runtime surface.
  const controller = createPreparedContextNavigation({ layer: layer as unknown as ContextLayer, windowTarget: windowTarget as unknown as Window, onError: error => { assert.ok(error instanceof Error); errors.push(error); },
    sources, unavailableObjectIds, presentation: { metersPerParsec: 3e16, defaultFocusRadiusM: 1e18, minimumDistanceRadii: .01, maximumDistanceM: 1e23 } });
  controller.connect(owner as unknown as ObjectWorldNavigation, { onFocusContentChange: (record, references, presentation) => content.push({ record, references, presentation }) });
  return { controller, owner, layer, lensCallbacks, lensWrites, windowTarget, errors, selections, writes, callbacks, content, flights, signal: () => signal,
    resolveDeferredVolumeBank() {
      assert.ok(deferredVolumeBank); bankState = deferredVolumeBank;
      if (pendingLens) { assert.ok(bankState.lenses.some(lens => lens.id === pendingLens)); bankState = { ...bankState, id: pendingLens, selectedLens: pendingLens }; }
      for (const callback of lensCallbacks) callback(bankState);
    } };
}

test('a saved lens link to an unavailable package still opens its actual catalogue record', () => {
  const f = fixture({ object: { detailedObjectId: 'helix' }, unavailableObjectIds: ['helix'] });
  f.windowTarget.location.searchParams.set('focusLens', 'eso-vista');
  f.controller.restore(f.windowTarget.location.href);
  assert.deepEqual(f.errors, []);
  assert.equal(last(f.content).record?.id, 'catalogue:a');
  assert.equal(last(f.content).presentation, null);
  assert.deepEqual(f.lensWrites, []);
  f.controller.destroy();
});

test('a direct focus link without a saved camera frames its target immediately', () => {
  const f = fixture();
  f.windowTarget.location.searchParams.delete('v');
  f.controller.restore(f.windowTarget.location.href);
  assert.deepEqual(f.flights,[{id:'catalogue:a',reducedMotion:true}]);
  assert.deepEqual(f.errors,[]);
  f.controller.destroy();
});

test('a focus link with a visible saved camera restores selection without reframing', () => {
  const f = fixture();
  f.controller.restore(f.windowTarget.location.href);
  assert.deepEqual(f.flights,[]);
  assert.equal(f.owner.preparedFocus()?.id,'catalogue:a');
  f.controller.destroy();
});

test('a focus link whose saved camera looks away reframes the named target', () => {
  const f = fixture({ cameraPositionM: [1e20, 0, -1e19] });
  f.controller.restore(f.windowTarget.location.href);
  assert.deepEqual(f.flights,[{id:'catalogue:a',reducedMotion:true}]);
  assert.equal(f.owner.preparedFocus()?.id,'catalogue:a');
  assert.equal(f.windowTarget.location.searchParams.has('v'), false);
  assert.deepEqual(f.errors,[]);
  f.controller.destroy();
});

test('a focus link whose saved camera puts the named target off-screen reframes it', () => {
  const f = fixture({ cameraPositionM: [2e20, 0, 1e19] });
  f.controller.restore(f.windowTarget.location.href);
  assert.deepEqual(f.flights,[{id:'catalogue:a',reducedMotion:true}]);
  assert.equal(f.windowTarget.location.searchParams.has('v'), false);
  assert.deepEqual(f.errors,[]);
  f.controller.destroy();
});

test('suspension isolates camera restore publications from incoming focus history and cancels an older selection flight', async () => {
  const f = fixture();
  f.controller.restore(f.windowTarget.location.href);
  assert.equal(required(last(f.content).record).id, 'catalogue:a');
  assert.deepEqual(last(f.content).references.map(source => source.id), ['positions', 'PublishedBibliographicKey', 'membership']);
  assert.equal(required(last(f.content).record).distance.sourceRef, 'PublishedBibliographicKey');
  const flight = f.controller.select({ id: 'catalogue:b' });
  assert.equal(required(f.owner.preparedFocus()).id, 'catalogue:b');
  assert.equal(required(last(f.content).record).id, 'catalogue:b');
  const incoming = 'https://example.test/mercury/?focus=catalogue:a&v=restored';
  f.windowTarget.location = new URL(incoming);
  f.controller.suspend();
  f.owner.setPreparedFocus(null); // Shared v restoration clears the runtime pivot.
  assert.equal(f.windowTarget.location.href, incoming);
  assert.equal(required(f.signal()).aborted, true);
  await flight;
  assert.equal(f.windowTarget.location.href, incoming);
  f.controller.restore(incoming);
  assert.equal(required(f.owner.preparedFocus()).id, 'catalogue:a');
  assert.equal(required(last(f.content).record).id, 'catalogue:a');
  assert.equal(f.windowTarget.location.href, incoming);
  assert.deepEqual(f.errors, []);
  f.controller.destroy();
  assert.equal(f.callbacks.size, 0);
});

test('an invalid incoming catalogue ID remains available for diagnosis after restoration publications', () => {
  const f = fixture();
  f.controller.restore(f.windowTarget.location.href);
  f.controller.suspend();
  const incoming = 'https://example.test/mercury/?focus=unknown&v=restored';
  f.windowTarget.location = new URL(incoming);
  f.owner.setPreparedFocus(null);
  f.controller.restore(incoming);
  f.owner.setPreparedFocus(null);
  assert.equal(f.errors.length, 1);
  assert.match(f.errors[0].message, /Unknown prepared galaxy/);
  assert.equal(f.windowTarget.location.href, incoming);
  assert.equal(f.selections.at(-1), null);
  assert.equal(last(f.content).record, null);
  f.controller.destroy();
});

test('an authored framing radius takes precedence over an oversized transparent image frame', () => {
  const imageLayerFrames = { detailed: baseFrame };
  const f = fixture({ imageLayerFrames, object: { detailedObjectId: 'detailed', presentation: { focusRadiusM: 2e18 } } });
  f.controller.restore(f.windowTarget.location.href);
  assert.equal(required(f.owner.preparedFocus()).framingRadiusM, 2e18);
  assert.equal(required(f.owner.preparedFocus()).limits.minimumDistanceM, 2e16);
  assert.equal(required(f.owner.preparedFocus()).limits.maximumDistanceM, 1e23);
  assert.deepEqual(f.errors, []);
  f.controller.destroy();
  const fallback = fixture({ imageLayerFrames, object: { detailedObjectId: 'detailed' } });
  fallback.controller.restore(fallback.windowTarget.location.href);
  assert.equal(required(fallback.owner.preparedFocus()).framingRadiusM, 5e20);
  fallback.controller.destroy();
});

test('a cluster focus uses its prepared aperture framing and source without pretending it has galaxy membership', () => {
  const f = fixture({ object: { kind: 'galaxy-cluster', membership: undefined,
    classification: { name: 'Cluster', basis: 'Published aperture', sourceRef: 'membership:cluster-row' }, presentation: { focusRadiusM: 9e22 } } });
  f.controller.restore(f.windowTarget.location.href);
  assert.deepEqual(f.errors, []);
  assert.equal(required(f.owner.preparedFocus()).framingRadiusM, 9e22);
  assert.deepEqual(last(f.content).references.map(source => source.id), ['positions', 'PublishedBibliographicKey', 'membership']);
  const cluster = required(last(f.content).record);
  assert.ok(isPreparedCluster(cluster));
  assert.equal(cluster.kind, 'galaxy-cluster');
  f.controller.destroy();
});

const volumeBank = (): PreparedVolumeLensState => ({ objectId: 'detailed', id: 'first', defaultLens: 'first', selectedLens: 'first', starsVisible: true,
  lenses: ['first', 'second', 'third'].map(id => ({ id, label: id, title: `${id} dataset`, description: 'Prepared observation', sourceUrl: 'https://example.test/source' })) });
const volumeLensFrames = { detailed: { framingRadiusUnits: 2, frame: baseFrame } };

test('volume focus uses its authored framing radius before transparent bounds and retains an explicit catalogue override', () => {
  for (const focusRadiusM of [undefined, 3e18]) {
    const f = fixture({ volumeLensFrames, volumeBank: volumeBank(), object: { detailedObjectId: 'detailed',
      ...(focusRadiusM ? { presentation: { focusRadiusM } } : {}) } });
    f.controller.restore(f.windowTarget.location.href);
    assert.equal(required(f.owner.preparedFocus()).framingRadiusM, focusRadiusM ?? 2e18);
    assert.deepEqual(f.errors, []);
    f.controller.destroy();
  }
});

test('focused lens selection follows applied runtime state while URL restore keeps the same camera owner', () => {
  const f = fixture({ volumeLensFrames, volumeBank: volumeBank(), object: { detailedObjectId: 'detailed' } });
  f.windowTarget.location.searchParams.set('focusLens', 'second');
  const incoming = f.windowTarget.location.href;
  f.controller.restore(incoming);
  assert.equal(required(f.layer.volumeLensState('detailed')).selectedLens, 'second');
  assert.equal(required(last(f.content).presentation).selectedLens, 'second');
  assert.equal(f.windowTarget.location.href, incoming);
  assert.equal(f.lensCallbacks.size, 1);
  const focus = f.owner.preparedFocus(), controls = required(last(f.content).presentation);
  controls.selectLens('third');
  assert.equal(f.owner.preparedFocus(), focus, 'Changing lens does not replace or move the camera focus');
  assert.equal(required(f.layer.volumeLensState('detailed')).selectedLens, 'third');
  assert.equal(required(last(f.content).presentation).selectedLens, 'third');
  assert.equal(f.windowTarget.location.searchParams.get('focusLens'), 'third');
  assert.equal(f.windowTarget.location.searchParams.get('v'), 'saved');
  f.controller.suspend();
  controls.selectLens('first');
  assert.equal(required(f.layer.volumeLensState('detailed')).selectedLens, 'third');
  f.windowTarget.location = new URL(incoming);
  f.controller.restore(incoming);
  assert.equal(required(f.layer.volumeLensState('detailed')).selectedLens, 'second');
  f.windowTarget.location.searchParams.delete('focusLens');
  f.controller.restore(f.windowTarget.location.href);
  assert.equal(required(f.layer.volumeLensState('detailed')).selectedLens, 'first', 'A plain focus restores its authored default');
  assert.equal(f.windowTarget.location.searchParams.get('focusLens'), 'first');
  f.owner.setPreparedFocus(null);
  assert.equal(last(f.content).presentation, null);
  assert.equal(f.windowTarget.location.searchParams.has('focus'), false);
  assert.equal(f.windowTarget.location.searchParams.has('focusLens'), false);
  assert.equal(f.lensCallbacks.size, 0);
  controls.selectLens('third');
  assert.equal(required(f.layer.volumeLensState('detailed')).selectedLens, 'first', 'Stale controls cannot mutate a departed focus');
  assert.deepEqual(f.errors, []);
  f.controller.destroy();
});

test('a saved lens waits for its lazy bank instead of rejecting the focus as unknown', () => {
  const bank = volumeBank();
  const f = fixture({ volumeLensFrames, deferredVolumeBank: bank, object: { detailedObjectId: bank.objectId } });
  f.windowTarget.location.searchParams.set('focusLens', 'second');
  const incoming = f.windowTarget.location.href;
  f.controller.restore(incoming);
  assert.deepEqual(f.errors, []);
  assert.equal(f.owner.preparedFocus()?.id, 'catalogue:a');
  assert.deepEqual(f.lensWrites, ['second']);
  assert.equal(last(f.content).record?.id, 'catalogue:a');
  assert.equal(last(f.content).presentation, null);
  assert.equal(f.windowTarget.location.href, incoming);
  f.resolveDeferredVolumeBank();
  assert.equal(required(last(f.content).presentation).selectedLens, 'second');
  assert.equal(f.windowTarget.location.href, incoming);
  f.controller.destroy();
});

test('invalid focused lenses retain their diagnostic URL and never apply an arbitrary bank', () => {
  for (const query of ['focusLens=unknown', 'focusLens=second&focusLens=third']) {
    const f = fixture({ volumeLensFrames, volumeBank: volumeBank(), object: { detailedObjectId: 'detailed' } });
    const incoming = `https://example.test/mercury/?focus=catalogue:a&${query}`;
    f.windowTarget.location = new URL(incoming);
    f.controller.restore(incoming);
    assert.equal(f.errors.length, 1);
    assert.match(f.errors[0].message, /focus lens/);
    assert.equal(f.windowTarget.location.href, incoming);
    assert.equal(f.owner.preparedFocus(), null);
    assert.deepEqual(f.lensWrites, []);
    f.controller.destroy();
  }
});

test('a lens query without a focus is removed and focused bank subscriptions are released on destruction', () => {
  const f = fixture({ volumeLensFrames, volumeBank: volumeBank(), object: { detailedObjectId: 'detailed' } });
  f.controller.restore(f.windowTarget.location.href);
  assert.equal(f.lensCallbacks.size, 1);
  f.windowTarget.location = new URL('https://example.test/mercury/?focusLens=third&v=saved');
  f.controller.restore(f.windowTarget.location.href);
  assert.equal(f.windowTarget.location.searchParams.has('focusLens'), false);
  assert.equal(f.windowTarget.location.searchParams.get('v'), 'saved');
  f.windowTarget.location.searchParams.set('focus', 'catalogue:a');
  f.controller.restore(f.windowTarget.location.href);
  assert.equal(f.lensCallbacks.size, 1);
  f.controller.destroy();
  assert.equal(f.lensCallbacks.size, 0);
});


test('an image-layer focus exposes its single optical dataset without volume-only actions', () => {
  const f = fixture({ imageLayerFrames: {detailed:baseFrame}, object:{detailedObjectId:'detailed'} });
  f.controller.restore('https://example.test/sun/?focus=catalogue:a&focusLens=optical');
  assert.deepEqual(f.errors, []);
  const controls = required(last(f.content).presentation);
  assert.equal(controls.selectedLens, 'optical');
  controls.selectLens('optical');
  assert.deepEqual(f.lensWrites, []);
  f.controller.destroy();
});

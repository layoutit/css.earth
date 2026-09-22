import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import type { BrowserWindow } from '../browser-types.mts';
import { bindNavigationIntent, createNavigationFragments, navigationFragments, type NavigationFragments } from '../navigation-fragments.mts';

// A fragment body is "<body data-object-shell>|<stage data-object-id>" for this parser fixture.
class FragmentDocument {
  body: { dataset: Record<string, string> }; stage: { dataset: Record<string, string> };
  constructor(shell: string, stage: string) { this.body = { dataset: { objectShell: shell } }; this.stage = { dataset: { objectId: stage } }; }
  querySelector(selector: string) { return selector === '.object-stage' ? this.stage : null; }
}
class FragmentParser {
  parseFromString(text: string) { const [shell, stage = shell] = text.split('|'); return new FragmentDocument(shell, stage); }
}
class IntentElement extends EventTarget {
  anchor: IntentAnchor | null; hovered: { dataset: Record<string, string | undefined> } | null = null;
  constructor(anchor: IntentAnchor | null = null) { super(); this.anchor = anchor; }
  closest(selector: string) { return selector === 'a[href]' ? this.anchor : null; }
  querySelector(selector: string) { return selector === '[data-object-hovered][data-object-navigate]' ? this.hovered : null; }
}
class IntentAnchor extends IntentElement {
  origin: string; pathname: string;
  preparedFocus = false;
  hasAttribute(name: string) { return name === 'data-prepared-focus-id' && this.preparedFocus; }
  constructor(pathname: string, origin: string) { super(); this.anchor = this; this.pathname = pathname; this.origin = origin; }
}
function fixtureWindow() {
  const timers = new Map<number, () => void>();
  let next = 0;
  const windowTarget = { DOMParser: FragmentParser, Element: IntentElement, HTMLAnchorElement: IntentAnchor,
    location: { origin: 'https://example.test' },
    setTimeout(callback: () => void) { timers.set(++next, callback); return next; },
    clearTimeout(id: number) { timers.delete(id); },
  } as unknown as BrowserWindow;
  const flush = () => { const pending = [...timers.values()]; timers.clear(); for (const callback of pending) callback(); };
  return { windowTarget, timers, flush };
}

test('an intent-fetched fragment is requested once, shared by preview and content, and bounded', async () => {
  const calls: string[] = [];
  const fragments = createNavigationFragments({ windowTarget: fixtureWindow().windowTarget, capacity: 2,
    async fetchPage(url) { calls.push(url); return new Response(url.split('/')[2]); } });
  fragments.prefetch('ceres');
  assert.equal(fragments.ready('ceres'), false, 'A request in flight is not yet a card');
  const [preview, content] = await Promise.all([fragments.get('ceres'), fragments.get('ceres')]);
  assert.notEqual(preview.document, content.document, 'Consumers never share a parsed document');
  assert.equal(fragments.inspect().activeDocuments, 2);
  preview.release(); content.release();
  assert.equal(fragments.inspect().activeDocuments, 0);
  const cachedCeres = fragments.peek('ceres'); assert.ok(cachedCeres); cachedCeres.release();
  const venus = await fragments.get('venus'); venus.release();
  const renewedCeres = fragments.peek('ceres'); assert.ok(renewedCeres, 'Reading a card renews it'); renewedCeres.release();
  const mars = await fragments.get('mars'); mars.release();
  assert.equal(fragments.peek('venus'), null, 'The least recently used fragment leaves the bounded cache');
  const retainedCeres = fragments.peek('ceres'); assert.ok(retainedCeres); retainedCeres.release();
  const reloadedVenus = await fragments.get('venus'); reloadedVenus.release();
  assert.deepEqual(calls, ['/navigation/ceres/', '/navigation/venus/', '/navigation/mars/', '/navigation/venus/']);
  assert.deepEqual(fragments.inspect(), { encodedEntries: 2, inFlightEntries: 0, activeDocuments: 0, parsedDocuments: 8 });
  assert.throws(() => createNavigationFragments({ windowTarget: fixtureWindow().windowTarget, capacity: 0 }), RangeError);
});

test('every module copy in a window reaches the same fragment cache', async () => {
  const windowTarget = fixtureWindow().windowTarget, other = fixtureWindow().windowTarget;
  // A query makes Node load a second module instance, like an HMR-updated development module.
  const specifier = '../navigation-fragments.mts?second-instance';
  const copy: unknown = await import(specifier);
  const shared = typeof copy === 'object' && copy !== null ? Reflect.get(copy, 'navigationFragments') : null;
  assert.equal(typeof shared, 'function');
  assert.notEqual(shared, navigationFragments, 'The fixture really loads a second module instance');
  const fragments = navigationFragments(windowTarget);
  assert.equal(navigationFragments(windowTarget), fragments);
  assert.equal(Reflect.apply(shared, undefined, [windowTarget]), fragments);
  assert.notEqual(navigationFragments(other), fragments, 'Each window owns its own cache');
});

test('failed, mismatched and cancelled requests never poison the shared fragment', async () => {
  const calls: string[] = [];
  let status = 503, body = 'venus';
  const fragments = createNavigationFragments({ windowTarget: fixtureWindow().windowTarget,
    async fetchPage(url) { calls.push(url); return new Response(body, { status }); } });
  await assert.rejects(fragments.get('venus'), /request failed: 503/u);
  status = 200; body = 'venus|mars';
  await assert.rejects(fragments.get('venus'), /registry identity/u);
  body = 'venus';
  const controller = new AbortController(), reason = new Error('replaced');
  const cancelled = fragments.get('venus', controller.signal);
  controller.abort(reason);
  await assert.rejects(cancelled, error => error === reason);
  const arrived = await fragments.get('venus');
  const cached = fragments.peek('venus'); assert.ok(cached);
  assert.notEqual(cached.document, arrived.document);
  arrived.release(); cached.release();
  assert.equal(fragments.inspect().activeDocuments, 0);
  assert.equal(calls.length, 3, 'Cancelling one consumer keeps the shared request');
  await assert.rejects(fragments.get('venus', AbortSignal.abort(reason)), error => error === reason);
  assert.equal(calls.length, 3);
});

test('hover, focus and world hover prefetch registry routes after a dwell; a press starts at once', () => {
  const { windowTarget, timers, flush } = fixtureWindow(), documentTarget = new EventTarget();
  const requested: string[] = [];
  const fragments: NavigationFragments = { prefetch(id) { requested.push(id); }, ready: () => false, peek: () => null,
    get: () => Promise.reject(new Error('Intent never waits for a fragment.')),
    inspect: () => ({ encodedEntries: 0, inFlightEntries: 0, activeDocuments: 0, parsedDocuments: 0 }) };
  const intent = bindNavigationIntent({ documentTarget: documentTarget as unknown as Document, windowTarget, fragments,
    objects: ['sun', 'ceres', 'venus'].map(id => ({ id, route: `/${id}/` })), skip: id => id === 'sun' });
  const link = (pathname: string, origin = 'https://example.test') => new IntentElement(new IntentAnchor(pathname, origin));
  const fire = (type: string, target: EventTarget) => {
    const event = new Event(type);
    Object.defineProperty(event, 'target', { value: target });
    documentTarget.dispatchEvent(event);
  };
  fire('pointerover', link('/ceres/'));
  fire('pointerover', link('/venus/'));
  assert.deepEqual(requested, [], 'A sweep waits for its dwell');
  assert.equal(timers.size, 1, 'A newer intent replaces the pending one');
  flush();
  assert.deepEqual(requested, ['venus']);
  fire('focusin', link('/ceres/')); flush();
  fire('pointerdown', link('/venus/'));
  assert.deepEqual(requested, ['venus', 'ceres', 'venus'], 'A press starts without a dwell');
  for (const target of [link('/sun/'), link('/ceres/', 'https://elsewhere.test'), link('/unregistered/'), new IntentElement()]) {
    fire('pointerover', target); flush();
  }
  assert.deepEqual(requested, ['venus', 'ceres', 'venus'], 'The current body, foreign and unregistered routes are ignored');
  const nebula = new IntentAnchor('/ceres/', 'https://example.test'); nebula.preparedFocus = true;
  fire('pointerdown', nebula);
  assert.deepEqual(requested, ['venus', 'ceres', 'venus'], 'A prepared focus never fetches its fallback body card.');
  const host = new IntentElement();
  host.hovered = { dataset: { objectNavigate: 'ceres' } };
  fire('objecthoverchange', host); flush();
  assert.deepEqual(requested.at(-1), 'ceres', 'A navigable body hovered in the world is prefetched');
  fire('objecthoverchange', host);
  host.hovered = null;
  fire('objecthoverchange', host);
  assert.equal(timers.size, 0, 'Leaving a body cancels its pending intent');
  fire('pointerover', link('/venus/'));
  intent.destroy();
  assert.equal(timers.size, 0);
  fire('pointerdown', link('/venus/'));
  assert.equal(requested.length, 4, 'A destroyed binding observes nothing');
});

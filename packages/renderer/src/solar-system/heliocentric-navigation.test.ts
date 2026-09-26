import assert from 'node:assert/strict';
import { test } from 'vitest';
import { bindObjectNavigationTarget, supportsObjectNavigation } from './heliocentric-navigation.js';

class Target extends EventTarget {
  style = { pointerEvents: '', cursor: '' };
  dataset: Record<string, string | undefined> = {};
  tabIndex = -1;
  attributes = new Map<string, string>();
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
}

test('a catalogue label needs explicit application navigation support', () => {
  const host = new EventTarget();
  assert.equal(supportsObjectNavigation(host, 'star:123'), false);
  const query = (event: Event) => {
    assert.equal(event.bubbles, true);
    if ('detail' in event && (event.detail as {objectId: string}).objectId === 'star:456') event.preventDefault();
  };
  host.addEventListener('objectnavigationquery', query);
  assert.equal(supportsObjectNavigation(host, 'star:123'), false);
  assert.equal(supportsObjectNavigation(host, 'star:456'), true);
  host.removeEventListener('objectnavigationquery', query);
  assert.equal(supportsObjectNavigation(host, 'star:456'), false);
});

function keyboard(key: string, repeat = false): Event {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperties(event, { key: { value: key }, repeat: { value: repeat } });
  return event;
}

test('a visible retained target emits one generic bubbling selection and blocks camera pointer ownership', () => {
  const element = new Target(), stage = new EventTarget();
  const selections: unknown[] = [];
  stage.addEventListener('objectnavigate', event => {
    assert.equal(event.bubbles, true);
    if ('detail' in event) selections.push(event.detail);
  });
  const target = bindObjectNavigationTarget(element, stage);
  target.update('venus', 'Venus');
  assert.equal(element.style.pointerEvents, 'auto');
  assert.equal(element.tabIndex, 0);
  let pointerStopped = false;
  element.addEventListener('pointerdown', event => { pointerStopped = event.cancelBubble; });
  element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  assert.equal(pointerStopped, true);
  const click = new Event('click', { cancelable: true });
  element.dispatchEvent(click);
  assert.equal(click.defaultPrevented, true);
  assert.deepEqual(selections, [{ objectId: 'venus' }]);
  target.destroy();
});

test('hidden or occluded targets cannot activate, including programmatic clicks and stale caption slots', () => {
  const element = new Target(), stage = new EventTarget();
  let count = 0;
  stage.addEventListener('objectnavigate', () => count++);
  const target = bindObjectNavigationTarget(element, stage);
  target.update('mercury', 'Mercury');
  target.update(null);
  element.dispatchEvent(new Event('click'));
  element.dispatchEvent(keyboard('Enter'));
  assert.equal(count, 0);
  assert.equal(element.style.pointerEvents, 'none');
  assert.equal(element.tabIndex, -1);
  assert.equal(element.dataset.objectNavigate, undefined);
  target.destroy();
  element.dispatchEvent(new Event('click'));
  assert.equal(count, 0);
});

test('reused captions select their new prepared object ID and keyboard repeats do not duplicate navigation', () => {
  const element = new Target(), stage = new EventTarget();
  const selections: unknown[] = [];
  stage.addEventListener('objectnavigate', event => { if ('detail' in event) selections.push(event.detail); });
  const target = bindObjectNavigationTarget(element, stage);
  target.update('mercury', 'Mercury');
  target.update('future-object', 'Future object');
  element.dispatchEvent(keyboard(' '));
  element.dispatchEvent(keyboard('Enter', true));
  element.dispatchEvent(keyboard('ArrowRight'));
  assert.deepEqual(selections, [{ objectId: 'future-object' }]);
  assert.equal(element.attributes.get('aria-label'), 'Go to Future object');
  target.destroy();
});

test('targets in a document share one press listener pair, removed with the last binding', () => {
  const owner = new EventTarget(), added: string[] = [], removed: string[] = [];
  const add = owner.addEventListener.bind(owner), remove = owner.removeEventListener.bind(owner);
  owner.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null) => { added.push(type); add(type, listener); };
  owner.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject | null) => { removed.push(type); remove(type, listener); };
  const markers = Array.from({ length: 3 }, () => Object.assign(new Target(), { ownerDocument: owner }));
  const own = markers.map(marker => { const listening: string[] = [], base = marker.addEventListener.bind(marker);
    marker.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null) => { listening.push(type); base(type, listener); }; return listening; });
  const bindings = markers.map(marker => bindObjectNavigationTarget(marker, new EventTarget()));
  assert.deepEqual(added, ['pointerdown', 'mousedown']);
  // No marker is a pointer target of its own: on iOS each would be a touch region recomputed every frame.
  for (const listening of own) assert.deepEqual(listening.filter(type => type.startsWith('pointer') || type === 'mousedown'), []);
  bindings[0]!.destroy(); bindings[1]!.destroy();
  assert.deepEqual(removed, []);
  bindings[2]!.destroy();
  assert.deepEqual(removed, ['pointerdown', 'mousedown']);
});

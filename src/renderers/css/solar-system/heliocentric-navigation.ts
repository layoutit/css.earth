/** The shell owns destination availability. Unhandled queries fail closed. */
export function supportsObjectNavigation(host: EventTarget, objectId: string): boolean {
  const query = new CustomEvent('objectnavigationquery', { bubbles: true, cancelable: true, detail: { objectId } });
  host.dispatchEvent(query);
  return query.defaultPrevented;
}

/** A retained target reports selection to the application; it never owns navigation. */
export interface ObjectNavigationTarget extends EventTarget {
  readonly style: Pick<CSSStyleDeclaration, 'pointerEvents' | 'cursor'>;
  readonly dataset: DOMStringMap;
  tabIndex: number;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

// On iOS every element with a pointer listener is a touch target, and WebKit recomputes each target's region (a walk
// of its subtree with its transforms) on every rendering update. A listener on every marker cost about a fifth of the
// page's rendering during flights. One press listener per document stops presses on bound, navigable targets instead:
// a document listener covers the whole page without a walk.
const MARKER_PRESS = '[data-object-navigate][data-object-navigate-activation]';
const pressDelegates = new WeakMap<EventTarget, { readonly stop: (event: Event) => void; bindings: number }>();
function stopMarkerPress(event: Event) {
  const target = event.target;
  if (typeof Element !== 'undefined' && target instanceof Element && target.closest(MARKER_PRESS)) event.stopPropagation();
}
function delegatedPresses(element: ObjectNavigationTarget): EventTarget | null {
  const owner = 'ownerDocument' in element ? element.ownerDocument : null;
  if (!owner || typeof EventTarget === 'undefined' || !(owner instanceof EventTarget)) return null;
  let delegate = pressDelegates.get(owner);
  if (!delegate) {
    delegate = { stop: stopMarkerPress, bindings: 0 };
    owner.addEventListener('pointerdown', delegate.stop);
    owner.addEventListener('mousedown', delegate.stop);
    pressDelegates.set(owner, delegate);
  }
  delegate.bindings++;
  return owner;
}
function releaseDelegatedPresses(owner: EventTarget) {
  const delegate = pressDelegates.get(owner);
  if (!delegate || --delegate.bindings > 0) return;
  owner.removeEventListener('pointerdown', delegate.stop);
  owner.removeEventListener('mousedown', delegate.stop);
  pressDelegates.delete(owner);
}

export function bindObjectNavigationTarget(element: ObjectNavigationTarget, host: EventTarget,
  { activation = 'click', pointerTarget = true }: { activation?: 'click' | 'dblclick';
    /** False when a stage picker owns hits: the target keeps no pointer or cursor style. */
    pointerTarget?: boolean } = {}) {
  let objectId: string | null = null;
  let previousLabel: string | null | undefined;
  const stopPointer = (event: Event) => { if (objectId !== null) event.stopPropagation(); };
  const activate = (event: Event) => {
    if (objectId === null || ('button' in event && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    host.dispatchEvent(new CustomEvent('objectnavigate', { bubbles: true, detail: { objectId } }));
  };
  const keyboard = (event: Event) => {
    if (!('key' in event) || (event.key !== 'Enter' && event.key !== ' ') || ('repeat' in event && event.repeat)) return;
    activate(event);
  };
  element.setAttribute('role', 'button');
  element.dataset.objectNavigateActivation = activation;
  // A real document delegates presses; a target without one (a test double) listens itself.
  const pressOwner = delegatedPresses(element);
  if (!pressOwner) {
    element.addEventListener('pointerdown', stopPointer);
    element.addEventListener('mousedown', stopPointer);
  }
  element.addEventListener('dblclick', activation === 'dblclick' ? activate : stopPointer);
  element.addEventListener('click', activation === 'click' ? activate : stopPointer);
  element.addEventListener('keydown', keyboard);
  const update = (next: string | null, name?: string) => {
    const label = next === null ? null : `Go to ${name ?? next}`;
    if (objectId === next && previousLabel === label) return;
    objectId = next;
    previousLabel = label;
    if (pointerTarget) {
      element.style.pointerEvents = next === null ? 'none' : 'auto';
      element.style.cursor = next === null ? '' : 'pointer';
    }
    element.tabIndex = next === null ? -1 : 0;
    element.setAttribute('aria-disabled', String(next === null));
    if (next === null) {
      delete element.dataset.objectNavigate;
      element.removeAttribute('aria-label');
    } else {
      element.dataset.objectNavigate = next;
      element.setAttribute('aria-label', label!);
    }
  };
  update(null);
  return Object.freeze({ update, destroy() {
    update(null);
    if (pressOwner) releaseDelegatedPresses(pressOwner);
    else {
      element.removeEventListener('pointerdown', stopPointer);
      element.removeEventListener('mousedown', stopPointer);
    }
    delete element.dataset.objectNavigateActivation;
    element.removeEventListener('dblclick', activation === 'dblclick' ? activate : stopPointer);
    element.removeEventListener('click', activation === 'click' ? activate : stopPointer);
    element.removeEventListener('keydown', keyboard);
  } });
}

/** A retained target reports selection to the application; it never owns navigation. */
export interface ObjectNavigationTarget extends EventTarget {
  readonly style: Pick<CSSStyleDeclaration, 'pointerEvents' | 'cursor'>;
  readonly dataset: DOMStringMap;
  tabIndex: number;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export function bindObjectNavigationTarget(element: ObjectNavigationTarget, host: EventTarget) {
  let objectId: string | null = null;
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
  element.addEventListener('pointerdown', stopPointer);
  element.addEventListener('mousedown', stopPointer);
  element.addEventListener('dblclick', stopPointer);
  element.addEventListener('click', activate);
  element.addEventListener('keydown', keyboard);
  const update = (next: string | null, name?: string) => {
    objectId = next;
    element.style.pointerEvents = next === null ? 'none' : 'auto';
    element.style.cursor = next === null ? '' : 'pointer';
    element.tabIndex = next === null ? -1 : 0;
    element.setAttribute('aria-disabled', String(next === null));
    if (next === null) {
      delete element.dataset.objectNavigate;
      element.removeAttribute('aria-label');
    } else {
      element.dataset.objectNavigate = next;
      element.setAttribute('aria-label', `Go to ${name ?? next}`);
    }
  };
  update(null);
  return Object.freeze({ update, destroy() {
    update(null);
    element.removeEventListener('pointerdown', stopPointer);
    element.removeEventListener('mousedown', stopPointer);
    element.removeEventListener('dblclick', stopPointer);
    element.removeEventListener('click', activate);
    element.removeEventListener('keydown', keyboard);
  } });
}

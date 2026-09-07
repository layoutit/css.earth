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

export function bindObjectNavigationTarget(element: ObjectNavigationTarget, host: EventTarget,
  { activation = 'click' }: { activation?: 'click' | 'dblclick' } = {}) {
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
  element.addEventListener('pointerdown', stopPointer);
  element.addEventListener('mousedown', stopPointer);
  element.addEventListener('dblclick', activation === 'dblclick' ? activate : stopPointer);
  element.addEventListener('click', activation === 'click' ? activate : stopPointer);
  element.addEventListener('keydown', keyboard);
  const update = (next: string | null, name?: string) => {
    const label = next === null ? null : `Go to ${name ?? next}`;
    if (objectId === next && previousLabel === label) return;
    objectId = next;
    previousLabel = label;
    element.style.pointerEvents = next === null ? 'none' : 'auto';
    element.style.cursor = next === null ? '' : 'pointer';
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
    element.removeEventListener('pointerdown', stopPointer);
    element.removeEventListener('mousedown', stopPointer);
    delete element.dataset.objectNavigateActivation;
    element.removeEventListener('dblclick', activation === 'dblclick' ? activate : stopPointer);
    element.removeEventListener('click', activation === 'click' ? activate : stopPointer);
    element.removeEventListener('keydown', keyboard);
  } });
}

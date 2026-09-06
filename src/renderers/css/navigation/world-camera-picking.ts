/** The transparent input surface owns gestures; pick retained scene targets
 * beneath it without changing their celestial paint/occlusion order. */
type SelectedClick = { x: number; y: number; timestamp: number; objectId: string };
type SecondPress = { pointerId: number; pointerType: string; x: number; y: number };
type PickingGesture = { selected: SelectedClick | null; second: SecondPress | null; consumeRelease: boolean };
const gestures = new WeakMap<HTMLElement, PickingGesture>();
const DOUBLE_CLICK_MILLISECONDS = 500;
const CLICK_SLOP_PIXELS = 5;

export function bindWorldCameraPicking(inputSurface: HTMLElement, host: HTMLElement) {
  const document = inputSurface.ownerDocument;
  const windowTarget = document.defaultView;
  if (!windowTarget) throw new Error('World picking requires a mounted window.');
  // The input element is retained across detailed-object owner changes. The
  // second press must still belong to the first selection after that handoff.
  const gesture = gestures.get(inputSurface) ?? { selected: null, second: null, consumeRelease: false };
  gestures.set(inputSurface, gesture);
  let pointer: { id: number; x: number; y: number; dragged: boolean } | null = null;
  const matchesSelection = (event: MouseEvent) => {
    const selected = gesture.selected;
    return selected !== null && event.timeStamp >= selected.timestamp &&
      event.timeStamp - selected.timestamp <= DOUBLE_CLICK_MILLISECONDS &&
      Math.hypot(event.clientX - selected.x, event.clientY - selected.y) <= CLICK_SLOP_PIXELS;
  };
  const consume = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const down = (event: PointerEvent) => {
    if (event.target !== inputSurface || !event.isPrimary || event.button !== 0) return;
    if (event.pointerType === 'mouse' && matchesSelection(event)) {
      gesture.second = { pointerId: event.pointerId, pointerType: event.pointerType,
        x: event.clientX, y: event.clientY };
      gesture.consumeRelease = true;
      consume(event);
      return;
    }
    gesture.selected = null; gesture.second = null; gesture.consumeRelease = false;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
  };
  const move = (event: PointerEvent) => {
    const second = gesture.second;
    if (second?.pointerId === event.pointerId) {
      if (Math.hypot(event.clientX - second.x, event.clientY - second.y) <= CLICK_SLOP_PIXELS) {
        consume(event); return;
      }
      // A real drag following a selection remains an interruption. Replay
      // its original press through the single native owner, then let this
      // movement continue; only a stationary second click is coalesced.
      gesture.selected = null; gesture.second = null; gesture.consumeRelease = false;
      inputSurface.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true,
        pointerId: second.pointerId, pointerType: second.pointerType, isPrimary: true,
        button: 0, buttons: 1, clientX: second.x, clientY: second.y }));
    }
    if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > CLICK_SLOP_PIXELS) pointer.dragged = true;
  };
  const up = (event: PointerEvent) => {
    if (gesture.second?.pointerId !== event.pointerId) return;
    gesture.second = null;
    consume(event);
  };
  const mouseDown = (event: MouseEvent) => {
    if (event.target === inputSurface && gesture.consumeRelease && matchesSelection(event)) consume(event);
  };
  const click = (event: MouseEvent) => {
    if (event.target === inputSurface && gesture.consumeRelease && matchesSelection(event)) {
      consume(event); return;
    }
    if (event.button !== 0 || pointer?.dragged || event.target !== inputSurface) { pointer = null; return; }
    pointer = null;
    const targets = document.elementsFromPoint(event.clientX, event.clientY);
    const target = targets.find(element => element instanceof HTMLElement && host.contains(element) &&
      element.dataset.objectNavigate && element.style.pointerEvents === 'auto');
    if (!(target instanceof HTMLElement)) return;
    gesture.selected = { x: event.clientX, y: event.clientY, timestamp: event.timeStamp,
      objectId: target.dataset.objectNavigate! };
    event.preventDefault();
    event.stopPropagation();
    target.click();
  };
  const doubleClick = (event: MouseEvent) => {
    if (event.target !== inputSurface || !gesture.consumeRelease || !matchesSelection(event)) return;
    gesture.selected = null; gesture.second = null; gesture.consumeRelease = false;
    consume(event);
  };
  const cancel = () => { pointer = null; gesture.second = null; gesture.consumeRelease = false; };
  // Window capture precedes document flight interruption even after an owner
  // handoff rebinds us. Native pointerdown.detail cannot identify click two.
  windowTarget.addEventListener('pointerdown', down, { capture: true });
  windowTarget.addEventListener('pointermove', move, { capture: true });
  windowTarget.addEventListener('pointerup', up, { capture: true });
  windowTarget.addEventListener('pointercancel', cancel, { capture: true });
  windowTarget.addEventListener('mousedown', mouseDown, { capture: true });
  windowTarget.addEventListener('click', click, { capture: true });
  windowTarget.addEventListener('dblclick', doubleClick, { capture: true });
  return () => {
    windowTarget.removeEventListener('pointerdown', down, { capture: true });
    windowTarget.removeEventListener('pointermove', move, { capture: true });
    windowTarget.removeEventListener('pointerup', up, { capture: true });
    windowTarget.removeEventListener('pointercancel', cancel, { capture: true });
    windowTarget.removeEventListener('mousedown', mouseDown, { capture: true });
    windowTarget.removeEventListener('click', click, { capture: true });
    windowTarget.removeEventListener('dblclick', doubleClick, { capture: true });
  };
}

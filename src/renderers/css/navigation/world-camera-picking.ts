import { screenPicking } from './screen-picking.js';
import { createOpacityClock } from '../stars/opacity-clock.js';
import { setHoverCursor } from './cursor-state.js';

/** The transparent input surface owns gestures. The presentation publishes
 * its already-clipped targets; input never searches the rendered document. */
type SelectedClick = { x: number; y: number; timestamp: number; objectId: string };
type SecondPress = { pointerId: number; pointerType: string; x: number; y: number };
type PickingGesture = { selected: SelectedClick | null; second: SecondPress | null; consumeRelease: boolean };
const gestures = new WeakMap<HTMLElement, PickingGesture>();
const DOUBLE_CLICK_MILLISECONDS = 500;
const CLICK_SLOP_PIXELS = 5;

export function bindWorldCameraPicking(inputSurface: HTMLElement, host: HTMLElement,
  readBounds: () => { left: number; top: number; width: number; height: number },
  detailOccludes?: (clientX: number, clientY: number) => boolean) {
  const document = inputSurface.ownerDocument;
  const windowTarget = document.defaultView;
  if (!windowTarget) throw new Error('World picking requires a mounted window.');
  // The input element is retained across detailed-object owner changes. The
  // second press must still belong to the first selection after that handoff.
  const gesture = gestures.get(inputSurface) ?? { selected: null, second: null, consumeRelease: false };
  gestures.set(inputSurface, gesture);
  let pointer: { id: number; x: number; y: number; dragged: boolean } | null = null;
  let hovered: HTMLElement | null = null;
  const registry = screenPicking(host);
  const pick = (event: MouseEvent) => {
    const bounds = readBounds();
    const target = registry.pick(event.clientX - bounds.left - bounds.width / 2,
      event.clientY - bounds.top - bounds.height / 2);
    // Context sprites paint behind the selected detailed surface. Their screen
    // bounds can overlap it even when their centres are not occluded. Reuse the
    // detail owner's existing hit contract for both hover and activation.
    // Targets anchored on the detailed surface itself paint in front of it and opt out.
    return target && target.dataset.surfacePick !== 'true' && detailOccludes?.(event.clientX, event.clientY) ? null : target;
  };
  let hoveredGroup: HTMLElement | null = null;
  const setHovered = (target: HTMLElement | null, interactive: boolean) => {
    if (target === hovered) return;
    if (hovered) delete hovered.dataset.objectHovered;
    if (hoveredGroup) delete hoveredGroup.dataset.objectHovered;
    hoveredGroup = target?.closest<HTMLElement>('[data-context-group]') ??
      (target?.dataset.objectNavigate
        ? host.querySelector<HTMLElement>(`[data-context-group="${target.dataset.objectNavigate}"]`) : null);
    if (hoveredGroup) hoveredGroup.dataset.objectHovered = 'true';
    if (target) {
      target.dataset.objectHovered = 'true';
      setHoverCursor(inputSurface, target.dataset.objectNavigate ? 'pointer' : null);
    } else {
      setHoverCursor(inputSurface, null);
    }
    hovered = target;
    host.dispatchEvent(new CustomEvent('objecthoverchange', { detail: { interactive } }));
  };
  const frameClock = createOpacityClock(windowTarget);
  let hoverPoint: PointerEvent | null = null, hoverFrame: number | null = null;
  let hoverInteractive = false;
  const scheduleHover = (interactive = false) => {
    hoverInteractive ||= interactive;
    if (!hoverPoint || hoverFrame !== null) return;
    hoverFrame = frameClock.request(() => {
      hoverFrame = null;
      const interactive = hoverInteractive; hoverInteractive = false;
      setHovered(hoverPoint ? pick(hoverPoint) : null, interactive);
    });
  };
  const unsubscribe = registry.subscribe(scheduleHover);
  const clearHover = (event?: Event) => {
    hoverPoint = null;
    if (hoverFrame !== null) frameClock.cancel(hoverFrame);
    hoverFrame = null; hoverInteractive = false;
    setHovered(null, event?.type === 'pointerleave');
  };
  const matchesSelection = (event: MouseEvent) => {
    const selected = gesture.selected;
    return selected !== null && event.timeStamp >= selected.timestamp &&
      event.timeStamp - selected.timestamp <= DOUBLE_CLICK_MILLISECONDS &&
      Math.hypot(event.clientX - selected.x, event.clientY - selected.y) <= CLICK_SLOP_PIXELS;
  };
  const consume = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const down = (event: PointerEvent) => {
    clearHover();
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
    if (event.target === inputSurface && event.buttons === 0 && event.pointerType !== 'touch') {
      hoverPoint = event; scheduleHover(true);
    } else clearHover();
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
    const target = pick(event);
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.objectNavigateActivation === 'dblclick') {
      consume(event);
      return;
    }
    gesture.selected = { x: event.clientX, y: event.clientY, timestamp: event.timeStamp,
      objectId: target.dataset.objectNavigate! };
    event.preventDefault();
    event.stopPropagation();
    target.click();
  };
  const doubleClick = (event: MouseEvent) => {
    if (event.target !== inputSurface) return;
    if (gesture.consumeRelease && matchesSelection(event)) {
      gesture.selected = null; gesture.second = null; gesture.consumeRelease = false;
      consume(event);
      return;
    }
    const target = pick(event);
    if (event.button !== 0 || target?.dataset.objectNavigateActivation !== 'dblclick') return;
    consume(event);
    target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, button: 0 }));
  };
  const cancel = () => { clearHover(); pointer = null; gesture.second = null; gesture.consumeRelease = false; };
  // Window capture precedes document flight interruption even after an owner
  // handoff rebinds us. Native pointerdown.detail cannot identify click two.
  windowTarget.addEventListener('pointerdown', down, { capture: true });
  windowTarget.addEventListener('pointermove', move, { capture: true });
  windowTarget.addEventListener('pointerup', up, { capture: true });
  windowTarget.addEventListener('pointercancel', cancel, { capture: true });
  windowTarget.addEventListener('mousedown', mouseDown, { capture: true });
  windowTarget.addEventListener('click', click, { capture: true });
  windowTarget.addEventListener('dblclick', doubleClick, { capture: true });
  windowTarget.addEventListener('blur', clearHover);
  windowTarget.addEventListener('wheel', clearHover, { capture: true });
  inputSurface.addEventListener('pointerleave', clearHover);
  return () => {
    clearHover();
    unsubscribe();
    windowTarget.removeEventListener('pointerdown', down, { capture: true });
    windowTarget.removeEventListener('pointermove', move, { capture: true });
    windowTarget.removeEventListener('pointerup', up, { capture: true });
    windowTarget.removeEventListener('pointercancel', cancel, { capture: true });
    windowTarget.removeEventListener('mousedown', mouseDown, { capture: true });
    windowTarget.removeEventListener('click', click, { capture: true });
    windowTarget.removeEventListener('dblclick', doubleClick, { capture: true });
    windowTarget.removeEventListener('blur', clearHover);
    windowTarget.removeEventListener('wheel', clearHover, { capture: true });
    inputSurface.removeEventListener('pointerleave', clearHover);
  };
}

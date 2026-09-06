/** The single transparent input surface owns native gestures; pick retained
 * scene targets beneath it without changing celestial paint/occlusion order. */
export function bindWorldCameraPicking(inputSurface: HTMLElement, host: HTMLElement) {
  let pointer: { id: number; x: number; y: number; dragged: boolean } | null = null;
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
  };
  const move = (event: PointerEvent) => {
    if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 5) pointer.dragged = true;
  };
  const click = (event: MouseEvent) => {
    if (event.button !== 0 || pointer?.dragged || event.target !== inputSurface) { pointer = null; return; }
    pointer = null;
    const targets = inputSurface.ownerDocument.elementsFromPoint(event.clientX, event.clientY);
    const target = targets.find(element => element instanceof HTMLElement && host.contains(element) &&
      element.dataset.objectNavigate && element.style.pointerEvents === 'auto');
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    target.click();
  };
  const cancel = () => { pointer = null; };
  inputSurface.addEventListener('pointerdown', down, true);
  inputSurface.addEventListener('pointermove', move, true);
  inputSurface.addEventListener('pointercancel', cancel, true);
  inputSurface.addEventListener('click', click, true);
  return () => {
    inputSurface.removeEventListener('pointerdown', down, true);
    inputSurface.removeEventListener('pointermove', move, true);
    inputSurface.removeEventListener('pointercancel', cancel, true);
    inputSurface.removeEventListener('click', click, true);
  };
}

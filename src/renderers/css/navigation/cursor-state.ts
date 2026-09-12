const cursors = new WeakMap<HTMLElement, { base: string; hover: string | null }>();

function stateFor(surface: HTMLElement) {
  const existing = cursors.get(surface);
  if (existing) return existing;
  const state = { base: '', hover: null };
  cursors.set(surface, state);
  return state;
}

function apply(surface: HTMLElement, state: { base: string; hover: string | null }) {
  surface.style.cursor = state.hover ?? state.base;
}

export function setBaseCursor(surface: HTMLElement, cursor: string) {
  const state = stateFor(surface);
  state.base = cursor;
  apply(surface, state);
}

export function setHoverCursor(surface: HTMLElement, cursor: string | null) {
  const state = stateFor(surface);
  state.hover = cursor;
  apply(surface, state);
}

export function clearCursor(surface: HTMLElement) {
  cursors.delete(surface);
  surface.style.cursor = '';
}

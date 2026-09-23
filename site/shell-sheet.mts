import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser-types.mts';
import { MOBILE_SHEET_POLICY, MOBILE_VIEWPORT_QUERY, mobileSheetKeyboardInset } from './runtime-policy.mts';

type SheetState = typeof MOBILE_SHEET_POLICY.states[number];
type SheetStops = Readonly<Record<SheetState, number>>;
interface SheetGesture {
  pointerId: number; x: number; y: number; start: number; offset: number; stops: SheetStops;
  fromHandle: boolean; active: boolean; lastY: number; lastTime: number; velocity: number;
}

// Phones show information in a bottom sheet that snaps between the heights
// declared in shell-layout.css. Wider layouts ignore every sheet gesture.
export function createSheetController(documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime, readSelectionKey: () => string) {
  const sheet = documentTarget.querySelector(".object-sidebar");
  const handle = documentTarget.querySelector(".object-sheet-handle");
  const search = documentTarget.querySelector(".object-sidebar-search");
  if (!(sheet instanceof windowTarget.HTMLElement) ||
      !(handle instanceof windowTarget.HTMLInputElement) ||
      !(search instanceof windowTarget.HTMLInputElement)) {
    throw new Error("Object shell sheet is incomplete.");
  }
  const { body } = documentTarget;
  const { states, dragSlopPixels, flingPixelsPerMillisecond, flingFreshnessMilliseconds,
    overdragPixels, overdragResistance } = MOBILE_SHEET_POLICY;
  const mobile = windowTarget.matchMedia(MOBILE_VIEWPORT_QUERY);
  const events = new AbortController();
  const { signal } = events;
  lifetime.onDispose(() => events.abort());
  let state: SheetState = handle.checked ? "full" : "peek";
  // Search opens the whole sheet; leaving search returns to the earlier height.
  let searchReturn: SheetState | null = null;
  let gesture: SheetGesture | null = null;
  let dragged = false;
  let snapFrame = 0;
  let readingPosition: { key: string; top: number } | null = null;
  let handleReadingPosition: number | null = null;
  const readingKey = readSelectionKey;
  lifetime.onDispose(() => {
    if (snapFrame) windowTarget.cancelAnimationFrame(snapFrame);
    snapFrame = 0;
  });

  // Distances from the fully open sheet down to each snap state.
  const stops = (): SheetStops => {
    const style = windowTarget.getComputedStyle(sheet);
    const peek = Number.parseFloat(style.getPropertyValue("--sheet-peek"));
    const half = Number.parseFloat(style.getPropertyValue("--sheet-half"));
    if (!Number.isFinite(peek) || !Number.isFinite(half)) {
      throw new Error("Object shell sheet heights are missing.");
    }
    const height = sheet.offsetHeight;
    return { peek: Math.max(0, height - peek), half: Math.max(0, height - half), full: 0 };
  };
  const currentOffset = () => {
    const transform = windowTarget.getComputedStyle(sheet).transform;
    return transform === "none" ? 0 : new windowTarget.DOMMatrixReadOnly(transform).m42;
  };
  const nearest = (offset: number, points: SheetStops, candidates: readonly SheetState[] = states) =>
    candidates.reduce((best, next) =>
      Math.abs(points[next] - offset) < Math.abs(points[best] - offset) ? next : best);
  const settle = (next: SheetState, speed = 0) => {
    const points = stops();
    const distance = Math.min(1, Math.abs(points[next] - currentOffset()) / Math.max(1, points.peek));
    const velocity = Math.min(1, Math.abs(speed) / 1.2);
    const duration = Math.round(Math.max(180, Math.min(340, 220 + 120 * distance - 60 * velocity)));
    sheet.style.setProperty("--sheet-snap-duration", `${duration}ms`);
    if (state === 'full' && next !== 'full') readingPosition = { key: readingKey(), top: handleReadingPosition ?? sheet.scrollTop };
    handleReadingPosition = null;
    const restoreScroll = next === 'full' && state !== 'full' && readingPosition?.key === readingKey() ? readingPosition.top : null;
    if (next !== "full") sheet.scrollTop = 0;
    state = next;
    body.dataset.sheet = next;
    handle.checked = next !== "peek";
    sheet.classList.remove("is-dragging");
    if (snapFrame) windowTarget.cancelAnimationFrame(snapFrame);
    snapFrame = windowTarget.requestAnimationFrame(() => {
      snapFrame = 0;
      if (!lifetime.disposed) {
        sheet.style.removeProperty("transform");
        if (restoreScroll !== null) sheet.scrollTop = restoreScroll;
      }
    });
  };
  // Scrolled content keeps its own drags until it returns to the top.
  const scrolled = (target: EventTarget | null) => {
    for (let node = target instanceof windowTarget.Element ? target : null; node; node = node.parentElement) {
      if (node.scrollTop > 0) return true;
      if (node === sheet) return false;
    }
    return false;
  };
  const ownsGesture = (target: EventTarget | null) => target !== handle && target instanceof windowTarget.Element &&
    target.closest("input, select, textarea, [data-surface-minimap]") !== null;

  sheet.addEventListener("pointerdown", (event) => {
    dragged = false;
    if (!mobile.matches || !event.isPrimary || event.button > 0 || ownsGesture(event.target)) return;
    const fromHandle = event.target instanceof windowTarget.Node && handle.contains(event.target);
    // Native focus can scroll the checkbox into view before its change event.
    // Save the reading position before that default action, including a drag.
    if (fromHandle && state === 'full') handleReadingPosition = sheet.scrollTop;
    if (state === "full" && !fromHandle && scrolled(event.target)) return;
    const start = currentOffset();
    gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, start, offset: start,
      stops: stops(), fromHandle, active: false, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0 };
  }, { signal });

  // A quick pointer can leave the sheet before the drag captures it, so the
  // gesture follows the document until it becomes a drag.
  documentTarget.addEventListener("pointermove", (event) => {
    const drag = gesture;
    if (drag === null || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < dragSlopPixels) return;
      // Sideways swipes belong to carousels; pulling up an open sheet scrolls it.
      if (Math.abs(dx) > Math.abs(dy) || (state === "full" && !drag.fromHandle && dy < 0)) {
        gesture = null;
        return;
      }
      drag.active = true;
      sheet.setPointerCapture(event.pointerId);
      sheet.classList.add("is-dragging");
    }
    const raw = drag.start + dy;
    const overdrag = (distance: number) => Math.min(overdragPixels, distance * overdragResistance);
    drag.offset = raw < 0 ? -overdrag(-raw)
      : raw > drag.stops.peek ? drag.stops.peek + overdrag(raw - drag.stops.peek) : raw;
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = 0.8 * (event.clientY - drag.lastY) / elapsed + 0.2 * drag.velocity;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    sheet.style.transform = `translate3d(0, ${drag.offset}px, 0)`;
  }, { signal });

  const release = (event: PointerEvent) => {
    const drag = gesture;
    if (drag === null || event.pointerId !== drag.pointerId) return;
    gesture = null;
    if (!drag.active) return;
    dragged = true;
    searchReturn = null;
    if (event.type === "pointercancel") {
      settle(state);
      return;
    }
    // A pause before release places the sheet; a flick carries it to the next stop.
    const velocity = event.timeStamp - drag.lastTime > flingFreshnessMilliseconds ? 0 : drag.velocity;
    const ahead = states.filter((candidate) => velocity < 0
      ? drag.stops[candidate] < drag.offset - 1
      : drag.stops[candidate] > drag.offset + 1);
    settle(Math.abs(velocity) >= flingPixelsPerMillisecond && ahead.length > 0
      ? nearest(drag.offset, drag.stops, ahead)
      : nearest(drag.offset, drag.stops), velocity);
  };
  documentTarget.addEventListener("pointerup", release, { signal });
  documentTarget.addEventListener("pointercancel", release, { signal });
  // Once the sheet follows a finger, native scrolling must not claim the touch.
  sheet.addEventListener("touchmove", (event) => {
    if (gesture?.active) event.preventDefault();
  }, { passive: false, signal });
  sheet.addEventListener("click", (event) => {
    if (!dragged) return;
    dragged = false;
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true, signal });

  handle.addEventListener("change", () => {
    if (!mobile.matches) return;
    searchReturn = null;
    settle(handle.checked ? "full" : "peek");
  }, { signal });
  handle.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
    if (step === 0 || !mobile.matches) return;
    event.preventDefault();
    settle(states[Math.max(0, Math.min(states.length - 1, states.indexOf(state) + step))] ?? state);
  }, { signal });

  const openSearch = () => {
    if (!mobile.matches || state === "full") return;
    searchReturn = state;
    settle("full");
  };
  const leaveSearch = () => {
    if (searchReturn === null) return;
    const previous = searchReturn;
    searchReturn = null;
    settle(previous);
  };
  const closeSearch = (event: KeyboardEvent) => {
    if (event.key === "Escape") leaveSearch();
  };
  search.addEventListener("focus", openSearch, { signal });
  search.addEventListener("input", openSearch, { signal });
  search.addEventListener("keydown", closeSearch, { signal });
  sheet.addEventListener("keydown", closeSearch, { signal });
  // Clearing the query leaves the results behind, exactly as Escape does.
  documentTarget.querySelector(".object-sidebar-search-clear")
    ?.addEventListener("click", leaveSearch, { signal });
  // The facility card sits inside the sheet, so opening it has to show it.
  const facilityToggle = documentTarget.querySelector(".object-facility-toggle");
  facilityToggle?.addEventListener("click", () => {
    if (mobile.matches && state === "peek" && facilityToggle.getAttribute("aria-pressed") === "true") settle("half");
  }, { signal });
  mobile.addEventListener("change", () => {
    gesture = null;
    sheet.classList.remove("is-dragging");
    sheet.style.removeProperty("transform");
  }, { signal });
  // Typing in search opens a keyboard over the sheet it just opened. The layout
  // viewport keeps its height, so the visual viewport reports the lost room.
  const visual = windowTarget.visualViewport ?? null;
  const followKeyboard = () => {
    const inset = visual === null || !mobile.matches ? 0 : mobileSheetKeyboardInset({
      layoutHeight: windowTarget.innerHeight,
      visualHeight: visual.height,
      offsetTop: visual.offsetTop,
    });
    if (inset > 0) body.style.setProperty("--sheet-keyboard", `${inset}px`);
    else body.style.removeProperty("--sheet-keyboard");
  };
  visual?.addEventListener("resize", followKeyboard, { signal });
  visual?.addEventListener("scroll", followKeyboard, { signal });
  lifetime.onDispose(() => body.style.removeProperty("--sheet-keyboard"));

  body.dataset.sheet = state;
  return Object.freeze({
    // A choice from search reveals its card over the scene.
    showSelection() {
      if (!mobile.matches || state !== "full") return;
      searchReturn = null;
      settle("peek");
    },
    destroy() {
      events.abort();
      gesture = null;
      sheet.classList.remove("is-dragging");
      sheet.style.removeProperty("transform");
      sheet.style.removeProperty("--sheet-snap-duration");
      delete body.dataset.sheet;
    },
  });
}

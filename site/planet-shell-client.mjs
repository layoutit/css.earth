import { createDestinationBrowser } from "./destination-browser.mjs";
import { createSceneLifetime } from "../src/platform/scene-lifetime.mjs";
import { createExplorerRailController } from "./explorer-rail.mjs";

export function mountPlanetShell({
  objectId,
  documentTarget = document,
  windowTarget = window,
  motionEnabled = false,
  onMotionChange = () => {},
}) {
  const drawer = documentTarget.querySelector(".planet-drawer-content");
  if (!(drawer instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell information drawer is missing.");
  }
  const lifetime = createSceneLifetime();
  let settingsController, objectBrowser;
  function own(controller) {
    lifetime.onDispose(() => controller.destroy());
    return controller;
  }
  try {
    objectBrowser = own(createObjectBrowserController(documentTarget, windowTarget, lifetime));
    own(createSheetController(drawer, windowTarget, lifetime));
    own(createChartSwitcherController(drawer, windowTarget, lifetime));
    own(createChartPixelAlignmentController(drawer, windowTarget, lifetime));
    settingsController = own(createSettingsController(
      documentTarget, windowTarget, { motionEnabled, onMotionChange }, lifetime,
    ));
    own(createPanelController(drawer, objectId, windowTarget, lifetime));
    own(createExplorerRailController(documentTarget, windowTarget));
  } catch (error) {
    const cleanupErrors = lifetime.destroy();
    if (cleanupErrors.length) {
      throw new AggregateError([error, ...cleanupErrors], error.message, { cause: error });
    }
    throw error;
  }
  return Object.freeze({
    setDestinations: objectBrowser.setDestinations,
    setMotionEnabled: settingsController.setMotionEnabled,
    setPlaybackState(state) {
      if (!lifetime.disposed) settingsController.setPlaybackState(state);
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Shell cleanup failed.");
    },
  });
}

function createSettingsController(
  documentTarget,
  windowTarget,
  { motionEnabled, onMotionChange },
  lifetime,
) {
  if (typeof onMotionChange !== "function") {
    throw new TypeError("Planet shell motion change handler must be a function.");
  }
  const motion = documentTarget.querySelector(".planet-motion-setting");
  const skyContrast = documentTarget.querySelector(
    ".planet-sky-contrast-setting",
  );
  const speed = documentTarget.querySelector(
    '.planet-speed-setting[type="range"][name="speed"]',
  );
  if (!(motion instanceof windowTarget.HTMLInputElement) ||
      (speed !== null && !(speed instanceof windowTarget.HTMLInputElement)) ||
      !(skyContrast instanceof windowTarget.HTMLInputElement)) {
    throw new Error("Planet shell settings controls are incomplete.");
  }
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let motionOn = motionEnabled === true;
  let highContrastSky = false;

  const renderMotion = () => {
    motion.checked = motionOn;
    if (speed) speed.disabled = !motionOn;
  };
  const renderSkyContrast = () => {
    skyContrast.checked = highContrastSky;
    documentTarget.body.dataset.skyContrast = highContrastSky
      ? "high"
      : "standard";
  };
  motion.addEventListener("change", () => {
    motionOn = motion.checked;
    renderMotion();
    onMotionChange(motionOn);
  }, { signal: events.signal });
  skyContrast.addEventListener("change", () => {
    highContrastSky = skyContrast.checked;
    renderSkyContrast();
  }, { signal: events.signal });
  renderMotion();
  renderSkyContrast();

  return Object.freeze({
    setMotionEnabled(next) {
      motionOn = next === true;
      renderMotion();
      onMotionChange(motionOn);
    },
    setPlaybackState({ motionRequested, reason }) {
      motionOn = motionRequested === true;
      renderMotion();
      const row = motion.closest(".planet-motion-setting-control");
      const explanation = row.querySelector(".planet-motion-blocked");
      const blocked = motionOn && reason === "reduced-motion";
      row.dataset.motionBlocked = String(blocked);
      explanation.hidden = !blocked;
      if (blocked) motion.setAttribute("aria-describedby", explanation.id);
      else motion.removeAttribute("aria-describedby");
    },
    destroy() {
      events.abort();
      delete documentTarget.body.dataset.skyContrast;
    },
  });
}

function createObjectBrowserController(documentTarget, windowTarget, lifetime) {
  const search = documentTarget.querySelector(".planet-sidebar-search");
  const searchCard = documentTarget.querySelector(".planet-sidebar-search-card");
  const trigger = documentTarget.querySelector(".planet-sidebar-view-all");
  const information = documentTarget.querySelector(".planet-information-panel");
  const browser = documentTarget.querySelector(".planet-object-browser");
  const empty = documentTarget.querySelector(".planet-object-empty");
  if (!(search instanceof windowTarget.HTMLInputElement) ||
      !(searchCard instanceof windowTarget.HTMLElement) ||
      !(trigger instanceof windowTarget.HTMLButtonElement) ||
      !(information instanceof windowTarget.HTMLElement) ||
      !(browser instanceof windowTarget.HTMLElement) ||
      !(empty instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell object browser is incomplete.");
  }
  const items = [...browser.querySelectorAll(".planet-object-item")]
    .filter((item) => item instanceof windowTarget.HTMLLIElement);
  if (items.length === 0) {
    throw new Error("Planet shell object browser has no objects.");
  }

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  const selectedSearchValue = search.value;
  let currentSearchValue = selectedSearchValue;
  let visibleObjects = 0;
  const destinations = createDestinationBrowser({
    documentTarget, windowTarget,
    onResults(count) { empty.hidden = visibleObjects + count > 0; },
    onSelected(place) { currentSearchValue = place.name; render(false); search.blur(); },
    onReset() { currentSearchValue = selectedSearchValue; render(false); },
  });
  let open = false;
  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase("en");
    visibleObjects = 0;
    void destinations?.search(query);
    if (query.length === 0) {
      for (const item of items) item.hidden = true;
      empty.hidden = true;
      browser.hidden = true;
      return;
    }
    browser.hidden = false;
    let visible = 0;
    for (const item of items) {
      const match = (item.dataset.objectName ?? "").includes(query);
      item.hidden = !match;
      if (match) visible += 1;
    }
    visibleObjects = visible;
    empty.hidden = visible !== 0 || Boolean(destinations);
  };
  const render = (next, { resetQuery = false } = {}) => {
    open = next;
    if (next && resetQuery) search.value = "";
    if (!next) search.value = currentSearchValue;
    destinations?.setOpen(next);
    information.hidden = next;
    browser.hidden = !next;
    trigger.ariaPressed = String(next);
    trigger.ariaLabel = next
      ? `Show ${selectedSearchValue} information`
      : "View all objects";
    trigger.textContent = "×";
    if (next) filter();
  };

  trigger.addEventListener("click", () => {
    if (open) render(false);
    else render(true, { resetQuery: true });
  }, {
    signal: events.signal,
  });
  search.addEventListener("input", () => {
    if (!open) render(true);
    else if (open) filter();
  }, { signal: events.signal });
  search.addEventListener("focus", () => search.select(), {
    signal: events.signal,
  });
  search.addEventListener("keydown", (event) => {
    if (open && (event.key === "Enter" || event.key === "ArrowDown")) {
      const first = [...browser.querySelectorAll("a, button")].find(element =>
        !element.closest("[hidden]") && !element.disabled);
      if (first) {
        event.preventDefault();
        if (event.key === "Enter") first.click(); else first.focus();
      }
    } else if (event.key === "Enter") {
      event.preventDefault(); render(true); return;
    }
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    render(false);
  }, { signal: events.signal });
  browser.addEventListener("keydown", (event) => {
    const controls = [...browser.querySelectorAll("a, button")].filter(element =>
      !element.closest("[hidden]") && !element.disabled);
    const index = controls.indexOf(documentTarget.activeElement);
    if (event.key === "Escape") { render(false); search.focus(); }
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = index + (event.key === "ArrowDown" ? 1 : -1);
      if (next < 0) search.focus(); else controls[Math.min(next, controls.length - 1)]?.focus();
    }
  }, { signal: events.signal });
  documentTarget.querySelector(".planet-find-destination")?.addEventListener("click", () => {
    render(true, { resetQuery: true }); search.focus();
  }, { signal: events.signal });
  documentTarget.addEventListener("pointerdown", (event) => {
    if (documentTarget.activeElement !== search ||
        !(event.target instanceof windowTarget.Node) ||
        searchCard.contains(event.target)) return;
    search.blur();
  }, { signal: events.signal });
  render(false);

  return Object.freeze({
    setDestinations(provider) { destinations?.bind(provider); },
    destroy() {
      events.abort();
      destinations?.destroy();
      currentSearchValue = selectedSearchValue;
      search.value = selectedSearchValue;
      for (const item of items) item.hidden = false;
      empty.hidden = true;
      render(false);
    },
  });
}

function createChartPixelAlignmentController(drawer, windowTarget, lifetime) {
  const charts = [...drawer.querySelectorAll(".planet-chart")]
    .filter((chart) => chart instanceof windowTarget.HTMLElement);
  const switchers = [...drawer.querySelectorAll(".planet-chart-switcher")]
    .filter((switcher) => switcher instanceof windowTarget.HTMLElement);
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let frame = 0;
  lifetime.onDispose(() => {
    if (frame !== 0) windowTarget.cancelAnimationFrame(frame);
    frame = 0;
  });

  const align = () => {
    frame = 0;
    const density = Math.max(1, windowTarget.devicePixelRatio || 1);
    for (const chart of charts) {
      chart.style.removeProperty("translate");
      const top = chart.getBoundingClientRect().top;
      const alignedTop = Math.round(top * density) / density;
      chart.style.setProperty("translate", `0 ${alignedTop - top}px`);
    }
  };
  const schedule = () => {
    if (frame === 0) frame = windowTarget.requestAnimationFrame(align);
  };

  windowTarget.addEventListener("resize", schedule, { signal: events.signal });
  for (const switcher of switchers) {
    switcher.addEventListener("chartchange", schedule, { signal: events.signal });
  }
  for (const chart of charts) {
    chart.addEventListener("load", schedule, { signal: events.signal });
  }
  schedule();

  return Object.freeze({
    destroy() {
      events.abort();
      if (frame !== 0) windowTarget.cancelAnimationFrame(frame);
      for (const chart of charts) chart.style.removeProperty("translate");
    },
  });
}

function createChartSwitcherController(drawer, windowTarget, lifetime) {
  const switcher = drawer.querySelector(".planet-chart-switcher");
  if (switcher === null) {
    return Object.freeze({ destroy() {} });
  }
  if (!(switcher instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell chart switcher is invalid.");
  }
  const previous = switcher.querySelector('.planet-chart-step[data-chart-step="-1"]');
  const next = switcher.querySelector('.planet-chart-step[data-chart-step="1"]');
  const iconFrame = switcher.querySelector(".planet-chart-current-icon");
  const slides = [...switcher.querySelectorAll(".planet-chart-slide")]
    .filter((slide) => slide instanceof windowTarget.HTMLElement);
  const labels = [...switcher.querySelectorAll(".planet-chart-label")]
    .filter((label) => label instanceof windowTarget.HTMLElement);
  const icons = [...switcher.querySelectorAll(".planet-chart-icon")]
    .filter((icon) => icon instanceof windowTarget.HTMLImageElement);
  if (!(previous instanceof windowTarget.HTMLButtonElement) ||
      !(next instanceof windowTarget.HTMLButtonElement) ||
      !(iconFrame instanceof windowTarget.HTMLElement) ||
      slides.length === 0 || labels.length !== slides.length) {
    throw new Error("Planet shell chart switcher is incomplete.");
  }
  const chartIds = slides.map((slide) => slide.dataset.chartId ?? "");
  if (chartIds.some((id) => id.length === 0) ||
      new Set(chartIds).size !== chartIds.length ||
      labels.some((label) => !chartIds.includes(label.dataset.chartLabel ?? ""))) {
    throw new Error("Planet shell chart switcher identities are incomplete.");
  }

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let activeIndex = Math.max(0, chartIds.indexOf(switcher.dataset.activeChart));
  const render = (index, notify = true) => {
    activeIndex = (index + slides.length) % slides.length;
    const activeId = chartIds[activeIndex];
    switcher.dataset.activeChart = activeId;
    for (const slide of slides) slide.hidden = slide.dataset.chartId !== activeId;
    for (const label of labels) label.hidden = label.dataset.chartLabel !== activeId;
    for (const icon of icons) icon.hidden = icon.dataset.chartIcon !== activeId;
    iconFrame.hidden = !icons.some((icon) => icon.dataset.chartIcon === activeId);

    const previousSlide = slides[(activeIndex - 1 + slides.length) % slides.length];
    const nextSlide = slides[(activeIndex + 1) % slides.length];
    previous.ariaLabel = `Previous chart: ${previousSlide.dataset.chartTitle}`;
    next.ariaLabel = `Next chart: ${nextSlide.dataset.chartTitle}`;
    previous.disabled = slides.length < 2;
    next.disabled = slides.length < 2;
    if (notify) switcher.dispatchEvent(new windowTarget.Event("chartchange"));
  };
  for (const button of [previous, next]) {
    button.addEventListener("click", () => {
      render(activeIndex + Number(button.dataset.chartStep));
    }, { signal: events.signal });
  }
  render(activeIndex, false);

  return Object.freeze({
    destroy() {
      events.abort();
    },
  });
}

function createSheetController(drawer, windowTarget, lifetime) {
  const handle = drawer.querySelector(".planet-sheet-handle");
  if (!(handle instanceof windowTarget.HTMLButtonElement)) {
    throw new Error("Planet shell sheet handle is missing.");
  }

  let startY = 0;
  let startOffset = 0;
  let offset = 0;
  let startTime = 0;
  let moved = false;
  let tracking = false;
  let draggedAt = -Infinity;
  let snapFrame = 0;
  lifetime.onDispose(() => {
    if (snapFrame) windowTarget.cancelAnimationFrame(snapFrame);
    snapFrame = 0;
  });
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  const limit = () => Math.max(0, windowTarget.innerHeight * 0.35 - 56);
  const expanded = () => drawer.classList.contains("is-expanded");
  const currentOffset = () => {
    const transform = windowTarget.getComputedStyle(drawer).transform;
    return transform === "none"
      ? 0
      : new windowTarget.DOMMatrixReadOnly(transform).m42;
  };
  const snap = (next, speed = 0) => {
    const range = Math.max(1, limit());
    const destination = next ? -range : 0;
    const distance = Math.min(1,
      Math.abs(destination - currentOffset()) / range);
    const velocity = Math.min(1, Math.abs(speed) / 1.2);
    const duration = Math.round(Math.max(180,
      Math.min(340, 220 + 120 * distance - 60 * velocity)));
    drawer.style.setProperty("--sheet-snap-duration", `${duration}ms`);
    drawer.classList.toggle("is-expanded", next);
    handle.ariaExpanded = String(next);
    drawer.classList.remove("is-dragging");
    if (snapFrame) windowTarget.cancelAnimationFrame(snapFrame);
    snapFrame = windowTarget.requestAnimationFrame(() => {
      snapFrame = 0;
      if (!lifetime.disposed) drawer.style.removeProperty("transform");
    });
  };

  handle.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button > 0) return;
    startOffset = currentOffset();
    offset = startOffset;
    startY = event.clientY;
    startTime = event.timeStamp;
    moved = false;
    tracking = true;
    drawer.style.transform = `translate3d(0, ${offset}px, 0)`;
    drawer.classList.add("is-dragging");
    handle.setPointerCapture(event.pointerId);
  }, { signal: events.signal });

  handle.addEventListener("pointermove", (event) => {
    if (!tracking) return;
    const delta = event.clientY - startY;
    moved ||= Math.abs(delta) > 3;
    const range = limit();
    const raw = startOffset + delta;
    offset = raw > 0
      ? Math.min(24, raw * 0.18)
      : raw < -range
        ? -range - Math.min(24, (-range - raw) * 0.18)
        : raw;
    drawer.style.transform = `translate3d(0, ${offset}px, 0)`;
  }, { signal: events.signal });

  handle.addEventListener("pointerup", (event) => {
    if (!tracking) return;
    tracking = false;
    if (!moved) {
      drawer.classList.remove("is-dragging");
      drawer.style.removeProperty("transform");
      return;
    }
    draggedAt = event.timeStamp;
    const speed = (event.clientY - startY) /
      Math.max(1, event.timeStamp - startTime);
    snap(Math.abs(speed) > 0.35 ? speed < 0 : offset < -limit() / 2, speed);
  }, { signal: events.signal });

  handle.addEventListener("pointercancel", () => {
    tracking = false;
    snap(expanded());
  }, { signal: events.signal });

  handle.addEventListener("click", (event) => {
    if (event.timeStamp - draggedAt > 100) snap(!expanded());
  }, { signal: events.signal });

  return Object.freeze({
    destroy() {
      events.abort();
      drawer.classList.remove("is-expanded", "is-dragging");
      drawer.style.removeProperty("transform");
      handle.ariaExpanded = "false";
    },
  });
}

function createPanelController(drawer, objectId, windowTarget, lifetime) {
  const storageKey = `css.earth:${objectId}:panels`;
  const informationPanel = drawer.querySelector(".planet-information-panel");
  if (!(informationPanel instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell combined information panel is missing.");
  }
  const panels = [...informationPanel.children]
    .filter((element) => element instanceof windowTarget.HTMLDetailsElement)
    .map((panel) => [panelKey(panel), panel]);

  try {
    const saved = JSON.parse(windowTarget.localStorage.getItem(storageKey));
    if (Array.isArray(saved)) {
      const openPanels = new Set(saved);
      for (const [name, panel] of panels) panel.open = openPanels.has(name);
    }
  } catch {}

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  const save = () => {
    try {
      windowTarget.localStorage.setItem(
        storageKey,
        JSON.stringify(
          panels.filter(([, panel]) => panel.open).map(([name]) => name),
        ),
      );
    } catch {}
  };
  for (const [, panel] of panels) {
    panel.addEventListener("toggle", save, { signal: events.signal });
  }

  return Object.freeze({
    destroy() {
      events.abort();
    },
  });
}

function panelKey(panel) {
  if (!panel.id) throw new Error("Planet shell panel identity is missing.");
  return panel.id;
}

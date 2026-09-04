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

  const sidebar = createSidebarController(documentTarget, windowTarget);
  const objectBrowser = createObjectBrowserController(
    documentTarget,
    windowTarget,
  );
  const sheet = createSheetController(drawer, windowTarget);
  const chartAlignment = createChartPixelAlignmentController(
    drawer,
    windowTarget,
  );
  let settingsController;
  let panels;
  try {
    settingsController = createSettingsController(
      documentTarget,
      windowTarget,
      { motionEnabled, onMotionChange },
    );
    panels = createPanelController(drawer, objectId, windowTarget);
  } catch (error) {
    sidebar.destroy();
    objectBrowser.destroy();
    sheet.destroy();
    chartAlignment.destroy();
    settingsController?.destroy();
    throw error;
  }
  let destroyed = false;

  return Object.freeze({
    destroy() {
      if (destroyed) return;
      destroyed = true;
      sidebar.destroy();
      objectBrowser.destroy();
      sheet.destroy();
      chartAlignment.destroy();
      settingsController.destroy();
      panels.destroy();
    },
  });
}

function createSettingsController(
  documentTarget,
  windowTarget,
  { motionEnabled, onMotionChange },
) {
  if (typeof onMotionChange !== "function") {
    throw new TypeError("Planet shell motion change handler must be a function.");
  }
  const panel = documentTarget.querySelector(".planet-settings-panel");
  const action = documentTarget.querySelector(".planet-settings-action");
  const motion = documentTarget.querySelector(".planet-motion-setting");
  const skyContrast = documentTarget.querySelector(
    ".planet-sky-contrast-setting",
  );
  if (!(panel instanceof windowTarget.HTMLDetailsElement) ||
      !(action instanceof windowTarget.HTMLButtonElement) ||
      !(motion instanceof windowTarget.HTMLInputElement) ||
      !(skyContrast instanceof windowTarget.HTMLInputElement)) {
    throw new Error("Planet shell settings controls are incomplete.");
  }
  const events = new AbortController();
  let motionOn = motionEnabled === true;
  let highContrastSky = false;

  const renderPanel = () => {
    action.ariaExpanded = String(panel.open);
    action.ariaLabel = panel.open ? "Close settings" : "Open settings";
  };

  const renderMotion = () => {
    motion.checked = motionOn;
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
  action.addEventListener("click", () => {
    panel.open = !panel.open;
    renderPanel();
  }, { signal: events.signal });
  panel.addEventListener("toggle", renderPanel, { signal: events.signal });
  renderPanel();
  renderMotion();
  renderSkyContrast();

  return Object.freeze({
    destroy() {
      events.abort();
      delete documentTarget.body.dataset.skyContrast;
    },
  });
}

function createObjectBrowserController(documentTarget, windowTarget) {
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
  const selectedSearchValue = search.value;
  let open = false;
  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase("en");
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
    empty.hidden = visible !== 0;
  };
  const render = (next, { resetQuery = false } = {}) => {
    open = next;
    if (next && resetQuery) search.value = "";
    if (!next) search.value = selectedSearchValue;
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
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    render(false);
  }, { signal: events.signal });
  documentTarget.addEventListener("pointerdown", (event) => {
    if (documentTarget.activeElement !== search ||
        !(event.target instanceof windowTarget.Node) ||
        searchCard.contains(event.target)) return;
    search.blur();
  }, { signal: events.signal });
  render(false);

  return Object.freeze({
    destroy() {
      events.abort();
      search.value = selectedSearchValue;
      for (const item of items) item.hidden = false;
      empty.hidden = true;
      render(false);
    },
  });
}

function createChartPixelAlignmentController(drawer, windowTarget) {
  const charts = [...drawer.querySelectorAll(".planet-chart")]
    .filter((chart) => chart instanceof windowTarget.HTMLElement);
  const panels = [...drawer.querySelectorAll(".planet-chart-panel")]
    .filter((panel) => panel instanceof windowTarget.HTMLDetailsElement);
  const events = new AbortController();
  let frame = 0;

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
  for (const panel of panels) {
    panel.addEventListener("toggle", schedule, { signal: events.signal });
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

function createSidebarController(documentTarget, windowTarget) {
  const sidebar = documentTarget.querySelector(".planet-sidebar");
  const toggle = documentTarget.querySelector(".planet-sidebar-toggle");
  if (!(sidebar instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet information sidebar is missing.");
  }
  if (!(toggle instanceof windowTarget.HTMLButtonElement)) {
    throw new Error("Planet sidebar toggle is missing.");
  }

  const body = documentTarget.body;
  const events = new AbortController();
  const collapsed = () => body.dataset.sidebarCollapsed === "true";
  const render = (next) => {
    if (next) body.dataset.sidebarCollapsed = "true";
    else delete body.dataset.sidebarCollapsed;
    toggle.ariaExpanded = String(!next);
    toggle.ariaLabel = next
      ? "Expand information sidebar"
      : "Collapse information sidebar";
  };

  toggle.addEventListener("click", () => render(!collapsed()), {
    signal: events.signal,
  });
  render(false);

  return Object.freeze({
    destroy() {
      events.abort();
      render(false);
    },
  });
}

function createSheetController(drawer, windowTarget) {
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
  const events = new AbortController();
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
    windowTarget.requestAnimationFrame(() =>
      drawer.style.removeProperty("transform"));
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

function createPanelController(drawer, objectId, windowTarget) {
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

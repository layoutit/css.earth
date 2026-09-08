import { createEntityCard } from "./entity-card.mjs";
import { createDestinationBrowser } from "./destination-browser.mjs";
import { createSceneLifetime } from "../src/platform/scene-lifetime.mjs";
import { createExplorerRailController } from "./explorer-rail.mjs";
import { createSurfaceMinimap } from "./surface-minimap.mjs";
import { createViewReadout } from "./view-readout.mjs";
import { overviewScopeAtCamera } from './overview-context.mjs';

export function mountPlanetShell({
  objectId,
  documentTarget = document,
  windowTarget = window,
  motionEnabled = false,
  onMotionChange = () => {},
  heliosphereEnabled = false,
  onHeliosphereChange = () => {},
  asteroidOrbitsEnabled = false,
  onAsteroidOrbitsChange = () => {},
}) {
  const drawer = documentTarget.querySelector(".planet-drawer-content");
  if (!(drawer instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell information drawer is missing.");
  }
  const lifetime = createSceneLifetime();
  let settingsController, objectBrowser, contentLifetime, minimapController, viewReadout;
  let selectionPreview = null;
  let overview = false, overviewScope = 'solar-system', camera = null, unsubscribeOverview = null;
  lifetime.onDispose(() => unsubscribeOverview?.());
  function updateOverview(force = false, world = camera?.navigation?.capture()) {
    if (selectionPreview) return;
    const scope = overview && world ? overviewScopeAtCamera(world, overviewScope) : 'solar-system';
    if (!force && scope === overviewScope) return;
    overviewScope = scope;
    objectBrowser.setOverview(overview, scope);
    viewReadout.setOverviewScope(scope);
  }
  function own(controller) {
    lifetime.onDispose(() => controller.destroy());
    return controller;
  }
  try {
    objectBrowser = own(createObjectBrowserController(documentTarget, windowTarget, lifetime));
    own(createSheetController(drawer, windowTarget, lifetime));
    own(createExplorerRailController(documentTarget, windowTarget, {
      onOpenSolarSystem: () => objectBrowser.showSolarSystem(),
    }));
    lifetime.onDispose(() => disposeContent());
    lifetime.onDispose(() => selectionPreview?.restore());
    mountContent(objectId, motionEnabled, false);
  } catch (error) {
    const cleanupErrors = lifetime.destroy();
    if (cleanupErrors.length) {
      throw new AggregateError([error, ...cleanupErrors], error.message, { cause: error });
    }
    throw error;
  }
  return Object.freeze({
    beginObjectSelection(object) {
      selectionPreview?.restore();
      const information = drawer.querySelector('.planet-information-panel');
      const previous = [...information.childNodes], restoreBrowser = objectBrowser.previewObject(object.name);
      const previousBusy = information.ariaBusy, previousInert = information.inert;
      const card = documentTarget.querySelector(`template[data-object-card="${object.id}"]`)
        ?.content.querySelector('.planet-information-panel');
      if (!card) throw new Error(`Prepared sidebar card is missing for ${object.id}.`);
      information.replaceChildren(...[...card.childNodes].map(node => node.cloneNode(true)));
      restorePanelState([...information.children].filter(node => node instanceof windowTarget.HTMLDetailsElement)
        .map(node => [panelKey(node), node]), object.id, windowTarget);
      information.ariaBusy = 'true'; information.inert = true;
      const preview = { id: object.id, commit() {
        selectionPreview = null;
        information.ariaBusy = previousBusy; information.inert = previousInert;
      }, restore() {
        if (selectionPreview !== preview) return;
        selectionPreview = null;
        information.replaceChildren(...previous);
        information.ariaBusy = previousBusy; information.inert = previousInert;
        restoreBrowser();
      } };
      selectionPreview = preview;
      return preview.restore;
    },
    setObject(content) {
      if (lifetime.disposed) return;
      const preserveSidebar = selectionPreview?.id === content.id;
      if (preserveSidebar) selectionPreview.commit();
      else selectionPreview?.restore();
      const motion = documentTarget.querySelector('.planet-motion-setting').checked;
      const contrast = documentTarget.querySelector('.planet-sky-contrast-setting').checked;
      disposeContent();
      content.apply({ preserveSidebar });
      overview = false; overviewScope = 'solar-system';
      objectBrowser.setObject(content.name);
      mountContent(content.id, motion, contrast);
    },
    setDestinations(provider) { if (!lifetime.disposed) return objectBrowser.setDestinations(provider); },
    restoreDestinations() { if (!lifetime.disposed) return objectBrowser.restoreDestinations(); },
    setOverview(enabled) {
      if (!lifetime.disposed) { overview = enabled; updateOverview(true); }
    },
    setCamera(provider) {
      if (!lifetime.disposed) {
        unsubscribeOverview?.(); camera = provider;
        minimapController.setCamera(provider); viewReadout.setCamera(provider);
        unsubscribeOverview = provider?.navigation?.subscribe(world => updateOverview(false, world)) ?? null;
        updateOverview(true);
      }
    },
    setMotionEnabled(enabled) { if (!lifetime.disposed) settingsController.setMotionEnabled(enabled); },
    setPlaybackState(state) {
      if (!lifetime.disposed) {
        settingsController.setPlaybackState(state);
        minimapController.setPlaybackState(state);
        viewReadout.setPlaybackState(state);
      }
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Shell cleanup failed.");
    },
  });

  function disposeContent() {
    const errors = contentLifetime?.destroy() ?? [];
    contentLifetime = null;
    if (errors.length) throw new AggregateError(errors, 'Object shell content cleanup failed.');
  }
  function mountContent(id, motionEnabled, highContrastSky) {
    const owner = contentLifetime = createSceneLifetime();
    const retain = controller => { owner.onDispose(() => controller.destroy()); return controller; };
    retain(createChartSwitcherController(drawer, windowTarget, owner));
    retain(createChartPixelAlignmentController(drawer, windowTarget, owner));
    retain(createLensBrowserController(drawer, windowTarget, owner));
    settingsController = retain(createSettingsController(documentTarget, windowTarget,
      { motionEnabled, onMotionChange, highContrastSky, heliosphereEnabled, asteroidOrbitsEnabled,
        onHeliosphereChange(enabled) { heliosphereEnabled = enabled; onHeliosphereChange(enabled); },
        onAsteroidOrbitsChange(enabled) { asteroidOrbitsEnabled = enabled; onAsteroidOrbitsChange(enabled); },
      }, owner));
    minimapController = retain(createSurfaceMinimap({ drawer, documentTarget, windowTarget,
      onInteraction() { settingsController.setMotionEnabled(false); },
    }));
    viewReadout = retain(createViewReadout({ drawer, documentTarget, windowTarget }));
    retain(createPanelController(drawer, id, windowTarget, owner));
  }
}

function createLensBrowserController(drawer, windowTarget, lifetime) {
  const root = drawer.querySelector(".planet-lenses");
  if (!root) {
    return Object.freeze({ destroy() {} });
  }

  const search = root.querySelector(".planet-lens-search");
  const empty = root.querySelector(".planet-lens-empty");
  if (!(root instanceof windowTarget.HTMLElement) ||
      !(search instanceof windowTarget.HTMLInputElement) ||
      !(empty instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell surface lens browser is incomplete.");
  }

  const options = [...root.querySelectorAll("[data-lens-option]")]
    .filter((option) => option instanceof windowTarget.HTMLElement);
  const buttons = options.map((option) =>
    option.querySelector('button[name="lens"]'));
  if (buttons.some((button) =>
    !(button instanceof windowTarget.HTMLButtonElement))) {
    throw new Error("Planet shell surface lens browser has no valid lenses.");
  }

  const details = [...drawer.querySelectorAll("[data-lens-details]")];
  const lensIds = new Set(buttons.map((button) => button.value));
  if (details.some((detail) => !lensIds.has(detail.dataset.lensDetails ?? ""))) {
    throw new Error("Planet shell surface lens details have no matching lens.");
  }

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  const renderSelection = () => {
    const activeLens = buttons.find((button) => button.ariaPressed === "true")
      ?.value;
    for (const detail of details) {
      detail.hidden = detail.dataset.lensDetails !== activeLens;
    }
  };
  const selectionObserver = new windowTarget.MutationObserver(renderSelection);
  lifetime.onDispose(() => selectionObserver.disconnect());
  for (const button of buttons) {
    selectionObserver.observe(button, {
      attributes: true,
      attributeFilter: ["aria-pressed"],
    });
  }

  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase("en");
    let visible = 0;
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      const button = buttons[index];
      const matches = option.dataset.entityAvailable !== "false" &&
        button.textContent.toLocaleLowerCase("en").includes(query);
      option.hidden = !matches;
      if (matches) visible += 1;
    }
    empty.hidden = visible !== 0 || !query;
    const count = root.querySelector("[data-lens-count]");
    if (count) count.textContent = `(${options.filter(option => option.dataset.entityAvailable !== "false").length})`;
  };

  const scopeObserver = new windowTarget.MutationObserver(filter);
  lifetime.onDispose(() => scopeObserver.disconnect());
  for (const option of options) scopeObserver.observe(option, { attributes: true, attributeFilter: ["data-entity-available"] });

  search.addEventListener("input", filter, { signal: events.signal });
  search.addEventListener("click", (event) => {
    event.stopPropagation();
  }, { signal: events.signal });
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || search.value.length === 0) return;
    event.preventDefault();
    search.value = "";
    filter();
  }, { signal: events.signal });
  filter();
  renderSelection();

  return Object.freeze({
    destroy() {
      events.abort();
      selectionObserver.disconnect();
      scopeObserver.disconnect();
      search.value = "";
      for (const option of options) option.hidden = option.dataset.entityAvailable === "false";
      empty.hidden = true;
      renderSelection();
    },
  });
}

function createSettingsController(
  documentTarget,
  windowTarget,
  { motionEnabled, onMotionChange, highContrastSky = false, heliosphereEnabled, onHeliosphereChange,
    asteroidOrbitsEnabled, onAsteroidOrbitsChange },
  lifetime,
) {
  if (typeof onMotionChange !== "function") {
    throw new TypeError("Planet shell motion change handler must be a function.");
  }
  const motion = documentTarget.querySelector(".planet-motion-setting");
  const heliosphere = documentTarget.querySelector(".planet-heliosphere-setting");
  const asteroidOrbits = documentTarget.querySelector(".planet-asteroid-orbits-setting");
  const skyContrast = documentTarget.querySelector(
    ".planet-sky-contrast-setting",
  );
  const speed = documentTarget.querySelector(
    '.planet-speed-setting[type="range"][name="speed"]',
  );
  if (!(motion instanceof windowTarget.HTMLInputElement) ||
      !(heliosphere instanceof windowTarget.HTMLInputElement) ||
      !(asteroidOrbits instanceof windowTarget.HTMLInputElement) ||
      (speed !== null && !(speed instanceof windowTarget.HTMLInputElement)) ||
      !(skyContrast instanceof windowTarget.HTMLInputElement)) {
    throw new Error("Planet shell settings controls are incomplete.");
  }
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let motionOn = motionEnabled === true;

  const renderMotion = () => {
    motion.checked = motionOn;
    if (speed) speed.disabled = !motionOn || speed.dataset?.runtimeReady === "false";
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
  heliosphere.checked = heliosphereEnabled === true;
  heliosphere.addEventListener("change", () => onHeliosphereChange(heliosphere.checked), { signal: events.signal });
  const renderAsteroidOrbits = () => {
    asteroidOrbits.checked = asteroidOrbitsEnabled === true;
    documentTarget.body.dataset.asteroidOrbits = asteroidOrbits.checked ? 'on' : 'off';
  };
  asteroidOrbits.addEventListener("change", () => {
    asteroidOrbitsEnabled = asteroidOrbits.checked;
    renderAsteroidOrbits();
    onAsteroidOrbitsChange(asteroidOrbitsEnabled);
  }, { signal: events.signal });
  renderAsteroidOrbits();
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
      const descriptions = new Set((motion.getAttribute("aria-describedby") ?? "")
        .split(/\s+/u).filter(id => id && id !== explanation.id));
      if (blocked) descriptions.add(explanation.id);
      if (descriptions.size) motion.setAttribute("aria-describedby", [...descriptions].join(" "));
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
  const galaxy = browser?.querySelector('[data-galactic-overview]');
  const system = browser?.querySelector('[data-solar-system-results]');
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
  const groups = [...browser.querySelectorAll('[data-object-type-group]')].map(details => ({
    details, items: [...details.querySelectorAll('.planet-object-item')], open: details.open,
  }));
  let filteringGroups = false;
  const introduction = system?.querySelector('.planet-introduction');

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let selectedSearchValue = search.value;
  let currentSearchValue = selectedSearchValue;
  let overview = false;
  let overviewScope = 'solar-system';
  const overviewName = () => overviewScope === 'milky-way' ? 'Milky Way' : 'Solar System';
  let visibleObjects = 0;
  let card, destinations;
  function mountEntityContent() {
    card = createEntityCard({ documentTarget, onNavigate: id => destinations?.selectById(id) });
    destinations = createDestinationBrowser({
    documentTarget, windowTarget, card,
    onResults(count) { empty.hidden = visibleObjects + count > 0; },
    onSelected(place) { currentSearchValue = place.name; render(false); search.blur(); },
    onReset() { currentSearchValue = selectedSearchValue; render(false); },
  });
  }
  function disposeEntityContent() { destinations?.destroy(); card?.destroy(); destinations = null; card = null; }
  lifetime.onDispose(disposeEntityContent);
  mountEntityContent();
  let open = false;
  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase("en");
    const galactic = query === 'milky way';
    if (galaxy) galaxy.hidden = !galactic;
    if (system) system.hidden = galactic;
    browser.ariaLabel = galactic ? 'Milky Way' : 'Solar System objects';
    if (galactic) {
      browser.hidden = false; empty.hidden = true; visibleObjects = 1;
      void destinations?.search('');
      return;
    }
    const showAll = query === "all objects";
    const classification = items.find(item => {
      const name = item.dataset.objectClassificationName;
      return name && (query === name || query === `${name}s` || query === item.dataset.objectClassification);
    })?.dataset.objectClassification;
    const systemName = items.find(item =>
      query === item.dataset.objectSystemName)?.dataset.objectSystemName;
    const filtering = !systemName && !showAll;
    if (introduction) introduction.hidden = filtering;
    if (filtering && !filteringGroups) for (const group of groups) group.open = group.details.open;
    visibleObjects = 0;
    void destinations?.search(classification || systemName || showAll ? "" : query);
    if (query.length === 0) {
      for (const item of items) item.hidden = true;
      empty.hidden = true;
      browser.hidden = true;
      filteringGroups = filtering;
      return;
    }
    browser.hidden = false;
    let visible = 0;
    for (const item of items) {
      const match = showAll || (classification ? item.dataset.objectClassification === classification
        : systemName ? item.dataset.objectSystemName === systemName
        : (item.dataset.objectName ?? "").includes(query));
      item.hidden = !match;
      if (match) visible += 1;
    }
    for (const group of groups) {
      group.details.hidden = filtering && !group.items.some(item => !item.hidden);
    }
    // Keep a matching category open, or reveal the first matching category.
    const openGroup = groups.find(group => !group.details.hidden && group.details.open)
      ?? groups.find(group => !group.details.hidden);
    for (const group of groups) {
      if (filtering) group.details.open = group === openGroup;
      else if (filteringGroups) group.details.open = group.open;
    }
    filteringGroups = filtering;
    visibleObjects = visible;
    if (system) system.hidden = visible === 0;
    empty.hidden = visible !== 0 || Boolean(destinations && !classification && !showAll);
  };
  const render = (next, { resetQuery = false } = {}) => {
    if (overview && !next) { next = true; search.value = overviewName(); }
    open = next;
    if (next && resetQuery) search.value = "";
    if (!next) search.value = currentSearchValue;
    information.hidden = next;
    browser.hidden = !next;
    trigger.ariaPressed = String(next);
    trigger.ariaLabel = overview ? `Show ${overviewName()}` : next
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
  galaxy?.querySelector('[data-browse-solar-system]')?.addEventListener('click', event => {
    event.preventDefault();
    search.value = 'Solar System'; render(true);
  }, { signal: events.signal });
  information.addEventListener("click", (event) => {
    const tag = event.target instanceof windowTarget.HTMLElement
      ? event.target.closest("[data-object-query]") : null;
    if (!tag || !information.contains(tag)) return;
    search.value = tag.dataset.objectQuery;
    render(true);
  }, { signal: events.signal });
  search.addEventListener("input", () => {
    if (!open) render(true);
    else if (open) filter();
  }, { signal: events.signal });
  const visibleControl = element => !element.disabled && !element.closest('[hidden]') && element.getClientRects().length > 0;
  search.addEventListener("keydown", (event) => {
    if (open && (event.key === "Enter" || event.key === "ArrowDown")) {
      const first = [...browser.querySelectorAll("a, button")].find(visibleControl);
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
    const controls = [...browser.querySelectorAll("summary, a, button")].filter(visibleControl);
    const index = controls.indexOf(documentTarget.activeElement);
    if (event.key === "Escape") { render(false); search.focus(); }
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = index + (event.key === "ArrowDown" ? 1 : -1);
      if (next < 0) search.focus(); else controls[Math.min(next, controls.length - 1)]?.focus();
    }
  }, { signal: events.signal });
  documentTarget.querySelector(".planet-find-destination")?.addEventListener("click", () => {
    render(true, { resetQuery: true });
  }, { signal: events.signal });
  documentTarget.addEventListener("pointerdown", (event) => {
    if (documentTarget.activeElement !== search ||
        !(event.target instanceof windowTarget.Node) ||
        searchCard.contains(event.target)) return;
    search.blur();
  }, { signal: events.signal });
  render(false);

  const markSelection = () => {
    documentTarget.documentElement.dataset.selection = overview ? overviewScope : 'object';
    for (const anchor of browser.querySelectorAll('.planet-object-link')) {
      const selected = !overview && anchor.querySelector('.planet-object-name')?.textContent === selectedSearchValue;
      anchor.classList.toggle('is-active', selected);
      if (selected) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
  };
  return Object.freeze({
    previewObject(name) {
      const previous = { selectedSearchValue, currentSearchValue, overview, open, query: search.value };
      overview = false; selectedSearchValue = name; currentSearchValue = name;
      markSelection(); render(false);
      return () => {
        ({ selectedSearchValue, currentSearchValue, overview } = previous);
        search.value = previous.query; markSelection(); render(previous.open);
      };
    },
    showSolarSystem() {
      search.value = "Solar System";
      render(true);
    },
    setOverview(enabled, scope = 'solar-system') {
      overview = enabled;
      overviewScope = scope;
      markSelection();
      if (enabled) destinations?.bind(null);
      render(false);
    },
    setObject(name) {
      overview = false;
      selectedSearchValue = name; currentSearchValue = name;
      disposeEntityContent();
      mountEntityContent();
      markSelection();
      render(false);
    },
    setDestinations(provider) { return destinations?.bind(provider); },
    restoreDestinations() { return destinations?.restore(); },
    destroy() {
      events.abort();
      disposeEntityContent();
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
  const slides = [...switcher.querySelectorAll(".planet-chart-slide")]
    .filter((slide) => slide instanceof windowTarget.HTMLElement);
  const labels = [...switcher.querySelectorAll(".planet-chart-label")]
    .filter((label) => label instanceof windowTarget.HTMLElement);
  if (!(previous instanceof windowTarget.HTMLButtonElement) ||
      !(next instanceof windowTarget.HTMLButtonElement) ||
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

    const previousSlide = slides[(activeIndex - 1 + slides.length) % slides.length];
    const nextSlide = slides[(activeIndex + 1) % slides.length];
    previous.ariaLabel = `Previous chart: ${previousSlide.dataset.chartTitle}`;
    next.ariaLabel = `Next chart: ${nextSlide.dataset.chartTitle}`;
    previous.disabled = slides.length < 2;
    next.disabled = slides.length < 2;
    if (notify) switcher.dispatchEvent(new windowTarget.Event("chartchange"));
  };
  for (const button of [previous, next]) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
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

  restorePanelState(panels, objectId, windowTarget);

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

function restorePanelState(panels, objectId, windowTarget) {
  try {
    const saved = JSON.parse(windowTarget.localStorage.getItem(`css.earth:${objectId}:panels`));
    if (Array.isArray(saved)) {
      const openPanels = new Set(saved);
      for (const [name, panel] of panels) panel.open = openPanels.has(name);
    }
  } catch {}
}

function panelKey(panel) {
  if (!panel.id) throw new Error("Planet shell panel identity is missing.");
  return panel.id;
}

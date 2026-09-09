import { objectCategory, matchesObjectCategory, objectCategoryCount } from "./object-categories.mjs";
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mjs';
import { createChartPixelAlignmentController } from "./chart-pixel-alignment.mjs";
import { createDestinationBrowser } from "./destination-browser.mjs";
import { createSceneLifetime } from "../src/platform/scene-lifetime.mjs";
import { createExplorerRailController } from "./explorer-rail.mjs";
import { createSurfaceMinimap, loadSurfacePreview } from "./surface-minimap.mjs";
import { createViewReadout } from "./view-readout.mjs";
import { createSurfaceMapReader } from "./surface-map-context.mjs";
import { mountDiagnosticRecorder } from './diagnostic-recorder.mjs';
import { overviewScopeAtCamera } from './overview-context.mjs';

export function mountPlanetShell({
  objectId,
  documentTarget = document,
  windowTarget = window,
  motionEnabled = false,
  onMotionChange = () => {},
  highContrastSky = false,
  onSkyContrastChange = () => {},
  heliosphereEnabled = false,
  onHeliosphereChange = () => {},
  asteroidOrbitsEnabled = false,
  onAsteroidOrbitsChange = () => {},
  asteroidLabelsEnabled = false,
  onAsteroidLabelsChange = () => {},
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
    if (DIAGNOSTICS_ENABLED) own(mountDiagnosticRecorder({ documentTarget, windowTarget, readCamera: () => camera }));
    objectBrowser = own(createObjectBrowserController(documentTarget, windowTarget, lifetime));
    own(createSheetController(drawer, windowTarget, lifetime));
    own(createExplorerRailController(documentTarget, windowTarget, {
      onOpenSolarSystem: () => objectBrowser.showSolarSystem(),
    }));
    lifetime.onDispose(() => disposeContent());
    lifetime.onDispose(() => selectionPreview?.restore());
    mountContent(objectId, motionEnabled, highContrastSky);
  } catch (error) {
    const cleanupErrors = lifetime.destroy();
    if (cleanupErrors.length) {
      throw new AggregateError([error, ...cleanupErrors], error.message, { cause: error });
    }
    throw error;
  }
  return Object.freeze({
    beginOverviewSelection() {
      selectionPreview?.restore();
      const restoreBrowser = objectBrowser.previewOverview();
      const preview = { id: null, restore() {
        if (selectionPreview !== preview) return;
        selectionPreview = null;
        restoreBrowser();
      } };
      selectionPreview = preview;
      return preview.restore;
    },
    beginObjectSelection(object) {
      selectionPreview?.restore();
      const information = drawer.querySelector('.planet-information-panel');
      const previous = [...information.childNodes], restoreBrowser = objectBrowser.previewObject(object.name);
      const previousBusy = information.ariaBusy, previousInert = information.inert;
      const card = documentTarget.querySelector(`template[data-object-card="${object.id}"]`)
        ?.content.querySelector('.planet-information-panel');
      if (!card) throw new Error(`Prepared sidebar card is missing for ${object.id}.`);
      information.replaceChildren(...[...card.childNodes].map(node => node.cloneNode(true)));
      restorePanelState([...information.querySelectorAll(':scope > details, :scope > [data-information-panel] > details')].filter(node => node instanceof windowTarget.HTMLDetailsElement)
        .map(node => [panelKey(node), node]), object.id, windowTarget);
      for (const map of information.querySelectorAll('.planet-surface-minimap')) {
        if (!map.closest('[hidden], details:not([open])')) loadSurfacePreview(map);
      }
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
    setDestinations(provider) { if (!lifetime.disposed) objectBrowser.setDestinations(provider); },
    setOverview(enabled) {
      if (!lifetime.disposed) {
        if (enabled && selectionPreview?.id === null) selectionPreview = null;
        overview = enabled; updateOverview(true);
      }
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
    retain(createInformationTabsController(drawer, owner));
    retain(createMissionAgencyController(drawer, owner));
    retain(createChartSwitcherController(drawer, windowTarget, owner));
    retain(createChartPixelAlignmentController(drawer, windowTarget));
    retain(createLensBrowserController(drawer, windowTarget, owner));
    settingsController = retain(createSettingsController(documentTarget, windowTarget,
      { motionEnabled, onMotionChange, highContrastSky, onSkyContrastChange, heliosphereEnabled, asteroidOrbitsEnabled, asteroidLabelsEnabled,
        onHeliosphereChange(enabled) { heliosphereEnabled = enabled; onHeliosphereChange(enabled); },
        onAsteroidOrbitsChange(enabled) { asteroidOrbitsEnabled = enabled; onAsteroidOrbitsChange(enabled); },
        onAsteroidLabelsChange(enabled) { asteroidLabelsEnabled = enabled; onAsteroidLabelsChange(enabled); },
      }, owner));
    const surfaceReader = retain(createSurfaceMapReader({ documentTarget, windowTarget }));
    minimapController = retain(createSurfaceMinimap({ drawer, documentTarget, windowTarget, surfaceReader,
      onInteraction() { settingsController.setMotionEnabled(false); },
    }));
    viewReadout = retain(createViewReadout({ drawer, documentTarget, windowTarget, surfaceReader }));
    retain(createPanelController(drawer, id, windowTarget, owner));
  }
}

function createInformationTabsController(drawer, lifetime) {
  const card = drawer.querySelector('.planet-information-panel');
  const tabs = [...(card?.querySelectorAll('[data-information-tab]:not([hidden])') ?? [])];
  const panels = [...(card?.querySelectorAll('[data-information-panel]') ?? [])];
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  const select = (tab, focus = false) => {
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.informationPanel !== tab.dataset.informationTab;
    if (focus) tab.focus();
  };
  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab), { signal: events.signal });
    tab.addEventListener('keydown', event => {
      const index = tabs.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : null;
      if (next === null) return;
      event.preventDefault();
      select(tabs[next], true);
    }, { signal: events.signal });
  }
  return { destroy() { events.abort(); } };
}

function createMissionAgencyController(drawer, lifetime) {
  const panel = drawer.querySelector('[data-information-panel="missions"]');
  const choices = [...(panel?.querySelectorAll('[data-mission-agency]') ?? [])].map(button => ({
    button,
    missionIds: new Set(JSON.parse(button.dataset.agencyMissions)),
  }));
  const figures = [...(panel?.querySelectorAll('[data-spacecraft]') ?? [])];
  const results = panel?.querySelector('[data-mission-results]');
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  const select = (choice, focus = false) => {
    for (const item of choices) item.button.setAttribute('aria-pressed', String(item === choice));
    for (const figure of figures) figure.hidden = !choice.missionIds.has(figure.dataset.spacecraft);
    results.setAttribute('aria-label', `${choice.button.dataset.missionAgency} missions`);
    if (focus) choice.button.focus();
  };
  choices.forEach((choice, index) => {
    choice.button.addEventListener('click', () => select(choice), { signal: events.signal });
    choice.button.addEventListener('keydown', event => {
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1
        : event.key === 'ArrowDown' ? (index + 1) % choices.length
        : event.key === 'ArrowUp' ? (index - 1 + choices.length) % choices.length : null;
      if (next === null) return;
      event.preventDefault();
      select(choices[next], true);
    }, { signal: events.signal });
  });
  return { destroy() { events.abort(); } };
}

function createLensBrowserController(drawer, windowTarget, lifetime) {
  const root = drawer.querySelector(".planet-lenses");
  if (!root) {
    return Object.freeze({ destroy() {} });
  }

  const options = [...root.querySelectorAll("[data-lens-option]")]
    .filter((option) => option instanceof windowTarget.HTMLElement);
  const buttons = options.map((option) =>
    option.querySelector('button[name="lens"]'));
  if (options.length === 0 || buttons.some((button) =>
    !(button instanceof windowTarget.HTMLButtonElement))) {
    throw new Error("Planet shell surface lens browser has no valid lenses.");
  }

  const details = [...drawer.querySelectorAll("[data-lens-details]")];
  const lensIds = new Set(buttons.map((button) => button.value));
  if (details.some((detail) => !lensIds.has(detail.dataset.lensDetails ?? ""))) {
    throw new Error("Planet shell surface lens details have no matching lens.");
  }

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

  renderSelection();

  return Object.freeze({
    destroy() {
      selectionObserver.disconnect();
      for (const detail of details) detail.hidden = true;
    },
  });
}

function createSettingsController(
  documentTarget,
  windowTarget,
  { motionEnabled, onMotionChange, highContrastSky = false, onSkyContrastChange, heliosphereEnabled, onHeliosphereChange,
    asteroidOrbitsEnabled, onAsteroidOrbitsChange, asteroidLabelsEnabled, onAsteroidLabelsChange },
  lifetime,
) {
  if (typeof onMotionChange !== "function") {
    throw new TypeError("Planet shell motion change handler must be a function.");
  }
  const motion = documentTarget.querySelector(".planet-motion-setting");
  const heliosphere = documentTarget.querySelector(".planet-heliosphere-setting");
  const asteroidOrbits = documentTarget.querySelector(".planet-asteroid-orbits-setting");
  const asteroidLabels = documentTarget.querySelector(".planet-asteroid-labels-setting");
  const skyContrast = documentTarget.querySelector(
    ".planet-sky-contrast-setting",
  );
  const speed = documentTarget.querySelector(
    '.planet-speed-setting[type="range"][name="speed"]',
  );
  if (!(motion instanceof windowTarget.HTMLInputElement) ||
      !(heliosphere instanceof windowTarget.HTMLInputElement) ||
      !(asteroidOrbits instanceof windowTarget.HTMLInputElement) ||
      !(asteroidLabels instanceof windowTarget.HTMLInputElement) ||
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
    onSkyContrastChange(highContrastSky);
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
  const renderAsteroidLabels = () => {
    asteroidLabels.checked = asteroidLabelsEnabled === true;
    documentTarget.body.dataset.asteroidLabels = asteroidLabels.checked ? 'on' : 'off';
  };
  asteroidLabels.addEventListener("change", () => {
    asteroidLabelsEnabled = asteroidLabels.checked;
    renderAsteroidLabels();
    onAsteroidLabelsChange(asteroidLabelsEnabled);
  }, { signal: events.signal });
  renderAsteroidLabels();
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
  const setPanelHidden = (panel, hidden) => {
    if (panel.hidden !== hidden) panel.hidden = hidden;
    const inert = hidden || panel.ariaBusy === 'true';
    if (panel.inert !== inert) panel.inert = inert;
  };
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
  const tabs = [...browser.querySelectorAll('[data-object-tab]')];
  const resultsPanel = browser.querySelector('#object-category-results');
  const chunks = [...browser.querySelectorAll('.planet-object-chunk')]
    .map(node => ({ node, items: [...node.querySelectorAll('.planet-object-item')] }));
  const refreshChunks = () => {
    for (const { node, items: rows } of chunks) {
      const count = rows.filter(item => !item.hidden).length;
      if (node.hidden !== (count === 0)) node.hidden = count === 0;
      const height = `${Math.max(0, count * 28 - 8)}px`;
      if (node.style.containIntrinsicBlockSize !== height) node.style.containIntrinsicBlockSize = height;
    }
  };
  if (chunks.length && typeof windowTarget.IntersectionObserver === 'function') {
    const observer = new windowTarget.IntersectionObserver(changes => {
      for (const { target, isIntersecting } of changes) target.toggleAttribute('data-in-view', isIntersecting);
    }, { root: resultsPanel, rootMargin: '100px 0px' });
    for (const { node } of chunks) observer.observe(node);
    resultsPanel.dataset.groupedVisibility = '';
    lifetime.onDispose(() => observer.disconnect());
  }
  browser.dataset.retained = '';
  information.dataset.retained = '';
  let activeCategory = 'all';
  // Reset the outgoing layout before changing result visibility. Hidden panels
  // were reset when closed, so opening one needs no synchronous layout readback.
  const resetResultsScroll = () => { if (!browser.hidden) resultsPanel.scrollTop = 0; };
  const selectTab = (classification, { focus = false, resetScroll = true } = {}) => {
    if (resetScroll) resetResultsScroll();
    activeCategory = classification;
    for (const tab of tabs) {
      const selected = tab.dataset.objectTab === classification;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) {
        resultsPanel.setAttribute('aria-labelledby', tab.id);
        if (focus) tab.focus();
      }
    }
    for (const item of items) item.hidden = item.dataset.objectMatch !== 'true'
      || !matchesObjectCategory(item.dataset.objectClassification, classification);
    refreshChunks();
    visibleObjects = items.filter(item => !item.hidden).length;
    empty.hidden = visibleObjects > 0;
  };

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let selectedObjectName = "";
  let overview = false;
  let overviewScope = 'solar-system';
  const overviewName = () => overviewScope === 'milky-way' ? 'Milky Way' : 'Solar System';
  let visibleObjects = 0;
  const destinations = createDestinationBrowser({
    documentTarget, windowTarget,
    onResults(count) { empty.hidden = visibleObjects + count > 0; },
    onSelected() { render(false); search.blur(); },
    onReset() { render(false); },
  });
  lifetime.onDispose(() => destinations?.destroy());
  let open = false;
  let browsing = false;
  const categoryButtons = [...documentTarget.querySelectorAll('.planet-search-category')];
  const markCategory = (classification = null) => {
    for (const button of categoryButtons) {
      button.ariaPressed = String(button.dataset.searchClassification === classification);
    }
  };
  const filter = (resetScroll = true) => {
    if (resetScroll) resetResultsScroll();
    markCategory();
    // Search text belongs to the user; the card context is only a fallback.
    const query = (browsing ? search.value.trim().toLocaleLowerCase("en") : "")
      || (overview ? overviewName().toLocaleLowerCase("en") : "");
    setPanelHidden(information, query.length > 0);
    destinations?.setOpen(query.length > 0);
    const galactic = query === 'milky way';
    if (galaxy) setPanelHidden(galaxy, !galactic);
    if (system) setPanelHidden(system, galactic);
    browser.ariaLabel = galactic ? 'Milky Way' : 'Solar System objects';
    if (galactic) {
      setPanelHidden(browser, false); empty.hidden = true; visibleObjects = 1;
      void destinations?.search('');
      return;
    }
    const showAll = query === "all objects";
    const classification = items.find(item => {
      const name = item.dataset.objectClassificationName;
      return name && (query === name || query === `${name}s` || query === item.dataset.objectClassification);
    })?.dataset.objectClassification;
    markCategory(classification);
    const systemName = items.find(item =>
      query === item.dataset.objectSystemName)?.dataset.objectSystemName;
    visibleObjects = 0;
    void destinations?.search(classification || systemName || showAll ? "" : query);
    if (query.length === 0) {
      for (const item of items) item.hidden = true;
      empty.hidden = true;
      setPanelHidden(browser, true);
      return;
    }
    setPanelHidden(browser, false);
    for (const item of items) {
      const match = classification === "dwarf-planet" || classification === "star" ? item.dataset.objectClassification === classification
        : showAll || classification || (systemName
        ? item.dataset.objectSystemName === systemName
        : (item.dataset.objectName ?? "").includes(query));
      item.dataset.objectMatch = String(Boolean(match));
    }
    const matches = items.filter(item => item.dataset.objectMatch === 'true');
    const classifications = matches.map(item => item.dataset.objectClassification);
    for (const tab of tabs) {
      tab.querySelector('.planet-object-tab-count').textContent = `(${objectCategoryCount(classifications, tab.dataset.objectTab)})`;
    }
    const nextCategory = classification ? objectCategory(classification)
      : showAll ? 'all' : matches.some(item => matchesObjectCategory(item.dataset.objectClassification, activeCategory))
        ? activeCategory : objectCategory(matches[0]?.dataset.objectClassification) ?? activeCategory;
    selectTab(nextCategory, { resetScroll: false });
    empty.hidden = visibleObjects !== 0 || Boolean(destinations && !classification && !showAll);
  };
  const render = (next, { resetQuery = false } = {}) => {
    resetResultsScroll();
    if (!next) browsing = false;
    if (overview && !next) next = true;
    open = next;
    if (next && resetQuery) search.value = "";
    destinations?.setOpen(next);
    setPanelHidden(information, next);
    setPanelHidden(browser, !next);
    if (next) filter(false);
    else markCategory();
  };

  trigger.addEventListener("click", () => {
    browsing = true;
    render(true);
    search.focus();
  }, {
    signal: events.signal,
  });
  for (const button of categoryButtons) {
    button.addEventListener('click', () => {
      search.value = button.dataset.searchQuery;
      search.dispatchEvent(new windowTarget.Event('input', { bubbles: true }));
      documentTarget.querySelector('.planet-sidebar').scrollTop = 0;
    }, { signal: events.signal });
    button.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      render(false);
      search.focus();
    }, { signal: events.signal });
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab.dataset.objectTab), { signal: events.signal });
    tab.addEventListener('keydown', event => {
      const index = tabs.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : null;
      if (next === null) return;
      event.preventDefault();
      selectTab(tabs[next].dataset.objectTab, { focus: true });
    }, { signal: events.signal });
  }
  galaxy?.querySelector('[data-browse-solar-system]')?.addEventListener('click', event => {
    event.preventDefault();
    browsing = true;
    search.value = 'Solar System'; render(true);
  }, { signal: events.signal });
  for (const panel of [information, browser]) panel.addEventListener("click", (event) => {
    const crumb = event.target instanceof windowTarget.HTMLElement
      ? event.target.closest("[data-object-query]") : null;
    if (!crumb || !panel.contains(crumb)) return;
    search.value = crumb.dataset.objectQuery;
    search.dispatchEvent(new windowTarget.Event('input', { bubbles: true }));
  }, { signal: events.signal });
  search.addEventListener("input", () => {
    browsing = true;
    if (!open) render(true);
    else if (open) filter();
  }, { signal: events.signal });
  // Source result rows have explicit visibility. Reading every row's geometry
  // here would synchronously lay out all skipped groups on each arrow key.
  const visibleControl = element => !element.disabled && !element.closest('[hidden], .planet-breadcrumbs')
    && (element.classList.contains('planet-object-link') || element.getClientRects().length > 0);
  search.addEventListener("keydown", (event) => {
    if (open && (event.key === "Enter" || event.key === "ArrowDown")) {
      const first = [...browser.querySelectorAll("a, button")].find(visibleControl);
      if (first) {
        event.preventDefault();
        if (event.key === "Enter") first.click(); else first.focus();
      }
    } else if (event.key === "Enter") {
      event.preventDefault(); browsing = true; render(true); return;
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
    browsing = true;
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
      const selected = !overview && anchor.querySelector('.planet-object-name')?.textContent === selectedObjectName;
      anchor.classList.toggle('is-active', selected);
      if (selected) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
  };
  return Object.freeze({
    previewOverview() {
      const previous = { selectedObjectName, overview, overviewScope, browsing };
      overview = true; overviewScope = 'solar-system'; browsing = false;
      markSelection(); render(false);
      return () => {
        const editing = browsing;
        ({ selectedObjectName, overview, overviewScope } = previous);
        browsing = editing || previous.browsing;
        markSelection(); render(browsing);
      };
    },
    previewObject(name) {
      const previous = { selectedObjectName, overview, overviewScope, browsing };
      overview = false; selectedObjectName = name;
      markSelection(); render(false);
      return () => {
        const editing = browsing;
        ({ selectedObjectName, overview, overviewScope } = previous);
        browsing = editing || previous.browsing;
        markSelection(); render(browsing);
      };
    },
    showSolarSystem() {
      overview = true; overviewScope = "solar-system";
      markSelection(); render(false);
    },
    setOverview(enabled, scope = 'solar-system') {
      const editing = browsing;
      overview = enabled;
      overviewScope = scope;
      markSelection();
      if (enabled) destinations?.bind(null);
      render(editing);
    },
    setObject(name) {
      // A completed flight publishes the selection, but a newer search owns
      // its query and results until the user chooses or dismisses them.
      const editing = browsing;
      overview = false;
      selectedObjectName = name;
      markSelection();
      destinations?.bind(null);
      render(editing);
    },
    setDestinations(provider) { destinations?.bind(provider); },
    destroy() {
      events.abort();
      destinations?.destroy();
      for (const item of items) item.hidden = false;
      empty.hidden = true;
      render(false);
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
  const panels = [...informationPanel.querySelectorAll(':scope > details, :scope > [data-information-panel] > details')]
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

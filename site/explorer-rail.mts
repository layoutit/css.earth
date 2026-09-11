import type { BrowserWindow } from './browser-types.mts';
import { MOBILE_VIEWPORT_QUERY } from "./runtime-policy.mts";

// Shell navigation only. Panel switches retain the mounted object scene.
export function createExplorerRailController(documentTarget: Document, windowTarget: BrowserWindow, { onOpenSolarSystem = () => {}, onShowPanel = () => {} }: { onOpenSolarSystem?(): void; onShowPanel?(): void } = {}) {
  const explore = documentTarget.querySelector<HTMLElement>(".explorer-rail-explore");
  const about = documentTarget.querySelector<HTMLElement>(".explorer-rail-about");
  const panel = documentTarget.querySelector<HTMLElement>(".explorer-about-panel");
  const drawer = documentTarget.querySelector<HTMLElement>(".planet-drawer-content");
  const searchCard = documentTarget.querySelector<HTMLElement>(".planet-sidebar-search-card");
  const search = documentTarget.querySelector<HTMLElement>(".planet-sidebar-search");
  const settings = documentTarget.querySelector<HTMLElement>(".planet-settings-action");
  const settingsPanel = documentTarget.querySelector<HTMLElement>(".planet-settings-panel");
  const aside = documentTarget.querySelector<HTMLElement>(".planet-sidebar");
  const spacecraftToggle = documentTarget.querySelector<HTMLElement>(".planet-spacecraft-toggle");
  if (!(explore instanceof windowTarget.HTMLButtonElement) || !(settings instanceof windowTarget.HTMLButtonElement)
      || (about !== null && !(about instanceof windowTarget.HTMLButtonElement))
      || !(panel instanceof windowTarget.HTMLElement) || !(settingsPanel instanceof windowTarget.HTMLElement)
      || !(drawer instanceof windowTarget.HTMLElement) || !(searchCard instanceof windowTarget.HTMLElement)
      || !(aside instanceof windowTarget.HTMLElement) || !(search instanceof windowTarget.HTMLInputElement)
      || (spacecraftToggle !== null && !(spacecraftToggle instanceof windowTarget.HTMLButtonElement))) {
    throw new Error("Explorer rail is incomplete.");
  }

  const events = new AbortController();
  let activePanel: "explore" | "about" = "explore";
  let settingsOpen = false;
  // Settings shares the right-hand context slot with the spacecraft card, never the sidebar.
  const setSettingsOpen = (open: boolean) => {
    settingsOpen = open;
    settingsPanel.hidden = !open;
    settings.ariaPressed = String(open);
    if (open) documentTarget.body.dataset.contextPanel = "settings";
    else delete documentTarget.body.dataset.contextPanel;
  };
  const render = (next: "explore" | "about") => {
    activePanel = next;
    panel.hidden = next !== "about";
    drawer.hidden = next !== "explore";
    searchCard.hidden = false;
    explore.ariaPressed = String(next === "explore");
    if (about) about.ariaPressed = String(next === "about");
    aside.ariaLabel = next === "about" ? "About cssEarth" : "Planet information";
  };
  const show = (next: "explore" | "about") => {
    onShowPanel();
    render(next);
    aside.scrollTop = 0;
    if (windowTarget.matchMedia(MOBILE_VIEWPORT_QUERY).matches) {
      windowTarget.scrollTo({ top: 0, behavior: "instant" });
    }
  };
  explore.addEventListener("click", () => {
    show("explore");
    onOpenSolarSystem();
  }, { signal: events.signal });
  about?.addEventListener("click", () => show("about"), { signal: events.signal });
  settings.addEventListener("click", () => {
    setSettingsOpen(!settingsOpen);
    if (settingsOpen && windowTarget.matchMedia(MOBILE_VIEWPORT_QUERY).matches) {
      settingsPanel.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }, { signal: events.signal });
  // Choosing the spacecraft card hands the context slot back from Settings.
  spacecraftToggle?.addEventListener("click", () => { if (settingsOpen) setSettingsOpen(false); }, { signal: events.signal });
  const showSearch = () => { if (activePanel !== "explore") show("explore"); };
  search.addEventListener("input", showSearch, { signal: events.signal });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "ArrowDown") showSearch();
  }, { capture: true, signal: events.signal });
  documentTarget.querySelector<HTMLElement>(".planet-sidebar-view-all")?.addEventListener("click", showSearch, { signal: events.signal });
  documentTarget.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (settingsOpen) {
      event.preventDefault();
      setSettingsOpen(false);
      settings.focus();
      return;
    }
    if (activePanel === "explore") return;
    event.preventDefault();
    show("explore");
    about?.focus();
  }, { signal: events.signal });
  render("explore");
  setSettingsOpen(false);

  return Object.freeze({
    destroy() {
      events.abort();
      setSettingsOpen(false);
      render("explore");
    },
  });
}

import type { BrowserWindow } from './browser-types.mts';
import { MOBILE_VIEWPORT_QUERY } from "./runtime-policy.mts";

// Shell navigation only. Panel switches retain the mounted object scene.
export function createExplorerRailController(documentTarget: Document, windowTarget: BrowserWindow, { onOpenSolarSystem = () => {}, onShowPanel = () => {} }: { onOpenSolarSystem?(): void; onShowPanel?(): void } = {}) {
  const explore = documentTarget.querySelector<HTMLElement>(".explorer-rail-explore");
  const about = documentTarget.querySelector<HTMLElement>(".explorer-rail-about");
  const panel = documentTarget.querySelector<HTMLElement>(".explorer-about-panel");
  const drawer = documentTarget.querySelector<HTMLElement>(".object-drawer-content");
  const searchCard = documentTarget.querySelector<HTMLElement>(".object-sidebar-search-card");
  const search = documentTarget.querySelector<HTMLElement>(".object-sidebar-search");
  const settings = documentTarget.querySelector<HTMLElement>(".object-settings-action");
  const settingsPanel = documentTarget.querySelector<HTMLElement>(".object-settings-panel");
  const aside = documentTarget.querySelector<HTMLElement>(".object-sidebar");
  if (!(explore instanceof windowTarget.HTMLButtonElement) || !(settings instanceof windowTarget.HTMLButtonElement)
      || (about !== null && !(about instanceof windowTarget.HTMLButtonElement))
      || !(panel instanceof windowTarget.HTMLElement) || !(settingsPanel instanceof windowTarget.HTMLElement)
      || !(drawer instanceof windowTarget.HTMLElement) || !(searchCard instanceof windowTarget.HTMLElement)
      || !(aside instanceof windowTarget.HTMLElement) || !(search instanceof windowTarget.HTMLInputElement)) {
    throw new Error("Explorer rail is incomplete.");
  }

  const events = new AbortController();
  let activePanel: "explore" | "about" = "explore";
  const render = (next: "explore" | "about") => {
    activePanel = next;
    panel.hidden = next !== "about";
    drawer.hidden = next !== "explore";
    searchCard.hidden = false;
    explore.ariaPressed = String(next === "explore");
    if (about) about.ariaPressed = String(next === "about");
    aside.ariaLabel = next === "about" ? "About cssEarth" : "Object information";
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
  const showSearch = () => { if (activePanel !== "explore") show("explore"); };
  search.addEventListener("input", showSearch, { signal: events.signal });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "ArrowDown") showSearch();
  }, { capture: true, signal: events.signal });
  documentTarget.querySelector<HTMLElement>(".object-sidebar-view-all")?.addEventListener("click", showSearch, { signal: events.signal });
  documentTarget.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    // The native popover owns Escape and focus restoration, even before JS.
    if (settingsPanel.matches(':popover-open')) return;
    if (activePanel === "explore") return;
    event.preventDefault();
    show("explore");
    about?.focus();
  }, { signal: events.signal });
  render("explore");

  return Object.freeze({
    destroy() {
      events.abort();
      render("explore");
    },
  });
}

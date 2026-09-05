import { MOBILE_VIEWPORT_QUERY } from "./runtime-policy.mjs";

// Shell navigation only. Panel switches retain the mounted object scene.
export function createExplorerRailController(documentTarget, windowTarget) {
  const explore = documentTarget.querySelector(".explorer-rail-explore");
  const about = documentTarget.querySelector(".explorer-rail-about");
  const panel = documentTarget.querySelector(".explorer-about-panel");
  const drawer = documentTarget.querySelector(".planet-drawer-content");
  const searchCard = documentTarget.querySelector(".planet-sidebar-search-card");
  const search = documentTarget.querySelector(".planet-sidebar-search");
  const settings = documentTarget.querySelector(".planet-settings-action");
  const settingsPanel = documentTarget.querySelector(".planet-settings-panel");
  const aside = documentTarget.querySelector(".planet-sidebar");
  if (![explore, about, settings].every((node) =>
    node instanceof windowTarget.HTMLButtonElement) ||
      ![panel, settingsPanel, drawer, searchCard, aside].every((node) =>
        node instanceof windowTarget.HTMLElement) ||
      !(search instanceof windowTarget.HTMLInputElement)) {
    throw new Error("Explorer rail is incomplete.");
  }

  const events = new AbortController();
  let activePanel = "explore";
  const render = (next) => {
    activePanel = next;
    panel.hidden = next !== "about";
    settingsPanel.hidden = next !== "settings";
    drawer.hidden = next !== "explore";
    searchCard.hidden = next !== "explore";
    explore.ariaPressed = String(next === "explore");
    about.ariaPressed = String(next === "about");
    settings.ariaPressed = String(next === "settings");
    aside.ariaLabel = next === "about" ? "About cssEarth"
      : next === "settings" ? "Settings"
      : "Planet information";
  };
  const show = (next) => {
    render(next);
    aside.scrollTop = 0;
    if (windowTarget.matchMedia(MOBILE_VIEWPORT_QUERY).matches) {
      windowTarget.scrollTo({ top: 0, behavior: "instant" });
    }
  };
  explore.addEventListener("click", () => {
    show("explore");
    search.focus();
  }, { signal: events.signal });
  about.addEventListener("click", () => show("about"), { signal: events.signal });
  settings.addEventListener("click", () => show("settings"), { signal: events.signal });
  documentTarget.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || activePanel === "explore") return;
    event.preventDefault();
    const action = activePanel === "settings" ? settings : about;
    show("explore");
    action.focus();
  }, { signal: events.signal });
  render("explore");

  return Object.freeze({
    destroy() {
      events.abort();
      render("explore");
    },
  });
}

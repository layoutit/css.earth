const searchRoots = [...document.querySelectorAll("[data-maps-search]")];

for (const root of searchRoots) {
  const input = root.querySelector(".planet-sidebar-search");
  const browser = document.querySelector(".planet-object-browser");
  const empty = document.querySelector(".planet-object-empty");
  const trigger = root.querySelector(".planet-sidebar-view-all");
  const items = [...document.querySelectorAll(".planet-object-item")];
  if (!(input instanceof HTMLInputElement) ||
      !(browser instanceof HTMLElement) ||
      !(empty instanceof HTMLElement) ||
      !(trigger instanceof HTMLButtonElement)) continue;

  const render = ({ open = trigger.ariaPressed === "true" } = {}) => {
    const query = input.value.trim().toLocaleLowerCase("en");
    let visible = 0;
    for (const item of items) {
      const matches = query.length === 0 || item.dataset.objectName?.includes(query);
      item.hidden = !matches;
      if (matches) visible += 1;
    }
    const visibleBrowser = open;
    browser.hidden = !visibleBrowser;
    empty.hidden = visible > 0 || !visibleBrowser;
    trigger.ariaPressed = String(visibleBrowser);
    trigger.textContent = visibleBrowser ? "Hide" : "View all";
    document.body.dataset.mapsSearchState = browser.hidden
      ? "idle"
      : visible > 0 ? "results" : "empty";
  };

  const firstVisibleResult = () => items
    .find((item) => !item.hidden)
    ?.querySelector(".planet-object-link");
  const navigateFirst = () => {
    const first = firstVisibleResult();
    if (first instanceof HTMLAnchorElement) first.click();
  };

  input.addEventListener("input", () => render({ open: true }));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      navigateFirst();
    }
    if (event.key === "Escape") {
      input.value = "";
      render({ open: true });
    }
  });
  trigger.addEventListener("click", () => {
    const next = trigger.ariaPressed !== "true";
    if (!next) input.value = "";
    render({ open: next });
  });
  for (const item of items) {
    item.querySelector(".planet-object-link")?.addEventListener("click", (event) => {
      document.body.dataset.mapsLanding = event.currentTarget.dataset.objectId || "object";
    });
  }
  render({ open: true });
}

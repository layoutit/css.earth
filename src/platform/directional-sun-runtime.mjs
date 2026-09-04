import { validateDirectionalSunPlan } from
  "./directional-sun-contract.mjs";

export function mountRetainedDirectionalSun({
  host,
  plan,
  imageDensity,
  objectId,
  before = null,
}) {
  validateDirectionalSunPlan(plan);
  if (!(host instanceof HTMLElement) || ![1, 2].includes(imageDensity) ||
      !/^[a-z][a-z0-9-]*$/u.test(objectId) ||
      (before !== null && !(before instanceof HTMLElement))) {
    throw new TypeError("Retained directional Sun mount arguments are invalid.");
  }
  const root = document.createElement("s");
  root.className = `planet-directional-sun ${objectId}-directional-sun`;
  root.ariaHidden = "true";
  root.style.backgroundImage =
    `url("${imageDensity === 2 ? plan.asset.url2x : plan.asset.url}")`;
  root.style.width = `${plan.projection.apparentViewportWidthShare * 100}cqw`;
  root.style.height = root.style.width;
  host.insertBefore(root, before);
  let viewportWidth = Math.max(1, host.clientWidth);
  let viewportHeight = Math.max(1, host.clientHeight);
  let lastDirection = null;
  let destroyed = false;
  let state = Object.freeze({
    classification: "behind-camera",
    visible: false,
    centerNdc: null,
  });

  const publishDirection = (direction) => {
    const forward = -direction[2];
    if (forward <= 1e-9) {
      if (!root.hidden) root.hidden = true;
      state = Object.freeze({
        classification: "behind-camera",
        visible: false,
        centerNdc: null,
      });
      return state;
    }
    const focalX = plan.projection.focalX;
    const focalY = focalX * viewportWidth / viewportHeight;
    const centerNdc = Object.freeze([
      focalX * direction[0] / forward,
      focalY * direction[1] / forward,
    ]);
    const halfWidthNdc = plan.projection.apparentViewportWidthShare;
    const halfHeightNdc = halfWidthNdc * viewportWidth / viewportHeight;
    const intersectsViewport =
      centerNdc[0] + halfWidthNdc >= -1 &&
      centerNdc[0] - halfWidthNdc <= 1 &&
      centerNdc[1] + halfHeightNdc >= -1 &&
      centerNdc[1] - halfHeightNdc <= 1;
    const hidden = !intersectsViewport;
    if (root.hidden !== hidden) root.hidden = hidden;
    const left = `${(centerNdc[0] + 1) * 50}%`;
    const top = `${(1 - centerNdc[1]) * 50}%`;
    if (root.style.left !== left) root.style.left = left;
    if (root.style.top !== top) root.style.top = top;
    const fullyVisible =
      centerNdc[0] - halfWidthNdc >= -1 &&
      centerNdc[0] + halfWidthNdc <= 1 &&
      centerNdc[1] - halfHeightNdc >= -1 &&
      centerNdc[1] + halfHeightNdc <= 1;
    state = Object.freeze({
      classification: !intersectsViewport
        ? "outside-viewport"
        : fullyVisible ? "fully-visible" : "partially-visible",
      visible: intersectsViewport,
      centerNdc,
    });
    return state;
  };
  const ResizeObserverConstructor =
    host.ownerDocument.defaultView?.ResizeObserver;
  const resizeObserver = typeof ResizeObserverConstructor === "function"
    ? new ResizeObserverConstructor(([entry]) => {
      if (destroyed || !entry) return;
      const nextWidth = Math.max(1, entry.contentRect.width);
      const nextHeight = Math.max(1, entry.contentRect.height);
      if (nextWidth === viewportWidth && nextHeight === viewportHeight) return;
      viewportWidth = nextWidth;
      viewportHeight = nextHeight;
      if (lastDirection !== null) publishDirection(lastDirection);
    })
    : null;
  resizeObserver?.observe(host);

  return Object.freeze({
    root,
    setViewDirection(direction) {
      if (!Array.isArray(direction) || direction.length !== 3 ||
          direction.some((value) => !Number.isFinite(value))) {
        throw new TypeError("Directional Sun view direction is invalid.");
      }
      if (resizeObserver === null) {
        viewportWidth = Math.max(1, host.clientWidth);
        viewportHeight = Math.max(1, host.clientHeight);
      }
      if (lastDirection !== null &&
          direction[0] === lastDirection[0] &&
          direction[1] === lastDirection[1] &&
          direction[2] === lastDirection[2]) return state;
      lastDirection = Object.freeze([...direction]);
      return publishDirection(lastDirection);
    },
    state() {
      return state;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      resizeObserver?.disconnect();
      root.remove();
    },
  });
}

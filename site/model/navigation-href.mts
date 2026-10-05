/** The history owner of each window, so scene code reads the URL a deferred write will publish (`navigationHref`). */
const owners = new WeakMap<Window, { href(): string }>();

/** The page's URL as the app knows it: a history write deferred while the camera moves is already this URL. */
export function navigationHref(windowTarget: Window) {
  return owners.get(windowTarget)?.href() ?? windowTarget.location.href;
}

export { owners };

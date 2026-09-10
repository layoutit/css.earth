/** One composited cloud image, independently attenuated from the sharp star layer. */
export function createCloudSurface(host: HTMLElement, before: Element) {
  const root = host.ownerDocument.createElement('div'); root.className = 'nebula-cloud-surface';
  root.style.position = 'absolute'; root.style.inset = '0'; root.style.pointerEvents = 'none';
  const end = host.ownerDocument.createElement('span'); end.hidden = true; root.append(end);
  host.insertBefore(root, before);
  return { root, end, destroy() { root.remove(); } };
}

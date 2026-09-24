/** The world camera a body mounts with (`cssearth-world-camera@1`): the shared frame, focus and camera from the world
 * summary, embedded in every page by `ObjectLayout.astro`. A body mounts from it before the 80 KB summary downloads;
 * the renderer validates it. */
const element = typeof document === 'undefined' ? null : document.querySelector('script[data-world-camera]');
export const APPLICATION_WORLD_CAMERA: unknown = element?.textContent ? JSON.parse(element.textContent) : undefined;

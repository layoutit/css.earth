// Registers the offline worker after the first scene has loaded, so it never
// competes with the page for bandwidth. Development servers skip it.
export function registerServiceWorker(windowTarget: Window, enabled: boolean) {
  const container = windowTarget.navigator.serviceWorker;
  if (!enabled || !container) return;
  const register = () => {
    container.register('/sw.js', { scope: '/' }).catch(error => {
      console.warn('Offline support is unavailable.', error);
    });
  };
  if (windowTarget.document.readyState === 'complete') register();
  else windowTarget.addEventListener('load', register, { once: true });
}

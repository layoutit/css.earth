// The header's Install button appears only after the browser offers to install
// the app (Chrome and Edge fire beforeinstallprompt; Safari and Firefox install
// from their own menus). The offer lives on the document root, so the button
// shows even after navigation replaces the header's markup.
export const INSTALLABLE_ATTRIBUTE = 'installable';

interface InstallOffer {
  prompt(): Promise<unknown>;
}

function installOffer(event: Event): InstallOffer | null {
  if (!('prompt' in event) || typeof event.prompt !== 'function') return null;
  const prompt = event.prompt;
  return { prompt: () => Promise.resolve(prompt.call(event)) };
}

export function bindInstallPrompt(windowTarget: Window) {
  const root = windowTarget.document.documentElement;
  let offer: InstallOffer | null = null;
  windowTarget.addEventListener('beforeinstallprompt', event => {
    const candidate = installOffer(event);
    if (!candidate) return;
    // Keep the browser's own mini-infobar away; the header button asks instead.
    event.preventDefault();
    offer = candidate;
    root.dataset[INSTALLABLE_ATTRIBUTE] = 'true';
  });
  const withdraw = () => {
    offer = null;
    delete root.dataset[INSTALLABLE_ATTRIBUTE];
  };
  windowTarget.addEventListener('appinstalled', withdraw);
  windowTarget.document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-install-app]') || !offer) return;
    const pending = offer;
    // An offer can be used once; the browser fires a new one if it may ask again.
    withdraw();
    void pending.prompt().catch(() => undefined);
  });
}

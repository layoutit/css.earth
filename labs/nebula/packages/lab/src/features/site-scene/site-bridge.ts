/**
 * The lab's side of the embed bridge: the website's own page in a frame (site-scene-view.tsx) publishes its state and
 * camera, and takes the lab's commands (@cssearth/renderer/embed/embed-bridge.ts, site/scene/embed-bridge.mts). A message
 * counts only from the site's origin and from that frame's window, and only when it parses.
 */
import { EMBED_BRIDGE_PROTOCOL, parseEmbedPageMessage, type EmbedCamera, type EmbedCommand, type EmbedPageMessage } from '@cssearth/renderer/embed/embed-bridge.ts';

export type SiteState = Extract<EmbedPageMessage, { type: 'state' }>;
export type SiteClick = Extract<EmbedPageMessage, { type: 'click' }>;
export interface SiteBridge {
  readonly state: SiteState | null;
  readonly camera: EmbedCamera | null;
  readonly moving: boolean;
  /** Hears every state and camera the page publishes. */
  subscribe(listener: (change: 'state' | 'camera') => void): () => void;
  /** Hears every click on the page's scene, in the page's (and the lab layers') CSS pixels. */
  onClick(listener: (click: SiteClick) => void): () => void;
  /** Sends one command; resolves with the page's reply (a captured view's token), rejects with its error. */
  send(command: EmbedCommand): Promise<{ view?: string }>;
  destroy(): void;
}

/** Which window a message came from, and from where: the two facts a message is accepted on. */
export interface BridgeEndpoint { readonly origin: string; readonly source: MessageEventSource | null }
export const acceptsMessage = (event: BridgeEndpoint, siteOrigin: string, frame: Window | null) =>
  frame !== null && event.origin === siteOrigin && event.source === frame;

export function connectSiteBridge({ windowTarget, frame, siteOrigin, timeoutMs = 20_000 }: {
  windowTarget: Window; frame: () => Window | null; siteOrigin: string; timeoutMs?: number;
}): SiteBridge {
  let state: SiteState | null = null, camera: EmbedCamera | null = null, moving = false, destroyed = false, nextId = 1;
  const listeners = new Set<(change: 'state' | 'camera') => void>(), clicks = new Set<(click: SiteClick) => void>();
  const waiting = new Map<number, { resolve(value: { view?: string }): void; reject(reason: Error): void; timer: number }>();
  const emit = (change: 'state' | 'camera') => { for (const listener of listeners) listener(change); };
  const message = (event: MessageEvent) => {
    if (destroyed || !acceptsMessage(event, siteOrigin, frame())) return;
    const parsed = parseEmbedPageMessage(event.data);
    if (!parsed) return;
    if (parsed.type === 'state') { state = parsed; emit('state'); return; }
    if (parsed.type === 'camera') { camera = parsed.camera; moving = parsed.moving; emit('camera'); return; }
    if (parsed.type === 'click') { for (const listener of clicks) listener(parsed); return; }
    const pending = waiting.get(parsed.requestId);
    if (!pending) return;
    waiting.delete(parsed.requestId); windowTarget.clearTimeout(pending.timer);
    if (parsed.ok) pending.resolve(parsed.view === undefined ? {} : { view: parsed.view });
    else pending.reject(new Error(parsed.error ?? 'The page refused the command.'));
  };
  windowTarget.addEventListener('message', message);
  return {
    get state() { return state; }, get camera() { return camera; }, get moving() { return moving; },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    onClick(listener) { clicks.add(listener); return () => { clicks.delete(listener); }; },
    send(command) {
      const target = frame();
      if (destroyed || !target) return Promise.reject(new Error('The website view is not open.'));
      const requestId = nextId++;
      return new Promise((resolve, reject) => {
        const timer = windowTarget.setTimeout(() => { waiting.delete(requestId); reject(new Error(`The page did not answer ${command.type}.`)); }, timeoutMs);
        waiting.set(requestId, { resolve, reject, timer });
        target.postMessage({ ...command, protocol: EMBED_BRIDGE_PROTOCOL, requestId }, siteOrigin);
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; windowTarget.removeEventListener('message', message); listeners.clear(); clicks.clear();
      for (const { reject, timer } of waiting.values()) { windowTarget.clearTimeout(timer); reject(new Error('The website view closed.')); }
      waiting.clear();
    },
  };
}

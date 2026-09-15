import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ControlEntry { id: string; host: HTMLElement; content: ReactNode }

/** Compatibility ports publish into the application's React tree, never independent roots. */
export function createControlPortals() {
  let entries: readonly ControlEntry[] = [], sequence = 0;
  const listeners = new Set<() => void>();
  const publish = (next: readonly ControlEntry[]) => { entries = next; for (const listener of listeners) listener(); };
  return {
    snapshot: () => entries,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    mount(host: HTMLElement) {
      if (entries.some(entry => entry.host === host)) throw new Error(`Control host already belongs to the application: ${host.id}`);
      const id = `control-${++sequence}`; let disposed = false;
      return {
        render(content: ReactNode) {
          if (disposed) return;
          const entry = { id, host, content };
          publish(entries.some(value => value.id === id) ? entries.map(value => value.id === id ? entry : value) : [...entries, entry]);
        },
        unmount() { if (!disposed) { disposed = true; publish(entries.filter(entry => entry.id !== id)); } },
      };
    },
  };
}
export type ControlPortals = ReturnType<typeof createControlPortals>;
export function ControlPortalContents({ controls }: { controls: ControlPortals }) {
  const entries = useSyncExternalStore(controls.subscribe, controls.snapshot);
  return entries.map(entry => createPortal(entry.content, entry.host, entry.id));
}

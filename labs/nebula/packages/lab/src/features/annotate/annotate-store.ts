import { useSyncExternalStore } from 'react';

/** Whether the viewport's Annotate mode is on: shared by the toolbar toggle and the selection overlay. */
let enabled = false;
const listeners = new Set<() => void>();
export function setAnnotating(value: boolean) { if (value !== enabled) { enabled = value; for (const listener of listeners) listener(); } }
export function useAnnotating(): boolean {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => enabled);
}

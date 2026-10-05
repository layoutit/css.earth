/** Preserve state values; only the application's random entry prefix receives a per-document alias. */
import type { Json } from './trace.mts';
export function historyValues(state: Json, prefixes: Map<string, string>): Json {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  const entry = state.cssEarthEntry;
  if (typeof entry !== 'string') return state;
  const match = /^([a-f0-9]{32})-([1-9][0-9]*)$/u.exec(entry);
  if (!match?.[1] || !match[2]) return state;
  const prefix = match[1];
  if (!prefixes.has(prefix)) prefixes.set(prefix, `session-${prefixes.size}`);
  return { ...state, cssEarthEntry: `${prefixes.get(prefix)}-${match[2]}` };
}

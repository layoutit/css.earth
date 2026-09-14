import { parseContextAvailability } from '../src/platform/context-availability.mts';

// Astro supplies the same startup inspection to server-rendered panels and the browser.
// External values stay unknown until the runtime parser validates them.
declare const __CSSEARTH_CONTEXT_AVAILABILITY__: unknown;
export const CONTEXT_AVAILABILITY = parseContextAvailability(__CSSEARTH_CONTEXT_AVAILABILITY__);

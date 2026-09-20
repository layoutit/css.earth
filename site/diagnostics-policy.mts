/// <reference types="vite/client" />
// Explicit opt-in for an immutable production-shaped performance recording.
// Ordinary production builds keep the inspection APIs and recorder disabled.
export const DIAGNOSTICS_ENABLED = import.meta.env?.DEV === true || import.meta.env?.MODE === 'performance';

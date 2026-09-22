import type { Plugin } from 'vite';

// Retain debug artifacts beside performance builds without a runtime request or
// a sourceMappingURL in served JS. Normal production builds are unaffected.
export function performanceSourceMaps(): Plugin {
  return {
    name: 'cssearth-performance-source-maps',
    apply: 'build',
    config(_config, { mode }) {
      if (mode === 'performance') return { build: { sourcemap: 'hidden' } };
    },
    // Astro sets the client environment's sourcemap from its own vite config, not from a plugin's config hook
    // (withastro/astro de96360), so the client bundle needs the setting applied per environment.
    configEnvironment(_name, _config, { mode }) {
      if (mode === 'performance') return { build: { sourcemap: 'hidden' } };
    },
  };
}

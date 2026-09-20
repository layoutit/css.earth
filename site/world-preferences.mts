import type { createApplicationWorldContext } from './application-world-context.mts';
import type { ShellOptions } from './planet-shell-client.mts';
import type { OrbitRenderer } from '../src/renderers/css/solar-system/prepared-orbit-lines.js';

type World = Awaited<ReturnType<ReturnType<typeof createApplicationWorldContext>['mount']>>;

/** Display intent survives detail replacement and is replayed when the retained world mounts. */
export function createWorldPreferences(documentTarget: Document) {
  const state = {
    highContrastSky: documentTarget.querySelector<HTMLInputElement>('.planet-sky-contrast-setting')?.checked ?? false,
    heliosphereEnabled: false, illustrationModelsEnabled: false,
    asteroidBodiesEnabled: false, asteroidOrbitsEnabled: false, asteroidLabelsEnabled: false,
    minimapEnabled: false, orbitRenderer: 'strokes' as OrbitRenderer,
    highlightedClassification: null as string | null,
  };
  const setters: { [K in keyof typeof state]: (world: World, value: typeof state[K]) => void } = {
    highContrastSky: (world, value) => world.setHighContrastSky?.(value),
    heliosphereEnabled: (world, value) => world.setHeliosphereEnabled?.(value),
    illustrationModelsEnabled: (world, value) => world.setIllustrationModelsEnabled?.(value),
    asteroidBodiesEnabled: (world, value) => world.setAsteroidBodiesEnabled?.(value),
    asteroidOrbitsEnabled: (world, value) => world.setAsteroidOrbitsEnabled?.(value),
    asteroidLabelsEnabled: (world, value) => world.setAsteroidLabelsEnabled?.(value),
    minimapEnabled: (world, value) => world.setMinimapEnabled?.(value),
    orbitRenderer: (world, value) => world.setOrbitRenderer?.(value),
    highlightedClassification: (world, value) => world.setHighlightedClassification?.(value),
  };
  return {
    apply(world: World) {
      function apply<K extends keyof typeof state>(key: K) { setters[key](world, state[key]); }
      for (const key of Object.keys(setters) as (keyof typeof state)[]) apply(key);
    },
    bind(isCurrent: () => boolean, getWorld: () => World | null) {
      function update<K extends keyof typeof state>(key: K, value: typeof state[K]) {
        if (!isCurrent()) return;
        state[key] = value;
        const world = getWorld();
        if (world) setters[key](world, value);
      }
      return {
        ...state,
        onSkyContrastChange: value => update('highContrastSky', value === true),
        onHeliosphereChange: value => update('heliosphereEnabled', value === true),
        onIllustrationModelsChange: value => update('illustrationModelsEnabled', value === true),
        onAsteroidBodiesChange: value => update('asteroidBodiesEnabled', value === true),
        onAsteroidOrbitsChange: value => update('asteroidOrbitsEnabled', value === true),
        onAsteroidLabelsChange: value => update('asteroidLabelsEnabled', value === true),
        onMinimapChange: value => update('minimapEnabled', value === true),
        onOrbitRendererChange: value => update('orbitRenderer', value),
        onCategoryChange: value => update('highlightedClassification', value),
      } satisfies Partial<ShellOptions>;
    },
  };
}

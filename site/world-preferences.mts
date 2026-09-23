import type { ShellOptions } from './object-shell-types.mts';

interface WorldPreferencesTarget {
  setHeliosphereEnabled?(enabled: boolean): void;
  setIllustrationModelsEnabled?(enabled: boolean): void;
  setMinimapEnabled?(enabled: boolean): void;
  setThreeDStarsEnabled?(enabled: boolean): void;
  setHighlightedClassification?(classification: string | null): void;
}

/** Display intent survives detail replacement and is replayed when the retained world mounts. */
export function createWorldPreferences() {
  const state = {
    heliosphereEnabled: false, illustrationModelsEnabled: false,
    surfaceLabelsEnabled: false, minimapEnabled: false, threeDStarsEnabled: false,
    highlightedClassification: null as string | null,
  };
  const setters: { [K in keyof typeof state]: (world: WorldPreferencesTarget, value: typeof state[K]) => void } = {
    heliosphereEnabled: (world, value) => world.setHeliosphereEnabled?.(value),
    illustrationModelsEnabled: (world, value) => world.setIllustrationModelsEnabled?.(value),
    surfaceLabelsEnabled: () => {},
    minimapEnabled: (world, value) => world.setMinimapEnabled?.(value),
    threeDStarsEnabled: (world, value) => world.setThreeDStarsEnabled?.(value),
    highlightedClassification: (world, value) => world.setHighlightedClassification?.(value),
  };
  return {
    apply(world: WorldPreferencesTarget) {
      function apply<K extends keyof typeof state>(key: K) { setters[key](world, state[key]); }
      for (const key of Object.keys(setters) as (keyof typeof state)[]) apply(key);
    },
    bind(isCurrent: () => boolean, getWorld: () => WorldPreferencesTarget | null) {
      function update<K extends keyof typeof state>(key: K, value: typeof state[K]) {
        if (!isCurrent()) return;
        state[key] = value;
        const world = getWorld();
        if (world) setters[key](world, value);
      }
      return {
        ...state,
        onHeliosphereChange: value => update('heliosphereEnabled', value === true),
        onIllustrationModelsChange: value => update('illustrationModelsEnabled', value === true),
        onSurfaceLabelsChange: value => update('surfaceLabelsEnabled', value === true),
        onMinimapChange: value => update('minimapEnabled', value === true),
        onThreeDStarsChange: value => update('threeDStarsEnabled', value === true),
        onCategoryChange: value => update('highlightedClassification', value),
      } satisfies Partial<ShellOptions>;
    },
  };
}

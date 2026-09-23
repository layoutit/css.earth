interface WorldPreferencesTarget {
  setHeliosphereEnabled?(enabled: boolean): void;
  setIllustrationModelsEnabled?(enabled: boolean): void;
  setThreeDStarsEnabled?(enabled: boolean): void;
  setHighlightedClassification?(classification: string | null): void;
}

export interface WorldPreferencesState {
  motionEnabled: boolean;
  heliosphereEnabled: boolean;
  illustrationModelsEnabled: boolean;
  surfaceLabelsEnabled: boolean;
  threeDStarsEnabled: boolean;
  highlightedClassification: string | null;
}
export interface WorldPreferences {
  readonly state: Readonly<WorldPreferencesState>;
  set<K extends keyof WorldPreferencesState>(key: K, value: WorldPreferencesState[K]): void;
  subscribe(listener: (key: keyof WorldPreferencesState) => void): () => void;
}

/** Application intent survives scene and card replacement. Controls and the world only project it. */
export function createWorldPreferences({ getWorld, onMotionChange }: {
  getWorld(): WorldPreferencesTarget | null;
  onMotionChange(): void;
}) {
  let state: Readonly<WorldPreferencesState> = Object.freeze({
    motionEnabled: false, heliosphereEnabled: false, illustrationModelsEnabled: false,
    surfaceLabelsEnabled: false, threeDStarsEnabled: false,
    highlightedClassification: null,
  });
  const listeners = new Set<(key: keyof WorldPreferencesState) => void>();
  const setters: { [K in keyof WorldPreferencesState]: (world: WorldPreferencesTarget, value: WorldPreferencesState[K]) => void } = {
    motionEnabled: () => {},
    heliosphereEnabled: (world, value) => world.setHeliosphereEnabled?.(value),
    illustrationModelsEnabled: (world, value) => world.setIllustrationModelsEnabled?.(value),
    surfaceLabelsEnabled: () => {},
    threeDStarsEnabled: (world, value) => world.setThreeDStarsEnabled?.(value),
    highlightedClassification: (world, value) => world.setHighlightedClassification?.(value),
  };
  function set<K extends keyof WorldPreferencesState>(key: K, value: WorldPreferencesState[K]) {
    if (state[key] === value) return;
    state = Object.freeze({ ...state, [key]: value });
    const world = getWorld();
    if (world) setters[key](world, value);
    for (const listener of listeners) listener(key);
    if (key === 'motionEnabled') onMotionChange();
  }
  const subscribe: WorldPreferences['subscribe'] = listener => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };
  return {
    get state() { return state; }, set, subscribe,
    apply(world: WorldPreferencesTarget) {
      function apply<K extends keyof WorldPreferencesState>(key: K) { setters[key](world, state[key]); }
      for (const key of Object.keys(setters) as (keyof WorldPreferencesState)[]) apply(key);
    },
    bind(isCurrent: () => boolean): WorldPreferences {
      return { get state() { return state; }, subscribe,
        set(key, value) { if (isCurrent()) set(key, value); },
      };
    },
  };
}

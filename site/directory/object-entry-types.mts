import type { CatalogEntry as RegistryCatalogEntry, NavigableObject as RegistryNavigableObject, ObjectEntry as RegistryObjectEntry } from '@cssearth/objects';
import type { SceneFactory } from '../browser/browser-types.mts';

/** The shared registry types, bound to the shell's scene loader and its abort signal. */
export type ObjectEntry = RegistryObjectEntry<SceneFactory, AbortSignal>;
export type CatalogEntry = RegistryCatalogEntry<SceneFactory, AbortSignal>;
export type NavigableObject = RegistryNavigableObject<SceneFactory, AbortSignal>;

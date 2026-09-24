import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';
import type { PreparedCssVolume } from '../volume/types.js';
import type { PreparedPointAppearance } from '../stars/types.js';
import type { PreparedCssSurfaceShell } from '../shell/types.js';
import type { PreparedCssImageLayers } from '../image-layers/loader.js';
import type { createPreparedVolumeLenses } from '../volume/prepared-volume-lenses.js';
import type { PreparedPointVisibility } from '../volume/projected-volume-visibility.js';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { WorldPlannerSource } from './world-context/world-context-planner-client.js';
import type { LensBillboards } from './lens-billboards.js';

export type PreparedImageLayerBank = { payload: PreparedCssImageLayers; resolveResource(path: string): string };
export type PreparedCatalogBank = { payload: unknown; galaxySample?: unknown; nebulae?: unknown; fadeStartDistanceM: number; fullDistanceM: number;
  clusters?: { payload: unknown; fadeStartDistanceM: number; fullDistanceM: number } };

export interface PreparedUniverseOptions {
  backgroundPointManifest?: string; backgroundPointCloud?: string;
  context: unknown; volume: PreparedCssVolume; pointAppearance: PreparedPointAppearance;
  /** The same prepared context as files the planner worker reads itself. */
  plannerSource?: WorldPlannerSource;
  resolvePointResource(path: string): string; resolveResource(path: string): string;
  sprites: Readonly<Record<string, SpriteWithUrl>>;
  annotationPriorities?: Readonly<Record<string, number>>;
  /** Moons named across their star's system; see `createWorldContextPlanner`. */
  annotationLandmarks?: readonly string[];
  annotationOpacities?: Readonly<Record<string, { line: number; label: number }>>;
  distantNavigation?: { readonly afterDistanceM: number; readonly nonNavigableIds: readonly string[] };
  /** Bodies the world draws as plain dots; see `mountPreparedWorldContext`. */
  plainDots?: { readonly ids: readonly string[]; readonly minimumDiameterPixels: number };
  /** Projected size at which any lens bank (nebula, cluster, galaxy or accompanying cloud) is fetched and drawn.
   * It may only raise the prepared thresholds: a small cloud is decoration, not worth its lens payload. */
  lensVisibility?: PreparedPointVisibility;
  shells?: readonly { payload: PreparedCssSurfaceShell; resolveResource(path: string): string }[];
  environmentLinks?: Readonly<Record<string, string>>;
  imageLayers?: readonly PreparedImageLayerBank[];
  /** Descriptor-only image banks. Their JSON and DOM are admitted only on projected visibility or explicit focus. */
  imageLayerBanks?: readonly { id: string; frame: DensityVolumeFrame }[];
  loadImageLayer?(id: string): Promise<PreparedImageLayerBank>;
  /** Volume lens banks are identified and framed from their descriptor alone; their heavy prepared
   * payload (all lenses, plus catalogue points) is fetched only through {@link loadVolumeLens}, the
   * first time a bank is selected or comes into view. Nothing here downloads at construction time. */
  volumeLensBanks?: readonly { id: string; frame: DensityVolumeFrame }[];
  /** Prepared before any lens is fetched: each bank's context visibility and, where it has one, its Sun-facing
   * billboard in a shared atlas. A small or distant bank draws its billboard; its lenses load only once large. */
  lensBillboards?: { readonly plan: LensBillboards; readonly atlasUrl: string };
  /** Mount the prepared celestial sky cube. Phones leave it out: its faces cost tens of megabytes of layers. */
  sky?: boolean;
  loadVolumeLens?(id: string): Promise<Parameters<typeof createPreparedVolumeLenses>[0]>;
  /** Testable cap for hidden banks with no active navigation subscriber. */
  warmVolumeLensDomNodeBudget?: number;
  catalog?: PreparedCatalogBank;
  /** Fade metadata is sufficient to gate the catalogue without fetching or parsing its records. */
  catalogBank?: Omit<PreparedCatalogBank, 'payload' | 'galaxySample' | 'nebulae' | 'clusters'> & {
    clusters?: Omit<NonNullable<PreparedCatalogBank['clusters']>, 'payload'> };
  loadCatalog?(): Promise<PreparedCatalogBank>;
}

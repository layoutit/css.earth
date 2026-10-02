import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';
import { type PreparedCssVolume, type PreparedPointAppearance, type PreparedCssSurfaceShell, type PreparedCssImageLayers, type PreparedPointVisibility, type DensityVolumeFrame, type DatasetBillboards } from '@cssearth/objects';

import type { BackgroundPointBank } from './background-points.js';
import type { createPreparedVolumeDatasets } from '../volume/prepared-volume-datasets.js';

import type { WorldPlannerSource } from './world-context/world-context-planner-client.js';

export type PreparedImageLayerMount = { payload: PreparedCssImageLayers; resolveResource(path: string): string;
  /** Published catalogues placed in the bank's own frame, drawn as dots over its layers and faded with them. */
  cataloguePointUrls?: readonly string[] };
export type PreparedCatalogBank = { payload: unknown; galaxySample?: unknown; nebulae?: unknown; fadeStartDistanceM: number; fullDistanceM: number;
  clusters?: { payload: unknown; fadeStartDistanceM: number; fullDistanceM: number } };

export interface PreparedUniverseOptions {
  /** Prepared catalogue point banks of the galaxies beyond the Local Group (background-points.ts). */
  backgroundCataloguePoints?: readonly BackgroundPointBank[];
  /** Prepared banks of the catalogued stars the map draws as plain dots: no label, hover or click (catalogue-points.ts). */
  starCataloguePoints?: readonly string[];
  /** Closed image meshes around the Sun seen from outside (the cosmic microwave background; image-mesh.ts). */
  /** `cutaway` answers, on each publication, whether a mesh with a cutaway is shown cut open (image-mesh.ts); open by default. */
  imageMeshes?: readonly { url: string; resolveResource(path: string): string; cutaway?(): boolean; hidden?(): boolean; hiddenCaption?: string }[];
  context: unknown; volume: PreparedCssVolume; pointAppearance: PreparedPointAppearance;
  /** The same prepared context as files the planner worker reads itself. */
  plannerSource?: WorldPlannerSource;
  resolvePointResource(path: string): string; resolveResource(path: string): string;
  sprites: Readonly<Record<string, SpriteWithUrl>>;
  annotationPriorities?: Readonly<Record<string, number>>;
  /** Moons named across their star's system; see `createWorldContextPlanner`. */
  annotationLandmarks?: readonly string[];
  annotationOpacities?: Readonly<Record<string, { line: number; label: number }>>;
  /** Bodies that are never a hover or navigation target; see `mountPreparedWorldContext`. */
  nonNavigableIds?: readonly string[];
  /** How wide, at least, a body its row marks `plainDot` is drawn; see `mountPreparedWorldContext`. */
  plainDots?: { readonly minimumDiameterPixels: number };
  /** Projected size at which any dataset bank (nebula, cluster, galaxy or accompanying cloud) is fetched and drawn.
   * It may only raise the prepared thresholds: a small cloud is decoration, not worth its dataset payload. */
  datasetVisibility?: PreparedPointVisibility;
  shells?: readonly { payload: PreparedCssSurfaceShell; resolveResource(path: string): string }[];
  environmentLinks?: Readonly<Record<string, string>>;
  /** The context packages a level object's datasets name (its `overview.packages`): the world always draws them, so each
   * answers as a bank with nothing to load. */
  contextBanks?: readonly string[];
  /** Published stellar extents, radius in metres by object id: each such galaxy's caption hangs under what is drawn of
   * it and hides while the camera is inside the extent. Objects without one keep their ordinary caption. */
  stellarExtents?: Readonly<Record<string, number>>;
  /** Prepared catalogue-point banks of stars inside the galaxy, by URL: drawn as dust with the galaxy
   * volume, fetched the first time it shows. */
  galaxyCataloguePoints?: readonly string[];
  /** A prepared `GALAXY_BACKING_SCHEMA` face-on image drawn under the galaxy's catalogue dots, by URL. */
  galaxyBacking?: string;
  imageLayers?: readonly PreparedImageLayerMount[];
  /** Descriptor-only image banks. Their JSON and DOM are admitted only on projected visibility or explicit focus. */
  imageLayerBanks?: readonly { id: string; frame: DensityVolumeFrame }[];
  loadImageLayer?(id: string): Promise<PreparedImageLayerMount>;
  /** Packages that are only a prepared catalogue point bank (`catalogue-point-bank` descriptors), by URL: fetched and drawn
   * while the catalogue row that details to them (`detailedObjectId`) is selected, or, for a bank that belongs to a body's
   * system (`host`), while the selected body is that host or orbits it. */
  pointBanks?: readonly { id: string; url: string; host?: string }[];
  /** Volume dataset banks are identified and framed from their descriptor alone; their heavy prepared
   * payload (all datasets, plus catalogue points) is fetched only through {@link loadVolumeDataset}, the
   * first time a bank is selected or comes into view. Nothing here downloads at construction time. */
  volumeDatasetBanks?: readonly { id: string; frame: DensityVolumeFrame }[];
  /** Prepared before any dataset is fetched: each bank's context visibility and, where it has one, its Sun-facing
   * billboard in a shared atlas. A small or distant bank draws its billboard; its datasets load only once large. */
  datasetBillboards?: { readonly plan: DatasetBillboards; readonly atlasUrl: string };
  /** Mount the prepared celestial sky cube. Phones leave it out: its faces cost tens of megabytes of layers. */
  sky?: boolean;
  /** A bank's payload, and any published catalogue points drawn with it (M87's globular clusters). */
  loadVolumeDataset?(id: string): Promise<Parameters<typeof createPreparedVolumeDatasets>[0] & { cataloguePointUrls?: readonly string[] }>;
  /** Testable cap for hidden banks with no active navigation subscriber. */
  warmVolumeDatasetDomNodeBudget?: number;
  catalog?: PreparedCatalogBank;
  /** Fade metadata is sufficient to gate the catalogue without fetching or parsing its records. */
  catalogBank?: Omit<PreparedCatalogBank, 'payload' | 'galaxySample' | 'nebulae' | 'clusters'> & {
    clusters?: Omit<NonNullable<PreparedCatalogBank['clusters']>, 'payload'> };
  loadCatalog?(): Promise<PreparedCatalogBank>;
}

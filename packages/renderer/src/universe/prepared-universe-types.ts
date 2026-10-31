import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';
import { type PreparedCssVolume, type PreparedPointAppearance, type PreparedCssSurfaceShell, type PreparedCssImageLayers, type PreparedPointVisibility, type DensityVolumeFrame, type DatasetBillboards, type PreparedGalaxyBacking } from '@cssearth/objects';

import type { BackgroundPointBank } from './points/background-points.js';
import type { createPreparedVolumeDatasets } from '../volume/prepared-volume-datasets.js';

import type { WorldPlannerSource } from './world-context/world-context-planner-client.js';

export type PreparedImageLayerMount = { payload: PreparedCssImageLayers; resolveResource(path: string): string;
  /** Published catalogues placed in the bank's own frame, drawn as dots over its layers and faded with them. */
  cataloguePointUrls?: readonly string[];
  /** By dataset, the overlay banks drawn over it while that dataset is selected (`prepared/<id>.bin`, cloud-points.ts). */
  overlayUrls?: Readonly<Record<string, readonly string[]>> };
/** `payload` is the catalogue's dots as the data worker reads them (@cssearth/objects catalogue-dots.ts); a caller that
 * holds the catalogues whole passes the galaxy catalogue with its sample and the other two. */
export type PreparedCatalogBank = { payload: unknown; galaxySample?: unknown; nebulae?: unknown; fadeStartDistanceM: number; fullDistanceM: number;
  clusters?: { payload?: unknown; fadeStartDistanceM: number; fullDistanceM: number } };

export interface PreparedUniverseOptions {
  /** Prepared catalogue point banks of the galaxies beyond the Local Group (background-points.ts). */
  backgroundCataloguePoints?: readonly BackgroundPointBank[];
  /** Closed image meshes around the Sun seen from outside (the cosmic microwave background; image-mesh.ts). */
  /** `cutaway` answers, on each publication, whether a mesh with a cutaway is shown cut open (image-mesh.ts); open by default. */
  imageMeshes?: readonly { id: string; url: string; resolveResource(path: string): string; cutaway?(): boolean; hidden?(): boolean; hiddenCaption?: string }[];
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
  /** Caption text by environment object id; an object without one is captioned with its id. */
  environmentNames?: Readonly<Record<string, string>>;
  /** The context packages a level object's datasets name (its `overview.packages`): the world always draws them, so each
   * answers as a bank with nothing to load. */
  contextBanks?: readonly string[];
  /** Published stellar extents, radius in metres by object id: each such galaxy's caption hangs under what is drawn of
   * it and hides while the camera is inside the extent. Objects without one keep their ordinary caption. */
  stellarExtents?: Readonly<Record<string, number>>;
  /** Prepared catalogue-point banks of stars inside the galaxy, by URL: drawn as dust with the galaxy
   * volume, fetched the first time it shows. */
  galaxyCataloguePoints?: readonly string[];
  /** Individual prepared stellar levels admitted by physical proximity. */
  galaxyCatalogueProximity?: { readonly host: string; readonly plan: import('@cssearth/objects').PreparedCatalogueProximity; resolve(file: string): string };
  galaxyStations?: import('./galaxy-stations/galaxy-stations.js').GalaxyStationBackgroundOptions;
  imageLayers?: readonly PreparedImageLayerMount[];
  /** Descriptor-only image banks. Their JSON and DOM are admitted only on projected visibility or explicit focus.
   * `surrounds`: the bank's light lies on walls around its middle, so it also draws around a body that stands inside it. */
  imageLayerBanks?: readonly { id: string; frame: DensityVolumeFrame; surrounds?: true; host?: string; datasets?: readonly string[] }[];
  loadImageLayer?(id: string): Promise<PreparedImageLayerMount>;
  /** Packages that are only a prepared catalogue point bank (`catalogue-point-bank` descriptors), by URL: fetched and drawn
   * while the catalogue row that details to them (`detailedObjectId`) is selected, or, for a bank that belongs to a body's
   * system (`host`), while the selected body is that host or orbits it. `stars`: its dots are the catalogued stars the map
   * draws as plain dots (no label, hover or click), the ones inside `host`: they draw while the selected body is that host
   * or is inside it (`setSelectionHolders`), dim as every other star does, leave out the dot at the place of a star a body
   * marker draws, and paint under the layers mounted after the world's own star dots. */
  pointBanks?: readonly { id: string; url: string; host?: string; stars?: true }[];
  /** Packages that are only one prepared picture on a plane around a body (`plane-bank` descriptors): a zone of its
   * system, such as a star's habitable zone laid in the plane of its planets' orbits. The plane draws while a dataset of
   * the mounted scene shows it, as a bank of dots a dataset names does; its picture, its box and the distances it fades
   * over come with its payload ({@link loadBacking}), read the first time it shows. `orbitOpacity` is the opacity the
   * world's orbit lines take while the plane shows whole, for a picture that would compete with them; `bodyColors` the
   * color each named body's orbit line and marker take while a dataset shows the plane. */
  planeBanks?: readonly { id: string; frame: DensityVolumeFrame; orbitOpacity?: number; bodyColors?: Readonly<Record<string, string>> }[];
  /** Volume dataset banks are identified and framed from their descriptor alone; their heavy prepared
   * payload (all datasets, plus catalogue points) is fetched only through {@link loadVolumeDataset}, the
   * first time a bank is selected or comes into view. Nothing here downloads at construction time. */
  volumeDatasetBanks?: readonly { id: string; frame: DensityVolumeFrame }[];
  /** Prepared before any dataset is fetched: each bank's context visibility and, where it has one, its Sun-facing
   * billboard in a shared atlas. A small or distant bank draws its billboard; its datasets load only once large. */
  /** What the universe knows of every dataset bank before fetching it, and where each bank's billboard image is served. */
  datasetBillboards?: { readonly plan: DatasetBillboards; readonly imageUrl: (id: string, dataset?: string) => string };
  /** Mount the prepared celestial sky cube. Phones leave it out: its faces cost tens of megabytes of layers. */
  sky?: boolean;
  /** The backing plane of a bank, volume dataset or image layers, whose prepared billboards say it has one
   * (`DatasetBankBillboard.backing`): its `GALAXY_BACKING_SCHEMA` payload and where its images are served. Read the
   * first time the bank shows from afar. */
  loadBacking?(id: string): Promise<{ payload: PreparedGalaxyBacking; resolveResource(path: string): string }>;
  /** A bank's payload, and any published catalogue points drawn with it (M87's globular clusters). */
  loadVolumeDataset?(id: string): Promise<Parameters<typeof createPreparedVolumeDatasets>[0] & {
    cataloguePointUrls?: readonly string[]; pointTransmission?: import('@cssearth/objects').PreparedPointTransmission;
    /** Existing cloud point/segment banks selected with the volume dataset, using the image-layer overlay contract. */
    overlayUrls?: Readonly<Record<string, readonly string[]>>;
  }>;
  /** Testable cap for hidden banks with no active navigation subscriber. */
  warmVolumeDatasetDomNodeBudget?: number;
  catalog?: PreparedCatalogBank;
  /** Fade metadata is sufficient to gate the catalogue without fetching or parsing its records. */
  catalogBank?: Omit<PreparedCatalogBank, 'payload' | 'galaxySample' | 'nebulae' | 'clusters'> & {
    clusters?: Omit<NonNullable<PreparedCatalogBank['clusters']>, 'payload'> };
  loadCatalog?(): Promise<PreparedCatalogBank>;
}

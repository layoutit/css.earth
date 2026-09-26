import type { LensVolume } from '@cssearth/renderer/runtime/object-contract.ts';

export interface LensLegendRecipe {
  kind: "scale" | "categories" | "ranges";
  ranges?: Array<{ label: string; color: string; low: number }>;
  title: string;
  meta?: string;
  image?: string;
  width?: number;
  height?: number;
  labels?: string[];
  recipe?: { palette: number[][]; labels: string[] };
  items?: Array<{ label: string; description?: string; color: string | number[] }>;
  sourceUrl?: string;
  sourcePath?: string;
  rasterRecipe?: {
    crop: { left: number; top: number; width: number; height: number };
    dividerRows?: { threshold: number; expectedRuns: number; minimumCoverage: number };
    outputWidth: number;
    outputHeight: number;
  };
}

export interface LensSource {
  id: string;
  path?: string;
  url?: string;
}

export interface LensRecipe {
  id: string;
  label: string;
  shortLabel?: string;
  /** Maintainer notes about the dataset. They are never published; reader text lives in the package's text.json. */
  notes?: string;
  /** The prepared surface marks missing observations with the shared no-data grid. */
  noData?: boolean;
  facts?: Array<{ id: string; label: string; value: string }>;
  filter?: string;
  qualification?: string;
  falseColor?: boolean;
  view?: "exterior" | "interior";
  thumbnail: string;
  surface?: string;
  poles?: string;
  material?: string;
  legend?: LensLegendRecipe;
  legendNote?: string;
  /**
   * A dataset may name a cloud that accompanies the body. It borrows the named surface's prepared
   * plates for the body itself, and the shell asks the cloud's bank for the lens while it is selected.
   */
  volume?: LensVolume;
  /**
   * One step of a dataset shown as a sequence, such as a map at each of 25 wavelengths. Every step is an ordinary lens with
   * its own prepared surface; the steps of a group sit together in the controls, the panel lists the group once and steps
   * through its members in order.
   */
  step?: LensStep;
  source: LensSource;
}

export interface LensStep {
  /** The group this lens is one step of; members are consecutive in the controls. */
  group: string;
  /** What distinguishes this step, such as "1.45 µm". */
  label: string;
}

export interface ChartRecipe {
  id: string;
  titleKey: string;
  open?: boolean;
  src: string;
  width: number;
  height: number;
  alt: string;
  source: LensSource;
}

export interface GalleryRecipe {
  id: string;
  titleKey: string;
  open?: boolean;
  qualification?: string;
  items: Array<{
    id: string;
    label: string;
    src: string;
    width: number;
    height: number;
    alt: string;
    caption: string;
    sourceUrl: string;
  }>;
}

export interface ObjectContentSource {
  schema: "cssearth-object-content@1";
  version: 1;
  id: string;
  displayName: string;
  panel: {
    facts: Fact[];
    moreFacts?: Fact[];
  };
  lenses: {
    titleKey: "lenses";
    defaultLens: string;
    labels?: Record<string, string>;
    controls: LensRecipe[];
  };
  settings: {
    titleKey: "settings";
    controls: Array<{
      kind: "cycle" | "toggle";
      name: string;
      label: string;
      state?: string;
      checked?: boolean;
    }>;
  };
  charts: ChartRecipe[];
  galleries?: GalleryRecipe[];
  resources: Array<{ label: string; role: string; description: string; href: string }>;
  provenance: Record<string, { id?: string; path?: string; url?: string; credit?: string; license?: string }>;
}

export interface Fact {
  id: string;
  label: string;
  value: string;
  source?: { catalogueId: string; url: string; label: string; checked: string; path?: string; locator?: string };
}

export interface PreparedObjectContent {
  objectId: string;
  title: { label: string };
  facts: ObjectContentSource["panel"]["facts"];
  moreFacts: NonNullable<ObjectContentSource["panel"]["moreFacts"]>;
  lenses: {
    title: { label: string; src: string; width: number; height: number };
    defaultLens: string;
    controls: Array<Record<string, unknown> & Pick<LensRecipe, "facts">>;
  };
  settings: {
    title: { label: string; src: string; width: number; height: number };
    controls: ObjectContentSource["settings"]["controls"];
  };
  charts: Array<ChartRecipe & { title: { label: string } }>;
  galleries: Array<GalleryRecipe & { title: { label: string; src: string; width: number; height: number } }>;
  resources: ObjectContentSource["resources"];
}

export interface PreparedRasterAssets {
  surfaces?: Record<string, { url?: string; url2x?: string; polesUrl?: string; polesUrl2x?: string; coronaUrl?: string; coronaUrl2x?: string; limbUrl?: string; limbUrl2x?: string }>;
  materials?: Record<string, { url?: string; url2x?: string }>;
  atmosphere?: { materialUrl?: string; observationUrl?: string; lightingUrl?: string };
  interior?: Record<string, unknown>;
}

export interface ContentPreparationConfig {
  contentPath?: string;
  assetsPath?: string;
  chartsPath?: string;
}

export interface ContentPreparationContext {
  sourceDirectory: string;
  publicDirectory: string;
  outputDirectory: string;
  config: ContentPreparationConfig;
}

export interface PreparedObjectContentAssets {
  id: string;
  content: PreparedObjectContentDocument;
  lenses: PreparedObjectContent["lenses"];
  controls: {
    lenses: PreparedObjectContent["lenses"] | null;
    settings: PreparedObjectContent["settings"];
  };
  files: readonly string[];
}

export interface PreparedObjectContentDocument {
  schema: "cssearth-prepared-content@1";
  objectId: string;
  title: PreparedObjectContent["title"];
  facts: PreparedObjectContent["facts"];
  moreFacts: PreparedObjectContent["moreFacts"];
  charts: PreparedObjectContent["charts"];
  galleries: PreparedObjectContent["galleries"];
  resources: PreparedObjectContent["resources"];
  provenance: ObjectContentSource["provenance"];
  destinations?: { searchLabel: string; description: string };
}

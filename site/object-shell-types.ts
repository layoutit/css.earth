export interface PreparedTitle {
  label: string;
  src: string;
  width: number;
  height: number;
}

export interface ObjectTitle {
  label: string;
  viewBox: string;
  renderViewBox: string;
  renderWidth: number;
  renderHeight: number;
  renderPathOffsetY: number;
  path: string;
  baseline: number;
}

export interface Fact {
  id: string;
  label: string;
  value: string;
}

export interface Chart {
  id: string;
  title: Pick<PreparedTitle, "label">;
  open?: boolean;
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface GalleryItem {
  id: string;
  label: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  sourceUrl: string;
}

export interface Gallery {
  id: string;
  hidden?: boolean;
  title: PreparedTitle;
  open?: boolean;
  qualification?: string;
  items: GalleryItem[];
}

/** Reader text for one dataset, published in prepared content rather than in its controls. */
export interface DatasetReaderText {
  title: string;
  detail?: string;
  summary: string;
}

/** Volume presentations retain a longer provenance description; the shared UI publishes the same summary field as bodies. */
export type Lens = LensControl & DatasetReaderText & { description?: string };

export interface LensControl {
  id: string;
  label: string;
  thumbnailUrl: string;
  texture?: { url: string; width: number; height: number; minimap?: unknown; attribution?: { label: string; url?: string } };
  /** The surface marks missing observations with the shared no-data grid. */
  noData?: boolean;
  /** A dataset that draws a companion cloud and keeps the named dataset's prepared surface for the body itself. */
  volume?: { objectId: string; lensId: string; surface: string };
  facts?: Fact[];
  legend?: {
    kind: "scale" | "categories";
    title: string;
    meta?: string;
    src?: string;
    colors?: string[];
    width?: number;
    height?: number;
    labels?: string[];
    items?: Array<{
      label: string;
      description: string;
      color: string;
    }>;
    sourceUrl?: string;
  };
}

export interface Setting {
  kind: "cycle" | "toggle";
  name: string;
  label: string;
  state?: string;
  checked?: boolean;
}

export interface Props {
  navigation?: boolean;
  objectId: string;
  destinations?: { searchLabel: string; description: string; };
  features?: { searchLabel: string; description: string; };
  title: ObjectTitle;
  introduction?: string;
  facts?: Fact[];
  moreFacts?: Fact[];
  galleries?: Gallery[];
  charts?: Chart[];
  lenses?: {
    title: PreparedTitle;
    controls: Lens[];
    defaultLens: string;
  };
  settings?: {
    title: PreparedTitle;
    controls: Setting[];
  };
}

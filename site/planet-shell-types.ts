interface PreparedTitle {
  label: string;
  src: string;
  width: number;
  height: number;
}

interface PlanetTitle {
  label: string;
  viewBox: string;
  renderViewBox: string;
  renderWidth: number;
  renderHeight: number;
  renderPathOffsetY: number;
  path: string;
}

interface Fact {
  id: string;
  label: string;
  value: string;
}

interface Chart {
  id: string;
  title: Pick<PreparedTitle, "label">;
  open?: boolean;
  src: string;
  width: number;
  height: number;
  alt: string;
}

interface GalleryItem {
  id: string;
  label: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  sourceUrl: string;
}

interface Gallery {
  id: string;
  hidden?: boolean;
  title: PreparedTitle;
  open?: boolean;
  qualification?: string;
  items: GalleryItem[];
}

interface Lens {
  id: string;
  label: string;
  detail?: string;
  thumbnailUrl: string;
  texture?: { url: string; width: number; height: number; minimap?: unknown; attribution?: { label: string; url?: string } };
  description: string;
  title: string;
  entityIds?: string[];
  legendNote?: string;
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

interface Setting {
  kind: "cycle" | "toggle";
  name: string;
  label: string;
  state?: string;
  checked?: boolean;
}

interface Resource {
  label: string;
  role: string;
  description: string;
  href: string;
}

export interface Props {
  objectId: string;
  destinations?: { lensIds?: string[]; searchLabel: string; description: string; lenses?: Array<{ id: string; label: string; thumbnailUrl: string; package: { url: string; bytes: number; sha256: string } }>; };
  title: PlanetTitle;
  introduction?: string;
  facts?: Fact[];
  moreFacts?: Fact[];
  galleries?: Gallery[];
  charts?: Chart[];
  resources?: Resource[];
  lenses?: {
    title: PreparedTitle;
    controls: Lens[];
    defaultLens: string;
    geographicCapacity?: number;
  };
  settings?: {
    title: PreparedTitle;
    controls: Setting[];
  };
}


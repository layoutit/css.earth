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
  visible?: boolean;
  title: Pick<PreparedTitle, "label">;
  open?: boolean;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  data?: { src: string; label: string };
  source?: { url?: string };
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
  summary?: string;
  facts?: Fact[];
  title: string;
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
  destinations?: { searchLabel: string; description: string; };
  title: PlanetTitle;
  introduction?: string;
  facts?: Fact[];
  moreFacts?: Fact[];
  galleries?: Gallery[];
  charts?: Chart[];
  resources?: Resource[];
  provenance?: ReturnType<typeof import("../src/platform/object-provenance.mjs").validateObjectProvenance>;
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

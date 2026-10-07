import type { PreparedTitle, ObjectTitle, Fact, Chart, Gallery } from '@cssearth/objects';

/** Reader text for one dataset, published in prepared content rather than in its controls. */
export interface DatasetReaderText {
  title: string;
  detail?: string;
  summary: string;
}

/** Volume presentations retain a longer provenance description; the shared UI publishes the same summary field as bodies. */
export type Dataset = DatasetControl & DatasetReaderText & { description?: string };

export interface DatasetControl {
  id: string;
  label: string;
  thumbnailUrl: string;
  sourceUrl?: string;
  /** This dataset describes the whole host system, so its reader row belongs on the system card. */
  systemDataset?: boolean;
  texture?: { url: string; width: number; height: number; minimap?: unknown; attribution?: { label: string; url?: string } };
  /** A dataset that is one color over the whole body (an unresolved star's): its hex is named beside its label, and its
   * details carry no map and no second title, which would only repeat the row. */
  color?: string;
  /** The surface marks missing observations with the shared no-data grid. */
  noData?: boolean;
  /** A dataset that draws a companion cloud and keeps the named dataset's prepared surface for the body itself. */
  volume?: { objectId: string; datasetId: string; surface: string };
  /** One step of a dataset shown as a sequence: the panel lists the group once and steps through its members. */
  step?: { group: string; label: string; autoplay?: boolean; opens?: 'first' | 'last' };
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
  datasets?: {
    title: PreparedTitle;
    controls: Dataset[];
    defaultDataset: string;
  };
  settings?: {
    title: PreparedTitle;
    controls: Setting[];
  };
  /** What the body's prepared motion plays: the shell offers the rotation and light-curve switches only where one does. */
  motion: { spin: boolean; lightCurve: boolean };
}

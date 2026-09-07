export const GEOGRAPHIC_LENS_CAPACITY = 8;
export const GEOGRAPHIC_OVERVIEW_IMAGE_CAPACITY = 64;
import type { PreparedReference, PreparedPagePlan } from './types.js';

export interface GeographicLensReference {
  id: string; label: string; thumbnailUrl: string; package: PreparedReference;
}
export interface GeographicEntity {
  id: string; lensIds?: readonly string[]; lenses?: readonly GeographicLensReference[];
}
export interface GeographicLensContent {
  schema: string; id: string; baseLensId: string; qualification: string;
  scope?: { objectId: string; entityIds: string[] }; entityIds?: string[];
  source: { year: number; units: string; url: string; publisher: string; license: string; licenseUrl: string; sha256: string };
  legend: {
    title?: string; meta?: string;
    items: Array<{ color: string; label: string; description?: string }>;
  } & ({ kind: 'categories' } | { kind: 'scale'; labels: [string, string] });
  pages: PreparedPagePlan;
  overview?: GeographicOverview;
}
export interface GeographicLensState {
  id: string | null; status: 'idle' | 'loading' | 'error' | 'ready' | 'no-coverage';
  content: GeographicLensContent | null; error: string | null; resolution?: 'detail' | 'overview';
}

export interface GeographicOverview {
  schema: string; decodedBytes: number;
  images: Array<{ slot: string; image: PreparedReference & {width: number; height: number} }>;
}

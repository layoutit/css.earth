import type { PreparedGalaxyRecord, PreparedGalaxyCatalog as Catalog, SpatialCitation } from '@cssearth/catalog';
export type Vec3 = [number, number, number];
export interface SourcePin { path: string; bytes: number }
/** A pinned file, or a citation that only names the references a claim uses (a paper is cited, not retained). */
export interface GalaxySource extends Partial<SourcePin> { id: string; url: string; citation: string; references?: SpatialCitation[] }
export interface GalaxyMembership {
  group: 'local-group' | 'local-volume' | 'galaxy-cluster' | 'uncertain';
  subgroup: 'milky-way' | 'andromeda' | 'field' | 'virgo' | 'unknown';
  basis: string;
  sourceRef?: string;
}
export interface GalaxyDistance {
  valuePc: number; minusPc?: number; plusPc?: number; method: string; sourceRef: string;
  uncertainty?: { statisticalPc: number; systematicPc: number };
}
export type PreparedGalaxy = PreparedGalaxyRecord;
export type PreparedGalaxyCatalog = Catalog;
export interface GalaxyRecipe {
  schema: 'cssearth-galaxy-catalog-source@1';
  frame: PreparedGalaxyCatalog['frame'];
  catalogue: SourcePin; archive: SourcePin; membershipTable: SourcePin;
  provenance: SourcePin;
  catalogueSourceId: string;
  membershipSourceId: string;
  archiveInputPrefix: string;
  eligibleTables: string[];
  excludedDistanceMethods: string[];
  hostRoots: Record<string, 'milky-way' | 'andromeda'>;
  membershipNames: Record<string, string>;
  detailObjects: Record<string, { id: string; focusRadiusM?: number }>;
  distanceOverrides: Record<string, GalaxyDistance>;
  /** Galaxies beyond the pinned catalogue that an object package details (M87), each row cited field by field. */
  citedRows?: Record<string, CitedGalaxy>;
  description: string;
}
/** A galaxy row written from its papers rather than read from the pinned catalogue: every field names its reference. */
export interface CitedGalaxy {
  name: string; aliases: string[]; raDeg: number; decDeg: number; positionRef: string;
  distance: GalaxyDistance; membership: GalaxyMembership & { sourceRef: string };
}
export type CsvRow = Record<string, string>;
export interface AuthorMetadata {
  key: string;
  location?: { ra?: number; dec?: number; ref_location?: string };
  name_discovery?: {
    name?: string; other_name?: string[]; host?: string; false_positive?: number;
    confirmed_dwarf?: number; confirmed_real?: number; confirmed_star_cluster?: number;
    ref_discovery?: string[] | null;
  };
  distance?: { distance_fixed_host?: boolean; ref_distance?: string; distance_measurement_method?: string };
}

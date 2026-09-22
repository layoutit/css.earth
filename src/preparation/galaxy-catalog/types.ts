import type { PreparedGalaxyRecord, PreparedGalaxyCatalog as Catalog, SpatialCitation } from '@cssearth/catalog';
export type Vec3 = [number, number, number];
export interface SourcePin { path: string; bytes: number }
export interface GalaxySource extends SourcePin { id: string; url: string; citation: string; references?: SpatialCitation[] }
export interface GalaxyMembership {
  group: 'local-group' | 'local-volume' | 'uncertain';
  subgroup: 'milky-way' | 'andromeda' | 'field' | 'unknown';
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
  description: string;
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

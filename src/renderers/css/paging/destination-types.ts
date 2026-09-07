import type { PreparedReference } from './types.js';
import type { GeographicEntity, GeographicLensReference } from './geographic-types.js';
export interface DestinationReference extends PreparedReference {
  encoding: 'gzip'; decodedBytes: number; decodedSha256: string;
}
export interface DestinationCatalog extends DestinationReference { count: number }
export interface DestinationResource { label: string; description: string; href: string; role?: string }
export interface DestinationEntity extends GeographicEntity {
  name: string; kind: string; kindLabel?: string; context: string; parentId: string | null;
  camera: { controlPitch: number; controlYaw: number; zoom: number };
  coverage: string; status?: string; identifiers?: Readonly<Record<string, string>>;
  facts?: Array<{ id: string; label: string; value: string }>; resources: DestinationResource[];
}
export interface PackedDestination extends Omit<DestinationEntity, 'resources' | 'lenses'> { resourceRefs: number[]; lensRefs: number[] }
export interface DestinationDetails { schema: string; records: PackedDestination[] }
export interface DestinationDirectory {
  schema: string; rootId: string; entries: Array<[string, number]>; packs: DestinationReference[];
  search: DestinationReference; resources: DestinationResource[]; lenses: GeographicLensReference[];
}
export interface DestinationSearch {
  schema: string; rows: Array<[string, string, string, string]>; aliases: Array<[string, number[]]>;
}
export interface DestinationResult { id: string; name: string; context: string; kind?: string }
export interface ResolvedDestination { entity: DestinationEntity; ancestors: DestinationEntity[] }

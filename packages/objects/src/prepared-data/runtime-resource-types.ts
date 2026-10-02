export interface PreparedResourceEntry { key: string; url: string; pool: string; decodedBytes?: number; }

export interface PreparedResourcePool  { id: string; capacity: number; concurrency: number; reuse: boolean; decoding?: "async" | "sync" | "auto"; retention: "mount" | "warm" | "selection"; stabilityMilliseconds?: number; eviction?: "capacity" | "unused"; maximumDecodedBytes?: number; }

export interface PreparedAssets { entries: readonly PreparedResourceEntry[]; pools: readonly PreparedResourcePool[]; startup: readonly string[];
  /** Resources that stand in for others where the browser lacks a capability (prepared-resource-fallbacks.ts). */
  fallbacks?: readonly PreparedResourceFallback[]; }

export type PreparedCapability = 'corner-shape';

export interface PreparedResourceFallback { unsupported: PreparedCapability; resources: Readonly<Record<string, string>> }

export interface PreparedAssetOrigin {
  readonly origin: string;
  /** The hashes a page's first view reads. A hash is 64 characters that do not compress, so the rest stay out. */
  readonly assets?: Readonly<Record<string, string>>;
  /** Same-origin directory holding every other hash, one JSON per resource group (`preparedAssetGroupFile`). */
  readonly groups?: string;
}

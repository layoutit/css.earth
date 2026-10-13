import type { InvestigationStatus } from '@cssearth/objects';
/** Archive search facts shared by live ledgers and the packaged snapshot reader. */
export interface ChandraObject { readonly id: string; readonly raDeg?: number; readonly decDeg?: number; readonly source: string }
export interface SpitzerObject {
  readonly id: string;
  readonly name: string;
  readonly classification: string;
  /** How this object is asked for, and why, when it cannot be. */
  readonly query: { readonly kind: 'naif'; readonly naifId: number }
    | { readonly kind: 'position'; readonly raDeg: number; readonly decDeg: number; readonly radiusDeg: number }
    | { readonly kind: 'none'; readonly reason: string };
}
export interface NamedShippedObject { readonly id: string; readonly names: readonly string[]; readonly position?: { readonly raDeg: number; readonly decDeg: number; readonly radiusDeg: number } }
export interface ReadMark { readonly status: InvestigationStatus; /** The ledger entry that settles the lead. */ readonly entry: string }

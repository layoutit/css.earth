/** Evidence carried by archive observations before their bytes are qualified. */
import type { ProductKind } from './query.mts';
import type { FamilyId } from './product-descriptor.mts';
import { mapIvoaProductType, type ProductTypeMapping } from './product-type.mts';

export const OBSERVATION_FAMILY_EVIDENCE_SCHEMA = 'cssearth-observation-family-evidence@1' as const;
export interface ObservationFamilyEvidence {
  readonly schema: typeof OBSERVATION_FAMILY_EVIDENCE_SCHEMA;
  readonly families: readonly FamilyId[];
  readonly status: 'source' | 'mapped' | 'preliminary' | 'unmapped';
  readonly sourceTerm: string;
  readonly vocabulary: string;
  readonly vocabularyVersion: string;
  readonly owner: { readonly kind: 'archive-adapter' | 'source-product'; readonly id: string; readonly evidence: string };
  readonly profileId?: string;
}

export interface FamilyEvidenceOwner { readonly kind: ObservationFamilyEvidence['owner']['kind']; readonly id: string; readonly evidence: string }

export function productTypeFamilyEvidence(mapping: ProductTypeMapping | null, owner: FamilyEvidenceOwner): ObservationFamilyEvidence {
  return { schema: OBSERVATION_FAMILY_EVIDENCE_SCHEMA, families: mapping?.families ?? [], status: mapping?.status ?? 'unmapped',
    sourceTerm: mapping?.sourceTerm ?? 'unknown', vocabulary: mapping?.vocabulary ?? 'IVOA product-type', vocabularyVersion: mapping?.vocabularyVersion ?? 'unknown', owner };
}

/** Ledger kinds are normalized by an archive adapter, then mapped through the same public vocabulary. */
export function productKindFamilyEvidence(kind: ProductKind | string | null | undefined, owner: FamilyEvidenceOwner): ObservationFamilyEvidence {
  return productTypeFamilyEvidence(mapIvoaProductType(kind ?? null), owner);
}

interface ArchiveFamilyProfile {
  readonly id: string; readonly families: readonly FamilyId[]; readonly sourceTerm: string; readonly vocabulary: string; readonly vocabularyVersion: string;
  readonly documentation: string; readonly kind: ProductKind; readonly decoder: string; readonly requiredIdentity: Readonly<Record<string, string | number | boolean>>;
}

/** Profiles describe archive-owned formats. They classify observations; they do not claim a reduction or rendering route. */
const ARCHIVE_FAMILY_PROFILES: Readonly<Record<string, ArchiveFamilyProfile>> = Object.freeze({
  'stereo-secchi-cor1-electron-density@2025-05-06': {
    id: 'stereo-secchi-cor1-electron-density@2025-05-06', families: ['F16'], sourceTerm: '3D tomographic coronal electron density on a spherical physical grid',
    vocabulary: 'STEREO/SECCHI COR1 N3D FITS', vocabularyVersion: '2025-05-06',
    documentation: 'https://stereo-ssc.nascom.nasa.gov/pub/ins_data/secchi/cor1_tomography_data.shtml', kind: 'cube', decoder: 'fits-image',
    requiredIdentity: { NAXIS: 3, CTYPE1: 'CRLN', CTYPE2: 'CRLT', CTYPE3: 'HECR', CUNIT1: 'deg', CUNIT2: 'deg', CUNIT3: 'solRad', BUNIT: 'cm^-3', INSTRUME: 'SECCHI' },
  },
});

export function archiveProfileFamilyEvidence(profileId: string, input: { readonly kind: ProductKind; readonly decoder: string; readonly identity: Readonly<Record<string, string | number | boolean>>; readonly owner: FamilyEvidenceOwner }): ObservationFamilyEvidence {
  const profile = ARCHIVE_FAMILY_PROFILES[profileId];
  if (!profile) throw new TypeError(`Unknown archive family profile ${profileId}.`);
  if (profile.kind !== input.kind || profile.decoder !== input.decoder) throw new TypeError(`${profileId} does not apply to ${input.decoder} ${input.kind}.`);
  for (const [key, expected] of Object.entries(profile.requiredIdentity)) if (input.identity[key] !== expected) throw new TypeError(`${profileId} requires identity ${key}=${String(expected)}.`);
  return { schema: OBSERVATION_FAMILY_EVIDENCE_SCHEMA, families: profile.families, status: 'source', sourceTerm: profile.sourceTerm,
    vocabulary: profile.vocabulary, vocabularyVersion: profile.vocabularyVersion, owner: { ...input.owner, evidence: `${input.owner.evidence}; ${profile.documentation}` }, profileId };
}

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
export const STEREO_COR1_F16_PROFILE = 'stereo-secchi-cor1-electron-density@2025-05-06' as const;
export const JUNO_MWR_NH3_F16_PROFILE = 'juno-mwr-nh3-distribution@2024-10-22' as const;
export const CONSERT_FSS_GEOMETRY_F16_PROFILE = 'consert-fss-body-fixed-geometry@2019-02-19' as const;
export const MRO_SHARAD_3D_F16_PROFILE = 'mro-sharad-3d-array@2025-10-22' as const;

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
  [STEREO_COR1_F16_PROFILE]: {
    id: STEREO_COR1_F16_PROFILE, families: ['F16'], sourceTerm: '3D tomographic coronal electron density on a spherical physical grid',
    vocabulary: 'STEREO/SECCHI COR1 N3D FITS', vocabularyVersion: '2025-05-06',
    documentation: 'https://stereo-ssc.nascom.nasa.gov/pub/ins_data/secchi/cor1_tomography_data.shtml', kind: 'cube', decoder: 'fits-image',
    requiredIdentity: { NAXIS: 3, NAXIS1: 361, NAXIS2: 181, NAXIS3: 51, CTYPE1: 'CRLN', CRPIX1: 1, CRVAL1: 0, CDELT1: 1, CUNIT1: 'deg', CTYPE2: 'CRLT', CRPIX2: 91, CRVAL2: 0, CDELT2: 1, CUNIT2: 'deg', CTYPE3: 'HECR', CRPIX3: 1, CRVAL3: 1.5, CDELT3: 0.05, CUNIT3: 'solRad', BUNIT: 'cm^-3', INSTRUME: 'SECCHI' },
  },
  [JUNO_MWR_NH3_F16_PROFILE]: {
    id: JUNO_MWR_NH3_F16_PROFILE, families: ['F16'], sourceTerm: 'Juno MWR Level-5 ammonia distribution and uncertainty on pressure and planetocentric-latitude coordinates',
    vocabulary: 'NASA PDS JNOMWR_2100 NH3A/NH3U', vocabularyVersion: '2024-10-22',
    documentation: 'https://atmos.nmsu.edu/PDS/data/jnomwr_2100/AAREADME.TXT', kind: 'table', decoder: 'pds-product',
    requiredIdentity: { DATA_SET_ID: 'JNO-J-MWR-5-NH3-DISTRIBUTION-V1.0', PRODUCT_ID: 'MWRNH3A2016240070004_R00548_V01.CSV', TARGET_NAME: 'JUPITER', INSTRUMENT_ID: 'MWR' },
  },
  [MRO_SHARAD_3D_F16_PROFILE]: {
    id: MRO_SHARAD_3D_F16_PROFILE, families: ['F16'], sourceTerm: 'Byte ranges of an MRO SHARAD three-dimensional delay-time radargram on projected X, projected Y and two-way delay axes',
    vocabulary: 'NASA PDS mro_sharad_3d Array_3D', vocabularyVersion: '2025-10-22',
    documentation: 'https://pds-geosciences.wustl.edu/mro/mro-m-sharad-5-3d-v1/mrosh_3001/readme.txt', kind: 'table', decoder: 'pds-product',
    requiredIdentity: { DATA_SET_ID: 'MRO-M-SHARAD-5-3D-V1.0', TARGET_NAME: 'MARS', INSTRUMENT_ID: 'SHARAD' },
  },
  [CONSERT_FSS_GEOMETRY_F16_PROFILE]: {
    id: CONSERT_FSS_GEOMETRY_F16_PROFILE, families: ['F16'], sourceTerm: 'CONSERT level-4 orbiter and lander positions at each sounding in the 67P Comet Fixed Frame',
    vocabulary: 'ESA PSA / NASA PDS RO/RL-C-CONSERT-4-FSS-V1.0 GEOMETRY', vocabularyVersion: '2019-02-19',
    documentation: 'https://pds-smallbodies.astro.umd.edu/holdings/ro_rl-c-consert-4-fss-v1.0/catalog/dataset.cat', kind: 'table', decoder: 'pds-product',
    requiredIdentity: { DATA_SET_ID: 'RO/RL-C-CONSERT-4-FSS-V1.0', TARGET_NAME: '67P/CHURYUMOV-GERASIMENKO 1 (1969 R1)', INSTRUMENT_ID: 'CONSERT', PROCESSING_LEVEL_ID: '4' },
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

/** What a limb-darkening choice is (limb.mts, picaso-limb.mts): the law, its sources and the grid it was read from. */
import type { QuadraticLimbDarkening } from '@cssearth/bake/objects/stellar';

/** The tabulated grids limb.mts reads a quadratic law from. */
export type LimbGridKey = 'atlas' | 'tlusty' | 'tlusty-b' | 'neilson' | 'phoenix' | 'white-dwarf';
/** The white-dwarf atmosphere classes a limb grid exists for. */
export const WHITE_DWARF_ATMOSPHERES = ['DA', 'DB', 'DBA'] as const;
export type WhiteDwarfAtmosphere = typeof WHITE_DWARF_ATMOSPHERES[number];

export interface LimbChoice {
  readonly limbDarkening?: Record<string, unknown>;
  /** The source files the law is read from, their acquisition steps and manifest inputs. */
  readonly files?: readonly { readonly path: string; readonly text: string }[];
  readonly acquisitions?: readonly Record<string, unknown>[]; readonly inputs?: readonly Record<string, unknown>[]; readonly coefficients?: QuadraticLimbDarkening;
  /** The sentence the dataset qualification, README and NOTICE use. */
  readonly sentence: string; readonly credit?: string; readonly grid?: LimbGridKey | 'howarth' | 'picaso';
  /** A transcribed row of a model grid, the nearest to a star no grid reaches (star-limb.mts). */
  readonly nearestModel?: boolean;
}

/** A method's verdict on a star's rotation, and what it is set beside before a map is made of it.
 *
 * Whether a light curve shows a star turning is a published method's to say (methods.mts). What is here is the verdict's
 * shape and four checks against what is already published of the star: its catalogued rotation period, the kind of
 * object SIMBAD files it as, the fastest its recorded radius and mass let it turn, and how much of other stars' light
 * the TESS Input Catalog puts in its pixels. Each can only withhold a map. */
/** The missions whose light curves are read, and MEarth, a survey from the ground whose light curves are read the same way. */
export type Mission = 'TESS' | 'K2' | 'Kepler' | 'MEarth';
export interface RotationVerdict { readonly detected: boolean; readonly periodDays?: number; /** The light's own strongest period, when the rotation is taken as twice it. */ readonly lightPeriodDays?: number; /** Peak to peak, as a share of the mean light. */ readonly amplitude?: number; readonly reason?: string }

/** How closely the light's period and a catalogued rotation period must agree to be one period: the metadata pass's own
 * measure, and the one Reinhold & Hekker (2020, Sect. 3.1) use for two campaigns of one star (periods within 20% are consistent). */
export const CATALOGUE_AGREEMENT = 0.2;
/** A verdict set beside the rotation period the star's record already holds. Two spot groups on opposite sides of a star
 * make its light repeat twice a turn, so the light's strongest period may be half the rotation: when it is half the
 * catalogued period, the star is taken to turn once in two of them. A period that is neither the catalogued one nor its half
 * is not believed: one of the two is wrong, and these pixels cannot say which. */
export function besideCatalogued(verdict: RotationVerdict, cataloguedDays: number | undefined): RotationVerdict {
  if (!verdict.detected || verdict.periodDays === undefined || cataloguedDays === undefined) return verdict;
  const near = (days: number) => Math.abs(verdict.periodDays! - days) <= CATALOGUE_AGREEMENT * days;
  if (near(cataloguedDays)) return verdict;
  if (near(cataloguedDays / 2)) return { ...verdict, periodDays: Number((2 * verdict.periodDays).toFixed(2)), lightPeriodDays: verdict.periodDays };
  return { detected: false, reason: `The light's period, ${verdict.periodDays} d, is neither the star's catalogued rotation period, ${cataloguedDays} d, nor its half.` };
}

/** SIMBAD types whose light changes for a reason that is not the star turning: one star eclipsing or distorting another,
 * matter passing between two, and pulsation. Each names a branch of SIMBAD's tree of types (`otypedef.path`), which a
 * star's record holds as `objectTypePath` (new-object/metadata). SIMBAD files pulsators by what kind of star they are, so
 * the branches are several. */
export const NOT_TURNING = ['EB*', 'El*', 'CV*', 'XB*', 'Sy*', 'Pu*', 'RR*', 'Ce*', 'WV*', 'RV*', 'dS*', 'gD*', 'bC*', 'SX*', 'LP*'] as const;
/** Why a star of this type is not looked at for a rotation, when it is not. */
export const notTurning = (objectType: string | undefined, objectTypePath: string | undefined): string | undefined => objectTypePath !== undefined && NOT_TURNING.some(root => objectTypePath.split(' > ').includes(root))
  ? `SIMBAD lists the star as ${objectType ?? objectTypePath}: its light changes for that reason, and a period in it would not be its turning.` : undefined;

/** A verdict set beside the fastest the star could turn: the period of an orbit at its surface, from its recorded radius and
 * mass. A star turning faster would fly apart, so a shorter period in its light is something else: a pulsation, a close
 * pair, or another star's light. */
export function withinBreakup(verdict: RotationVerdict, fastestTurnDays: number | undefined): RotationVerdict {
  const shortest = verdict.lightPeriodDays ?? verdict.periodDays;
  if (!verdict.detected || shortest === undefined || fastestTurnDays === undefined || (verdict.periodDays ?? 0) >= fastestTurnDays) return verdict;
  return { detected: false, reason: `The light's period, ${shortest} d, is shorter than the ${fastestTurnDays.toFixed(2)} d of an orbit at the star's surface (its recorded radius and mass): the star cannot turn that fast, so the light changes for another reason.` };
}

/** How much of other stars' light a TESS target's pixels may hold for its light curve to be read as the star's: a
 * contamination ratio under 0.2 in the TESS Input Catalog (the others' flux in the target's pixels over the target's own).
 * Fetherolf et al. (2023, ApJS 268, 4, Sect. II.1) search the mission's 2-minute PDC-MAP light curves for periodic
 * variability only in stars "not severely blended with neighboring stars (CONTRATIO < 0.2)", and García Soto et al. (2023,
 * AJ 165, 192, Sect. II.2) "limit the contamination ratio to <20%" for the rotation periods they measure in the same light
 * curves. A TESS pixel is 21 arcseconds wide: a star 5 arcseconds from a brighter one has a light curve of its own in
 * the archive that is mostly the other star's light, and a map of it would draw the other star's spots.
 *
 * A target the catalog gives no ratio is read. That is how the paper's own catalogue is made (counted 2026-10-07 in its
 * table of autocorrelation periods at MAST, DOI 10.17909/f8pz-vj63: 1,334 of its 4,662 stars have no ratio, and the
 * largest ratio is 0.19994).
 *
 * Neither Holcomb et al. (2022) nor Colman et al. (2024) prints a limit on blending. Setting this one before their
 * verdicts is this repository's, and the note lists it; the number is the two papers'. */
export const BLENDED = { contaminationRatio: 0.2, citation: 'Fetherolf et al. (2023, ApJS 268, 4)', url: 'https://arxiv.org/abs/2208.11721' } as const;
/** Why a TESS target's light is not read as its star's, when the catalog's contamination ratio says it is blended. */
export const blended = (contaminationRatio: number | undefined, tic: number): string | undefined => contaminationRatio !== undefined && contaminationRatio >= BLENDED.contaminationRatio
  ? `The TESS Input Catalog gives the target of the star's 2-minute light curves (TIC ${tic}) a contamination ratio of ${Number(contaminationRatio.toPrecision(2))}: for each part of the star's own light, its pixels hold that many parts of other stars'. Fetherolf et al. (2023) search these light curves for periodic variability only under a ratio of 0.2, and the light is not read as this star's.` : undefined;

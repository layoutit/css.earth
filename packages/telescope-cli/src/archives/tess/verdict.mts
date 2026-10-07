/** A method's verdict on a star's rotation, and what it is set beside before a map is made of it.
 *
 * Whether a light curve shows a star turning is a published method's to say (methods.mts). What is here is the verdict's
 * shape and three checks against what is already published of the star: its catalogued rotation period, the kind of
 * object SIMBAD files it as, and the fastest its recorded radius and mass let it turn. Each can only withhold a map. */
/** The missions whose light curves are read. */
export type Mission = 'TESS' | 'K2' | 'Kepler';
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

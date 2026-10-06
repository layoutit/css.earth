/** The shape of a star spec and of the bodies it hosts: what spec.mts parses and the generator reads. */
import type { WhiteDwarfAtmosphere } from './limb-choice.mts';

export interface Cited { readonly value: number; readonly source: string; readonly url: string; readonly uncertainty?: number }
export type ColorRoute = 'stis-ngsl' | 'gaia-xp' | 'pulkovo' | 'kiehling' | 'kharitonov' | 'burnashev';
export interface StarSpec {
  readonly id: string; readonly name: string; readonly system: string; readonly description: string; readonly order?: number;
  /** The object the star is inside, by the object tree: its galaxy (`milky-way` for a star Gaia or Hipparcos places, the galaxy a
   * star was measured in otherwise). The systems step moves a star with planets into its own system, and `boundTo` puts a companion
   * in the system of its star. A package that exists keeps its parent when the spec names none; a new one is refused without it. */
  readonly parent?: string;
  /** The star this one is measured to be bound to with no measured orbit, and the measurement that says so: the astronomy record's
   * `boundTo` and `sources.binary`. The star is then inside that star's system. */
  readonly boundTo?: { readonly host: string; readonly source: string };
  /** A SIMBAD name, a Gaia DR3 source_id, or both. */
  readonly target?: string; readonly gaia?: string;
  /** Other designations of the star, searchable and listed on its card: the names `name` was preferred to (display-name.mts). */
  readonly aliases?: readonly string[];
  /** A map target: ringed, named and opened by a click (the catalogue's `featured`). Every other star is a plain dot. */
  readonly featured?: true;
  readonly paper: { readonly url: string; readonly credit: string };
  readonly radius: Cited | 'gaia-flame'; readonly mass: Cited | 'gaia-flame' | 'unmeasured'; readonly temperature: Cited;
  readonly gravity?: Cited; readonly radialVelocity?: Cited;
  /** The published range of gravities for the star's class, cited: a limb read inside it when the star's own is unpublished (gravity.mts). */
  readonly gravityRange?: { readonly min: number; readonly max: number; readonly source: string; readonly url: string };
  /** Parsecs, cited: replaces Gaia DR3's parallax distance (spec header). */
  readonly distance?: Cited;
  /** One row of a published VizieR table that places a star Gaia cannot see (spec header). */
  readonly position?: CataloguePosition;
  readonly spin?: { readonly inclinationDegrees: number; readonly periodDays?: number; readonly source: string; readonly url: string };
  /** A fast rotator's published Roche-von Zeipel fit: the record written beside the star, its paper, and the rotation period it prints (roche-shape.mts). */
  readonly gravityDarkening?: { readonly record: Readonly<Record<string, unknown>>; readonly credit: string; readonly url: string; readonly rotationPeriodHours?: number };
  readonly limb?: { readonly none: string };
  /** A white dwarf's cited atmosphere class, which picks the grid its limb law is read from (limb.mts). */
  readonly whiteDwarf?: WhiteDwarfSpec;
  /** `disagreement` says why the color and its cross-check differ by more than the agreement threshold, for the color record;
   * `companion` says what is known of a close, bright companion a double-star catalogue lists when a measured spectrum is kept
   * (companion-blend.mts). */
  readonly color?: { readonly skip: readonly ColorRoute[]; readonly reason: string; readonly disagreement?: string; readonly companion?: string };
  readonly planets: readonly HostedSpec[]; readonly companions: readonly HostedSpec[];
  /** Drafted reader text, cited to the paper at `locator`; without it the card and introduction stay marked for a person. */
  readonly text?: DraftText;
  /** What the generator or a person chose not to show, one sentence each, for the README. */
  readonly notes: readonly string[];
}
/** `motion` is for a catalogue that measures the star's proper motion (Hipparcos, for a star too bright for Gaia): the Julian year its
 * RAJ2000 and DEJ2000 are given at and the columns holding the motion in right ascension (times cos declination) and declination, mas/yr. */
export interface CataloguePosition { readonly catalogue: string; readonly row: Readonly<Record<string, string>>; readonly credit: string; readonly url: string;
  /** The columns holding the J2000 position in decimal degrees when they are not the table's RAJ2000 and DEJ2000: VizieR's own
   * `_RAJ2000` and `_DEJ2000`, for a table that writes its positions in sexagesimal or inside a name. */
  readonly columns?: { readonly ra: string; readonly dec: string };
  /** `simbad` places the star at SIMBAD's position of the object whose `main_id` is `row.main_id` (catalogue `basic`): for a star whose
   * own table gives each row no position, and whose rows CDS has matched to SIMBAD by name. */
  readonly archive?: 'simbad' | 'mast' | 'paper';
  /** With `mast`: `catalogue` is the MAST product, `row` its { extension, x, y }, and this the coordinate of the first pixel's centre in the
   * paper's convention: 0.5 (HSTphot, DOLPHOT), 1 (DAOPHOT, IRAF, FITS) or 0. */
  readonly firstPixel?: number;
  readonly motion?: { readonly epoch: number; readonly ra: string; readonly dec: string } }
/** Sentences of the body's Wikipedia article lead, verbatim (prose.mts), cited as quotes beside the drafted text. */
export interface DraftQuotes { readonly url: string; readonly title: string; readonly revision: string; readonly card?: string; readonly introduction?: string }
export interface DraftText { readonly card: string; readonly introduction: string; readonly locator: string; readonly quotes?: DraftQuotes }
export const HOSTED_EPOCHS = ['periastron', 'inferior-conjunction', 'superior-conjunction'] as const;
export type HostedEpoch = typeof HOSTED_EPOCHS[number];
export type OrbitSpec =
  | { readonly whereistheplanet: string; readonly measurements: string; readonly measurementsSource: string; readonly body?: number; readonly source: string; readonly url: string }
  | { readonly archive: 'nasa-ps'; readonly reference?: string; readonly planetName?: string; readonly measured?: true }
  | { readonly elements: Readonly<Record<string, number>>; readonly epoch?: HostedEpoch; readonly source: string; readonly url: string }
  | { readonly record: true; readonly source: string; readonly url: string };
/** A measured dayside brightness temperature (secondary eclipse) for the "Thermal glow" dataset (planet-datasets.mts). */
export interface ThermalSpec { readonly where?: string; readonly temperatureK: number; readonly uncertaintyK?: number; readonly wavelengthMicrometres: number; readonly facility: string; readonly source: string; readonly url: string; readonly chosen: string }
/** Published flux densities in three infrared bands for the band-color dataset of an imaged planet (planet-datasets.mts): red, green,
 * blue from the longest wavelength, on one display range shared with the bodies it names. */
export interface PhotometrySpec {
  readonly unit: string; readonly source: { readonly citation: string; readonly url: string; readonly locator: string };
  readonly bands: readonly [{ readonly band: string; readonly wavelengthMicrometres: number; readonly value: number; readonly error: number }, { readonly band: string; readonly wavelengthMicrometres: number; readonly value: number; readonly error: number }, { readonly band: string; readonly wavelengthMicrometres: number; readonly value: number; readonly error: number }];
  readonly displayRange: readonly [number, number]; readonly displayRangeSource: string;
}
/** A body on a hosted orbit: a planet (Jupiter units) or a companion star (solar units). */
export interface HostedSpec {
  readonly kind: 'planet' | 'companion'; readonly id: string; readonly name: string; readonly description: string; readonly order?: number;
  readonly paper: { readonly url: string; readonly credit: string };
  readonly radius?: Cited; readonly mass?: Cited; readonly temperature?: Cited; readonly orbit: OrbitSpec; readonly text?: DraftText; readonly thermal?: ThermalSpec; readonly photometry?: PhotometrySpec;
  /** Heat maps from published phase-curve fits, added beside the color dataset (phase-curve-dataset.mts). */
  readonly phaseCurves?: readonly PhaseCurveEntry[];
  /** A companion that is a black hole: an astronomy record only (spec header). */
  readonly blackHole?: true;
  /** Why a companion's color is a Planck spectrum at its temperature, when not because the archives cannot separate it. */
  readonly colorReason?: string;
  /** A white dwarf's cited atmosphere class, which picks the grid its limb law is read from (limb.mts). */
  readonly whiteDwarf?: WhiteDwarfSpec;
}
export interface WhiteDwarfSpec { readonly atmosphere: WhiteDwarfAtmosphere; readonly source: string; readonly url: string }
export interface PhaseCurveEntry {
  /** Dataset id, and the dataset key of its reader text. */
  readonly dataset: string; readonly label: string;
  /** The record's path inside the package's source directory. */
  readonly path: string; readonly url: string;
  /** Who fitted it ("Knutson et al. (2012)") and what they fitted ("a Spitzer IRAC phase curve of 2009"). */
  readonly credit: string; readonly observed: string;
  readonly record: Readonly<Record<string, unknown>>;
}

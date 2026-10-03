/** The query's contract: mode capabilities, constraint verdicts, candidates, coverage and the saved observation selection. */
import type { ProductKind, CapabilityRequest } from './recipe-request.mts';
import type { VoInputs, VoProductCandidate } from './vo/bridge.mts';
import type { QualifiedObservation } from './qualified-observations.mts';
import type { RequestSatisfaction } from './request-satisfaction.mts';
import type { ResolutionAssumption } from '@cssearth/objects';
import type { SourceIntakeIssue } from './source-intake.mts';
import type { LoadedSourceProduct } from './source-products.mts';
import type { QualificationAction } from './qualification-routes.mts';
import type { TargetAssociation } from '@cssearth/telescope/node';
import type { TargetCatalogueEntry, TargetResolution } from '@cssearth/telescope';

export const ARCSEC_PER_RADIAN = 206_264.806_247;
export const TARGET_ASSOCIATIONS_PATH = 'data/telescopes/target-associations.json';
export const MODES_SCHEMA = 'cssearth-telescope-modes@1';

/** What an instrument mode can do, from its own documentation. `bands` means the coverage is the one `bands.mts` already
 * states for that mode's bands, so it is not retyped here. */
export interface ModeCapability {
  readonly telescope: string; readonly mode: string;
  /** One interval per documented window, filter or channel, merged where they touch and sorted. A mode is never given an
   * enclosing minimum and maximum: NIRCam coronagraphy observes 1.8 to 2.2 and 2.8 to 5.0 micrometres and nothing between. */
  readonly wavelengthIntervals?: readonly (readonly [number, number])[];
  /** Left out where the documentation states no aperture, as for a spacecraft camera given only by its T number. */
  readonly apertureMetres?: number;
  /** How finely the detector samples the image. This is sampling, not resolution. */
  readonly pixelScaleArcsec?: number;
  /** What the optics resolve, where the documentation states it directly rather than leaving it to the diffraction limit:
   * a grazing-incidence X-ray telescope has no useful diffraction limit, and its published point spread function is the fact. */
  readonly instrumentResolution?: { readonly arcsec: number; readonly basis: string; readonly citation: string };
  readonly kinds: readonly ProductKind[];
  readonly citation: string;
  readonly note?: string;
}

export type ConstraintAnswer = 'yes' | 'no' | 'partial' | 'unknown';
export interface ConstraintVerdict { readonly answer: ConstraintAnswer; readonly reason: string;
  readonly assumptions?: readonly { readonly id: ResolutionAssumption; readonly description: string; readonly accepted: boolean }[] }
/** What this repository can do with a mode, in rising order of what has actually been established here.
 *
 * `archive-final` is its own level and not a weaker `proven`: the observatory's own final product was pinned, downloaded and
 * read whole, which establishes the bytes and not a re-calibration. A mode whose pipeline is retired can reach it and never
 * reach `proven`, and a caller asking what was re-made here is never answered with it. */
export type ToolkitLevel = 'none' | 'archive-final' | 'source-qualified' | 'tool-without-checked-program' | 'proven';

export interface ToolkitSupport {
  readonly level: ToolkitLevel; readonly reason: string;
  readonly productionMethod: 'none' | 'tool-available' | 'local-pipeline' | 'archive-final' | 'archive-retrieval';
  readonly evidenceBasis: 'none' | 'accepted-route-receipts' | 'archive-origin';
  readonly acceptanceCriterion: 'none' | 'receipt-valid-for-pinned-program' | 'archive-bytes-qualified';
  readonly tool?: string;
  readonly programs: readonly string[]; readonly checked: readonly string[];
  /** Programs whose pin of the archive's own final product was checked. Never merged with `checked`, which is re-calibration. */
  readonly archiveFinalQualified: readonly string[];
  /** Exact target ownership supplied by the adapter when its ledger carries that relation. */
  readonly targetPrograms: readonly string[]; readonly targetChecked: readonly string[]; readonly targetArchiveFinalQualifiedPrograms: readonly string[];
  readonly targetProgramPinned: boolean; readonly targetProgramChecked: boolean;
  readonly targetArchiveFinalQualified: boolean;
}

export interface ReportedResolution { readonly path: string; readonly quantity: string; readonly observation: string; readonly programme?: string; readonly angularResolutionArcsec: number; readonly surfaceResolutionKm: number; readonly basis: string; readonly resolutionKind: string }
export interface CandidateEvidence {
  readonly ledger: string; readonly archiveDate: string;
  readonly receipts: readonly string[];
  readonly targetAssociations: readonly { readonly source: string; readonly archive: 'mast'; readonly collection: string; readonly archiveTarget: string; readonly programme: string;
    readonly astroquery: string; readonly queriedAt: string;
    readonly citation: string; readonly locator: string; readonly establishes: string }[];
  readonly bodyMaps: readonly ReportedResolution[];
  readonly investigations: readonly { readonly id: string; readonly status: string; readonly subject: string }[];
}

/** Evidence that names no single mode. It stays here rather than being attached to a candidate that might not be the one it
 * is about. */
export interface UnassignedEvidence {
  readonly kind: 'body-map' | 'investigation';
  readonly source: string; readonly identity: string; readonly reason: string;
  readonly couldMean: readonly string[];
}

export type WorkflowBlockerCode = 'request-incomplete' | 'constraint-refused' | 'toolkit-unavailable' | 'body-map-author-missing' | 'target-program-unqualified';
export type TargetCoverageState = 'observed' | 'searched-empty' | 'unsupported-products' | 'not-searched' | 'unanswered';
export type SearchCoverage = 'target-unresolved' | 'incomplete' | 'bounded';
export type ProviderSearchState = 'sampled' | 'overflow' | 'empty-in-scope' | 'unavailable' | 'unknown-target';
export interface TargetCoverage { readonly telescope: string; readonly ledger: string; readonly state: TargetCoverageState; readonly reason: string;
  readonly registryProducts?: number; readonly admittedProducts?: number; readonly rejected?: readonly { readonly lidvid: string; readonly reason: string }[] }
/** A bounded answer describes only configured searches; incomplete evidence cannot support a negative. */
export function assessSearchCoverage(input:{readonly resolution:TargetResolution;readonly indexed:readonly TargetCoverage[];
  readonly providers:readonly {readonly state:ProviderSearchState}[];readonly sourceIncomplete?:boolean;readonly unresolved?:boolean}):SearchCoverage {
  if(input.resolution.status!=='resolved')return 'target-unresolved';
  return input.unresolved||input.sourceIncomplete||input.indexed.some(item=>item.state==='not-searched'||item.state==='unanswered')
    ||input.providers.some(service=>service.state==='unavailable'||service.state==='overflow')?'incomplete':'bounded';
}
export interface WorkflowBlocker { readonly code: WorkflowBlockerCode; readonly reason: string; readonly constraint?: string }
export interface SelectionAction { readonly kind: 'select-observation'; readonly programme: string; readonly command: 'pnpm'; readonly arguments: readonly string[] }
export interface CandidateSelectionAssessment {
  readonly selectable: boolean;
  readonly blockers: readonly WorkflowBlocker[];
  /** One executable, structured action per target-qualified program. Empty while any blocker remains. */
  readonly nextActions: readonly SelectionAction[];
  /** Concrete archive observations this repository can qualify when that is the only remaining blocker. */
  readonly qualificationActions: readonly QualificationAction[];
}

export interface Candidate {
  readonly qualifiedProducts?: readonly QualifiedObservation[];
  readonly telescope: string; readonly mode: string;
  readonly observations: { readonly count: number; readonly scope: 'this-mode' | 'object-total';
    /** Complete observation identities where the ledger preserves them, rather than only a grouped count. */
    readonly records?: readonly { readonly id: string; readonly programme?: string; readonly startIso: string; readonly endIso?: string; readonly title?: string;
      readonly filter?: string; readonly pixelScaleArcsec?: number; readonly quality?: string; readonly observatory?: string; readonly instrument?: string;
      readonly archiveTarget?: string; readonly night?: string; readonly targetLid?: string; readonly productLidvid?: string; readonly archiveProductId?: string;
      readonly centralWavelengthMicrometres?: number;
      readonly wavelengthIntervalMicrometres?: readonly [number, number]; readonly wavelengthIntervalsMicrometres?: readonly (readonly [number, number])[];
      readonly surfaceResolutionKm?: number; readonly kind?: ProductKind; readonly use?: string; readonly units?: string;
      readonly qualification?: { readonly verified: boolean; readonly receipt: string; readonly problem?: string; readonly limitations: readonly string[] }; readonly requestSatisfaction?: RequestSatisfaction; readonly sourceProductId?: string; readonly sourceFiles?: readonly { readonly role: string; readonly path: string; readonly origin: string }[] }[] } | null;
  readonly programmes: readonly string[];
  readonly meetsConstraints: Readonly<Record<string, ConstraintVerdict>>;
  readonly toolkitSupport: ToolkitSupport;
  /** Whether this repository has an author that turns this exact mode into the requested shared body-map contract. This is
   * separate from toolkit support: a reducer can be proven while ending at an unregistered detector product. */
  readonly bodyMapSupport: { readonly answer: 'yes' | 'no'; readonly reason: string; readonly author?: string };
  /** The workflow verdict derived from the same facts the explicit selector enforces. */
  readonly selectionAssessment: CandidateSelectionAssessment;
  readonly evidence: CandidateEvidence;
  readonly unknown: readonly string[];
}

/** Everything the query reads, already loaded: it does no input or output of its own. */
export interface QueryInputs {
  readonly vo?: VoInputs;
  readonly sourceIntakeIssues?: readonly SourceIntakeIssue[];
  readonly ledgers: readonly { readonly telescope: string; readonly path: string; readonly value: unknown }[];
  readonly capabilities: readonly ModeCapability[];
  readonly targetCatalogue: readonly TargetCatalogueEntry[];
  readonly targetAssociations: readonly TargetAssociation[];
  readonly bodyMaps: readonly { readonly path: string; readonly value: unknown }[];
  readonly sourceProducts?: readonly LoadedSourceProduct[];
  readonly qualifiedProducts?: readonly QualifiedObservation[];
  readonly associationFailures?: readonly { readonly collection: string; readonly reason: string }[];
  readonly investigations?: { readonly path: string; readonly value: unknown };
}

export interface CapabilityAnswer {
  readonly archiveProducts?: readonly VoProductCandidate[];
  readonly archiveAccess?: VoInputs;
  readonly sourceIntakeIssues?: readonly SourceIntakeIssue[];
  readonly target: string;
  readonly request: CapabilityRequest;
  readonly targetResolution: TargetResolution;
  readonly candidates: readonly Candidate[];
  readonly unassignedEvidence: readonly UnassignedEvidence[];
  readonly endpoint: { readonly status: 'unknown-target' | 'request-incomplete' | 'index-incomplete' | 'no-selectable-candidate' | 'selectable-candidates'; readonly coverage: SearchCoverage; readonly selectableCandidates: number; readonly blockerCodes: readonly (WorkflowBlockerCode | 'unknown-target' | 'target-index-unavailable' | 'archive-query-unanswered' | 'archive-products-unsupported')[] };
  /** One explicit coverage result per ledger. Absence is never silently treated as an archive negative. */
  readonly targetCoverage: readonly TargetCoverage[];
  /** Compatibility view containing only ledgers that explicitly searched for the target and found nothing. */
  readonly withoutTheTarget: readonly { readonly telescope: string; readonly ledger: string; readonly reason: string }[];
}

export const OBSERVATION_SELECTION_SCHEMA = 'cssearth-telescope-observation-selection@1';
export interface ObservationSelection {
  readonly product?: QualifiedObservation;
  readonly schema: typeof OBSERVATION_SELECTION_SCHEMA;
  readonly satisfaction: RequestSatisfaction;
  readonly request: CapabilityRequest;
  readonly telescope: string;
  readonly mode: string;
  readonly programme: string;
  readonly toolkitLevel: ToolkitLevel;
  readonly constraints: Readonly<Record<string, ConstraintVerdict>>;
  readonly bodyMapSupport: Candidate['bodyMapSupport'];
  /** Constraints that remain partial or unknown after selection. They stay visible rather than becoming an implied yes. */
  readonly unresolved: readonly { readonly constraint: string; readonly answer: 'partial' | 'unknown'; readonly reason: string }[];
  readonly evidence: CandidateEvidence;
}

export type SelectionBlockerCode = 'incomplete-request' | 'candidate' | 'constraint' | 'toolkit' | 'body-map' | 'programme';
export interface SelectionBlocker { readonly code: SelectionBlockerCode; readonly reason: string; readonly constraint?: string }
export interface SelectionAssessment { readonly candidate?: Candidate; readonly archiveProduct?: VoProductCandidate; readonly blockers: readonly SelectionBlocker[] }

export class ObservationSelectionError extends Error {
  readonly blockers: readonly SelectionBlocker[];
  constructor(telescope: string, mode: string, programme: string, blockers: readonly SelectionBlocker[]) {
    super(`Cannot select ${telescope} ${mode} program ${programme}:\n${blockers.map(blocker => `- ${blocker.reason}`).join('\n')}`);
    this.name = 'ObservationSelectionError'; this.blockers = blockers;
    Object.defineProperty(this, 'blockers', { enumerable: false });
  }
}

/** What a ledger says about one target in one mode, in the one shape every adapter produces. */

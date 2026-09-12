import { isArray } from './is-array.mts';

export interface ObservationCoverage {
  readonly surfacePercent?: number;
  readonly qualifiedPixels?: number;
  readonly withheldPixels?: number;
}

export interface ObservationThumbnail {
  readonly url: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

/** A compact, prepared account of source frames used by one rendered dataset. */
export interface ObservationEvidence {
  readonly id: string;
  readonly title: string;
  readonly sourceImageIds: readonly string[];
  readonly cameraSourceIds: readonly string[];
  readonly shapeSourceIds: readonly string[];
  readonly observedAt?: string;
  readonly instrument?: string;
  readonly quantity?: string;
  /** Qualified terrain registration from archived controls; published pointing alone is excluded. */
  readonly registration: { readonly kind: 'archived-controls'; readonly method: string; readonly sourceId: string; readonly validatedControlCount: number; readonly maximumResidualMeters?: number; readonly maximumResidualPixels?: number };
  readonly coverage?: ObservationCoverage;
  readonly thumbnail?: ObservationThumbnail;
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !isArray(value);
const text = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) throw new TypeError(`Invalid observation ${label}.`);
  return value;
};
const id = (value: unknown, label: string) => {
  const result = text(value, label);
  if (!/^[a-z][a-z0-9-]*$/u.test(result)) throw new TypeError(`Invalid observation ${label}.`);
  return result;
};
const ids = (value: unknown, label: string) => {
  if (!isArray(value) || !value.length) throw new TypeError(`Missing observation ${label}.`);
  const result = value.map(entry => id(entry, label));
  if (new Set(result).size !== result.length) throw new TypeError(`Duplicate observation ${label}.`);
  return Object.freeze(result);
};
const count = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`Invalid observation ${label}.`);
  return value;
};
const positiveCount = (value: unknown, label: string): number => {
  const result = count(value, label);
  if (!result) throw new TypeError(`Observation ${label} must be positive.`);
  return result;
};

export function parseObservationEvidence(value: unknown): ObservationEvidence {
  if (!record(value)) throw new TypeError('Invalid observation evidence.');
  const allowed = new Set(['id', 'title', 'sourceImageIds', 'cameraSourceIds', 'shapeSourceIds', 'observedAt', 'instrument', 'quantity', 'registration', 'coverage', 'thumbnail']);
  if (Object.keys(value).some(key => !allowed.has(key))) throw new TypeError('Unexpected observation evidence field.');
  const observedAt = value.observedAt === undefined ? undefined : text(value.observedAt, 'time');
  if (observedAt !== undefined && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u.test(observedAt) || Number.isNaN(Date.parse(observedAt)))) throw new TypeError('Observation time must be an ISO UTC instant.');
  if (!record(value.registration)) throw new TypeError('Missing observation registration.');
  const registration = value.registration;
  if (Object.keys(registration).some(key => !['kind', 'method', 'sourceId', 'validatedControlCount', 'maximumResidualMeters', 'maximumResidualPixels'].includes(key))) throw new TypeError('Unexpected observation registration field.');
  if (registration.kind !== 'archived-controls') throw new TypeError('Observation evidence requires archived control registration.');
  const maximumResidualMeters = registration.maximumResidualMeters;
  if (maximumResidualMeters !== undefined && (typeof maximumResidualMeters !== 'number' || !Number.isFinite(maximumResidualMeters) || maximumResidualMeters < 0)) throw new TypeError('Invalid observation registration residual.');
  const maximumResidualPixels = registration.maximumResidualPixels;
  if (maximumResidualPixels !== undefined && (typeof maximumResidualPixels !== 'number' || !Number.isFinite(maximumResidualPixels) || maximumResidualPixels < 0)) throw new TypeError('Invalid observation registration pixel residual.');
  if (maximumResidualMeters === undefined && maximumResidualPixels === undefined) throw new TypeError('Observation registration needs a measured residual.');
  let coverage: ObservationCoverage | undefined;
  if (value.coverage !== undefined) {
    if (!record(value.coverage)) throw new TypeError('Invalid observation coverage.');
    const raw = value.coverage;
    if (Object.keys(raw).some(key => !['surfacePercent', 'qualifiedPixels', 'withheldPixels'].includes(key))) throw new TypeError('Unexpected observation coverage field.');
    const surfacePercent = raw.surfacePercent;
    if (surfacePercent !== undefined && (typeof surfacePercent !== 'number' || !Number.isFinite(surfacePercent) || surfacePercent < 0 || surfacePercent > 100)) throw new TypeError('Invalid observation surface percentage.');
    const qualifiedPixels = raw.qualifiedPixels === undefined ? undefined : count(raw.qualifiedPixels, 'qualified pixel count');
    const withheldPixels = raw.withheldPixels === undefined ? undefined : count(raw.withheldPixels, 'withheld pixel count');
    if (surfacePercent === undefined && qualifiedPixels === undefined && withheldPixels === undefined) throw new TypeError('Observation coverage needs a measured value.');
    coverage = Object.freeze({ ...(surfacePercent === undefined ? {} : { surfacePercent }), ...(qualifiedPixels === undefined ? {} : { qualifiedPixels }), ...(withheldPixels === undefined ? {} : { withheldPixels }) });
  }
  let thumbnail: ObservationThumbnail | undefined;
  if (value.thumbnail !== undefined) {
    if (!record(value.thumbnail)) throw new TypeError('Invalid observation thumbnail.');
    const raw = value.thumbnail;
    if (Object.keys(raw).some(key => !['url', 'alt', 'width', 'height'].includes(key))) throw new TypeError('Unexpected observation thumbnail field.');
    const url = text(raw.url, 'thumbnail URL');
    if (!url.startsWith('/scenes/')) throw new TypeError('Observation thumbnail must be a prepared scene asset.');
    const width = count(raw.width, 'thumbnail width'), height = count(raw.height, 'thumbnail height');
    if (!width || !height) throw new TypeError('Invalid observation thumbnail dimensions.');
    thumbnail = Object.freeze({ url, alt: text(raw.alt, 'thumbnail alt text'), width, height });
  }
  return Object.freeze({ id: id(value.id, 'ID'), title: text(value.title, 'title'), sourceImageIds: ids(value.sourceImageIds, 'image source IDs'),
    cameraSourceIds: ids(value.cameraSourceIds, 'camera source IDs'), shapeSourceIds: ids(value.shapeSourceIds, 'shape source IDs'),
    ...(observedAt === undefined ? {} : { observedAt }), ...(value.instrument === undefined ? {} : { instrument: text(value.instrument, 'instrument') }),
    ...(value.quantity === undefined ? {} : { quantity: text(value.quantity, 'quantity') }),
    registration: Object.freeze({ kind: 'archived-controls', method: text(registration.method, 'registration method'), sourceId: id(registration.sourceId, 'registration source ID'), validatedControlCount: positiveCount(registration.validatedControlCount, 'validated control count'), ...(maximumResidualMeters === undefined ? {} : { maximumResidualMeters }), ...(maximumResidualPixels === undefined ? {} : { maximumResidualPixels }) }),
    ...(coverage === undefined ? {} : { coverage }), ...(thumbnail === undefined ? {} : { thumbnail }) });
}

export interface PreparedObservationEvidence {
  readonly schema: 'cssearth-prepared-observation-evidence@1';
  readonly objectId: string;
  readonly sourceManifestSha256: string;
  /** Generator plus every runtime decoder/reporting dependency used for this report. */
  readonly generator: { readonly path: string; readonly sha256: string; readonly dependencies: readonly { readonly path: string; readonly sha256: string }[] };
  readonly inputs: readonly { readonly id: string; readonly sha256: string }[];
  readonly datasets: readonly { readonly lensId: string; readonly recipe: { readonly id: string; readonly sha256: string }; readonly observations: readonly ObservationEvidence[] }[];
}

/** A report may be consumed only when provenance pins its present bytes. */
export function observationEvidenceOutputMatches(pins: readonly { readonly bytes: number; readonly sha256: string }[], actual: { readonly bytes: number; readonly sha256: string } | null) {
  return actual === null ? pins.length === 0 : pins.length > 0 && pins.every(pin => pin.bytes === actual.bytes && pin.sha256 === actual.sha256);
}

/** Preparation emits this report; it is not an authored declaration of success. */
export function parsePreparedObservationEvidence(value: unknown): PreparedObservationEvidence {
  if (!record(value) || value.schema !== 'cssearth-prepared-observation-evidence@1') throw new TypeError('Invalid prepared observation evidence.');
  if (Object.keys(value).some(key => !['schema', 'objectId', 'sourceManifestSha256', 'generator', 'inputs', 'datasets'].includes(key))) throw new TypeError('Unexpected prepared observation evidence field.');
  const objectId = id(value.objectId, 'object ID');
  const digest = (raw: unknown, label: string) => {
    const result = text(raw, label);
    if (!/^[a-f0-9]{64}$/u.test(result)) throw new TypeError(`Invalid observation ${label}.`);
    return result;
  };
  if (!record(value.generator) || Object.keys(value.generator).some(key => !['path', 'sha256', 'dependencies'].includes(key))) throw new TypeError('Invalid observation evidence generator.');
  const generatorDependency = (raw: unknown, label: string) => {
    if (!record(raw) || Object.keys(raw).some(key => !['path', 'sha256'].includes(key))) throw new TypeError(`Invalid observation ${label}.`);
    const path = text(raw.path, `${label} path`);
    if (!/\.m?ts$/u.test(path) || path.startsWith('/') || path.split('/').includes('..')) throw new TypeError(`Invalid observation ${label} path.`);
    return Object.freeze({ path, sha256: digest(raw.sha256, `${label} hash`) });
  };
  const generator = generatorDependency({ path: value.generator.path, sha256: value.generator.sha256 }, 'generator');
  if (!isArray(value.generator.dependencies)) throw new TypeError('Observation generator needs its dependency closure.');
  const generatorDependencies = value.generator.dependencies.map((raw, index) => generatorDependency(raw, `generator dependency ${index + 1}`));
  if (new Set(generatorDependencies.map(item => item.path)).size !== generatorDependencies.length || generatorDependencies.some(item => item.path === generator.path))
    throw new TypeError('Duplicate observation generator dependency.');
  if (!isArray(value.inputs) || !value.inputs.length) throw new TypeError('Prepared observation evidence needs source inputs.');
  const inputs = value.inputs.map(raw => {
    if (!record(raw) || Object.keys(raw).some(key => !['id', 'sha256'].includes(key))) throw new TypeError('Invalid prepared observation input.');
    return Object.freeze({ id: id(raw.id, 'input ID'), sha256: digest(raw.sha256, 'input hash') });
  });
  if (new Set(inputs.map(input => input.id)).size !== inputs.length) throw new TypeError('Duplicate prepared observation input.');
  if (!isArray(value.datasets) || !value.datasets.length) throw new TypeError('Prepared observation evidence needs datasets.');
  const datasets = value.datasets.map(raw => {
    if (!record(raw) || Object.keys(raw).some(key => !['lensId', 'recipe', 'observations'].includes(key))) throw new TypeError('Invalid prepared observation dataset.');
    if (!record(raw.recipe) || Object.keys(raw.recipe).some(key => !['id', 'sha256'].includes(key))) throw new TypeError('Invalid prepared observation recipe.');
    if (!isArray(raw.observations) || !raw.observations.length || raw.observations.length > 12) throw new TypeError('Prepared observation dataset must contain 1–12 observations.');
    const observations = raw.observations.map(parseObservationEvidence);
    if (new Set(observations.map(item => item.id)).size !== observations.length) throw new TypeError('Duplicate prepared observation ID.');
    return Object.freeze({ lensId: id(raw.lensId, 'lens ID'), recipe: Object.freeze({ id: id(raw.recipe.id, 'recipe ID'), sha256: digest(raw.recipe.sha256, 'recipe hash') }), observations: Object.freeze(observations) });
  });
  if (new Set(datasets.map(item => item.lensId)).size !== datasets.length) throw new TypeError('Duplicate prepared observation dataset.');
  return Object.freeze({ schema: 'cssearth-prepared-observation-evidence@1', objectId, sourceManifestSha256: digest(value.sourceManifestSha256, 'source manifest hash'),
    generator: Object.freeze({ ...generator, dependencies: Object.freeze(generatorDependencies) }), inputs: Object.freeze(inputs), datasets: Object.freeze(datasets) });
}

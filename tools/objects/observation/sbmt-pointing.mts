/**
 * Read SBMT's published SUM pointing text without assigning it to cssEarth's
 * body or renderer frame.  The format supplies the source's named vectors and
 * calibration records, but this file deliberately does not infer a ray model:
 * a caller needs separate evidence for the SUM coordinate and pixel conventions.
 */
export type SbmtVector3 = readonly [number, number, number];
export type SbmtMatrix2x3 = readonly [readonly [number, number, number], readonly [number, number, number]];

export interface SbmtSumLandmark {
  readonly id: string;
  /** Published sample and line centers. The SUM format does not state their pixel origin. */
  readonly sampleLineCenter: readonly [number, number];
}

/** A published landmark-on-limb center, after the SUM's `LIMB FITS` marker. */
export interface SbmtSumLimbFit {
  readonly id: string;
  readonly sampleLineCenter: readonly [number, number];
}

/** Every fixed header field in the SUM grammar, with source-established meanings. */
export interface SbmtSumPointing {
  /** SUM identifier; USGS notes this is not always the image name. */
  readonly sumId: string;
  /** Potentially corrected UTC start, center, or stop time; its exposure reference remains external metadata. */
  readonly timeUtc: string;
  readonly sampleCount: number;
  readonly lineCount: number;
  readonly lowerDnThreshold: number;
  readonly upperDnThreshold: number;
  readonly focalLengthMillimetres: number;
  /** Sample and line boresight/optical-axis centers. */
  readonly opticalAxisSampleLineCenter: readonly [number, number];
  readonly spacecraftToObjectCenterBodyFixed: SbmtVector3;
  readonly sampleAxisBodyFixed: SbmtVector3;
  readonly lineAxisBodyFixed: SbmtVector3;
  readonly boresightBodyFixed: SbmtVector3;
  readonly sunDirectionBodyFixed: SbmtVector3;
  /** Both rows, including published skew and signs. This is not reduced to focal lengths. */
  readonly kMatrix: SbmtMatrix2x3;
  readonly distortion: readonly [number, number, number, number];
  readonly sigmaVso: SbmtVector3;
  readonly sigmaPtg: SbmtVector3;
  readonly landmarks: readonly SbmtSumLandmark[];
  readonly limbFits: readonly SbmtSumLimbFit[];
}

const header = [
  { label: undefined, count: 1 },
  { label: undefined, count: 1 },
  { label: 'NPX, NLN, THRSH', count: 4 },
  { label: 'MMFL, CTR', count: 3 },
  { label: 'SCOBJ', count: 3 },
  { label: 'CX', count: 3 },
  { label: 'CY', count: 3 },
  { label: 'CZ', count: 3 },
  { label: 'SZ', count: 3 },
  { label: 'K-MATRIX', count: 6 },
  { label: 'DISTORTION', count: 4 },
  { label: 'SIGMA_VSO', count: 3 },
  { label: 'SIGMA_PTG', count: 3 },
] as const;

const numberToken = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[dDeE][+-]?\d+)?$/u;
const imageIdToken = /^[A-Za-z0-9_.-]+$/u;

function linesOf(text: string): string[] {
  if (typeof text !== 'string' || !text.length || text.includes('\0')) throw new TypeError('SBMT SUM must be nonempty text without NUL bytes.');
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  while (lines.at(-1)?.trim() === '') lines.pop();
  if (lines.length < header.length + 1) throw new Error('SBMT SUM is missing its fixed pointing header.');
  return lines;
}

function numericTokens(line: string, count: number, label: string): number[] {
  const tokens = line.trim().split(/\s+/u);
  if (tokens.length !== count || !tokens.every(token => numberToken.test(token))) throw new Error(`SBMT SUM ${label} must contain exactly ${count} finite numbers.`);
  const values = tokens.map(token => Number(token.replace(/[dD]/gu, 'E')));
  if (!values.every(Number.isFinite)) throw new Error(`SBMT SUM ${label} contains a nonfinite number.`);
  return values;
}

function labeledNumbers(line: string, count: number, label: string): number[] {
  const end = line.trimEnd(), start = end.lastIndexOf(label);
  if (start < 2 || end.slice(start) !== label || !/\s{2,}$/u.test(end.slice(0, start))) throw new Error(`SBMT SUM expected ${label} header label.`);
  const data = end.slice(0, start).trim();
  return numericTokens(data, count, label);
}

function vector(values: number[]): SbmtVector3 {
  return [values[0]!, values[1]!, values[2]!];
}

/**
 * Parse a published SBMT SUM file.  Values use Fortran D exponents in some
 * releases.  The parser retains those values as numbers but does not create a
 * camera projection: the format reference names the vectors but does not give
 * a full K-matrix projection equation or pixel-origin convention.
 */
export function parseSbmtSumPointing(text: string): SbmtSumPointing {
  const lines = linesOf(text);
  const sumId = lines[0]!.trim(), timeUtc = lines[1]!.trim();
  if (!imageIdToken.test(sumId)) throw new Error('SBMT SUM ID is invalid.');
  if (!/^\d{4} [A-Z]{3} \d{2} \d{2}:\d{2}:\d{2}\.\d+$/u.test(timeUtc)) throw new Error('SBMT SUM UTC time is invalid.');

  const values = header.slice(2).map((entry, index) => labeledNumbers(lines[index + 2]!, entry.count, entry.label!));
  if (lines[13]!.trim() !== 'LANDMARKS') throw new Error('SBMT SUM lacks its LANDMARKS marker.');
  const [image, optics, scobj, cx, cy, cz, sz, kMatrix, distortion, sigmaVso, sigmaPtg] = values;
  if (!image || !optics || !scobj || !cx || !cy || !cz || !sz || !kMatrix || !distortion || !sigmaVso || !sigmaPtg) throw new Error('SBMT SUM fixed header is incomplete.');
  const [sampleCount, lineCount, lowerDnThreshold, upperDnThreshold] = image;
  if (![sampleCount, lineCount, lowerDnThreshold, upperDnThreshold].every(Number.isSafeInteger) || sampleCount < 1 || lineCount < 1 || lowerDnThreshold < 0 || upperDnThreshold < 0 || lowerDnThreshold > upperDnThreshold) throw new Error('SBMT SUM image dimensions or DN thresholds are invalid.');
  if (!(optics[0]! > 0) || sigmaVso.some(value => value < 0) || sigmaPtg.some(value => value < 0)) throw new Error('SBMT SUM focal length and sigmas must be nonnegative.');

  if (lines.at(-1)!.trim() !== 'END FILE') throw new Error('SBMT SUM lacks its END FILE marker.');
  const limbFitsStart = lines.findIndex((line, index) => index >= 14 && line.trim() === 'LIMB FITS');
  if (limbFitsStart < 0) throw new Error('SBMT SUM lacks its LIMB FITS marker.');
  const parseImageCenter = (line: string, index: number, kind: 'landmark' | 'limb fit') => {
    const tokens = line.trim().split(/\s+/u);
    if (tokens.length !== 3 || !imageIdToken.test(tokens[0]!) || !numberToken.test(tokens[1]!) || !numberToken.test(tokens[2]!)) throw new Error(`SBMT SUM ${kind} ${index + 1} is invalid.`);
    const sampleLineCenter: [number, number] = [Number(tokens[1]!.replace(/[dD]/gu, 'E')), Number(tokens[2]!.replace(/[dD]/gu, 'E'))];
    if (!sampleLineCenter.every(Number.isFinite)) throw new Error(`SBMT SUM ${kind} ${index + 1} contains a nonfinite center.`);
    return { id: tokens[0]!, sampleLineCenter };
  };
  const landmarks = lines.slice(14, limbFitsStart).map((line, index) => parseImageCenter(line, index, 'landmark'));
  const limbFits = lines.slice(limbFitsStart + 1, -1).map((line, index) => parseImageCenter(line, index, 'limb fit'));

  return {
    sumId, timeUtc, sampleCount: sampleCount!, lineCount: lineCount!, lowerDnThreshold: lowerDnThreshold!, upperDnThreshold: upperDnThreshold!,
    focalLengthMillimetres: optics[0]!, opticalAxisSampleLineCenter: [optics[1]!, optics[2]!],
    spacecraftToObjectCenterBodyFixed: vector(scobj), sampleAxisBodyFixed: vector(cx), lineAxisBodyFixed: vector(cy), boresightBodyFixed: vector(cz), sunDirectionBodyFixed: vector(sz),
    kMatrix: [[kMatrix[0]!, kMatrix[1]!, kMatrix[2]!], [kMatrix[3]!, kMatrix[4]!, kMatrix[5]!]],
    distortion: [distortion[0]!, distortion[1]!, distortion[2]!, distortion[3]!],
    sigmaVso: vector(sigmaVso), sigmaPtg: vector(sigmaPtg), landmarks, limbFits,
  };
}

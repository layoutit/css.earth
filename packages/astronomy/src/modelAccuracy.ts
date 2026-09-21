import { SCENE_SATELLITE_STATES } from './data/sceneSatelliteStates.data.js'
import {
  DWARF_PLANET_IDS,
  PLANET_IDS,
  bodyData,
  moonsOf,
  systemGravitationalParameterKm3PerS2,
  type PlanetId,
} from './bodies.js'
import { ELP2000_TRUNCATION_BOUND_KM, ELP2000_VALID_FROM_JD, ELP2000_VALID_TO_JD } from './elp2000.js'
import { SATELLITE_IDS, satelliteRecord, type SatelliteId } from './satellites.js'
import { M_PER_AU, M_PER_KM } from './units.js'
import {
  VSOP87A_TRUNCATION_BOUND_AU,
  VSOP87A_VALID_FROM_JD,
  VSOP87A_VALID_TO_JD,
  type Vsop87BodyKey,
} from './vsop87.js'

export interface FrameModelAccuracy {
  readonly frameId: string
  readonly model: string
  readonly kind: 'model-budget' | 'fit-residual' | 'exact-convention' | 'unknown'
  readonly estimateKm: number | null
  readonly validFromJdTt: number | null
  readonly validToJdTt: number | null
  readonly sourceLabel: string
  readonly sourceUrl: string
  readonly explanation: string
}

const VSOP_SOURCE_URL = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/VI/81'
const ELP_SOURCE_URL = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/VI/79'
const HORIZONS_SOURCE_URL = 'https://ssd.jpl.nasa.gov/horizons/'
const PROJECT_SOURCE_URL = 'https://github.com/layoutit/cssEarth/blob/main/packages/astronomy/AGENTS.md'

const VSOP_KEY_BY_PLANET: Record<PlanetId, Vsop87BodyKey> = {
  mercury: 'mercury',
  venus: 'venus',
  earth: 'emb',
  mars: 'mars',
  jupiter: 'jupiter',
  saturn: 'saturn',
  uranus: 'uranus',
  neptune: 'neptune',
}

/** Measured untruncated VSOP87A discrepancy from the committed DE441 fixtures, in km. */
const VSOP_THEORY_DISCREPANCY_KM: Record<Vsop87BodyKey, number> = {
  mercury: 9.3,
  venus: 17.1,
  emb: 19.1,
  mars: 123,
  jupiter: 1359,
  saturn: 1869.8,
  uranus: 17328.5,
  neptune: 48536.5,
}

/**
 * Maximum evaluator-to-Horizons position residual at the six committed,
 * out-of-fit-sample fixture epochs. These are observations, not bounds or
 * statistical uncertainties.
 */
const SATELLITE_FIXTURE_MAX_KM: Record<SatelliteId, number> = {
  paaliaq: 14686.766060114216,
  tarvos: 14289.465037346157,
  ijiraq: 9349.305144460977,
  suttungr: 5537.38631019438,
  mundilfari: 10946.297914741323,
  skathi: 3135.098354373108,
  erriapus: 11239.635338310401,
  thrymr: 6327.4731443519795,
  bebhionn: 35180.27199442682,
  bergelmir: 4370.567300408625,
  bestla: 13244.793674351526,
  fornjot: 9860.7522653543,
  hati: 10819.137219892531,
  hyrrokkin: 7535.372343890514,
  loge: 8681.363318931204,
  skoll: 7169.2594630787,
  greip: 9025.010316663893,
  tarqeq: 4847.555696729821,
  caliban: 191.0088910188856,
  sycorax: 748.3042107793555,
  prospero: 716.900566808697,
  setebos: 2497.9418798052484,
  kiviuq: 28145.685414789965,
  albiorix: 18473.578208360203,

  siarnaq: 280355.5692405671,
  ymir: 161334.72011835242,
  nereid: 10417.19020260089,
  himalia: 54960.50018520494,
  polydeuces: 939.7293216478489,
  anthe: 2029.4157931053912,
  aegaeon: 306.9010577737413,
  bianca: 62.38429913291977,
  cressida: 31.167287112096254,
  desdemona: 99.17274979901151,
  rosalind: 90.45546017581691,
  phobos: 1395.0463862179204,
  deimos: 112.87860276333798,
  io: 305.340674039755,
  europa: 948.8783552801129,
  ganymede: 3194.390212322053,
  callisto: 4428.458903772901,
  amalthea: 1267.432064142389,
  thebe: 530.0731982080321,
  adrastea: 972.8679003969534,
  metis: 946.8090712289422,
  mimas: 143728.96469762226,
  enceladus: 1915.539637717103,
  tethys: 12052.305125084453,
  dione: 422.0589256119233,
  rhea: 417.88873003967274,
  titan: 1962.3113653019973,
  hyperion: 174839.3486522163,
  iapetus: 59626.0142811711,
  phoebe: 640720.6899566406,
  janus: 113343.60390661786,
  epimetheus: 297616.7325933514,
  helene: 79944.84840594218,
  calypso: 17895.200900517168,
  daphnis: 1129.3174840451686,
  telesto: 17176.524789155148,
  atlas: 7503.609904483168,
  prometheus: 1684.0659231836269,
  pandora: 2581.883953096961,
  pan: 6.926377026450239,
  miranda: 3313.041427765532,
  ariel: 882.9165013531997,
  umbriel: 580.098620593774,
  titania: 2408.954748127577,
  oberon: 1380.33900460793,
  triton: 49252.75275560124,
  proteus: 684.0919384620709,
  larissa: 471.54964789874685,
  naiad: 237.63844794163802,
  thalassa: 104.86029958307859,
  despina: 63.347226539073226,
  galatea: 54.73951237290662,
  charon: 1.0206866493052924,
  nix: 94.35775652756546,
  hydra: 47.05466895261672,
  kerberos: 125.18018743032951,
  styx: 388.06247072435855,
  puck: 46.42767332013248,
  methone: 17510.670766114912,
  pallene: 27.64911948293053,
  belinda: 28.493677463456997,
  juliet: 119.87199717537884,
  portia: 92.4705283027405,
  cordelia: 0.4561261348117766,
  ophelia: 2.0127049908729133,
  dimorphos: 0.054002378820475615,
  elara: 21855.95470883458,
  pasiphae: 32583.06134122711,
  sinope: 31808.556888423773,
  lysithea: 16548.705538529768,
  carme: 11835.983990893437,
  ananke: 33423.87515514806,
  leda: 20956.030128156868,
  halimede: 283.99320999733703,
  psamathe: 3053.7131231152903,
  sao: 316.3934301074006,
  laomedeia: 760.2921749019467,
  neso: 8482.94194448433,
  stephano: 256.2110497854336,
  trinculo: 341.6133224617875,
  francisco: 102.70912469149125,
  margaret: 15315.040854708555,
  ferdinand: 736.7189408631319,
  callirrhoe: 103234.3574684297,
  themisto: 83130.12075855436,
  megaclite: 55366.55678712171,
  taygete: 23117.765947574226,
  chaldene: 27003.37433152101,
  harpalyke: 13210.055090795882,
  kalyke: 25769.132815801888,
  iocaste: 35448.87432874531,
  erinome: 23470.47783432536,
  isonoe: 12978.029249716941,
  praxidike: 61744.20677041964,
  autonoe: 53748.37410767448,
}

const AU_KM = M_PER_AU / M_PER_KM
const ELP_THEORY_DISCREPANCY_KM = 2.668

const metadata = (
  frameId: string,
  model: string,
  kind: FrameModelAccuracy['kind'],
  estimateKm: number | null,
  validFromJdTt: number | null,
  validToJdTt: number | null,
  sourceLabel: string,
  sourceUrl: string,
  explanation: string,
): FrameModelAccuracy =>
  Object.freeze({
    frameId,
    model,
    kind,
    estimateKm,
    validFromJdTt,
    validToJdTt,
    sourceLabel,
    sourceUrl,
    explanation,
  })

const ACCURACY_BY_FRAME = new Map<string, FrameModelAccuracy>()

ACCURACY_BY_FRAME.set(
  'ssb',
  metadata(
    'ssb',
    'SSB colocated with the solar-neighbourhood origin',
    'exact-convention',
    0,
    null,
    null,
    'cssEarth reference-frame convention',
    PROJECT_SOURCE_URL,
    'The standard tree defines the SSB-to-sol edge as zero. This is a coordinate convention, not a claim about the accuracy of the outer cosmic frames.',
  ),
)

ACCURACY_BY_FRAME.set(
  'sun',
  metadata(
    'sun',
    'Eight-planet mass-weighted barycentric correction',
    'fit-residual',
    164.71062368999685,
    VSOP87A_VALID_FROM_JD,
    VSOP87A_VALID_TO_JD,
    'JPL Horizons DE441 Sun-to-SSB vector fixtures',
    HORIZONS_SOURCE_URL,
    'Maximum sampled residual at the seven committed fixture epochs. The correction is computed from the eight VSOP87A planetary systems; omitted dwarf planets and asteroids dominate the discrepancy. This is neither a bound nor a statistical uncertainty.',
  ),
)

for (const planet of PLANET_IDS) {
  const key = VSOP_KEY_BY_PLANET[planet]
  const estimateKm = VSOP87A_TRUNCATION_BOUND_AU[key] * AU_KM + VSOP_THEORY_DISCREPANCY_KM[key]
  const frameId = `${planet}Barycentre`
  ACCURACY_BY_FRAME.set(
    frameId,
    metadata(
      frameId,
      `Truncated VSOP87A ${key === 'emb' ? 'Earth-Moon' : planet} system-barycentre series`,
      'model-budget',
      estimateKm,
      VSOP87A_VALID_FROM_JD,
      VSOP87A_VALID_TO_JD,
      'VSOP87A (Bretagnon & Francou 1988) with DE441 discrepancy',
      VSOP_SOURCE_URL,
      'Conservative sum of the generated dropped-coefficient truncation budget and the measured untruncated-series discrepancy from the seven committed JPL Horizons DE441 fixtures. It is a model budget, not a probability interval.',
    ),
  )
}

const moonBudgetKm = ELP2000_TRUNCATION_BOUND_KM + ELP_THEORY_DISCREPANCY_KM
ACCURACY_BY_FRAME.set(
  'moon',
  metadata(
    'moon',
    'Truncated ELP2000-82B geocentric lunar series',
    'model-budget',
    moonBudgetKm,
    ELP2000_VALID_FROM_JD,
    ELP2000_VALID_TO_JD,
    'ELP2000-82B (Chapront-Touzé & Chapront 1988) with DE441 discrepancy',
    ELP_SOURCE_URL,
    'Conservative sum of the generated dropped-term truncation budget and the measured untruncated-series discrepancy from the seven committed JPL Horizons DE441 fixtures. It is a model budget, not a probability interval.',
  ),
)

for (const id of SATELLITE_IDS) {
  const record = satelliteRecord(id)
  ACCURACY_BY_FRAME.set(
    id,
    metadata(
      id,
      record.positionCorrection
        ? 'Horizons-fitted precessing ellipse with prepared periodic ICRF residuals'
        : 'Precessing Kepler ellipse fitted to JPL Horizons osculating elements',
      'fit-residual',
      SATELLITE_FIXTURE_MAX_KM[id],
      record.fitFromJdTdb,
      record.fitToJdTdb,
      'JPL Horizons fitted elements and independent vector fixtures',
      HORIZONS_SOURCE_URL,
      'Maximum sampled residual at the six committed vector-fixture epochs, which were not input samples to the element fit. It describes this compact fit only; it is neither a bound nor a statistical uncertainty.',
    ),
  )
}

// A retained state has one supported epoch, with source accuracy explicitly unquantified.
for (const [id, record] of Object.entries(SCENE_SATELLITE_STATES)) {
  ACCURACY_BY_FRAME.set(id, metadata(id, record.provenance.model, 'unknown', null,
    record.epochJdTt, record.epochJdTt, 'Object-owned geometric state', record.provenance.source ?? '',
    'Only the prepared scene epoch is supported. Source limitations are retained; coordinate-composition checks do not measure orbit accuracy.'))
}

for (const planet of PLANET_IDS) {
  const moons = moonsOf(planet).filter(id => bodyData(id).gravitationalParameterKm3PerS2 > 0)
  if (moons.length === 0) {
    ACCURACY_BY_FRAME.set(
      planet,
      metadata(
        planet,
        'Planet centre equals its carried system barycentre',
        'exact-convention',
        0,
        null,
        null,
        'cssEarth solar-system frame definition',
        PROJECT_SOURCE_URL,
        'No satellites are carried for this planetary system, so the planet-to-system-barycentre correction is identically zero by the model definition.',
      ),
    )
    continue
  }

  let estimateKm = 0
  let validFromJdTt = -Infinity
  let validToJdTt = Infinity
  for (const moon of moons) {
    const accuracy = ACCURACY_BY_FRAME.get(moon)!
    estimateKm +=
      (bodyData(moon).gravitationalParameterKm3PerS2 / systemGravitationalParameterKm3PerS2(planet)) *
      accuracy.estimateKm!
    validFromJdTt = Math.max(validFromJdTt, accuracy.validFromJdTt!)
    validToJdTt = Math.min(validToJdTt, accuracy.validToJdTt!)
  }
  ACCURACY_BY_FRAME.set(
    planet,
    metadata(
      planet,
      'Mass-weighted represented-satellite correction to the system barycentre',
      planet === 'earth' ? 'model-budget' : 'fit-residual',
      estimateKm,
      validFromJdTt,
      validToJdTt,
      planet === 'earth'
        ? 'ELP2000-82B lunar budget and JPL system GM'
        : 'JPL Horizons satellite residuals and system GM',
      planet === 'earth' ? ELP_SOURCE_URL : HORIZONS_SOURCE_URL,
      `Conservative arithmetic sum of the ${moons.length} represented satellite model ${moons.length === 1 ? 'estimate' : 'estimates'}, weighted by satellite-to-system GM. No independence or root-sum-square assumption is used; unrepresented satellites are not quantified.`,
    ),
  )
}

for (const frameId of ['cmb', 'mw', 'sol']) {
  ACCURACY_BY_FRAME.set(
    frameId,
    metadata(
      frameId,
      'Outer cosmic-frame placement',
      'unknown',
      null,
      null,
      null,
      'No bounded position model',
      PROJECT_SOURCE_URL,
      'The outer cosmic frame placement has no sourced error estimate in the shipped astronomy models.',
    ),
  )
}

for (const frameId of DWARF_PLANET_IDS) {
  ACCURACY_BY_FRAME.set(
    frameId,
    metadata(
      frameId,
      'Single-epoch JPL Horizons osculating Kepler ellipse',
      'unknown',
      null,
      null,
      null,
      'JPL Horizons osculating elements',
      HORIZONS_SOURCE_URL,
      'The propagated ellipse has no defensible sourced error estimate or validity interval. Its committed fixture differences are demonstrations at selected epochs, not a bounded model claim.',
    ),
  )
}

/** Static accuracy metadata for the position model on one frame-to-parent edge. */
export const frameModelAccuracy = (frameId: string): FrameModelAccuracy =>
  ACCURACY_BY_FRAME.get(frameId) ??
  metadata(
    frameId,
    'Unregistered frame position model',
    'unknown',
    null,
    null,
    null,
    'No accuracy metadata',
    PROJECT_SOURCE_URL,
    'No bounded position-model metadata is registered for this frame edge.',
  )

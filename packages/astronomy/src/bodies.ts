import type { SatelliteId } from './data/satelliteElements.data.js'
import { SATELLITE_ELEMENTS } from './data/satelliteElements.data.js'

/**
 * Physical data for the bodies this package places.
 *
 * Values come from JPL Solar System Dynamics. Most are transcribed from
 * Horizons' `OBJ_DATA` block, fetched with
 * `format=text&COMMAND='<code>'&OBJ_DATA='YES'&MAKE_EPHEM='NO'`. The added
 * Saturn moons use JPL's current satellite physical-parameters table
 * (`https://ssd.jpl.nasa.gov/sats/phys_par/`), which publishes the selected
 * ephemeris GM and IAU WGCCRE mean radius together. They are transcribed rather
 * than parsed because the physical-data blocks are free text whose layout
 * differs per body — a parser for them would be a second thing to get wrong.
 *
 * `meanRadiusKm` is the volumetric mean radius where Horizons gives one, and
 * the geometric mean of the triaxial radii where it gives only those (Phobos,
 * Deimos, Miranda, Ariel). It is NOT the equatorial radius: it is used for the
 * frame-capture rule, where the right question is "how big is this body", not
 * "how wide is it at the equator". A renderer that needs the ellipsoid needs
 * three numbers and should not get them from here.
 */
export interface BodyData {
  readonly id: BodyId
  readonly name: string
  readonly horizonsCode: string
  readonly meanRadiusKm: number
  /** GM, km^3/s^2. Zero only where Horizons publishes no GM. */
  readonly gravitationalParameterKm3PerS2: number
  /** Gravitational parent — the body this one orbits. `null` for the Sun. */
  readonly parent: BodyId | null
}

export type PlanetId = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune'
/** Dwarf-planet centre positions use their own heliocentric element sources. */
export type DwarfPlanetId = 'pluto' | 'ceres' | 'eris' | 'haumea' | 'makemake'
export type AsteroidId = 'vesta' | 'eros' | 'itokawa' | 'bennu' | 'ryugu' | 'ida' | 'gaspra' | 'mathilde' | 'lutetia' | 'steins' | 'didymos' | 'kleopatra' | 'toutatis' | 'pallas' | 'hygiea' | 'juno' | 'psyche' | 'interamnia' | 'davida' | 'sylvia' | 'eunomia' | 'euphrosyne' | 'bamberga' | 'fortuna' | 'themis' | 'amphitrite' | 'egeria' | 'elektra' | 'iris' | 'hebe' | 'eugenia' | 'daphne' | 'eleonora' | 'nemesis' | 'kalliope' | 'nemausa' | 'parthenope' | 'melpomene' | 'julia' | 'victoria' | 'urania' | 'flora' | 'europa-52' | 'metis-9' | 'camilla' | 'thisbe' | 'doris' | 'hermione' | 'diotima' | 'herculina' | 'nausikaa' | 'astraea' | 'irene' | 'nysa' | 'sappho' | 'betulia' | 'castalia' | 'asteroid-1998-wt24' | 'asteroid-1994-cc' | 'fides' | 'penelope' | 'alphonsina' | 'angelina' | 'ganymed' | 'moshup' | 'cybele' | 'aurora' | 'palma' | 'thule' | 'hektor' | 'hekate' | 'phaethon' | 'harmonia' | 'panopaea' | 'desdemona-666' | 'asteroid-1950-da' | 'apophis' | 'donaldjohanson' | 'geographos' | 'bacchus' | 'mithra' | 'nereus' | 'golevka' | 'yorp' | 'asteroid-1996-hw1' | 'asteroid-2008-ev5' | 'ra-shalom' | 'asteroid-1992-sk' | 'asteroid-1998-ml14' | 'asteroid-2002-ce26'
export type BodyId = 'sun' | PlanetId | 'moon' | SatelliteId | DwarfPlanetId | AsteroidId | CometId
export type CometId = 'comet-67p' | 'comet-103p' | 'comet-9p' | 'comet-81p' | 'comet-1p'

export const PLANET_IDS: readonly PlanetId[] = [
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
]

export const DWARF_PLANET_IDS: readonly DwarfPlanetId[] = ['pluto', 'ceres', 'eris', 'haumea', 'makemake']
export const ASTEROID_IDS: readonly AsteroidId[] = ['vesta', 'eros', 'itokawa', 'bennu', 'ryugu', 'ida', 'gaspra', 'mathilde', 'lutetia', 'steins', 'didymos', 'kleopatra', 'toutatis', 'pallas', 'hygiea', 'juno', 'psyche', 'interamnia', 'davida', 'sylvia', 'eunomia', 'euphrosyne', 'bamberga', 'fortuna', 'themis', 'amphitrite', 'egeria', 'elektra', 'iris', 'hebe', 'eugenia', 'daphne', 'eleonora', 'nemesis', 'kalliope', 'nemausa', 'parthenope', 'melpomene', 'julia', 'victoria', 'urania', 'flora', 'europa-52', 'metis-9', 'camilla', 'thisbe', 'doris', 'hermione', 'diotima', 'herculina', 'nausikaa', 'astraea', 'irene', 'nysa', 'sappho', 'betulia', 'castalia', 'asteroid-1998-wt24', 'asteroid-1994-cc', 'fides', 'penelope', 'alphonsina', 'angelina', 'ganymed', 'moshup', 'cybele', 'aurora', 'palma', 'thule', 'hektor', 'hekate', 'phaethon', 'harmonia', 'panopaea', 'desdemona-666', 'asteroid-1950-da', 'apophis', 'donaldjohanson', 'geographos', 'bacchus', 'mithra', 'nereus', 'golevka', 'yorp', 'asteroid-1996-hw1', 'asteroid-2008-ev5', 'ra-shalom', 'asteroid-1992-sk', 'asteroid-1998-ml14', 'asteroid-2002-ce26']
export const COMET_IDS: readonly CometId[] = ['comet-67p', 'comet-103p', 'comet-9p', 'comet-81p', 'comet-1p']

const body = (
  id: BodyId,
  name: string,
  horizonsCode: string,
  meanRadiusKm: number,
  gravitationalParameterKm3PerS2: number,
  parent: BodyId | null,
): BodyData => ({ id, name, horizonsCode, meanRadiusKm, gravitationalParameterKm3PerS2, parent })

export const BODIES: Record<BodyId, BodyData> = {
  siarnaq: body('siarnaq', 'Siarnaq', '629', 19.5, 0, 'saturn'),
  ymir: body('ymir', 'Ymir', '619', 9.6, 0, 'saturn'),

  nereid: body('nereid', 'Nereid', '802', 170, 0, 'neptune'),
  himalia: body('himalia', 'Himalia', '506', 85, 0.15155, 'jupiter'),
  polydeuces: body('polydeuces', 'Polydeuces', '634', 1.525973578806757, 0, 'saturn'),
  anthe: body('anthe', 'Anthe', '649', 0.5, 0, 'saturn'),
  aegaeon: body('aegaeon', 'Aegaeon', '653', 0.327106631018859, 0, 'saturn'),
  bianca: body('bianca', 'Bianca', '708', 25.67646409198381, 0, 'uranus'),
  cressida: body('cressida', 'Cressida', '709', 39.78509749046438, 0.01227, 'uranus'),
  desdemona: body('desdemona', 'Desdemona', '710', 32.01203974041056, 0, 'uranus'),
  rosalind: body('rosalind', 'Rosalind', '713', 35.99999999999999, 0, 'uranus'),
  sun: body('sun', 'Sun', '10', 695700, 132712440041.93938, null),
  // Equivalent-volume radius of the triangulated PDS Stooke historical model.
  // Approximate model scale, not a measured mean radius; no known GM is asserted.
  'comet-1p': body('comet-1p', '1P/Halley', 'DES=1P;CAP;', 4.57906433330178, 0, 'sun'),
  // ESA/RMOC MTP019 equivalent-volume radius (ESA_MODEL_INFO.ASC); mass 9.982e12 kg
  // (Pätzold et al. 2016, doi:10.1038/nature16535) times CODATA G. Shape remains object-owned.
  'comet-67p': body('comet-67p', '67P/Churyumov–Gerasimenko', 'DES=67P;CAP;', 1.65, 9.982e12 * 6.6743e-20, 'sun'),
  // Farnham & Thomas (2013) PDS shape catalogue equivalent-volume radii.
  // No measured GM is supplied by these source records; zero follows this registry's unknown-GM convention.
  'comet-103p': body('comet-103p', '103P/Hartley 2', 'DES=103P;CAP;', 0.58, 0, 'sun'),
  'comet-9p': body('comet-9p', '9P/Tempel 1', 'DES=9P;CAP;', 2.83, 0, 'sun'),
  // Farnham, Duxbury & Li (2005), PDS v2.1: geometric mean of the fitted
  // ellipsoid semi-axes. Approximate scale only; the unseen shape is not rendered.
  'comet-81p': body('comet-81p', '81P/Wild 2', 'DES=81P;CAP;', Math.cbrt(1.350 * 2.002 * 2.607), 0, 'sun'),
  // JPL Horizons physical block, solution JPL#36 (2021-Apr-13), retrieved 2026-09-07.
  vesta: body('vesta', 'Vesta', '4;', 261.385, 17.28828, 'sun'),
  // Body-owned Horizons physical blocks, retrieved 2026-09-07.
  eros: body('eros', 'Eros', '433;', 8.42, 0.0004463, 'sun'),
  itokawa: body('itokawa', 'Itokawa', '25143;', 0.165, 2.1e-9, 'sun'),
  bennu: body('bennu', 'Bennu', '101955;', 0.241, 0, 'sun'),
  ryugu: body('ryugu', 'Ryugu', '162173;', 0.448, 3e-8, 'sun'),
  ida: body('ida', 'Ida', '243;', 16, 0.00275, 'sun'),
  gaspra: body('gaspra', 'Gaspra', '951;', 6.1, 0, 'sun'),
  mathilde: body('mathilde', 'Mathilde', '253;', 26.4, 0.00689, 'sun'),
  lutetia: body('lutetia', 'Lutetia', '21;', 49, 0.1134, 'sun'),
  steins: body('steins', 'Steins', '2867;', 2.58, 0, 'sun'),

  // DART s547 GM and released encounter-mesh reference radii; body source records.
  didymos: body('didymos', 'Didymos', '65803;', .365, 3.51278e-8, 'sun'),
  dimorphos: body('dimorphos', 'Dimorphos', '120065803', .075, 3.02680e-10, 'didymos'),
  // MPCD2021 diameter/mass; Toutatis radar-mesh volume-equivalent radius.
  kleopatra: body('kleopatra', 'Kleopatra', '216;', 59.1, .1982, 'sun'),
  toutatis: body('toutatis', 'Toutatis', '4179;', 1.224, 0, 'sun'),
  // Vernazza et al. (2021), Table 1: mean ADAM/MPCD radii and masses; GM = G * mass.
  pallas: body('pallas', 'Pallas', '2;', 255.5, 13.6289206, 'sun'),
  hygiea: body('hygiea', 'Hygiea', '10;', 216.5, 5.8333382, 'sun'),
  juno: body('juno', 'Juno', '3;', 127, 1.802061, 'sun'),
  psyche: body('psyche', 'Psyche', '16;', 111.5, 1.5083918, 'sun'),

  interamnia: body('interamnia', 'Interamnia', '704;', 166, 2.3493536, 'sun'),
  davida: body('davida', 'Davida', '511;', 149, 1.7753638, 'sun'),
  sylvia: body('sylvia', 'Sylvia', '87;', 137, 0.9544249, 'sun'),
  eunomia: body('eunomia', 'Eunomia', '15;', 135, 2.0356615, 'sun'),
  euphrosyne: body('euphrosyne', 'Euphrosyne', '31;', 134, 1.1012595, 'sun'),
  bamberga: body('bamberga', 'Bamberga', '324;', 113.5, 0.6807786, 'sun'),
  fortuna: body('fortuna', 'Fortuna', '19;', 105.5, 0.5873384, 'sun'),
  themis: body('themis', 'Themis', '24;', 104, 0.4138066, 'sun'),
  amphitrite: body('amphitrite', 'Amphitrite', '29;', 102, 0.8476361, 'sun'),
  egeria: body('egeria', 'Egeria', '13;', 101, 0.6140355999999999, 'sun'),
  elektra: body('elektra', 'Elektra', '130;', 99.5, 0.4271552, 'sun'),
  iris: body('iris', 'Iris', '7;', 99.5, 0.9010305, 'sun'),
  hebe: body('hebe', 'Hebe', '6;', 97.5, 0.8276132, 'sun'),
  eugenia: body('eugenia', 'Eugenia', '45;', 94, 0.3871094, 'sun'),
  daphne: body('daphne', 'Daphne', '41;', 93.5, 0.4071323, 'sun'),
  eleonora: body('eleonora', 'Eleonora', '354;', 82.5, 0.5005725, 'sun'),
  nemesis: body('nemesis', 'Nemesis', '128;', 81.5, 0.2269262, 'sun'),
  kalliope: body('kalliope', 'Kalliope', '22;', 75, 0.5139211, 'sun'),
  nemausa: body('nemausa', 'Nemausa', '51;', 75, 0.2602977, 'sun'),
  parthenope: body('parthenope', 'Parthenope', '11;', 74.5, 0.3670865, 'sun'),
  melpomene: body('melpomene', 'Melpomene', '18;', 70.5, 0.3003435, 'sun'),
  julia: body('julia', 'Julia', '89;', 70, 0.2869949, 'sun'),
  victoria: body('victoria', 'Victoria', '12;', 58, 0.1802061, 'sun'),
  urania: body('urania', 'Urania', '30;', 44, 0.08676589999999999, 'sun'),

  'flora': body('flora', 'Flora', '8;', 73, 0.266972, 'sun'),
  'europa-52': body('europa-52', '52 Europa', '52;', 159.5, 1.5951577, 'sun'),
  'metis-9': body('metis-9', '9 Metis', '9;', 86.5, 0.533944, 'sun'),
  // DAMIT calibrated model radii; GM from the pinned Horizons physical blocks.
  'camilla': body('camilla', 'Camilla', '107;', 130, 0.7475, 'sun'),
  'thisbe': body('thisbe', 'Thisbe', '88;', 109, 0, 'sun'),
  'doris': body('doris', 'Doris', '48;', 105, 0, 'sun'),
  'hermione': body('hermione', 'Hermione', '121;', 100, 0, 'sun'),
  'diotima': body('diotima', 'Diotima', '423;', 104.5, 0, 'sun'),
  'herculina': body('herculina', 'Herculina', '532;', 94.5, 0, 'sun'),
  'nausikaa': body('nausikaa', 'Nausikaa', '192;', 47, 0, 'sun'),
  'astraea': body('astraea', 'Astraea', '5;', 56, 0, 'sun'),
  'irene': body('irene', 'Irene', '14;', 76.5, 0, 'sun'),
  'nysa': body('nysa', 'Nysa', '44;', 37.5, 0, 'sun'),
  'sappho': body('sappho', 'Sappho', '80;', 30.5, 0, 'sun'),

  // Published radar-model scales; GM unavailable in the pinned Horizons records.
  'betulia': body('betulia', 'Betulia', '1580;', 2.695, 0, 'sun'),
  'castalia': body('castalia', 'Castalia', '4769;', 0.542238, 0, 'sun'),
  'asteroid-1998-wt24': body('asteroid-1998-wt24', '1998 WT24', '33342;', 0.2075, 0, 'sun'),
  'asteroid-1994-cc': body('asteroid-1994-cc', '1994 CC Alpha', '136617;', 0.31, 0, 'sun'),

  // Calibrated model radii and paired Horizons physical records.
  'fides': body('fides', 'Fides', '37;', 59, 0, 'sun'),
  'penelope': body('penelope', 'Penelope', '201;', 42.5, 0, 'sun'),
  'alphonsina': body('alphonsina', 'Alphonsina', '925;', 29, 0, 'sun'),
  'angelina': body('angelina', 'Angelina', '64;', 26, 0, 'sun'),
  'ganymed': body('ganymed', 'Ganymed', '1036;', 19.5, 0, 'sun'),
  'moshup': body('moshup', 'Moshup', '66391;', 0.6585, 0, 'sun'),

  // Calibrated model radii and paired Horizons physical records.
  'cybele': body('cybele', 'Cybele', '65;', 156.5, 0, 'sun'),
  'aurora': body('aurora', 'Aurora', '94;', 99, 0, 'sun'),
  'palma': body('palma', 'Palma', '372;', 93.5, 0, 'sun'),
  'thule': body('thule', 'Thule', '279;', 58, 0, 'sun'),
  'hektor': body('hektor', 'Hektor', '624;', 87.5, 0, 'sun'),
  'hekate': body('hekate', 'Hekate', '100;', 43.5, 0, 'sun'),
  'phaethon': body('phaethon', 'Phaethon', '3200;', 2.55, 0, 'sun'),

  'harmonia': body('harmonia', 'Harmonia', '40;', 55.5, 0, 'sun'),
  'panopaea': body('panopaea', 'Panopaea', '70;', 64, 0, 'sun'),
  'desdemona-666': body('desdemona-666', '666 Desdemona', '666;', 14.2, 0, 'sun'),

  'asteroid-1950-da': body('asteroid-1950-da', '1950 DA', '29075;', 0.65, 0, 'sun'),

  'apophis': body('apophis', 'Apophis', '99942;', 0.17, 0, 'sun'),

  'donaldjohanson': body('donaldjohanson', 'Donaldjohanson', '52246;', 2.405325, 0, 'sun'),

  // Published radar-model scales; GM unavailable in the pinned Horizons records.
  'geographos': body('geographos', 'Geographos', '1620;', 1.284042, 0, 'sun'),
  'bacchus': body('bacchus', 'Bacchus', '2063;', 0.315, 0, 'sun'),
  'mithra': body('mithra', 'Mithra', '4486;', 0.845, 0, 'sun'),
  'nereus': body('nereus', 'Nereus', '4660;', 0.165, 0, 'sun'),
  'golevka': body('golevka', 'Golevka', '6489;', 0.265, 0, 'sun'),
  'yorp': body('yorp', 'YORP', '54509;', 0.0564, 0, 'sun'),

  // Published radar-model scales; use a documented primary mass where available.
  'asteroid-1996-hw1': body('asteroid-1996-hw1', '1996 HW1', '8567;', 1.01, 0, 'sun'),
  'asteroid-2008-ev5': body('asteroid-2008-ev5', '2008 EV5', '341843;', 0.2, 0, 'sun'),
  'ra-shalom': body('ra-shalom', 'Ra-Shalom', '2100;', 1.15, 0, 'sun'),
  'asteroid-1992-sk': body('asteroid-1992-sk', '1992 SK', '10115;', 0.5, 0, 'sun'),
  'asteroid-1998-ml14': body('asteroid-1998-ml14', '1998 ML14', '52760;', 0.5, 0, 'sun'),
  'asteroid-2002-ce26': body('asteroid-2002-ce26', '2002 CE26 Primary', '276049;', 1.73, 0.0000013014885, 'sun'),

  mercury: body('mercury', 'Mercury', '199', 2439.4, 22031.86855, 'sun'),
  venus: body('venus', 'Venus', '299', 6051.84, 324858.592, 'sun'),
  earth: body('earth', 'Earth', '399', 6371.01, 398600.435436, 'sun'),
  mars: body('mars', 'Mars', '499', 3389.92, 42828.375662, 'sun'),
  jupiter: body('jupiter', 'Jupiter', '599', 69911, 126686531.9, 'sun'),
  saturn: body('saturn', 'Saturn', '699', 58232, 37931206.234, 'sun'),
  uranus: body('uranus', 'Uranus', '799', 25362, 5793950.6103, 'sun'),
  neptune: body('neptune', 'Neptune', '899', 24624, 6835099.97, 'sun'),

  moon: body('moon', 'Moon', '301', 1737.4, 4902.800066, 'earth'),

  // Horizons publishes Phobos and Deimos as masses, not GM; these are
  // mass x G with G = 6.67430e-20 km^3 kg^-1 s^-2 (CODATA 2018).
  phobos: body('phobos', 'Phobos', '401', 11.08, 1.08e16 * 6.6743e-20, 'mars'),
  deimos: body('deimos', 'Deimos', '402', 6.2, 1.8e15 * 6.6743e-20, 'mars'),

  io: body('io', 'Io', '501', 1821.49, 5959.9155, 'jupiter'),
  europa: body('europa', 'Europa', '502', 1560.8, 3202.7121, 'jupiter'),
  ganymede: body('ganymede', 'Ganymede', '503', 2631.2, 9887.8328, 'jupiter'),
  callisto: body('callisto', 'Callisto', '504', 2410.3, 7179.2834, 'jupiter'),
  // JPL Horizons OBJ_DATA physical blocks, retrieved 2026-09-08.
  amalthea: body('amalthea', 'Amalthea', '505', 83.5, 0.1646, 'jupiter'),
  thebe: body('thebe', 'Thebe', '514', 49.3, 0.0301, 'jupiter'),
  adrastea: body('adrastea', 'Adrastea', '515', 8.2, 0.0001, 'jupiter'),
  metis: body('metis', 'Metis', '516', 21.5, 0.0025, 'jupiter'),

  // No measured GM is supplied for these small moons; zero means omitted mass.
  // Radii: Thomas2013/IAU2015 shapes, not an inferred density or invented mass.
  methone: body('methone', 'Methone', '632', 1.45, 0, 'saturn'),
  pallene: body('pallene', 'Pallene', '633', 2.23, 0, 'saturn'),
  mimas: body('mimas', 'Mimas', '601', 198.8, 2.503489, 'saturn'),
  enceladus: body('enceladus', 'Enceladus', '602', 252.3, 7.210367, 'saturn'),
  tethys: body('tethys', 'Tethys', '603', 536.3, 41.21, 'saturn'),
  dione: body('dione', 'Dione', '604', 562.5, 73.116, 'saturn'),
  rhea: body('rhea', 'Rhea', '605', 764.5, 153.94, 'saturn'),
  titan: body('titan', 'Titan', '606', 2575.5, 8978.14, 'saturn'),
  hyperion: body('hyperion', 'Hyperion', '607', 135, 0.37049, 'saturn'),
  iapetus: body('iapetus', 'Iapetus', '608', 734.5, 120.52, 'saturn'),
  phoebe: body('phoebe', 'Phoebe', '609', 106.5, 0.55479, 'saturn'),
  janus: body('janus', 'Janus', '610', 89.2, 0.12662, 'saturn'),
  epimetheus: body('epimetheus', 'Epimetheus', '611', 58.2, 0.03514, 'saturn'),
  helene: body('helene', 'Helene', '612', 18, 0.00048, 'saturn'),
  // Calypso radius: NASA profile; GM: Horizons target 614 OBJ_DATA.
  calypso: body('calypso', 'Calypso', '614', 10.7, 0.00024, 'saturn'),
  // Daphnis: WGCCRE radii 4.6 x 4.5 x 2.8 km; no published Horizons GM.
  daphnis: body('daphnis', 'Daphnis', '635', 3.8, 0, 'saturn'),
  // Telesto is absent from JPL's consolidated physical-parameters table;
  // Horizons' target 613 OBJ_DATA block gives GM 0.00048 km^3/s^2 and the
  // triaxial radii 16.3 x 11.8 x 9.8 km, whose geometric mean is 12.35 km.
  telesto: body('telesto', 'Telesto', '613', 12.35, 0.00048, 'saturn'),
  atlas: body('atlas', 'Atlas', '615', 15.1, 0.00037, 'saturn'),
  prometheus: body('prometheus', 'Prometheus', '616', 43.1, 0.01071, 'saturn'),
  pandora: body('pandora', 'Pandora', '617', 40.6, 0.00926, 'saturn'),
  pan: body('pan', 'Pan', '618', 14, 0.00028, 'saturn'),

  puck: body('puck', 'Puck', '715', 81, 0, 'uranus'),
  // Volume-equivalent radii of Karkoschka's published prolate shape fits.
  portia: body('portia', 'Portia', '712', 67.64856167757256, 0, 'uranus'),
  juliet: body('juliet', 'Juliet', '711', 46.82612683898881, 0, 'uranus'),
  belinda: body('belinda', 'Belinda', '714', 40.317473596635935, 0, 'uranus'),
  // Ring-dynamics mass estimates: French et al. 2024, Table 3 footnote b.
  // https://arxiv.org/abs/2401.04634; same published prolate radii as above.
  cordelia: body('cordelia', 'Cordelia', '706', 20.082988502465085, 0.00406, 'uranus'),
  ophelia: body('ophelia', 'Ophelia', '707', 21.361102076705983, 0.00238, 'uranus'),
  miranda: body('miranda', 'Miranda', '705', 235.7, 4.3, 'uranus'),
  ariel: body('ariel', 'Ariel', '701', 578.9, 83.43, 'uranus'),
  umbriel: body('umbriel', 'Umbriel', '702', 584.7, 85.4, 'uranus'),
  titania: body('titania', 'Titania', '703', 788.9, 222.8, 'uranus'),
  oberon: body('oberon', 'Oberon', '704', 761.4, 205.34, 'uranus'),

  triton: body('triton', 'Triton', '801', 1352.6, 1428.495, 'neptune'),
  proteus: body('proteus', 'Proteus', '808', 208, 2.58, 'neptune'),
  larissa: body('larissa', 'Larissa', '807', 96, 0.25484, 'neptune'),
  // Current Horizons GMs; Karkoschka ellipsoid dimensions belong to body sources.
  naiad: body('naiad', 'Naiad', '803', 29, 0.00853, 'neptune'),
  thalassa: body('thalassa', 'Thalassa', '804', 40, 0.02359, 'neptune'),
  despina: body('despina', 'Despina', '805', 74, 0.11673, 'neptune'),
  galatea: body('galatea', 'Galatea', '806', 88, 0.1899, 'neptune'),

  charon: body('charon', 'Charon', '901', 606, 106.10, 'pluto'),
  // PLU060 Horizons GMs (2024); radii match the sourced display shapes.
  // Nix/Hydra: Porter released meshes. Kerberos/Styx: Porter2025 fitted volumes.
  nix: body('nix', 'Nix', '902', 18.265603887767425, 0.001496, 'pluto'),
  hydra: body('hydra', 'Hydra', '903', 18.11455731342771, 0.00201, 'pluto'),
  kerberos: body('kerberos', 'Kerberos', '904', 4.75, 0.00006038, 'pluto'),
  styx: body('styx', 'Styx', '905', 3.5, 0.0000405, 'pluto'),

  // Dwarf planets. `horizonsCode` is the exact string this package's Horizons
  // queries use (`generate-dwarf-planets.mjs`, `fetch-fixtures.mjs`) — for
  // Ceres, Eris, Haumea and Makemake that is a small-body designation with a
  // trailing `;`, not a major-body number, because none of them has one.
  //
  // Pluto and Ceres have an `OBJ_DATA` physical block, so `meanRadiusKm` and
  // `gravitationalParameterKm3PerS2` are transcribed the same way as every
  // planet above. Eris, Haumea and Makemake do not — Horizons carries no mass
  // or size for them — so those three cite the literature directly:
  //   eris:     mean radius 1163 km, sphere to the occultation's precision
  //             (Sicardy et al. 2011, Nature 478, 493); mass 1.67e22 kg
  //             (same paper, from Dysnomia's orbit); GM = mass x G with
  //             G = 6.67430e-20 km^3 kg^-1 s^-2 (CODATA 2018), as for Phobos
  //             and Deimos above.
  //   haumea:   markedly NOT spherical — see `bodyShapes.ts` for the triaxial
  //             figure (1161 x 852 x 513 km, Ortiz et al. 2017, Nature 550,
  //             219). `meanRadiusKm` here is `(a^2 c)^(1/3)` = 797.6 km, the
  //             volumetric mean the frame-capture rule wants, NOT a width.
  //             Mass 4.006e21 kg (Ragozzine & Brown 2009, AJ 137, 4766).
  //   makemake: modelled as an oblate spheroid, equatorial 751 km / polar
  //             715 km (Ortiz et al. 2012, Nature 491, 566, from a stellar
  //             occultation); `meanRadiusKm` is the volumetric mean of that,
  //             738.8 km. GM = 278 km^3/s^2 (Parker et al. 2025, from the
  //             satellite MK2's orbit — arXiv:2509.05880 — superseding the
  //             2016 discovery paper's cruder value).
  pluto: body('pluto', 'Pluto', '999', 1188.3, 869.326, 'sun'),
  ceres: body('ceres', 'Ceres', '1;', 469.7, 62.6284, 'sun'),
  eris: body('eris', 'Eris', '136199;', 1163, 1.67e22 * 6.6743e-20, 'sun'),
  haumea: body('haumea', 'Haumea', '136108;', 797.6, 4.006e21 * 6.6743e-20, 'sun'),
  makemake: body('makemake', 'Makemake', '136472;', 738.8, 278, 'sun'),
}

export const BODY_IDS = Object.keys(BODIES) as readonly BodyId[]

export const bodyData = (id: BodyId): BodyData => {
  const data = BODIES[id]
  if (!data) throw new Error(`unknown body: ${id}`)
  return data
}

/**
 * Ids of the moons this package places around each planet, in declaration
 * order. Precomputed rather than filtered on demand: `solarSystem.ts` asks for
 * it once per planet per simulation tick, and a `filter` there would allocate
 * eight arrays a frame to answer a question about static data.
 */
const MOONS_OF = new Map<BodyId, readonly BodyId[]>(
  BODY_IDS.map(parent => [parent, BODY_IDS.filter(id => BODIES[id].parent === parent && parent !== 'sun')]),
)

export const moonsOf = (parent: BodyId): readonly BodyId[] => MOONS_OF.get(parent)!

/**
 * GM of a planet plus every moon this package carries for it — the mass that
 * VSOP87's "planet" actually is, since VSOP87 integrates each planetary system
 * as one body.
 *
 * It is not the true system GM: the moons left out (Jupiter's 90-odd outer
 * irregulars, and most of Saturn's small moons) are together under 1e-7 of any
 * system, which moves the Sun's barycentric offset by well under a kilometre.
 */
const SYSTEM_GM: Record<PlanetId, number> = Object.fromEntries(
  PLANET_IDS.map((planet) => [
    planet,
    moonsOf(planet).reduce(
      (sum, id) => sum + bodyData(id).gravitationalParameterKm3PerS2,
      bodyData(planet).gravitationalParameterKm3PerS2,
    ),
  ]),
) as Record<PlanetId, number>

export const systemGravitationalParameterKm3PerS2 = (planet: PlanetId): number => SYSTEM_GM[planet]

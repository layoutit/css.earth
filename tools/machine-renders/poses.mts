import { Quaternion, Vector3 } from 'three';

export type Vector = [number, number, number];
export interface MachinePose {
  sourceSha256: string;
  facingFeature: string;
  sourceAxis: Vector;
  modelQuaternion: [number, number, number, number];
  evidence: { url: string; identification: string };
}

/** Screen right/up/toward-viewer coordinates. Down-left from the upper-right card. */
export const inwardDirection: Vector = [-0.8, -0.45, 0.45];

/** Authored illustration poses, visually matched to pinned models and mission diagrams.
 * Source axes identify a visible dish or optical opening, not calibrated flight frames.
 * Quaternions rotate the source model before lighting; no image rotation follows capture. */
export const machinePoses: Record<string, MachinePose> = {
  'cassini': {
    sourceSha256: 'f8bc110e23821021e99b88634843449cc8e98d86d0d8561c612c1cf0404e64e7',
    facingFeature: "Radar / high-gain dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.848399234791, -0.466483160423, -0.017914603695, 0.249582183702],
    evidence: { url: 'https://science.nasa.gov/mission/cassini/spacecraft/cassini-orbiter/radio-detection-and-ranging/radar-technical-write-up/', identification: "Use the visible opening of the large dish as the illustration front." },
  },
  'dawn': {
    sourceSha256: '411249aed791994b6a2014894ad6bd7ca0445dbcf6d5342af9edc5df988f04b7',
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 0, 1],
    modelQuaternion: [0.273127361384, -0.453099602563, -0.025525568038, 0.848204362166],
    evidence: { url: 'https://www.jpl.nasa.gov/images/pia12026-illustration-of-dawn-spacecraft-inside-view/', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'galileo': {
    sourceSha256: '43943ada671c17c31d07ddb220a95c302e0ca5c3ded6abda7935df2bae634877',
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.840690524284, -0.492123574677, -0.115506004170, 0.194196273463],
    evidence: { url: 'https://www.jpl.nasa.gov/news/press_kits/galileo-end.pdf#page=17', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'grail': {
    sourceSha256: '5fd82bb248b085ac3b448077d77cbcd532516ad627268c2fde32c5db5392de53',
    facingFeature: "MoonKAM nadir deck", sourceAxis: [0, 0, 1],
    modelQuaternion: [0.296476939609, -0.438177166977, -0.069902416308, 0.845704349530],
    evidence: { url: 'https://science.nasa.gov/mission/grail/', identification: "Moon-facing camera deck; the gravity-ranging link points to the other spacecraft." },
  },
  'hubble': {
    sourceSha256: 'e5ba4de15c7d359ac8fa1ab7e286aff42dec09c0fadae3db99252587f39fa384',
    facingFeature: "Telescope aperture", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.789657241177, -0.524059195449, -0.310714718152, 0.072524237637],
    evidence: { url: 'https://science.nasa.gov/mission/hubble/observatory/design/optics/', identification: "Open end of the main optical tube." },
  },
  'juno': {
    sourceSha256: '13f6bd48ff830a1890b21ef6e0182bb1043926feebb77af9733e7374b050367a',
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [-0.169117737989, 0.346067505501, 0.831565622977, 0.400168823144],
    evidence: { url: 'https://descanso.jpl.nasa.gov/DPSummary/Descanso16_Juno_RevA.pdf', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'lro': {
    sourceSha256: 'c868a65e36ed293476be3d05e7e60968778c5cf4b2a7aba8859fcc20242a0612',
    facingFeature: "Lunar observing instruments", sourceAxis: [0, 0, 1],
    modelQuaternion: [-0.422661200534, -0.318206403052, 0.841100586337, 0.112481101893],
    evidence: { url: 'https://svs.gsfc.nasa.gov/10408/', identification: "Optical openings on the instrument cluster beside the bus." },
  },
  'magellan': {
    sourceSha256: '8a7f61e467309865fb2bb3fc3b2d3efbc0898d9e15eb6afb2fd743b7cd9f5084',
    facingFeature: "Radar antenna", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.824337466787, -0.386367893191, 0.201419799103, 0.361410648005],
    evidence: { url: 'https://science.nasa.gov/mission/magellan/', identification: "Radar uses the large high-gain dish." },
  },
  'mars-global-surveyor': {
    sourceSha256: '8812c97f2c147e409e883d5196377d596df84de87c08c1453e9e3cfaf082052f',
    facingFeature: "MOC/MOLA science deck", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.732040302959, -0.266590704802, 0.429207629784, 0.456976149808],
    evidence: { url: 'https://science.nasa.gov/mission/mars-global-surveyor/science-instruments/', identification: "Instrument apertures opposite the antenna-boom end." },
  },
  'messenger': {
    sourceSha256: 'c0268bfed0910e68a54c45925aea8edfc6e479d8131a849de7949252e01b9875',
    facingFeature: "MDIS/MLA instrument deck", sourceAxis: [0, 1, 0],
    modelQuaternion: [-0.528094752800, 0.489987266672, 0.664242520985, 0.199525145982],
    evidence: { url: 'https://www.nasa.gov/wp-content/uploads/2015/04/525164main_mercurymoi_pk.pdf', identification: "Apertures opposite the large engine nozzle, distinct from the heat shield." },
  },
  'mro': {
    sourceSha256: 'b195c566d227dec8e42ca2fafcc2a8cc26a127e04ed577e4b9515199d2002d9e',
    facingFeature: "HiRISE science deck", sourceAxis: [0, -1, 0],
    modelQuaternion: [0.097148676431, 0.544768125266, -0.520057631468, 0.650638059381],
    evidence: { url: 'https://science.nasa.gov/mission/mars-reconnaissance-orbiter/science-instruments/', identification: "Main telescope lens plane faces negative Y in the source model." },
  },
  'near-shoemaker': {
    sourceSha256: 'f3de2f87c97685b207be97e80d7cdca37d1567dd68204e1feb2d85f90e3adb0c',
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [-0.297339126118, -0.081361278746, -0.794790311151, -0.522760124436],
    evidence: { url: 'https://pds.nasa.gov/data/near-a-mag-3-rdr-earth-v1.0/nmerth_2001/document/mission.pdf', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'new-horizons': {
    sourceSha256: 'cf152d8cea17c4a83711041cb0d29ca1d980bfafa084ada2656569ea92cdd73f',
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.520353161895, -0.077864743140, 0.670324385298, 0.523292353428],
    evidence: { url: 'https://pluto.jhuapl.edu/Mission/Spacecraft.php', identification: "The large communication dish supplies the visual facing direction." },
  },
  'odyssey': {
    sourceSha256: 'ac0faa8dbfb54aabcbe3d06886c3d98dd29d120fd49b1c9fa6abbfbed22b049a',
    facingFeature: "High-gain antenna dish", sourceAxis: [-1, 0, 0],
    modelQuaternion: [-0.408857549103, 0.109175259119, 0.311107653974, 0.850957281523],
    evidence: { url: 'https://www.jpl.nasa.gov/news/press_kits/odysseylaunch.pdf', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'osiris-rex': {
    sourceSha256: 'ef8e0429ee4dd8e918908923d5efdc6d3576b9216cc8e16533b50dd28c196bca',
    facingFeature: "High-gain antenna dish", sourceAxis: [1, 0, 0],
    modelQuaternion: [0.290133298810, -0.270327351726, 0.904552880347, -0.156620172665],
    evidence: { url: 'https://science.nasa.gov/mission/osiris-rex/science-instruments/', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'rosetta': {
    sourceSha256: '56b3325b9ff45da5a03ba0c13b548b59de979c83ec3738085183d7dd1029fb76',
    facingFeature: "OSIRIS science face", sourceAxis: [0, 0, -1],
    modelQuaternion: [0.837465012355, 0.136947244227, 0.496924482735, -0.181559532491],
    evidence: { url: 'https://www.esa.int/ESA_Multimedia/Images/2013/12/Rosetta_s_instruments_black_background', identification: "Optical openings on the face opposite the launch adapter." },
  },
  'sdo': {
    sourceSha256: '8ce4607bd65f098eee22f02717a182d6721610c940a961511dfbca832a3eda95',
    facingFeature: "AIA telescope apertures", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.799110407901, -0.521496684794, -0.285525393976, 0.089101139884],
    evidence: { url: 'https://sdo.gsfc.nasa.gov/mission/spacecraft.php', identification: "Four telescope apertures at the end of the long spacecraft body." },
  },
  'suomi-npp': {
    sourceSha256: '885278277ed8fa864368803b7da2046292754bff01033055d56fe86e8b951ee4',
    facingFeature: "Earth-facing instrument deck", sourceAxis: [-1, 0, 0],
    modelQuaternion: [-0.481990138908, -0.319491531217, -0.081439370362, -0.811774781840],
    evidence: { url: 'https://svs.gsfc.nasa.gov/vis/a010000/a010700/a010742/NPPInstruments.html', identification: "Sensor openings on the instrument deck, distinct from the opposite electronics face." },
  },
  'terra': {
    sourceSha256: '8794857595f7a7d416184fe926ecb50e11bf267dbe471d1cf2728a85e8d017fa',
    facingFeature: "Earth-facing instrument deck", sourceAxis: [0, -1, 0],
    modelQuaternion: [-0.518319837353, -0.807981474587, 0.106029956078, 0.259361005830],
    evidence: { url: 'https://terra.nasa.gov/about/terra-instruments', identification: "Instrument apertures on the nadir side, opposite the flat zenith panels." },
  },
  'voyager-1': {
    sourceSha256: '4f8c8299c7259a5870f009c401967cd667e2741640cbead4ccb15c774545b5f3',
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [-0.169253524047, -0.162193165141, -0.831537996256, -0.503578377774],
    evidence: { url: 'https://science.nasa.gov/mission/voyager/spacecraft/', identification: "The large communication dish supplies the visual facing direction." },
  },
  'voyager-2': {
    sourceSha256: '4f8c8299c7259a5870f009c401967cd667e2741640cbead4ccb15c774545b5f3',
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [-0.169253524047, -0.162193165141, -0.831537996256, -0.503578377774],
    evidence: { url: 'https://science.nasa.gov/mission/voyager/spacecraft/', identification: "Same source model and dish-facing pose as Voyager 1." },
  },
};

export function getMachinePose(id: string, sourceSha256: string): MachinePose {
  const pose = machinePoses[id];
  if (!pose || pose.sourceSha256 !== sourceSha256) throw new Error(`Unreviewed machine pose or source: ${id}`);
  const q = new Quaternion(...pose.modelQuaternion);
  const aim = new Vector3(...pose.sourceAxis).normalize().applyQuaternion(q);
  if (Math.abs(q.length() - 1) > 1e-8 || aim.distanceTo(new Vector3(...inwardDirection).normalize()) > 1e-8) {
    throw new Error(`Invalid inward machine pose: ${id}`);
  }
  return pose;
}

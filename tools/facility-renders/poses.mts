import { Quaternion, Vector3 } from 'three';

export type Vector = [number, number, number];
export interface FacilityPose {
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
export const facilityPoses: Record<string, FacilityPose> = {
  'cassini': {
    facingFeature: "Radar / high-gain dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.848399234791, -0.466483160423, -0.017914603695, 0.249582183702],
    evidence: { url: 'https://science.nasa.gov/mission/cassini/spacecraft/cassini-orbiter/radio-detection-and-ranging/radar-technical-write-up/', identification: "Use the visible opening of the large dish as the illustration front." },
  },
  'dawn': {
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 0, 1],
    modelQuaternion: [0.273127361384, -0.453099602563, -0.025525568038, 0.848204362166],
    evidence: { url: 'https://www.jpl.nasa.gov/images/pia12026-illustration-of-dawn-spacecraft-inside-view/', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'galileo': {
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.840690524284, -0.492123574677, -0.115506004170, 0.194196273463],
    evidence: { url: 'https://www.jpl.nasa.gov/news/press_kits/galileo-end.pdf#page=17', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'grail': {
    facingFeature: "MoonKAM nadir deck", sourceAxis: [0, 0, 1],
    modelQuaternion: [0.296476939609, -0.438177166977, -0.069902416308, 0.845704349530],
    evidence: { url: 'https://science.nasa.gov/mission/grail/', identification: "Moon-facing camera deck; the gravity-ranging link points to the other spacecraft." },
  },
  'hubble': {
    facingFeature: "Telescope aperture", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.789657241177, -0.524059195449, -0.310714718152, 0.072524237637],
    evidence: { url: 'https://science.nasa.gov/mission/hubble/observatory/design/optics/', identification: "Open end of the main optical tube." },
  },
  'juno': {
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [-0.169117737989, 0.346067505501, 0.831565622977, 0.400168823144],
    evidence: { url: 'https://descanso.jpl.nasa.gov/DPSummary/Descanso16_Juno_RevA.pdf', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'lro': {
    facingFeature: "Lunar observing instruments", sourceAxis: [0, 0, 1],
    modelQuaternion: [-0.422661200534, -0.318206403052, 0.841100586337, 0.112481101893],
    evidence: { url: 'https://svs.gsfc.nasa.gov/10408/', identification: "Optical openings on the instrument cluster beside the bus." },
  },
  'magellan': {
    facingFeature: "Radar antenna", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.824337466787, -0.386367893191, 0.201419799103, 0.361410648005],
    evidence: { url: 'https://science.nasa.gov/mission/magellan/', identification: "Radar uses the large high-gain dish." },
  },
  'mars-global-surveyor': {
    facingFeature: "MOC/MOLA science deck", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.732040302959, -0.266590704802, 0.429207629784, 0.456976149808],
    evidence: { url: 'https://science.nasa.gov/mission/mars-global-surveyor/science-instruments/', identification: "Instrument apertures opposite the antenna-boom end." },
  },
  'messenger': {
    facingFeature: "MDIS/MLA instrument deck", sourceAxis: [0, 1, 0],
    modelQuaternion: [-0.528094752800, 0.489987266672, 0.664242520985, 0.199525145982],
    evidence: { url: 'https://www.nasa.gov/wp-content/uploads/2015/04/525164main_mercurymoi_pk.pdf', identification: "Apertures opposite the large engine nozzle, distinct from the heat shield." },
  },
  'mro': {
    facingFeature: "HiRISE science deck", sourceAxis: [0, -1, 0],
    modelQuaternion: [0.097148676431, 0.544768125266, -0.520057631468, 0.650638059381],
    evidence: { url: 'https://science.nasa.gov/mission/mars-reconnaissance-orbiter/science-instruments/', identification: "Main telescope lens plane faces negative Y in the source model." },
  },
  'near-shoemaker': {
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [-0.297339126118, -0.081361278746, -0.794790311151, -0.522760124436],
    evidence: { url: 'https://pds.nasa.gov/data/near-a-mag-3-rdr-earth-v1.0/nmerth_2001/document/mission.pdf', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'new-horizons': {
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.520353161895, -0.077864743140, 0.670324385298, 0.523292353428],
    evidence: { url: 'https://pluto.jhuapl.edu/Mission/Spacecraft.php', identification: "The large communication dish supplies the visual facing direction." },
  },
  'odyssey': {
    facingFeature: "High-gain antenna dish", sourceAxis: [-1, 0, 0],
    modelQuaternion: [-0.408857549103, 0.109175259119, 0.311107653974, 0.850957281523],
    evidence: { url: 'https://www.jpl.nasa.gov/news/press_kits/odysseylaunch.pdf', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'osiris-rex': {
    facingFeature: "High-gain antenna dish", sourceAxis: [1, 0, 0],
    modelQuaternion: [0.290133298810, -0.270327351726, 0.904552880347, -0.156620172665],
    evidence: { url: 'https://science.nasa.gov/mission/osiris-rex/science-instruments/', identification: "Use the prominent communication dish as the visual front; retain the source articulation." },
  },
  'rosetta': {
    facingFeature: "OSIRIS science face", sourceAxis: [0, 0, -1],
    modelQuaternion: [0.837465012355, 0.136947244227, 0.496924482735, -0.181559532491],
    evidence: { url: 'https://www.esa.int/ESA_Multimedia/Images/2013/12/Rosetta_s_instruments_black_background', identification: "Optical openings on the face opposite the launch adapter." },
  },
  'sdo': {
    facingFeature: "AIA telescope apertures", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.799110407901, -0.521496684794, -0.285525393976, 0.089101139884],
    evidence: { url: 'https://sdo.gsfc.nasa.gov/mission/spacecraft.php', identification: "Four telescope apertures at the end of the long spacecraft body." },
  },
  'suomi-npp': {
    facingFeature: "Earth-facing instrument deck", sourceAxis: [-1, 0, 0],
    modelQuaternion: [-0.481990138908, -0.319491531217, -0.081439370362, -0.811774781840],
    evidence: { url: 'https://svs.gsfc.nasa.gov/vis/a010000/a010700/a010742/NPPInstruments.html', identification: "Sensor openings on the instrument deck, distinct from the opposite electronics face." },
  },
  'terra': {
    facingFeature: "Earth-facing instrument deck", sourceAxis: [0, -1, 0],
    modelQuaternion: [-0.518319837353, -0.807981474587, 0.106029956078, 0.259361005830],
    evidence: { url: 'https://terra.nasa.gov/about/terra-instruments', identification: "Instrument apertures on the nadir side, opposite the flat zenith panels." },
  },
  'voyager-1': {
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [-0.169253524047, -0.162193165141, -0.831537996256, -0.503578377774],
    evidence: { url: 'https://science.nasa.gov/mission/voyager/spacecraft/', identification: "The large communication dish supplies the visual facing direction." },
  },
  'voyager-2': {
    facingFeature: "High-gain antenna dish", sourceAxis: [0, 1, 0],
    modelQuaternion: [-0.169253524047, -0.162193165141, -0.831537996256, -0.503578377774],
    evidence: { url: 'https://science.nasa.gov/mission/voyager/spacecraft/', identification: "Same source model and dish-facing pose as Voyager 1." },
  },
};

export function getFacilityPose(id: string): FacilityPose {
  const pose = facilityPoses[id];
  if (!pose) throw new Error(`Unreviewed facility pose: ${id}`);
  const q = new Quaternion(...pose.modelQuaternion);
  const aim = new Vector3(...pose.sourceAxis).normalize().applyQuaternion(q);
  if (Math.abs(q.length() - 1) > 1e-8 || aim.distanceTo(new Vector3(...inwardDirection).normalize()) > 1e-8) {
    throw new Error(`Invalid inward facility pose: ${id}`);
  }
  return pose;
}

type Decision = { decision: string; reason: string; plans: number[] };
const candidate = (plans: number[], reason: string): Decision => ({
  decision: "qualification-first",
  reason,
  plans,
});
export function screen(key: string, title: string, target: string): Decision {
  const t = (key + " " + title).toLowerCase();
  if (/\bmars\b|viking|nozomi/.test(t) || target.toLowerCase() === "mars")
    return {
      decision: "deferred-mars",
      reason:
        "Mars retained in the catalogue and deferred under the requested scope.",
      plans: [],
    };
  if (/kibo-pm|kibopm/.test(t))
    return {
      decision: "outside-current-scope",
      reason:
        "Microgravity laboratory experiment; no celestial-body measurement proposed for cssEarth.",
      plans: [],
    };
  if (
    /spice|orbit data|trajectory|tracking data|housekeeping|house keeping|documentation|ground calibration|calibration images|in-flight calibration|instrument temperatures|engineering|navigation files|maneuver acceleration|small forces|\bcontext collection|xml schema|document collection|ancillary|dark image|background data|trend data|calibration collection|calibration data/.test(
      t,
    )
  )
    return {
      decision: "support-data",
      reason:
        "Navigation, calibration, engineering or documentation support. Retain for the related science acquisition; not a separate display dataset.",
      plans: [],
    };
  const rules: [RegExp, number[], string][] = [
    [
      /hisaki/,
      [108],
      "Hisaki ultraviolet source: distinguish target, auroral emission and coma/torus emission; the multi-target archive includes non-Mars opportunities.",
    ],
    [
      /lucy/,
      [129],
      "Lucy encounter data: retain target, processing level and encounter date; partially processed images still need their calibration.",
    ],
    [
      /dart_|pds4-dart|liciacube/,
      [130],
      "DART impact record: distinguish imaging, ejecta photometry, shape models and orbital measurements.",
    ],
    [
      /epoxi-exoplanets/,
      [131],
      "EPOCh transit observations: calibrate host-star photometry and preserve timing, systematics and uncertainties.",
    ],
    [
      /shoemaker|sl9/,
      [42],
      "Shoemaker-Levy 9 observation: select dated impacts and identify the measured signal before a Jupiter comparison.",
    ],
    [
      /dif-e-|epoxi.*earth/,
      [60],
      "Historical Earth observations: retain observation time and calibrated quantity; compare with the Galileo scope.",
    ],
    [
      /lab |laboratory|icespec|classe/,
      [87],
      "Laboratory reference: preserve sample/material identity and conditions; it is not a directly observed planetary map.",
    ],
    [
      /new horizons|pds4-nh_|nh-[a-z_]+-/,
      [88, 105, 106],
      "New Horizons source: compare native IDs and selected OPUS inputs; PDS4 conversion is not new science. Route by target and instrument before implementation.",
    ],
    [
      /sln-l-lmag/,
      [111],
      "Lunar magnetic measurements: check component, altitude and inversion assumptions.",
    ],
    [
      /sln-l-grs/,
      [112],
      "Lunar gamma-ray records: distinguish intensity, energy spectra and derived elemental abundance.",
    ],
    [
      /sln-l-lrs/,
      [113],
      "Lunar radar or wave record: identify the physical quantity and ground track before selecting a map/profile.",
    ],
    [
      /apollo/,
      [114],
      "Apollo seismic record: verify numeric samples, time base, station and instrument response.",
    ],
    [
      /vco-000(14|15|20)|vco-00800/,
      [115],
      "Venus wind/profile record: retain observation time, altitude interpretation and quality flags.",
    ],
    [
      /vco-|akatsuki/,
      [107],
      "Akatsuki cloud data extend the existing Venus observation proposal. Venus already has a selected UVI exposure; compare before adding.",
    ],
    [
      /hinode|yohkoh|hinotori/,
      [116],
      "Solar observation: inspect processing level and dated footprint; local scans cannot represent the entire Sun.",
    ],
    [
      /sln-e-|akebono|erg-|arase|geotail|imap-|reimei|ohzora|jikiken|kyokko|soundingrockets|sedaap|calet|taiyo/,
      [123],
      "Earth/space-environment observation: retain time and observation coordinates; use an existing chart or image capability.",
    ],
    [
      /glims|smiles/,
      [52],
      "Earth atmospheric observation: qualify native measurements and vertical or line-of-sight sampling.",
    ],
    [
      /sln-l-pace|sln-l-rs-|sln-l-ard/,
      [127],
      "Lunar particles or plasma observation: retain units, sampling and geometry.",
    ],
    [
      /sln-l-mi-|sln-l-sp-|selene-sp/,
      [9],
      "Kaguya reflected-light data extend the existing spectral-band proposal; compare selected releases and coverage.",
    ],
    [
      /sln-l-rise/,
      [46],
      "Lunar gravity source extends the existing gravity proposal; preserve model normalization and covariance.",
    ],
    [
      /sln-l-tc-|sln-l-lalt/,
      [10, 28],
      "Lunar imagery/topography source: compare with current prepared inputs; do not change Moon geometry.",
    ],
    [
      /sln-l-e-hdtv/,
      [94],
      "Historical Earth/Moon camera source: verify calibration and useful coverage.",
    ],
    [
      /slim/,
      [125],
      "Mission-level lead only; locate a released calibrated product before starting implementation.",
    ],
    [
      /curation-|tanpopo/,
      [87],
      "Physical sample record: useful laboratory context; do not infer an asteroid-wide composition map from one sample.",
    ],
    [
      /hayabusa-xrs/,
      [126],
      "Itokawa X-ray source needs calibration and solar-reference checks.",
    ],
    [
      /hay-a-nirs|hayabusa-nirs/,
      [82],
      "Itokawa near-infrared measurements extend the existing NIRS proposal.",
    ],
    [
      /hay-a-|hayabusa-(?!2)/,
      [14],
      "Itokawa source: compare native IDs and selected shape/image inputs before counting new science.",
    ],
    [
      /hyb2-004|hayabusa2-nir/,
      [13],
      "Ryugu NIRS3 source: compare with PSI mirror and current thermal-correction investigation.",
    ],
    [
      /hyb2-003|hayabusa2-tir/,
      [83],
      "Ryugu thermal source: compare native release with PSI and preserve observation time/geometry.",
    ],
    [
      /hyb2-010/,
      [84],
      "MASCOT local radiometer data extend the local-temperature proposal.",
    ],
    [
      /hyb2-009/,
      [85],
      "MASCOT magnetic data extend the measured-magnetic-constraints proposal.",
    ],
    [
      /hyb2-|hayabusa2/,
      [90],
      "Ryugu mission source: reconcile native identifiers with PSI; archive packaging is not new imagery.",
    ],
    [
      /akari.*(acua|astflux)/,
      [17, 20],
      "AKARI asteroid catalogue: select diameter/albedo, flux or spectra by the product, preserving model assumptions.",
    ],
    [
      /akari|irts|bice/,
      [75, 76],
      "Infrared sky source: qualify the actual catalogue, image or spectrum and its calibration/coverage.",
    ],
    [
      /asca|ginga|hakucho|hitomi|suzaku|tenma|xrism|maxi|vsop|vlba/,
      [124],
      "High-energy or radio archive: separate calibrated products from raw events, response/backgrounds and quicklooks.",
    ],
    [
      /ro-.*virtis|ro-.*miro/,
      [117],
      "Rosetta infrared/microwave source: distinguish nucleus and coma, calibration release and dated footprint.",
    ],
    [
      /ro-.*(rosina|alice|gia-|cosima|midas)/,
      [118],
      "Rosetta gas/dust source: retain sensor, processing level, time and sampled location.",
    ],
    [
      /consert|ro-.*rsi/,
      [120],
      "Rosetta radio observation: session inventory is not a derived gravity/interior measurement.",
    ],
    [
      /rl-.*(mupus|sesame|romap|cosac|ptolemy|rolis|civa|sd2)/,
      [119],
      "Philae local record: instrument state and landing/contact history limit interpretation.",
    ],
    [
      /ro-.*(osinac|osiwac|navcam)/,
      [128],
      "Rosetta image source: compare target and native registration before selecting a dated surface comparison.",
    ],
    [
      /ro-.*rpc/,
      [118],
      "Rosetta plasma measurement: retain spacecraft location and time; distinguish plasma from neutral gas and surface composition.",
    ],
    [
      /tempel/,
      [45],
      "Deep Impact/Tempel record extends P45; identify the actual target and encounter before selecting an image or temperature map.",
    ],
    [
      /hartley|dif-c-|dii-c-|wild.?2|borrelly|halley|sdu-|ds1-|gio-|suisei|sakigake|sakig-/,
      [121],
      "Historical comet encounter record: verify calibration, target and usable footprint before a body or chart implementation.",
    ],
    [
      /ihw-|comet|bopps/,
      [122],
      "Comet/ground-based record: compare aperture, calibration and observing geometry before a time-series or spectral chart.",
    ],
    [
      /msx|spirit3/,
      [89],
      "MSX source extends the existing calibrated-infrared proposal.",
    ],
    [
      /spectr|taxonomy/,
      [20],
      "Small-body spectral source: preserve wavelength units and observational or laboratory classification.",
    ],
    [
      /lightcurve|rotation|bsgc/,
      [18],
      "Small-body observation: distinguish astrometry, photometry and derived rotation period before updating facts.",
    ],
    [
      /diameter|albedo/,
      [17],
      "Small-body size/reflectivity source: retain the physical model and uncertainty.",
    ],
    [
      /polarim|phase curve|color/,
      [22],
      "Small-body photometric source: qualify bands, phase angle and calibration.",
    ],
    [
      /asteroid|steins|lutetia/,
      [90],
      "Small-body archive: compare current packages and selected native inputs before treating this as additional coverage.",
    ],
  ];
  for (const [re, p, why] of rules) if (re.test(t)) return candidate(p, why);
  return {
    decision: "needs-review",
    reason:
      "Catalogue metadata retained. No justified implementation scope assigned yet; inspect the native product and compare with current packages.",
    plans: [],
  };
}

// Entry script: node packages/bake/cli/astronomy-data-collect-opus-review.mts. OPUS pipeline stage: a proposed
// decision and reason for each instrument/target sample, into OPUS_WORK_DIR; the shared client is in
// @cssearth/bake/sources/astronomy-data.
import { readFile, writeFile } from "node:fs/promises";
import { array, object, string, number, workDir } from "@cssearth/bake/sources/astronomy-data";
const root = workDir;
const rows = array(
  JSON.parse(await readFile(root + "/samples.json", "utf8")),
).map(object);
const saturnMoons = new Set(
  "Aegaeon Anthe Atlas Calypso Daphnis Dione Enceladus Epimetheus Helene Hyperion Iapetus Janus Methone Mimas Pallene Pan Pandora Phoebe Polydeuces Prometheus Rhea Telesto Tethys Titan".split(
    " ",
  ),
);
const irregular = new Set(
  "Albiorix Bebhionn Bergelmir Bestla Erriapus Fornjot Greip Hati Hyrrokkin Ijiraq Jarnsaxa Kari Kiviuq Loge Mundilfari Narvi Paaliaq Siarnaq Skathi Skoll Surtur Suttungr Tarqeq Tarvos Thrymr Ymir Himalia Elara Callirrhoe"
    .split(" ")
    .concat(["S/2004 S 12", "S/2004 S 13"]),
);
const uranian = new Set(
  "Ariel Miranda Umbriel Titania Oberon Puck Cupid Mab Belinda Bianca Cordelia Cressida Desdemona Juliet Ophelia Perdita Portia Rosalind".split(
    " ",
  ),
);
const neptunian = new Set(
  "Triton Proteus Nereid Larissa Naiad Thalassa Despina Galatea".split(" "),
);
const small = new Set(
  "Arawn Chariklo Chiron Eris Haumea Huya Ixion Makemake Manwe Orcus Pholus Quaoar Sedna Varda Masursky Gaspra Ida"
    .split(" ")
    .concat(["Chariklo Ring"]),
);
const calibration = new Set([
  "Calibration",
  "Calibration Lamps",
  "Flatfield",
  "Dark",
  "Dark Sky",
  "Black Sky",
  "Plaque",
  "Acq-Eclpse",
]);
type Decision = { decision: string; reason: string; proposals: string[] };
const yes = (reason: string, ...proposals: string[]): Decision => ({
  decision: "qualification",
  reason,
  proposals,
});
const blocked = (reason: string, ...proposals: string[]): Decision => ({
  decision: "prior-limit",
  reason,
  proposals,
});
function review(i: string, t: string): Decision {
  if (t === "Mars")
    return {
      decision: "deferred-scope",
      reason:
        "Mars implementation is excluded. Retain this instrument-specific archive slice without proposing a Mars addition.",
      proposals: [],
    };
  if (calibration.has(t))
    return {
      decision: "calibration-support",
      reason:
        "The intended target identifies a calibration, detector-background or acquisition product. Retain for calibration of linked science observations; it does not itself establish a body map.",
      proposals: [],
    };
  if (["Unknown", "None", "Other", "System", "Sky"].includes(t))
    return {
      decision: "target-unresolved",
      reason:
        "The archive target is non-specific. Inspect observation purpose and the separate geometry slices before assigning a body. These rows are not evidence that useful observations are absent.",
      proposals: [],
    };
  if (t === "Solar Wind" || t === "Interstellar Medium")
    return {
      decision: "outside-current-proposals",
      reason:
        "The archived UVIS time series concern interplanetary/background signals. No supported surface, ring or existing chart addition was established in this screen; retain for a separately scoped heliophysics investigation.",
      proposals: [],
    };
  if (t === "Sun")
    return {
      decision: "event-review",
      reason:
        "Sun-targeted cruise/calibration and occultation observations are mixed. The label does not establish a useful solar surface map; inspect occulting body, observing mode and calibration purpose first.",
      proposals:
        i === "Cassini VIMS" || i === "Cassini UVIS" ? ["96", "109"] : [],
    };
  if (
    t === "Star" ||
    /^Alp |^Bet |^Gam |^Del |^Sig |^Tau |^HD |^CN Leo$|^The Car$/.test(t)
  )
    return {
      decision: "event-review",
      reason:
        "Stellar pointing can be calibration, stellar science or a planetary occultation. Follow the observation purpose and foreground-body geometry before accepting or rejecting it; do not paint the star onto a body.",
      proposals:
        i === "Cassini VIMS" || i === "Cassini UVIS" ? ["96", "109"] : [],
    };
  if (
    [
      "M7",
      "NGC 3532",
      "Necklace Nebula",
      "Orion",
      "Pleiades",
      "Scorpius",
      "Taurus",
      "Variable Stars in Milky Way Bulge",
    ].includes(t)
  )
    return yes(
      "The intended target is a sky source or field. Check calibrated signal, filters and observing purpose against the existing image-layer/sky proposals; many fields are calibration observations, not new planetary surfaces.",
      "76",
    );
  if (t === "Voyager 1")
    return {
      decision: "target-purpose-unresolved",
      reason:
        "The intended target is a spacecraft direction. This metadata alone does not establish a resolved spacecraft observation or a planetary dataset.",
      proposals: [],
    };
  if (t === "Dust")
    return yes(
      "Inspect the optical observation and its background before connecting it to the dust-content proposal. An image target called Dust is not a calibrated particle-detector count or dust-density map.",
      "86",
    );
  if (t === "Shoemaker Levy 9")
    return yes(
      "Preserve the dated comet/impact context in the Jupiter history work. Confirm whether each frame measures the comet, an impact site or a calibration field.",
      "42",
    );
  if (t === "Jupiter Rings")
    return yes(
      "Native reflected-light imaging can constrain a measured radial brightness profile. Resolve background, phase, radius and projection before replacing any schematic ring input.",
      "64",
    );
  if (t === "Saturn Rings")
    return yes(
      "Separate native occultation optical depth from reflected or thermal spectra. Date, wavelength, geometry and sampled radius determine whether this slice extends the current UVIS profile or the spectral proposal.",
      ...(/RSS|PPS|UVS|FOS/.test(i) || !/^Cassini|^Voyager|^Hubble/.test(i)
        ? ["96"]
        : ["96", "44"]),
    );
  if (t === "Uranus Rings")
    return yes(
      "Occultation profiles and ring images require different reductions. Preserve individual event geometry, sampling, uncertainty and radial limits before comparing with the current summary-table rings.",
      "97",
    );
  if (t === "Neptune Rings")
    return yes(
      "Determine whether this is a radial occultation or ring/arc imaging. Native segment limits and absolute arc longitudes must be established separately; no full-ring coverage follows from the target name.",
      "98",
    );
  if (t === "Earth" || t === "Moon")
    return yes(
      "Use the native historical observation as a separate epoch/band only if it adds supported information. Distant cruise photometry, slit spectra and raw detector images are not automatically global georeferenced maps.",
      t === "Earth" ? "60" : i === "Galileo SSI" ? "60" : "94",
    );
  if (t === "Venus")
    return yes(
      "Historical flyby imaging/spectra can test a dated cloud-band addition. Raw signal, cloud altitude, pointing and temporal coherence still require qualification.",
      "107",
    );
  if (t === "Jupiter")
    return yes(
      "Match a coherent observing program to dated clouds or an observed spectrum. Keep auroral, reflected-light and thermal signals distinct and compare against current OPAL dates.",
      "42",
      ...(/VIMS|UVIS|STIS|NICMOS/.test(i) ? ["108"] : []),
    );
  if (t === "Saturn")
    return yes(
      "Separate clouds, atmospheric spectra and thermal retrievals; current OPAL imagery already exists. CIRS spectra require radiometric/footprint interpretation before any claimed temperature map.",
      "43",
      ...(/CIRS|VIMS|UVIS|STIS|NICMOS/.test(i) ? ["108"] : []),
    );
  if (t === "Uranus")
    return yes(
      "Choose the physical measurement first: the ground-based/FOS records are atmospheric occultation light curves; imager and STIS records require dated cloud or spectral interpretation.",
      ...(!/^Cassini|^Voyager|^Hubble|^New Horizons/.test(i) ||
      i === "Hubble FOS"
        ? ["110"]
        : i === "Hubble STIS" || i === "Hubble NICMOS"
          ? ["108"]
          : ["102"]),
    );
  if (t === "Neptune")
    return yes(
      "Voyager imaging can extend the dated cloud proposal; Hubble and distant New Horizons records require comparison with current OPAL data and measured aperture/spectral information.",
      "59",
      ...(/STIS|NICMOS/.test(i) ? ["108"] : []),
    );
  if (t === "Titan")
    return yes(
      "Titan infrared surface, atmospheric spectra, seasonal temperature and dated clouds are separate measurements. Reuse the existing Titan proposals and preserve the VIMS registration/calibration blockers.",
      ...(i === "Cassini CIRS"
        ? ["34"]
        : i === "Cassini VIMS"
          ? ["33", "80"]
          : i === "Cassini UVIS" || i === "Hubble STIS"
            ? ["80"]
            : ["69"]),
    );
  if (t === "Pluto" || t === "Charon")
    return /^New Horizons/.test(i)
      ? yes(
          "Native encounter imagery can qualify individual MVIC bands, but intended-target indexing misses bodies elsewhere in a frame. Current controlled monochrome and enhanced-color products are the comparison baseline.",
          "105",
        )
      : yes(
          "These historical disk/photometry observations overlap the prior telescope-map proposal. Require actual spatial information or retain measured disk-integrated photometry; no reconstructed detailed surface from an unresolved source.",
          "56",
          "22",
        );
  if (["Nix", "Hydra", "Kerberos", "Styx"].includes(t))
    return blocked(
      "Native files exist, but the current body ledgers retain resolution, registration or mesh-frame blockers. OPUS metadata does not meet those reopen conditions; preserve exact IDs and seek genuinely new control evidence.",
      "106",
    );
  if (t === "Arrokoth")
    return {
      decision: "existing-family",
      reason:
        "Arrokoth already uses native LORRI and a derived MVIC cube. Compare exact source IDs with the current selected inputs; this screen establishes archive overlap, not an additional qualified surface.",
      proposals: [],
    };
  if (t === "2014 MU69")
    return yes(
      "This historical target name refers to Arrokoth; preserve the alias. Hubble discovery/photometry images do not replace the resolved New Horizons surface. Assess only measured photometry not already covered.",
      "18",
      "22",
    );
  if (["Io", "Europa", "Ganymede", "Callisto"].includes(t)) {
    if (i === "Cassini UVIS" || i.startsWith("Hubble"))
      return yes(
        "Inspect native UV/optical/infrared bandpass and observing mode. Separate atmospheric/auroral emission from reflected surface light; spectra and images need their own spatial qualification.",
        "101",
        ...(t === "Io" ? ["41"] : []),
      );
    if (i === "Cassini VIMS")
      return yes(
        "Cassini spectral cubes provide an alternative infrared source route within the existing moon spectroscopy work. Check resolved sampling and geometry; they do not remove NIMS-specific blockers by themselves.",
        t === "Europa"
          ? "11"
          : t === "Ganymede"
            ? "35"
            : t === "Callisto"
              ? "12"
              : "41",
      );
    return yes(
      "Use exact calibrated observation IDs to test an additional date or controlled regional coverage against the selected global mosaic. A raw-frame count does not establish a detail improvement.",
      t === "Io"
        ? "41"
        : t === "Europa"
          ? "55"
          : t === "Ganymede"
            ? "57"
            : "58",
    );
  }
  if (uranian.has(t))
    return blocked(
      "The major Uranian moons already have Voyager color. Numeric-band interpretation or added coverage needs independent calibration/control evidence beyond the current recipes; small unresolved moons stay photometric constraints.",
      "103",
    );
  if (neptunian.has(t))
    return blocked(
      "Triton and Proteus already use Voyager bands. Check current native IDs and reopen conditions before proposing more; unresolved observations of other moons are photometry, not detailed surface maps.",
      "104",
    );
  if (["Adrastea", "Amalthea", "Metis", "Thebe"].includes(t))
    return yes(
      "Resolve actual native sampling and compare with the current small-moon inputs. Additional photometry/phase coverage can fit the existing historical small-body work; no surface map follows from detector dimensions.",
      "90",
      "22",
    );
  if (saturnMoons.has(t)) {
    if (i === "Cassini CIRS")
      return yes(
        "Native heat-radiation spectra extend the existing Cassini moon-temperature proposal. Recover individual footprints, local time, calibration and temperature-retrieval assumptions; do not average distinct illumination states.",
        "37",
      );
    if (i === "Cassini VIMS")
      return t === "Enceladus"
        ? {
            decision: "existing-family",
            reason:
              "The Enceladus infrared mosaic is merged at the current audit baseline. These native cubes are potential provenance/coverage follow-up, not a second proposal to add the same infrared view.",
            proposals: [],
          }
        : yes(
            "Mimas/Hyperion are the clearest missing VIMS cases; several other moons already have infrared views. Require distinct measured bands or area gain against each selected source and retain raw-cube calibration/geometry limits.",
            "99",
          );
    if (i === "Cassini UVIS" || i === "Hubble STIS")
      return yes(
        "Qualify reflected ultraviolet spectra separately from background and exospheric signals. Unresolved data may support a prepared chart; the target tag does not establish a registered surface band.",
        "100",
        ...(t === "Enceladus" ? ["109"] : []),
      );
    if (t === "Atlas")
      return blocked(
        "The existing Atlas additional-coverage proposal retains its source/registration blocker. An OPUS listing alone does not reopen the rejected footprint.",
        "73",
      );
    return yes(
      "Extend the existing Saturn-moon photography proposal only if native IDs, registration and actual area coverage improve on the selected observations. Current shapes and scene geometry stay fixed.",
      "68",
    );
  }
  if (irregular.has(t) || small.has(t) || /^\d{4} /.test(t))
    return yes(
      "Retain calibrated disk-integrated brightness, colors or rotation sampling where supported. Establish the target aperture and phase first; detector dimensions and intended-target tags do not imply a resolved surface.",
      ...(i === "Cassini VIMS" || i === "Cassini UVIS"
        ? ["20", "22"]
        : ["18", "22"]),
      ...(["Gaspra", "Ida"].includes(t) ? ["90"] : []),
    );
  throw Error("Unreviewed target/instrument " + i + " / " + t);
}
const reviewed = rows.map((r) => {
  const instrument = string(r.instrument),
    target = string(r.target),
    d = review(instrument, target);
  return {
    ...r,
    instrument,
    target,
    count: number(r.count),
    id: encodeURIComponent(instrument) + "/" + encodeURIComponent(target),
    ...d,
  };
});
await writeFile(
  root + "/review.json",
  JSON.stringify(reviewed, null, 2) + "\n",
);
await writeFile(
  root + "/review.tsv",
  "instrument\ttarget\tcount\tdecision\tproposals\treason\n" +
    reviewed
      .map((r) =>
        [
          r.instrument,
          r.target,
          r.count,
          r.decision,
          r.proposals.join(","),
          r.reason,
        ].join("\t"),
      )
      .join("\n") +
    "\n",
);
const counts: Record<string, number> = {};
for (const r of reviewed) counts[r.decision] = (counts[r.decision] ?? 0) + 1;
console.log(
  JSON.stringify(
    {
      rows: reviewed.length,
      observations: reviewed.reduce((s, r) => s + number(r.count), 0),
      decisions: counts,
    },
    null,
    2,
  ),
);

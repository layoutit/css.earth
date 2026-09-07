// Small build-time attribution projection, checked against the object-owned
// source provenance by scene-sources.test.mjs. No source or prepared bank is
// imported into shell/browser execution.
const hygHref = 'https://github.com/astronexus/HYG-Database';
const hygLicenceHref = "https://codeberg.org/astronexus/hyg/raw/branch/main/data/hyg/CURRENT/LICENSE";
const sharedSources = Object.freeze([
  {
    "label": "NASA SVS",
    "role": "sky",
    "href": "https://svs.gsfc.nasa.gov/4851/",
    "description": "NASA Deep Star Maps 2020 — Milky Way-only celestial map. NASA/Goddard Space Flight Center Scientific Visualization Studio; Ernie Wright (USRA), visualizer; ESA/Gaia/DPAC, Gaia Data Release 2."
  },
  {
    "label": "OpenSpace",
    "role": "galaxy",
    "href": "https://docs.openspaceproject.com/latest/content/milky-way/galaxy/milky-way-volume/index.html",
    "description": "OpenSpace Milky Way volume. Jon Parker, Emil Axelsson, Carter Emmart, OpenSpace Team. National Astronomical Observatory of Japan (simulation); American Museum of Natural History (Dark Universe model); OpenSpace Project (volume adaptation)."
  },
  {
    "label": "HYG",
    "role": "stars",
    "href": "https://github.com/astronexus/HYG-Database",
    "description": "HYG Stellar Database by David Nash / Astronexus. Prepared derivatives licensed CC-BY-SA-4.0."
  },
  {
    "label": "IBEX",
    "role": "heliopause",
    "href": "https://doi.org/10.3847/1538-4365/abf658",
    "description": "Reisenfeld et al. (2021): IBEX-derived envelope, published Z–H model; tail distances are ENA sounding limits, not a measured heliopause closure."
  },
  {
    "label": "LVDB",
    "role": "galaxies",
    "href": "https://doi.org/10.33232/001c.144859",
    "description": "Pace (2025), The Local Volume Database, DOI 10.33232/001c.144859; release v1.1.1. Catalogue compilation: CC0 1.0; original measurement papers retain their separate rights."
  },
  {
    "label": "McConnachie",
    "role": "membership",
    "href": "https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/community/nearby/",
    "description": "McConnachie (2012), AJ 144, 4, DOI 10.1088/0004-6256/144/1/4; author October 2019 Table 1 membership classifications. LVDB host associations supplement this historical table."
  },
  {
    "label": "ESA/Hubble",
    "role": "M31 image",
    "href": "https://esahubble.org/images/heic1112f/",
    "description": "Wide-field view of the Andromeda Galaxy. ESA/Hubble & Digitized Sky Survey 2. Acknowledgment: Davide De Martin (ESA/Hubble). CC-BY-4.0. The observation is decomposed by local compactness into one high-frequency midplane residual and a diffuse component. Only diffuse optical depth is distributed through 32 normalized parametric slabs; cross-axis textures sample the same separable field. This is not measured per-pixel depth."
  },
  {
    "label": "ESO",
    "role": "M33 image",
    "href": "https://www.eso.org/public/images/eso1424a/",
    "description": "VST snaps a very detailed view of the Triangulum Galaxy. ESO. CC-BY-4.0. The observation is decomposed by local compactness into one high-frequency midplane residual and a diffuse component. Only diffuse optical depth is distributed through 32 normalized parametric slabs; cross-axis textures sample the same separable field. This is not measured per-pixel depth."
  },
  {
    "label": "NOIRLab",
    "role": "LMC image",
    "href": "https://noirlab.edu/public/images/noirlab2030a/",
    "description": "Deepest, widest view of the Large Magellanic Cloud from SMASH. CTIO/NOIRLab/NSF/AURA/SMASH/D. Nidever (Montana State University) Acknowledgment: Image processing: Travis Rector (University of Alaska Anchorage), Mahdi Zamani & Davide de Martin. CC-BY-4.0. The observation is decomposed by local compactness into one high-frequency midplane residual and a diffuse component. Only diffuse optical depth is distributed through 32 normalized parametric slabs; cross-axis textures sample the same separable field. This is not measured per-pixel depth."
  },
  {
    "label": "NOIRLab",
    "role": "SMC image",
    "href": "https://noirlab.edu/public/images/noirlab2030b/",
    "description": "Deepest, widest view of the Small Magellanic Cloud from SMASH. CTIO/NOIRLab/NSF/AURA/SMASH/D. Nidever (Montana State University) Acknowledgment: Image processing: Travis Rector (University of Alaska Anchorage), Mahdi Zamani & Davide de Martin. CC-BY-4.0. The observation is decomposed by local compactness into one high-frequency midplane residual and a diffuse component. Only diffuse optical depth is distributed through 32 normalized parametric slabs; cross-axis textures sample the same separable field. This is not measured per-pixel depth."
  },
  {
    "label": "MCXC-II",
    "role": "clusters",
    "href": "https://www.aanda.org/articles/aa/full_html/2024/08/aa49427-24/aa49427-24.html",
    "description": "Sadibekova et al. (2024), MCXC-II, A&A 688 A187; CDS J/A+A/688/A187. Seven cluster centres with redshift-derived comoving distances in the publication cosmology; peculiar velocities are not corrected. Outlines show the published R500 overdensity aperture, not a cluster boundary or member distribution."
  }
].map(Object.freeze));

/** Preserve object sources and append the shared environments once per source. */
export function sceneSources(resources = []) {
  const result = new Map();
  for (const resource of [...resources, ...sharedSources]) {
    // Shared world context suppresses the retired photographic sky leaves.
    // Other ESO sources and object-specific OpenSpace credits remain valid.
    if (isSupersededPanorama(resource.href)) continue;
    const key = sourceKey(resource.href);
    result.set(key, { ...result.get(key), ...resource });
  }
  return [...result.values()];
}

function isSupersededPanorama(href) {
  const url = new URL(href);
  return url.hostname.replace(/^www\./u, '') === 'eso.org' &&
    url.pathname.replace(/\/+$/u, '') === '/public/images/eso0932a';
}

function sourceKey(href) {
  const url = new URL(href);
  url.hash = '';
  const normalized = url.href.replace(/\/$/u, '');
  // Existing object content links the catalogue repository; the shared source
  // provenance records its licence URL. Both identify the same HYG source.
  return normalized === hygLicenceHref.replace(/\/$/u, '') ? hygHref : normalized;
}

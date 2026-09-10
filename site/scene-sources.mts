export interface SceneSource { label: string; role: string; href: string; description: string; credit?: string; }
// Small build-time attribution projection, checked against the object-owned
// source provenance by scene-sources.test.mjs. No source or prepared bank is
// imported into shell/browser execution. Compact credits serve the sidebar;
// full descriptions retain the scientific provenance and qualifications.
const hygHref = 'https://github.com/astronexus/HYG-Database';
const hygLicenceHref = "https://codeberg.org/astronexus/hyg/raw/branch/main/data/hyg/CURRENT/LICENSE";
const sharedSources = Object.freeze([
  {
    "label": "NASA SVS",
    "role": "sky",
    "credit": "Deep Star Maps 2020 · NASA/Goddard, Ernie Wright (USRA), ESA/Gaia/DPAC.",
    "href": "https://svs.gsfc.nasa.gov/4851/",
    "description": "NASA Deep Star Maps 2020 — Milky Way-only celestial map. NASA/Goddard Space Flight Center Scientific Visualization Studio; Ernie Wright (USRA), visualizer; ESA/Gaia/DPAC, Gaia Data Release 2."
  },
  {
    "label": "OpenSpace",
    "role": "galaxy",
    "credit": "Milky Way volume · Jon Parker, Emil Axelsson, Carter Emmart; NAOJ, AMNH & OpenSpace.",
    "href": "https://docs.openspaceproject.com/latest/content/milky-way/galaxy/milky-way-volume/index.html",
    "description": "OpenSpace Milky Way volume. Jon Parker, Emil Axelsson, Carter Emmart, OpenSpace Team. National Astronomical Observatory of Japan (simulation); American Museum of Natural History (Dark Universe model); OpenSpace Project (volume adaptation)."
  },
  {
    "label": "HYG",
    "role": "stars",
    "credit": "Star catalogue · David Nash / Astronexus · CC BY-SA 4.0.",
    "href": "https://github.com/astronexus/HYG-Database",
    "description": "HYG Stellar Database by David Nash / Astronexus. Prepared derivatives licensed CC-BY-SA-4.0."
  },
  {
    "label": "IBEX",
    "role": "heliopause",
    "credit": "Heliopause model · Reisenfeld et al. (2021).",
    "href": "https://doi.org/10.3847/1538-4365/abf658",
    "description": "Reisenfeld et al. (2021): IBEX-derived envelope, published Z–H model; tail distances are ENA sounding limits, not a measured heliopause closure."
  }
].map(source => Object.freeze(source)));

/** Preserve object sources and append the shared environments once per source. */
export function sceneSources(resources: readonly SceneSource[] = []) {
  const result = new Map<string, SceneSource>();
  for (const resource of [...resources, ...sharedSources]) {
    // Shared world context suppresses the retired photographic sky leaves.
    // Other ESO sources and object-specific OpenSpace credits remain valid.
    if (isSupersededPanorama(resource.href)) continue;
    const key = sourceKey(resource.href);
    result.set(key, { ...result.get(key), ...resource });
  }
  return [...result.values()];
}

function isSupersededPanorama(href: string) {
  const url = new URL(href);
  return url.hostname.replace(/^www\./u, '') === 'eso.org' &&
    url.pathname.replace(/\/+$/u, '') === '/public/images/eso0932a';
}

function sourceKey(href: string) {
  const url = new URL(href);
  url.hash = '';
  const normalized = url.href.replace(/\/$/u, '');
  // Existing object content links the catalogue repository; the shared source
  // provenance records its licence URL. Both identify the same HYG source.
  return normalized === hygLicenceHref.replace(/\/$/u, '') ? hygHref : normalized;
}

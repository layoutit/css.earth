import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceObject, sourceArray, sourceUrl } from '../src/platform/source-catalog.mts';
export interface SceneSource { label: string; role: string; href: string; description: string; credit?: string; }
import { SOURCE_CATALOGUE, sourceHref } from './sources-catalog.mts';
// Shared context is indexed once by its owner. Footer placement does not create
// an observation edge for every body on which that context can appear.
const sharedSources = Object.freeze([
  ...SOURCE_CATALOGUE.usage.edges.filter(use => use.kind === 'shared-context').map(use => Object.freeze({
    label: use.consumerLabel, role: use.consumerId, credit: use.credit,
    href: sourceHref(use.catalogueId), description: use.limitations.join(' '),
  })),
  // Additional prepared environments retain their object-owned scientific credits.
  // scene-sources.test.mjs checks these against the active banks and source receipts.
  ...[
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
    "role": "LMC registration",
    "href": "https://noirlab.edu/public/images/noirlab2030a/",
    "description": "SMASH reference image and sky registration for the LMC model. CTIO/NOIRLab/NSF/AURA/SMASH/D. Nidever (Montana State University) Acknowledgment: Image processing: Travis Rector (University of Alaska Anchorage), Mahdi Zamani & Davide de Martin. CC-BY-4.0. The active color lenses are VISTA, Horálek optical and WISE."
  },
  {
    "label": "ESO VISTA",
    "role": "LMC VISTA image",
    "href": "https://www.eso.org/public/images/eso1914a/",
    "description": "Near-infrared colors from ESO’s VISTA survey, painted onto the shared simulated LMC density cloud. ESO/VMC Survey."
  },
  {
    "label": "NOIRLab Horálek",
    "role": "LMC Horálek image",
    "href": "https://noirlab.edu/public/images/iotw2547a/",
    "description": "Visible-light colors from Petr Horálek’s NOIRLab wide-field image, painted onto the shared simulated LMC density cloud. NOIRLab/NSF/AURA/P. Horálek (Institute of Physics in Opava)."
  },
  {
    "label": "NASA/IPAC WISE",
    "role": "LMC WISE image",
    "href": "https://irsa.ipac.caltech.edu/onlinehelp/wise/wise/overview.html",
    "description": "Infrared colors from NASA/IPAC WISE survey data, painted onto the shared simulated LMC density cloud. IPAC/NASA; color HiPS by CDS (CNRS/Unistra)."
  },
  {
    "label": "Dryad",
    "role": "LMC density model",
    "href": "https://doi.org/10.5061/dryad.1vhhmgr82",
    "description": "Stellar simulation: Garver, Nidever, Debattista & Deg (2026), CC0. Smoothed, normalized relative density; authored display exposure. All imported simulation stellar particles are included in this neutral overview. The observer placement is reconstructed from the paper; it is approximate and preserves model/observation offsets. Image overlays use publisher sky coordinates. No gas or dust depth is inferred."
  },
  {
    "label": "Bonanos",
    "role": "LMC stars",
    "href": "https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/138/1003",
    "description": "Bonanos et al. (2009), AJ 138, 1003; CDS/VizieR J/AJ/138/1003. Original observed RA/DEC and photometry are retained as catalogue data. Rays are registered through the fixed reference-image WCS and its accepted Alignment fit to the simulation cloud. Depths are a deterministic density-conditioned display realization, not measured stellar distances or new astrometry. Candidate image material never selects or moves stars."
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
].map(source => Object.freeze(source)),
]);
// Explicit presentation aliases live beside the context that replaces them.
// They never contribute an identity or observation edge to the source graph.
const footerAliases = new Map<string,string>();
for (const use of SOURCE_CATALOGUE.usage.edges.filter(use => use.kind === 'shared-context')) {
  const owner = sourceObject(JSON.parse(await readFile(resolve(process.cwd(),use.ownerPath),'utf8')));
  for (const alias of sourceArray(sourceObject(owner.catalogueDisplay).footerAliases ?? [],sourceUrl)) {
    const key = normalizedHref(alias), target = normalizedHref(sourceHref(use.catalogueId));
    if (footerAliases.has(key) && footerAliases.get(key) !== target) throw new TypeError('Ambiguous shared footer alias.');
    footerAliases.set(key,target);
  }
}

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

export interface SceneSourceGroup { provider: string; members: readonly (SceneSource & { part: string })[]; }

/** Print a shared provider name once. Grouping reads the authored labels only: entries
 * whose label starts with the same name join one group, and each keeps its own link.
 * A member is named by the rest of its label, or by its role when the label is just the provider. */
export function sceneSourceGroups(sources: readonly SceneSource[]): readonly SceneSourceGroup[] {
  const provider = (source: SceneSource) => source.label.split(/[ /]/u)[0] ?? source.label;
  const counts = new Map<string, number>();
  for (const source of sources) counts.set(provider(source), (counts.get(provider(source)) ?? 0) + 1);
  const groups: SceneSourceGroup[] = [];
  for (const source of sources) {
    const name = provider(source);
    if ((counts.get(name) ?? 0) < 2) { groups.push({ provider: "", members: [{ ...source, part: source.label }] }); continue; }
    const part = source.label.slice(name.length).replace(/^[ /]+/u, "").trim() || source.role;
    const group = groups.find(group => group.provider === name);
    if (group) group.members = [...group.members, { ...source, part }];
    else groups.push({ provider: name, members: [{ ...source, part }] });
  }
  // Two pages can share a label, such as the surface and sky views of one archive.
  // Their roles tell them apart; the label alone would print the same name twice.
  for (const group of groups) {
    const parts = new Map<string, number>();
    for (const member of group.members) parts.set(member.part, (parts.get(member.part) ?? 0) + 1);
    group.members = group.members.map(member => (parts.get(member.part) ?? 0) > 1 ? { ...member, part: member.role } : member);
  }
  return groups;
}

function isSupersededPanorama(href: string) {
  const url = new URL(href);
  return url.hostname.replace(/^www\./u, '') === 'eso.org' &&
    url.pathname.replace(/\/+$/u, '') === '/public/images/eso0932a';
}

function normalizedHref(href: string) {
  const url = new URL(href); url.hash = ''; return url.href.replace(/\/$/u, '');
}
function sourceKey(href: string) {
  const normalized = normalizedHref(href); return footerAliases.get(normalized) ?? normalized;
}

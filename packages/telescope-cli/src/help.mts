import { renderHelp, HELP_FINE_PRINT } from './tui/help.mts';
export { VERSION } from './version.mts';

const coreHelp = [
  ['explore TARGET', 'Find observations and choose one'],
  ['get RUN --pick N', 'Retrieve a saved choice'],
  ['outputs ARTIFACT.json', 'List available outputs'],
  ['export RESULT --output TYPE [--out DIRECTORY]', 'Export a selected output'],
] as const;
const usefulHelp = [
  ['papers TARGET', 'Find related research'],
  ['leads TARGET', 'Find published data and models'],
  ['stars GALAXY', "Find a galaxy's stellar catalogues"],
  ['skill install --provider NAME', 'Install the agent skill'],
  ['toolchain list|remove|install|verify [NAME]', 'Manage installed toolchains'],
] as const;
const usageWidth = Math.max(...[...coreHelp, ...usefulHelp].map(([usage]) => usage.length));
const helpRows = (entries: readonly (readonly [string, string])[]) => entries.map(([usage, description]) =>
  `  telescope ${usage.padEnd(usageWidth)}  ${description}`).join('\n');

export const SHORT_HELP = `Telescope — explore observations and turn qualified data into outputs.

Core flow:
${helpRows(coreHelp)}

Also useful:
${helpRows(usefulHelp)}

${HELP_FINE_PRINT}
`;

export const HELP = `Telescope — explore observations or continue from an existing artifact.

Agent skill (explicit host or skills directory):
  telescope skill install|uninstall (--provider NAME | --dest DIRECTORY) [--copy] [--json]
  Providers: claude, codex, agents, grok, agy, antigravity, cursor, opencode.
  Default: symlink to this package; --copy writes an owned independent copy.
  Repeats do nothing; unrelated or modified content is refused. No host config is edited.

Managed toolchains:
  telescope toolchain list [--json]
  telescope toolchain remove NAME [--json]
  List installed environments, size on disk and folder. Removal deletes one environment only inside
  the user root’s toolchains/; linked paths and active install locks are refused. Legacy installs are listed
  but cannot be removed here. Python environments and micromamba remain central, installed once.
  telescope toolchain install NAME [--json]
  telescope toolchain verify astroquery|pds|starry|spiderman|picaso [--json]
  Install names also include archive toolchains: chandra, spitzer, hst, keck, gemini, naco, tess,
  mearth, espadons, eureka, klip, squeeze, rotir, pionier, amber, gravity, matisse, casa.
  Source builds need a C compiler and standard-library headers (macOS also needs its SDK).

Human entry points:
  telescope explore [TARGET] [--family F01..F18] [--kind KIND] [--instrument NAME] [--wavelength MIN,MAX] [--from ISO --to ISO] [--icrs-circle RA,DEC,RADIUS] [--out DIRECTORY] [--fresh] [--yes|-y]
  telescope fetch EXPLORE.json --archive keck|gemini|opus|chandra|spitzer --pick N [--file NAME] [--out DIRECTORY] [--resume] [--yes|-y] [--json]
  telescope papers TARGET... [--about PHRASE,PHRASE] [--fulltext] [--instrument NAME] [--host NAME] [--json] [--out DIRECTORY]
  telescope simulations TARGET [--json] [--out DIRECTORY]
  telescope leads TARGET | --class CLASS [--json] [--out DIRECTORY]
  telescope stars GALAXY [--json] [--out DIRECTORY]
  telescope gaia-cone RA,DEC,RADIUS [--magnitude-limit G] [--limit N] [--json] [--out FILE]
  telescope new-object SPEC.json [--check] [--skip-existing] [--json]
  telescope new-object --from-archive HOST... | --from-debcat SYSTEM... | --from-apokasc KIC... | --from-cepheids NAME... | --from-k2 EPIC... | --from-tess TIC... | --from-gaia SOURCE_ID... | --from-hipparcos HIP... | --from-iau all|NAME... | --from-chara HD... | --from-npoi HD... | --from-benchmark HD... | --from-narrabri HD... | --from-sh0es HOST[/ID]... | --from-m31cepheids all|V1|ID... | --from-m33cepheids all|ID... | --from-table CLASS:GALAXY=TABLE[#ROW]... | --from-esa PAGE_ID=PICTURE_URL... | --from-magnetic HOST... | --from-spectra HOST... | --from-pixels all|HOST... | --from-pulsation all|HOST|gaia:HOST... --out SPEC.json
  telescope ascl SOFTWARE [--json]
  telescope ascl --product PRODUCT.json|RUN/pick-N/result.json [--json]
  telescope wwt-fits EXPLORE.json --pick N --level N --x X --y Y --out DIRECTORY
  telescope wwt-fits CATALOG.json --set NAME --level N --x X --y Y --out DIRECTORY [--json]
  telescope wwt-image EXPLORE.json --pick N --level 0..3 --out DIRECTORY [--json]
  telescope import SPEC.json --out DIRECTORY
  telescope families [--json]
  telescope family-assess REQUEST.json ARTIFACT.json --out DIRECTORY [--json]
  telescope family-run DESCRIPTOR.json OPERATION [--component ID] [--params PARAMS.json] --out DIRECTORY [--json]
  telescope outputs ARTIFACT.json [--structure NAME] [--out DIRECTORY]
  telescope candidates STAR --epoch MJD|DATE --out DIRECTORY [--figure-background transparent|opaque]
  telescope associate MEASUREMENTS.csv --system STAR --out DIRECTORY [--orbit-draws N] [--fit-astrometry] [--fit-orbits]

Explore may first install managed Python: it names the packages, approximate size and toolchains/ folder,
then asks in a terminal. --yes (-y) skips this question; scripts proceed without prompting.
Explore needs only a target. A name outside the catalogue is resolved by SIMBAD, and the search uses its identifiers and
position, with SIMBAD's position error as a footprint circle that selects records without cutting them. In a terminal it saves the bounded discovery snapshot, shows actual
observations and limitations, and asks which exact identity to retrieve. With --json, redirected
stdin, or redirected stdout it never prompts and writes a compact summary as JSON; the complete record stays on disk. If --out is
omitted, a unique directory is created under ./telescope-runs/ in the current working directory. Get accepts that directory's
explore.json as well as a strict query.json. Downloads exist once in RUN/pick-N/ and are reused on retry.
Fetch and export without --out save under ./telescope-runs/<target>-<timestamp>/ too.
Outputs saves the complete inspection as outputs.json inside the existing run and prints a summary naming savedPath; it never creates a new run.
--out for outputs may select an existing subfolder inside that run. Standalone artifacts use their containing folder.
Field searches use field-<ra>-<dec>-<timestamp>. Run-owned JSON follows the run; lookups without --out
write nothing. Reusable search-answer caches (--fresh bypasses), Astroquery caches, micromamba and
toolchains stay in the user root. A read-only cwd fails before network work: choose a writable folder
or pass --out DIR. Exploration does not state scientific acceptance criteria.
In a terminal, outputs asks which available operation to run, then asks only for that operation's
reported inputs and a new output directory. Press Enter at any prompt to cancel before an export
starts. With --json or redirected input/output it never prompts; the listed command templates remain.
New-object turns a star spec into a complete object package: SIMBAD (through the same resolver as explore) names it and gives
its Gaia DR3 source; the color dataset comes from the best archived spectrum (STIS NGSL, Gaia XP, then the ground catalogues),
cross-checked against the next; a model limb law from Claret's grids; manifest, acquisition plan, source records and credits.
Only prose is left marked TODO(new-object), unless the spec carries drafted text. --from-archive writes a spec for planet hosts from the
NASA Exoplanet Archive's default parameter sets (their transiting planets, with drafted text); --from-debcat drafts both stars of
an eclipsing binary from DEBCat, --from-apokasc a Kepler-field giant from APOKASC-3, --from-cepheids a Cepheid from Groenewegen
(2013), --from-k2 a K2-field giant and --from-tess a TESS giant from Khan et al. (2023), --from-gaia any star from Gaia DR3 FLAME, --from-hipparcos a Hipparcos star from the model-atmosphere fit to its light (McDonald et al. 2017), --from-iau the stars the IAU has named that the universe lacks, each by the first of those routes that measures it, --from-chara a nearby star whose disc CHARA measured (Boyajian et al. 2012), --from-npoi a bright star whose disc the NPOI measured (Baines et al. 2018, 2021, 2023, 2025), --from-benchmark a Gaia benchmark star (Soubiran et al. 2024), --from-narrabri a star whose disc the Narrabri interferometer measured (Hanbury Brown et al. 1974; Code et al. 1976), --from-sh0es the Cepheids Hubble found in a SN Ia host galaxy (Hoffmann et al. 2016), --from-m31cepheids Hubble's V1 and the Cepheids Hubble measured in Andromeda (Li et al. 2021), --from-m33cepheids those it measured in Triangulum (Breuval et al. 2023), --from-table a star of another galaxy from any VizieR table that lists it with a period (cepheid:m81=J/ApJ/743/176/table1), placed in its galaxy by the table's position, by SIMBAD's, or by the table's detector pixel on the exposure the request names (#exposure=mast:HST/product/FILE.fits,firstPixel=N), each naming what the spec still needs from the paper; --check runs the bake's first steps on
what was generated; --skip-existing leaves objects already in the universe alone. --from-esa drafts a picture ESA publishes for Hubble or Webb as one more
dataset of a page that shows a shaped layer bank (m57=https://esawebb.org/images/weic2320c/): it reads the picture's page and the sky tags in its JPEG, finds the
star the picture shows at the page's place, and leaves the sentences and what each color takes on the bank's walls to write; a spec of pictures writes each
picture's bank and its page's dataset, may be run again, and bakes with SPEC.json --bake. --from-magnetic drafts a star's corona, derived from the magnetic maps its
page already shows and its ROSAT X-ray flux (docs/stellar-corona-from-magnetic-maps.md); a spec of coronae writes each star's volume bank and its "Derived corona"
dataset, and bakes with SPEC.json --bake. --from-spectra drafts a star's magnetic maps from the programs of archived polarised spectra this repository has
reduced; a spec of magneticMaps writes each map as a "Radial field" dataset of the star's page, and bakes with
SPEC.json --bake. --from-pixels drafts the brightness map of each star this repository has reduced from the TESS, K2 and Kepler missions' light curves of it
(all is every reduced star); a spec of brightnessMaps writes each map as a "Brightness map" dataset of the star's
page and the measured period into its measurements record, and bakes with SPEC.json --bake. --from-pulsation drafts a pulsating star's light through one cycle
from the published light-curve model its package keeps (a Cepheid's row of Gaia DR3 vari_cepheid; all is every such star; gaia:HOST first looks a star placed by
its paper's table up in that table at its place, and installs its row); a spec of pulsations writes the cycle as the ten steps of a "Pulsation" dataset of
the star's page, and bakes with SPEC.json --bake (docs/pulsating-stars-light-through-a-cycle.md). See the command guide for the spec format.
Papers lists up to 20 OpenAlex works that name the target, by any spelling of its catalogue names, in their title or
abstract, with the instrument and any one of the --about phrases (singular or plural); --fulltext asks for the works whose
indexed full text names them. It uses arXiv's Atom API when OpenAlex is unavailable or its daily budget is spent, and the
report names the source and the reason. It tries one plain GET per open copy, reads the arXiv preprint as HTML when the
copy is not, marks browser challenges as blocked, and prints the sentences that name the subject with the target and the
figure captions and table titles about maps or observation lists. Each work then lists what else was published under its
title (an erratum is printed that way), whether it is retracted, and the later works that cite it and name the target.
Several targets are a sweep: one search each, the works named, nothing fetched. A search costs 10 of OpenAlex's 1,000 daily
credits for a network without a key; OPENALEX_API_KEY in the environment has ten times that. Nothing is saved without --out.
Simulations lists the Zenodo dataset records that name the target and speak of a simulation or a model, each with its
license, size and files. It downloads nothing. A listed record is a lead: in a checkout,
packages/telescope-cli/src/new-object/new-object-cli.mts adds one as a dataset from an entry written after reading its
paper, fetching by byte range only the header and the one grid it draws (docs/telescope-commands.md gives the command).
Leads asks DataCite, which registers the DOIs of every data repository and of arXiv, for the records that name the target
and speak of a measured phase curve or map, a measured eclipse, or a model: data releases at Zenodo, Dryad, Dataverse,
universities, the CDS and MAST, and the papers themselves. --class exoplanet asks for every object of that class, ten a
request, and ranks them with what each page opens on, the pages without a map first. A lead is read before anything is
shown: in a checkout, new-object-cli.mts draws a paper's fitted phase-curve table or a released model field.
Stars counts the stars SIMBAD lists inside a galaxy's outline by class, names the papers they come from, and says which of
VizieR's tables of those papers give each star a period and a place. It downloads nothing. A table it calls ready is a lead
for new-object --from-table, and so is one that lists detector pixels, once its paper has said which exposure they are of.
It also names the single stars of no class that SIMBAD holds there with no parallax or proper motion, the most cited first,
and the works the papers API finds that name the galaxy and a kind of star, which the archives may not hold yet.
Gaia-cone asks GAVO's TAP service for the Gaia DR3 stars inside a circle on the sky (degrees), brighter than G (16 unless
given), the brightest N (5000) first, each with its position, proper motion, parallax, BP-RP color and Bailer-Jones distance.
ASCL searches its live software catalog by title or matches the exact software names in a verified
product receipt. It reports citable code entries and preferred citations when provided by ASCL.
Only the receipt establishes what this run recorded as used; an ASCL match is a citation lead, not
proof of software version, scientific validity, or target detection. ASCL lookup is explicit and
downloads at most 8 MiB; ordinary outputs inspection stays offline.
WWT image export selects a separately numbered curated TAN sky image from a saved exploration,
downloads at most 64 pinned-catalog tiles, and assembles one static PNG plus a source receipt.
It is a display-image input for offline preparation, not a scientific observation or a runtime tile service.
Get and fetch print download size and destination before transferring science bytes. In a terminal,
100 MB or more and unknown sizes ask Continue? [Y/n]; Enter proceeds, n cancels with exit code 1.
--yes (-y) skips the question. --json or redirected stdin/stdout never prompt and include download metadata.
Fetch selects a separately numbered source within one archive from a saved exploration. Keck is
the default for older saved runs. Exact archive identities are rechecked; original bytes, discovery
and current metadata are pinned within the saved transfer limit. FITS files enter shared outputs;
OPUS preserves its native image, label and support files. Acquisition does not establish calibration,
target detection or scientific fitness.
For Gemini, OPUS, Chandra and Spitzer, a failed fetch retains completed files in DIRECTORY.partial.
Use the printed resume command, including --out with the actual run directory, to recheck the selected archive metadata and local files,
then download only unfinished files. Choose a new directory if the archive selection changed.
Explore pushes an instrument and observation interval into Keck, Gemini and Chandra live source
queries before their bounded samples. Spitzer filters all returned AORs before sampling. Keck and
Chandra queries use UTC day bounds; source leads remain separate from qualified choices.
Family-assess accepts a fetched source receipt when it pins a supported family descriptor, as
well as a descriptor directly. It verifies the artifact closure and saves the descriptor hash.
Compatibility is not scientific fulfillment.
WWT FITS reads one original numeric tile from a pinned WTML collection snapshot. It preserves the
source FITS bytes, extracts an image and sample table through Astropy, and records the exact tile
URL and hashes. Use src/sources/wwt/phat-fits.json for WWT's PHAT f475w/f814w collection. Missing unit,
uncertainty, celestial WCS or original untiled identity stay unresolved; WTML placement is separate.
Family-run executes one operation from a verified product descriptor through the static owner allowlist.
Its params file is optional only when that operation has no required parameters. The output directory
must be new; reusable data and a pinned product record are reopened before success is reported.

Explicit scientific request:
  telescope query TARGET --wavelength MIN,MAX --kind cube --any-time --min-arcsec N --out DIRECTORY
  telescope get RUN --pick N
  telescope get RUN --pick N --offline [--yes|-y]
  telescope export RUN/pick-N/result.json --output image --hdu N [--structure NAME] --plane N [--out DIRECTORY]
  telescope export RUN/pick-N/result.json --output spectrum --hdu N --pixel X,Y [--out DIRECTORY]
  telescope export RESULT_JSON --output band-image --hdu N --band LO,HI [--out DIRECTORY]
  telescope export RESULT_JSON --output aperture-spectrum --hdu N --aperture X0,Y0,X1,Y1 --background none [--out DIRECTORY]
  telescope export RESULT_JSON --output feature-map --hdu N --band LO,HI --continuum L0,L1,R0,R1 [--out DIRECTORY]

Physical object handoff (existing measured/modelled depth):
  telescope export OBJECT_JSON --output points|volume|volume-dataset-bank [--out DIRECTORY]
  Reuses the existing physical-object loaders; copies pinned renderer resources and credits.

Surface outputs:
  telescope export MEASUREMENT/output.product.json --output body-map --geometry navigation.json [--out MAP_DIRECTORY]
  telescope export OUTPUT_DIRECTORY/output.product.json --output html [--out HTML_DIRECTORY]
  telescope export OBJECT_JSON --output html [--out HTML_DIRECTORY]
  telescope export MAP_DIRECTORY/map.fits.product.json --output sphere [--out SPHERE_DIRECTORY]
  telescope project MEASUREMENT/output.product.json --geometry navigation.json --out MAP_DIRECTORY  (compatibility alias)
  Navigation pins SPICE kernels and explicitly chooses WCS or disc registration.
  Projection preserves unknown beam resolution and request satisfaction. See docs/virtual-telescopes.md.

Aggregate outputs:
  --background X0,Y0,X1,Y1           Subtract a disjoint region's mean spectrum
  --uncertainty omit|independent     Default omit; independent explicitly assumes no covariance
  --band LO,HI                      Wavelength interval in micrometres
  Apertures are fixed pixel boxes with exclusive upper bounds; spectra are region means.
  Band images are wavelength-weighted means. Feature maps integrate a continuum residual.

Sky association:
  candidates places every hosted planet of a star at an epoch, as offsets from the star in mas, with
  1σ/2σ/3σ ephemeris ellipses from the orbit's published posterior where one exists, and its orbit.
  associate reads relative astrometry in the orbitize! CSV layout (epoch as MJD, raoff, decoff,
  raoff_err, decoff_err, radec_corr) and tests each row against those candidates: Mahalanobis R,
  p = exp(-R^2/2) and the one-sided normal σ, a chart per row and one of the whole system.
  --orbit-draws N traces N posterior draws of each published orbit; --fit-astrometry adds the
  astrometry the published fit was made from, which the prediction tool ships beside its draws;
  --fit-orbits fits an orbit to the measurements themselves with orbitize!, one body at a time,
  and draws that posterior instead. Fitting samples, so it costs about twenty seconds per body.

Figures:
  --figure-background transparent|opaque  PNG and SVG background for export; default transparent
  Family operations that draw a figure take "figureBackground" in --params the same way.

Explore filters and query options use micrometres, arcseconds and kilometres:
  --from ISO --to ISO                 Time range instead of --any-time
  --icrs-circle RA,DEC,RADIUS          ICRS circle in degrees; with TARGET it also requests a cutout.
                                      Omit TARGET for in-field records; name-only archives are not searched
  --instrument NAME                   Archive instrument name, e.g. ERIS (explore)
  --fresh                             Ask every archive again; without it an answer saved in the last day stands (explore)
  --spectral-frame barycentric        Permit advertised SODA BAND subsetting
  --max-science-bytes N               Science transfer bound (default 1 GiB)
  --max-metadata-bytes N              Metadata response bound (default 32 MiB)
  --max-expanded-bytes N              Expanded package bound (default 1 GiB)
  --max-package-members N             Package file bound (default 1024)
  --max-link-depth N                  Nested DataLink edges (default 3)
  --max-link-requests N               Access-description requests (default 32)
  --min-km N --range-km N             Required surface resolution
  --min-elements N --range-km N --radius-km N
  --continuum LEFT_MIN,LEFT_MAX,RIGHT_MIN,RIGHT_MAX
  --accept-assumptions ID,ID          Explicit scientific assumptions
  --kind image|cube|spectrum|table|photometry|events|strips

  --json                             JSON-only stdout; progress on stderr
  --verbose                          Full exploration diagnostics, query evidence or error stack
  --help                             Show this help
  --version                          Show the Telescope CLI version

Explorations and queries save immutable numbered choices in explore.json and query.json. Get
revalidates the exact saved identity, qualifies it if needed, and exports pinned data and evidence
to RUN/pick-N/. If both snapshot files are present, get refuses the ambiguous directory.
Get prints the download size and destination first; 100 MB or more and unknown sizes ask Continue? [Y/n]
in a terminal. Enter proceeds; n cancels with exit code 1. --yes (-y) skips; --json and redirected
stdin/stdout proceed without a question and include download metadata. First implicit managed Python
installation also names its packages, approximate size and toolchains/ folder before terminal consent.
Outputs inspects deliveries, derived product records and physical object packages, and reports
the artifact stage and source context, then reports available operations, blockers, required inputs
and concrete commands after checking the prerequisites shared with export. Supported inputs are
existing telescope deliveries, product records and prepared physical object packages; raw
FITS/PDS files are not admitted without their qualification evidence. The v1
transitions are native delivery -> scientific output; 2D measurement + navigation -> body map;
body map + embeddable standard body -> sphere; prepared point/volume/volume-dataset-bank object -> renderer handoff.
Configured, bounded archive searches and a declared product kind do not promise universal
archive coverage, decoding or export. Qualified FITS images, spectra, band images and feature maps
use zero-based HDU, plane and pixel indices. Cubes require an explicit plane for image export.
Explore records outcome.selection (available or none) separately from outcome.coverage
(bounded, incomplete or target-unresolved). A provider failure, overflow, unread source or
unresolved discovery makes coverage incomplete even when another observation is selectable.
Query records endpoint.coverage separately from its scientific workflow status, so indexed
candidate modes do not hide failed provider searches. Human query output puts provider status
first and bounds the blocker list; --verbose and the saved JSON retain the full evidence.
No choices in a bounded search never proves that no observation exists. Retry after fixing a
provider or source error in a new directory; the original numbered choices stay immutable.
Export writes FITS images or ECSV spectra, PNG, SVG, CSV and a pinned receipt.
The output directory must be new. No browser or viewer service is required.
Local import copies and pins a bounded file or directory closure from a data-only JSON specification.
It records user declarations as unverified and proposes a registered handler from byte content; import
does not establish archive origin, calibration, or scientific qualification.
Scientific surface publication remains an explicit qualification after projection. Physical 3D
adapters need real geometry. Sphere export prepares one standalone no-JavaScript HTML file.
Native deliveries, sphere HTML and physical handoffs carry their portable files. Intermediate
measurement/map records may still depend on retained workspace sources. Missing dependencies
are refused, never searched for or repaired. Export success preserves the source request's
fulfilled, unresolved or refused verdict.
Exit codes: 0 exploration/retrieval completed or request fulfilled, 1 operation failed, 2 invalid arguments,
3 no retrievable choice or unresolved request, 4 refused request.
The npm command accepts --workspace PATH (or CSSEARTH_WORKSPACE) for a css.earth science checkout.
new-object (including every drafter, --check and --bake) and volume preparation require that checkout.
Standalone alternative: telescope export RESULT --output html --out DIRECTORY.
Guide: https://github.com/layoutit/css.earth/blob/main/packages/telescope-cli/README.md
Issues: https://github.com/layoutit/css.earth/issues
`;

/** Preserve the published reference above while carving command pages from its actual text. */
function between(start: string, end?: string): string {
  const first = HELP.indexOf(start);
  const last = end === undefined ? HELP.length : HELP.indexOf(end, first + start.length);
  if (first < 0 || last < first) throw new Error(`Missing help reference section: ${start}`);
  return HELP.slice(first, last).trimEnd();
}

const usage = (command: string): string => HELP.split('\n').filter(line => line.startsWith(`  telescope ${command} `)).join('\n');
const globalOptions = between('  --json ', '\nExplorations and queries');
const footer = between('Exit codes:');
const filters = between('Explore filters and query options', '\n  --json ');
const delivery = between('Explorations and queries save', '\nOutputs inspects');
const outputInspection = between('Outputs inspects', '\nConfigured, bounded');
const coverage = between('Configured, bounded archive searches', '\nExport writes');
const portable = between('Scientific surface publication remains', '\nExit codes:');
const exportKinds = between('Physical object handoff', '\nSky association:');
const figures = between('Figures:', '\nExplore filters');

const explanations: Readonly<Record<string, readonly string[]>> = {
  open: ['  telescope open [DIRECTORY] [--json]', 'List saved explorations under ./telescope-runs/ (or DIRECTORY), newest first, with observation, downloaded, partial and made counts. In a terminal, use ↑↓ or Page Up/Down to choose, Enter to reopen the saved explore table without searching, and Escape to quit. Pipes print plain rows; --json prints the run list.'],
  skill: [between('Agent skill', '\nManaged toolchains:')],
  toolchain: [between('Managed toolchains:', '\nHuman entry points:')],
  explore: [between('Explore may first install managed Python:', '\nIn a terminal, outputs'),
    between('Explore pushes an instrument', '\nFamily-assess'), filters, delivery, coverage,
    '  --all                              Show every saved choice in plain output (default: first 10)'],
  get: [delivery, coverage, filters],
  query: [filters, delivery, coverage],
  outputs: [between('In a terminal, outputs', '\nNew-object'), outputInspection, portable],
  export: [exportKinds, figures, coverage, between('Export writes', '\nLocal import'), portable],
  project: [between('Surface outputs:', '\nAggregate outputs:'), portable],
  'new-object': [between('New-object turns a star spec', '\nPapers lists')],
  papers: [between('Papers lists', '\nSimulations lists'), 'In a terminal, browse and search the list; Enter opens a paper and Escape quits. --no-open disables opening the browser.'],
  simulations: [between('Simulations lists', '\nLeads asks')],
  leads: [between('Leads asks', '\nStars counts'), 'For one object in a terminal, browse and search the list; Enter opens a record and Escape quits. --no-open disables opening the browser.'],
  stars: [between('Stars counts', '\nGaia-cone asks'), 'In a terminal, browse and search the list; Enter opens its paper and Escape quits. --no-open disables opening the browser.'],
  'gaia-cone': [between('Gaia-cone asks', '\nASCL searches')],
  ascl: [between('ASCL searches', '\nWWT image export')],
  'wwt-image': [between('WWT image export', '\nFetch selects')],
  fetch: [between('Get and fetch print download size', '\nFamily-assess')],
  'family-assess': [between('Family-assess accepts', '\nWWT FITS reads')],
  'wwt-fits': [between('WWT FITS reads', '\nFamily-run executes')],
  'family-run': [between('Family-run executes', '\nExplicit scientific request:'), figures],
  candidates: [between('Sky association:', '\nFigures:'), figures],
  associate: [between('Sky association:', '\nFigures:'), figures],
  import: [between('Local import copies', '\nScientific surface publication')],
  families: ['Lists the registered observation families and their available profiles.'],
};

export const HELP_COMMANDS = Object.keys(explanations);

const currentOutputHelp = `Current human and agent output:
  telescope open [DIRECTORY] [--json]
  telescope explore TARGET [--all] [--verbose] [--json]
  telescope get RUN --pick N [--out DIRECTORY] [--offline] [--yes|-y] [--verbose] [--json]
  telescope outputs ARTIFACT.json [--structure NAME] [--out DIRECTORY] [--verbose] [--json]
  telescope export RESULT --output TYPE [--out DIRECTORY] [--verbose] [--json]
In a terminal, Explore shows up to 12 rows per page, reduced to fit the window.
Use ↑↓ to scroll, Page Up/Down to page, type to search, and Backspace to edit.
Enter chooses and confirms a download; in make it creates and opens an output.
A made output opens again without exporting. Escape goes back; at the list it saves and quits.
Use q to quit from make; --no-open disables opening files.
Plain output shows the first 10 choices; --all shows every choice in the same pick order.
--verbose retains full limitations and diagnostics in plain output and saved evidence.
Explore --json emits cssearth-telescope-explore-summary@1, with outcome, resolution, counts,
savedPath and compact choices. The complete record stays in explore.json; use jq for details.
Outputs saves the complete inspection as outputs.json inside the existing run and prints a summary naming savedPath; it never creates a new run.
--out for outputs may select an existing subfolder inside that run. Standalone artifacts use their containing folder.
JSON commands never prompt, and progress and notices go to stderr.
`;

/** An empty command means the short screen; topic help keeps its plain reference. */
export function helpText(command = '', tty = false): string {
  if (!command || command === 'help') return tty ? renderHelp(0, 80).join('\n') + '\n' : SHORT_HELP;
  if (command === 'all') return `${HELP}\n${currentOutputHelp}`;
  const sections = explanations[command];
  if (!sections) throw new TypeError(`Unknown help command ${command}. Use telescope help all for the full reference.`);
  const current = ['explore', 'get', 'outputs', 'export'].includes(command) ? currentOutputHelp : '';
  return [`Telescope ${command}`, usage(command), ...sections, current, globalOptions, footer].filter(Boolean).join('\n\n') + '\n';
}

/** Resolve help before validating command arguments, so incomplete invocations can request usage. */
export function helpCommand(args: readonly string[]): string | undefined {
  if (!args.length) return '';
  if (args[0] === 'help') return args[1] ?? '';
  if (args.includes('--help') || args.includes('-h')) return args[0]?.startsWith('-') ? '' : args[0];
  return undefined;
}

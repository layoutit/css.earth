export const VERSION = '0.1.0';

export const SHORT_HELP = `Telescope — explore observations and turn qualified data into outputs.

Start here:
  telescope explore TARGET                 Find observations and choose one in a terminal
  telescope outputs ARTIFACT.json          Inspect a delivery and choose an output

Use telescope --help for all commands, filters, and exit codes.
Guide: https://github.com/layoutit/css.earth/blob/main/packages/telescope/README.md
`;

export const HELP = `Telescope — explore observations or continue from an existing artifact.

Human entry points:
  telescope explore TARGET [--family F01..F18] [--kind KIND] [--instrument NAME] [--wavelength MIN,MAX] [--icrs-circle RA,DEC,RADIUS] [--out DIRECTORY]
  telescope papers TARGET [--instrument NAME] [--host NAME] [--json] [--out DIRECTORY]
  telescope import SPEC.json --out DIRECTORY
  telescope families [--json]
  telescope family-assess REQUEST.json DESCRIPTOR.json --out DIRECTORY [--json]
  telescope family-run DESCRIPTOR.json OPERATION [--component ID] [--params PARAMS.json] --out DIRECTORY [--json]
  telescope outputs ARTIFACT.json [--structure NAME]
  telescope candidates STAR --epoch MJD|DATE --out DIRECTORY [--figure-background transparent|opaque]
  telescope associate MEASUREMENTS.csv --system STAR --out DIRECTORY [--orbit-draws N] [--fit-astrometry] [--fit-orbits]

Explore needs only a target. A name outside the catalogue is resolved by SIMBAD, and the search uses its identifiers and
position, with SIMBAD's position error as a footprint circle that selects records without cutting them. In a terminal it saves the bounded discovery snapshot, shows actual
observations and limitations, and asks which exact identity to retrieve. With --json, redirected
stdin, or redirected stdout it never prompts and writes the saved exploration as JSON. If --out is
omitted, a unique directory is created under ./telescope-runs/. Get accepts that directory's
explore.json as well as a strict query.json. Exploration does not state scientific acceptance criteria.
In a terminal, outputs asks which available operation to run, then asks only for that operation's
reported inputs and a new output directory. Press Enter at any prompt to cancel before an export
starts. With --json or redirected input/output it never prompts; the listed command templates remain.
Papers lists up to 20 OpenAlex works that name the target (and instrument) in their title or abstract,
open access first. It tries one plain GET per open copy, marks browser challenges as blocked, and prints
HTML figure captions and table titles about maps or observation lists. Nothing is saved without --out.
Family-run executes one operation from a verified product descriptor through the static owner allowlist.
Its params file is optional only when that operation has no required parameters. The output directory
must be new; reusable data and a pinned product record are reopened before success is reported.

Explicit scientific request:
  telescope query TARGET --wavelength MIN,MAX --kind cube --any-time --min-arcsec N --out DIRECTORY
  telescope get DIRECTORY --pick N
  telescope get DIRECTORY --pick N --offline
  telescope export DIRECTORY/pick-N/result.json --output image --hdu N [--structure NAME] --plane N --out DIRECTORY
  telescope export DIRECTORY/pick-N/result.json --output spectrum --hdu N --pixel X,Y --out DIRECTORY
  telescope export RESULT_JSON --output band-image --hdu N --band LO,HI --out DIRECTORY
  telescope export RESULT_JSON --output aperture-spectrum --hdu N --aperture X0,Y0,X1,Y1 --background none --out DIRECTORY
  telescope export RESULT_JSON --output feature-map --hdu N --band LO,HI --continuum L0,L1,R0,R1 --out DIRECTORY

Physical object handoff (existing measured/modelled depth):
  telescope export OBJECT_JSON --output points|volume|volume-lens-bank --out DIRECTORY
  Reuses the existing physical-object loaders; copies pinned renderer resources and credits.

Surface outputs:
  telescope export MEASUREMENT/output.product.json --output body-map --geometry navigation.json --out MAP_DIRECTORY
  telescope export MAP_DIRECTORY/map.fits.product.json --output sphere --out SPHERE_DIRECTORY
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
  --icrs-circle RA,DEC,RADIUS          Explicit ICRS cutout, in degrees. Explore also lists archive records
                                      whose footprint intersects it as in the field, never as the target
  --instrument NAME                   Archive instrument name, e.g. ERIS (explore)
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
to DIRECTORY/pick-N/. If both snapshot files are present, get refuses the ambiguous directory.
Outputs inspects deliveries, derived product records and physical object packages, and reports
the artifact stage and source context, then reports available operations, blockers, required inputs
and concrete commands after checking the prerequisites shared with export. Supported inputs are
existing telescope deliveries, product records and prepared physical object packages; raw
FITS/PDS files are not admitted without their qualification evidence. The v1
transitions are native delivery -> scientific output; 2D measurement + navigation -> body map;
body map + embeddable standard body -> sphere; prepared point/volume/volume-lens-bank object -> renderer handoff.
Configured, bounded archive searches and a declared product kind do not promise universal
archive coverage, decoding or export. Qualified FITS images, spectra, band images and feature maps
use zero-based HDU, plane and pixel indices. Cubes require an explicit plane for image export.
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
Guide: https://github.com/layoutit/css.earth/blob/main/packages/telescope/README.md
Issues: https://github.com/layoutit/css.earth/issues
`;

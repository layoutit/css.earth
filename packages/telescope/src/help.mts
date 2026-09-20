export const HELP = `Telescope — retrieve a qualified telescope product for a saved scientific question.

  telescope query TARGET --wavelength MIN,MAX --kind cube --any-time --min-arcsec N --out DIRECTORY
  telescope get DIRECTORY --pick N
  telescope get DIRECTORY --pick N --offline
  telescope outputs ARTIFACT.json [--structure NAME]
  telescope export DIRECTORY/pick-N/result.json --output image --hdu N [--structure NAME] --plane N --out DIRECTORY
  telescope export DIRECTORY/pick-N/result.json --output spectrum --hdu N --pixel X,Y --out DIRECTORY
  telescope export RESULT_JSON --output band-image --hdu N --band LO,HI --out DIRECTORY
  telescope export RESULT_JSON --output aperture-spectrum --hdu N --aperture X0,Y0,X1,Y1 --background none --out DIRECTORY
  telescope export RESULT_JSON --output feature-map --hdu N --band LO,HI --continuum L0,L1,R0,R1 --out DIRECTORY

Physical object handoff (existing measured/modelled depth):
  telescope export OBJECT_JSON --output points|volume --out DIRECTORY
  Reuses the existing point/volume loaders; copies pinned renderer resources and credits.

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

Query options use micrometres, arcseconds and kilometres:
  --from ISO --to ISO                 Time range instead of --any-time
  --icrs-circle RA,DEC,RADIUS          Explicit ICRS cutout, in degrees
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
  --verbose                          Full query evidence or error stack
  --help                             Show this help

Queries save immutable numbered choices in DIRECTORY/query.json. Get revalidates the
choice, qualifies it if needed, and exports pinned data and evidence to DIRECTORY/pick-N/.
Outputs inspects deliveries, derived product records and physical object packages, and reports
only the next supported exports after checking the prerequisites shared with export. The v1
transitions are native delivery -> scientific output; 2D measurement + navigation -> body map;
body map + embeddable standard body -> sphere; prepared point/volume object -> renderer handoff.
Configured, bounded archive searches and a declared product kind do not promise universal
archive coverage, decoding or export. Qualified FITS images, spectra, band images and feature maps
use zero-based HDU, plane and pixel indices. Cubes require an explicit plane for image export.
Export writes FITS images or ECSV spectra, PNG, SVG, CSV and a pinned receipt.
The output directory must be new. No browser or viewer service is required.
Scientific surface publication remains an explicit qualification after projection. Physical 3D
adapters need real geometry. Sphere export prepares one standalone no-JavaScript HTML file.
Native deliveries, sphere HTML and physical handoffs carry their portable files. Intermediate
measurement/map records may still depend on retained workspace sources. Missing dependencies
are refused, never searched for or repaired. Export success preserves the source request's
fulfilled, unresolved or refused verdict.
Exit codes: 0 ready/fulfilled, 1 operation failed, 2 invalid arguments,
3 no retrievable choice or unresolved request, 4 refused request.
The npm command accepts --workspace PATH (or CSSEARTH_WORKSPACE) for a css.earth science checkout.
`;

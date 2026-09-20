export const HELP = `Telescope — retrieve a qualified telescope product for a saved scientific question.

  telescope query TARGET --wavelength MIN,MAX --kind cube --any-time --min-arcsec N --out DIRECTORY
  telescope get DIRECTORY --pick N
  telescope outputs DIRECTORY/pick-N/result.json
  telescope export DIRECTORY/pick-N/result.json --output image --hdu N --plane N --out DIRECTORY
  telescope export DIRECTORY/pick-N/result.json --output spectrum --hdu N --pixel X,Y --out DIRECTORY
  telescope export RESULT_JSON --output band-image --hdu N --band LO,HI --out DIRECTORY
  telescope export RESULT_JSON --output aperture-spectrum --hdu N --aperture X0,Y0,X1,Y1 --background none --out DIRECTORY
  telescope export RESULT_JSON --output feature-map --hdu N --band LO,HI --continuum L0,L1,R0,R1 --out DIRECTORY

Aggregate outputs:
  --background X0,Y0,X1,Y1           Subtract a disjoint region's mean spectrum
  --uncertainty omit|independent     Default omit; independent explicitly assumes no covariance
  --band LO,HI                      Wavelength interval in micrometres
  Apertures are fixed pixel boxes with exclusive upper bounds; spectra are region means.
  Band images are wavelength-weighted means. Feature maps integrate a continuum residual.

Query options use micrometres, arcseconds and kilometres:
  --from ISO --to ISO                 Time range instead of --any-time
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
Outputs support qualified FITS images, spectra, band images and feature maps. HDU, plane and
pixel indices are zero-based. Cubes require an explicit plane for image export.
Export writes FITS images or ECSV spectra, PNG, SVG, CSV and a pinned receipt.
The output directory must be new. No browser or viewer service is required.
Surface publication remains telescope:publish-map; sphere and physical 3D adapters need geometry.
Exit codes: 0 ready/fulfilled, 1 operation failed, 2 invalid arguments,
3 no retrievable choice or unresolved request, 4 refused request.
The npm command accepts --workspace PATH (or CSSEARTH_WORKSPACE) for a css.earth science checkout.
`;

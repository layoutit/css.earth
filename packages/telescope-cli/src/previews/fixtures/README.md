These are reduced ALMA DataLink TABLEDATA responses saved on 2026-10-14, used without network access.

- `alma-member.xml`: member `uid://A001/X1465/X1a15`, from `https://almascience.org/datalink/sync?ID=uid://A001/X1465/X1a15`. Retains the product tar's direct row and nested DataLink descriptor. The tar row's ID names the member; the descriptor's ID parameter names the tar.
- `alma-products.xml`: that tar's nested DataLink, from `https://almascience.eso.org/datalink/sync?ID=2019.1.01098.S_uid___A001_X1465_X1a15_001_of_001.tar`. Retains the Betelgeuse continuum and a calibrator's SODA rows and descriptors, proving that selecting a member alone does not select its science target.

Only rows/resources were removed and XML formatting changed. Cube preference tests replace the continuum product name with a synthetic spectral-window cube name. MAST response rows and tiny FITS arrays are synthetic in-memory fixtures. Optional real-source tests use the ignored approved mock inputs when present; no large FITS input is committed here.

`sphere-area-panel.json` pins the corrected SPHERE panel for `ADP.2026-08-19T13:19:07.649.fits` (pick 43). It deliberately replaces that pick's approved nearest-pixel panel: stretch the whole image with the 5th/99.7th percentile asinh rule, centre-crop a square, area-average fractional pixel overlaps into 30 by 60 cells, round to three decimals, then render the existing ramp. The real FITS input remains under the ignored mock sources.

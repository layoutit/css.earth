# Astronomy package ownership

cssEarth uses upstream packages where they can own a complete mechanical boundary. Scientific selection, input pins, reducers,
product records and evidence remain cssEarth contracts.

The machine-readable contract is
[`tools/objects/astronomy-packages/ownership.json`](../tools/objects/astronomy-packages/ownership.json). The sole Python process
boundary is `client.mts`; callers choose a named operation rather than importing Python packages or reproducing a protocol.

## Owned upstream

- **PyVO 1.9.1 owns TAP and VOTable decoding.** ALMA, ESO, Chandra, KOA, CADC, SIMBAD, OiDB and VizieR now use the same
  `tap-query` operation. Archive-specific downloads and calibration associations stay with their archive clients.
- **Astroquery 0.4.11 owns supported archive APIs.** It handles MAST, ALMA product discovery, VizieR cone searches and the JPL
  Horizons calls used by Chandra, Hubble and Juno.
- **Astropy owns the table, units and coordinates inside that Python boundary.** Its FITS/WCS implementation remains the
  independent oracle for the TypeScript production reader.

## Whole implementations retained here

A candidate package is not adopted per field or per happy path. SPHERE's legacy pinned Horizons tables, PDS product decoding,
SPICE kernel evaluation, streaming FITS reads and the qualified Spitzer route remain entirely in their current implementations.
The ownership contract records the measured reason for each decision. A later migration must move a complete operation and pass
the real products that operation serves.

The lock file uses hashes and `--no-deps`; package versions and the environment descriptor are part of the toolchain digest.
Astroquery, PyVO and Astropy are installed dependencies rather than copied source. Their copyright notices are retained beside
the lock. Observatory data keep their own attribution and reuse terms in each program and source manifest.

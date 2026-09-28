#!/usr/bin/env python3
"""Sample a Gaia DR3 BP/RP continuous spectrum onto the archive's own sampled grid.

  python3 xp-continuous-sample.py <continuous.csv> <sampled.csv>

Gaia publishes externally calibrated *sampled* spectra only for the brightest sources; fainter ones carry the continuous
basis-function coefficients instead. GaiaXPy is the archive's own library for that conversion (Ruz-Mieres 2022,
doi:10.5281/zenodo.6674521), and `calibrate` applies the same external calibration (Montegriffo et al. 2023, A&A 674, A3).
The output is written in the DataLink XP_SAMPLED CSV layout, 343 samples from 336 to 1020 nm in 2 nm steps, so the colour
pipeline reads it exactly as it reads an archive-sampled spectrum.
"""
import csv
import sys
import numpy as np
from gaiaxpy import calibrate

def main(source: str, destination: str) -> None:
    sampling = np.arange(336, 1021, 2)
    table, used = calibrate(source, sampling=sampling, save_file=False)
    if len(table) != 1:
        raise SystemExit(f'{source} must hold exactly one spectrum, not {len(table)}.')
    if not np.array_equal(np.asarray(used), sampling):
        raise SystemExit('GaiaXPy did not return the requested sampling.')
    row = table.iloc[0]
    # The solution identity travels with the coefficients, not with the calibrated samples.
    with open(source, encoding='utf8') as handle:
        solutions = {int(entry['source_id']): int(entry['solution_id']) for entry in csv.DictReader(handle)}
    flux = ','.join(repr(float(value)) for value in row['flux'])
    error = ','.join(repr(float(value)) for value in row['flux_error'])
    with open(destination, 'w', encoding='utf8') as output:
        output.write('source_id,solution_id,ra,dec,flux,flux_error\n')
        output.write(f'{int(row["source_id"])},{solutions[int(row["source_id"])]},,,"({flux})","({error})"\n')

if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])

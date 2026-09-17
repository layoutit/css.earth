#!/usr/bin/env python3
"""Astropy binary-table cells for tools/objects/interferometry/fits-table.mts binaryTable and numbers.
Run with the pinned oracle environment; never imports the TypeScript reader.
The tiny table has every column type an OIFITS file here uses (D, E, I, J, K, L, B, A, complex C and M), an ESO HIERARCH card,
an integer column with TNULL and one scaled column, which the reader must refuse rather than return unscaled.
"""
import sys
from pathlib import Path
import astropy
from astropy.io import fits
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, write

rows = 4
rng = np.random.default_rng(20260917)
columns = [
    fits.Column(name='TIME', format='D', array=rng.normal(size=rows) * 1e5),
    fits.Column(name='VIS2DATA', format='3E', array=rng.normal(size=(rows, 3)).astype(np.float32)),
    fits.Column(name='TARGET_ID', format='I', array=np.array([1, -2, 32767, -32768], dtype=np.int16)),
    fits.Column(name='STA_INDEX', format='2J', null=-2147483648, array=np.array([[1, 2], [-2147483648, 4], [5, -2147483648], [7, 8]], dtype=np.int32)),
    fits.Column(name='MJD_NS', format='K', array=np.array([2 ** 52, -(2 ** 40), 0, 12345678901], dtype=np.int64)),
    fits.Column(name='FLAG', format='3L', array=np.array([[True, False, True], [False, False, False], [True, True, True], [False, True, False]])),
    fits.Column(name='BYTE', format='B', null=255, array=np.array([0, 255, 17, 254], dtype=np.uint8)),
    fits.Column(name='INSNAME', format='16A', array=np.array(['MATISSE_LM', 'GRAVITY_SC', 'PIONIER', ''])),
    fits.Column(name='VISDATA', format='2C', array=(rng.normal(size=(rows, 2)) + 1j * rng.normal(size=(rows, 2))).astype(np.complex64)),
    fits.Column(name='VISERR', format='M', array=rng.normal(size=rows) - 1j * rng.normal(size=rows)),
    fits.Column(name='SCALED', format='I', array=np.array([0, 1, 2, -1], dtype=np.int16)),
]
table = fits.BinTableHDU.from_columns(columns, name='OI_TEST')
# Declared after the column is built, so the stored integers stay as written and only a reader that applies TSCAL/TZERO changes them.
table.header['TSCAL11'], table.header['TZERO11'] = 0.5, 10.0
table.header['INSNAME'] = 'ORACLE'
table.header['HIERARCH ESO PRO CATG'] = 'CALIB_RAW_INT'
path = ROOT / 'tests/fixtures/fits/binary-table-columns.fits'
fits.HDUList([fits.PrimaryHDU(), table]).writeto(path, overwrite=True)

with fits.open(path, memmap=False, mask_and_scale=False) as hdus:
    hdu = hdus['OI_TEST']
    data, header = hdu.data, hdu.header
    cells = {}
    for index, column in enumerate(hdu.columns, start=1):
        if column.format.startswith(('A',)) or column.format.endswith('A'):
            cells[column.name] = [str(v) for v in data[column.name]]
            continue
        if column.name == 'SCALED':
            continue
        raw = np.asarray(data.field(index - 1))
        out = []
        for row in range(rows):
            value = np.atleast_1d(raw[row])
            if np.iscomplexobj(value):
                out.append([float(x) for pair in zip(value.real, value.imag) for x in pair])
            elif value.dtype == bool:
                out.append([1.0 if x else 0.0 for x in value])
            else:
                null = column.null
                out.append([None if null is not None and int(x) == null else float(x) for x in value])
        cells[column.name] = out
    cases = {'oi-test': {'extname': 'OI_TEST', 'rows': rows, 'rowBytes': int(header['NAXIS1']),
                         'columns': [{'name': c.name, 'format': c.format} for c in hdu.columns], 'scaled': ['SCALED'],
                         'hierarch': {'ESO PRO CATG': header['HIERARCH ESO PRO CATG']}, 'insname': header['INSNAME'], 'cells': cells}}
write('fits/binary-table.json', 'astropy', 'tools/oracles/fits/binary-table.py', {'astropy': astropy.__version__}, [path], cases)

#!/usr/bin/env python3
"""Offline test for exact range assembly; it never contacts Zenodo."""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from astropy.io import fits


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("edenhofer_restore", HERE / "restore.py")
assert SPEC and SPEC.loader
restore = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = restore
SPEC.loader.exec_module(restore)


def header_bytes(header: fits.Header) -> bytes:
    return header.tostring(sep="", endcard=True, padding=True).encode("ascii")


class FakeFetcher:
    """A sparse 15.7 GB FITS: headers plus only requested parent rows exist."""

    def __init__(self) -> None:
        self.calls: list[tuple[int, int]] = []
        primary = fits.Header()
        primary["SIMPLE"] = True
        primary["BITPIX"] = 8
        primary["NAXIS"] = 0
        primary["EXTEND"] = True
        self.primary = header_bytes(primary)
        self.mean = self.image_header("MEAN")
        self.std = self.image_header("STD.")
        self.mean_offset = len(self.primary)
        self.mean_data = self.mean_offset + len(self.mean)
        self.data_bytes = 1251**3 * 4
        self.std_offset = self.mean_data + ((self.data_bytes + restore.BLOCK - 1) // restore.BLOCK) * restore.BLOCK
        self.std_data = self.std_offset + len(self.std)

    @staticmethod
    def image_header(name: str) -> bytes:
        header = fits.Header()
        header["XTENSION"] = "IMAGE"
        header["BITPIX"] = -32
        header["NAXIS"] = 3
        for axis in (1, 2, 3):
            header[f"NAXIS{axis}"] = 1251
            header[f"CTYPE{axis}"] = "XYZ"[axis - 1]
            header[f"CUNIT{axis}"] = "pc"
            header[f"CDELT{axis}"] = 2.0
            header[f"CRVAL{axis}"] = -1250.0
            header[f"CRPIX{axis}"] = 1.0
        header["PCOUNT"] = 0
        header["GCOUNT"] = 1
        header["EXTNAME"] = name
        header["CUNIT"] = "E of Zhang, Green, and Rix (2023)"
        return header_bytes(header)

    def bytes_for(self, start: int, stop: int) -> bytes:
        for offset, header in ((0, self.primary), (self.mean_offset, self.mean), (self.std_offset, self.std)):
            if offset <= start <= stop < offset + len(header):
                return header[start - offset : stop - offset + 1]
        for data_offset, added in ((self.mean_data, 0.0), (self.std_data, 100_000_000.0)):
            if data_offset <= start <= stop < data_offset + self.data_bytes:
                first = (start - data_offset) // 4
                values = np.arange(first, first + (stop - start + 1) // 4, dtype=np.int64).astype(np.float32) + added
                return values.astype(">f4", copy=False).tobytes()
        raise AssertionError(f"unexpected fake byte range {start}-{stop}")

    def __call__(self, url: str, bounds: tuple[int, int]) -> restore.HttpReply:
        assert url == "fake://edenhofer"
        self.calls.append(bounds)
        start, stop = bounds
        body = self.bytes_for(start, stop)
        return restore.HttpReply(206, {"content-length": str(len(body)), "content-range": f"bytes {start}-{stop}/{restore.PARENT_BYTES}"}, body)


class RestoreTest(unittest.TestCase):
    def test_fake_ranges_assemble_exact_rows_and_shift_wcs(self) -> None:
        fetcher = FakeFetcher()
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "crop.fits"
            bytes_written, digest = restore.restore(output, url="fake://edenhofer", fetcher=fetcher, expected_sha256=None)
            self.assertEqual(bytes_written, restore.OUTPUT_BYTES)
            self.assertEqual(len(digest), 64)
            # Three FITS headers plus 96 contiguous Y spans for each extension:
            # the bounded plane strategy makes 195 requests, not 18,432 rows.
            self.assertEqual(len(fetcher.calls), 195)
            self.assertTrue(all(stop - start + 1 == 96 * 1251 * 4 for start, stop in fetcher.calls[3:]))
            with fits.open(output) as hdus:
                self.assertEqual(hdus[1].data.shape, (96, 96, 96))
                index = (500 * 1251 + 450) * 1251 + 400
                self.assertEqual(hdus[1].data[0, 0, 0], np.float32(index))
                self.assertEqual(hdus[2].data[0, 0, 0], np.float32(index + 100_000_000))
                self.assertEqual(hdus[1].header["CRPIX1"], -399.0)
                self.assertEqual(hdus[1].header["CRPIX2"], -449.0)
                self.assertEqual(hdus[1].header["CRPIX3"], -499.0)
                self.assertEqual(hdus[1].header["CUNIT"], "E of Zhang, Green, and Rix (2023)")

    def test_rejects_non_206_and_bad_content_range_length(self) -> None:
        bad = restore.HttpReply(200, {"content-length": "1", "content-range": "bytes 0-0/15662543040"}, b"x")
        with self.assertRaisesRegex(restore.RestoreError, "HTTP 206"):
            restore.fetch_range(lambda _url, _range: bad, "fake://edenhofer", (0, 0))
        bad_length = restore.HttpReply(206, {"content-length": "2", "content-range": "bytes 0-0/15662543040"}, b"x")
        with self.assertRaisesRegex(restore.RestoreError, "Content-Length"):
            restore.fetch_range(lambda _url, _range: bad_length, "fake://edenhofer", (0, 0))


if __name__ == "__main__":
    unittest.main()

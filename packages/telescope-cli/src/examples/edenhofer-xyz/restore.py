#!/usr/bin/env python3
"""Restore one small, pinned physical-XYZ FITS crop from the Edenhofer v1.0.2 parent.

The parent is 15.7 GB.  This program asks the archive only for FITS headers and
one bounded Y span from each selected Z plane. It never downloads the parent
file. Astroquery is deliberately checked
alongside Astropy because this example belongs to the repository's pinned
``astronomy-packages`` toolchain, even though HTTP Range is handled by urllib.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Mapping, Sequence
from urllib.request import Request, urlopen

import numpy as np
from astropy.io import fits


RECORD = "10658339"
DOI = "10.5281/zenodo.10658339"
URL = "https://zenodo.org/records/10658339/files/mean_and_std_xyz.fits?download=1"
PARENT_BYTES = 15_662_543_040
PARENT_MD5 = "13ddd81b5e35e01582b74e0ec8db0fe5"
OUTPUT_SHA256 = "c4338d130262e349b41951edbdf18b5fcb064ae9f6d0b1ba0d688c20627abd33"
OUTPUT_BYTES = 7_087_680
CROP_START = (400, 450, 500)  # FITS X, Y, Z; end-exclusive below.
CROP_STOP = (496, 546, 596)
SHAPE = tuple(stop - start for start, stop in zip(CROP_START, CROP_STOP))
BLOCK = 2880
ASTROPY_VERSION = "8.0.1"
ASTROQUERY_VERSION = "0.4.11"


class RestoreError(RuntimeError):
    """The archive reply or source structure cannot establish this crop."""


@dataclass(frozen=True)
class HttpReply:
    status: int
    headers: Mapping[str, str]
    body: bytes


ByteRange = tuple[int, int]  # inclusive
Fetcher = Callable[[str, ByteRange], HttpReply]
Progress = Callable[[int], None]


def require_toolchain() -> None:
    found_astropy = importlib.metadata.version("astropy")
    found_astroquery = importlib.metadata.version("astroquery")
    if (found_astropy, found_astroquery) != (ASTROPY_VERSION, ASTROQUERY_VERSION):
        raise RestoreError(
            "This example requires the pinned astronomy-packages toolchain "
            f"(astropy {ASTROPY_VERSION}, astroquery {ASTROQUERY_VERSION}); found "
            f"astropy {found_astropy}, astroquery {found_astroquery}."
        )


def http_fetch(url: str, bounds: ByteRange) -> HttpReply:
    start, stop = bounds
    if start < 0 or stop < start:
        raise RestoreError("Range request has invalid inclusive bounds.")
    header = f"bytes={start}-{stop}"
    request = Request(url, headers={"Range": header, "Accept-Encoding": "identity"})
    with urlopen(request, timeout=90) as response:  # nosec B310: URL is pinned above/CLI only
        return HttpReply(
            status=response.status,
            headers={key.lower(): value for key, value in response.headers.items()},
            body=response.read(),
        )


_CONTENT_RANGE = re.compile(r"^bytes (\d+)-(\d+)/(\d+)$")


def parse_content_range(value: str) -> tuple[int, int, int]:
    match = _CONTENT_RANGE.match(value.strip())
    if not match:
        raise RestoreError(f"Invalid Content-Range: {value!r}")
    return tuple(int(part) for part in match.groups())  # type: ignore[return-value]


def _require_response(reply: HttpReply) -> None:
    if reply.status != 206:
        raise RestoreError(f"Expected HTTP 206 for range restoration, received {reply.status}.")
    length = reply.headers.get("content-length")
    if length is None or not length.isdecimal() or int(length) != len(reply.body):
        raise RestoreError("HTTP Content-Length does not match the received range body.")


def fetch_range(fetcher: Fetcher, url: str, bounds: ByteRange, expected_total: int | None = PARENT_BYTES) -> bytes:
    """Fetch one exact byte range, proving 206, Content-Range and body length."""
    start, stop = bounds
    if start < 0 or stop < start:
        raise RestoreError("Range request has invalid inclusive bounds.")
    reply = fetcher(url, bounds)
    _require_response(reply)
    value = reply.headers.get("content-range")
    if value is None:
        raise RestoreError("HTTP 206 reply has no Content-Range.")
    actual_start, actual_stop, total = parse_content_range(value)
    if (actual_start, actual_stop) != bounds:
        raise RestoreError(f"Archive returned {actual_start}-{actual_stop}, not requested {start}-{stop}.")
    if expected_total is not None and total != expected_total:
        raise RestoreError(f"Content-Range total {total} differs from the pinned parent size {expected_total}.")
    if len(reply.body) != stop - start + 1:
        raise RestoreError(f"Range {bounds} body length is not its Content-Range length.")
    return reply.body


def _header_end(raw: bytes) -> int | None:
    for offset in range(0, len(raw), 80):
        if raw[offset : offset + 8] == b"END     ":
            return ((offset + 80 + BLOCK - 1) // BLOCK) * BLOCK
    return None


def read_header(fetcher: Fetcher, url: str, offset: int) -> tuple[fits.Header, int]:
    raw = b""
    while True:
        span = (offset + len(raw), offset + len(raw) + BLOCK - 1)
        raw += fetch_range(fetcher, url, span)
        length = _header_end(raw)
        if length is not None:
            return fits.Header.fromstring(raw[:length].decode("ascii"), sep=""), length
        if len(raw) >= 64 * BLOCK:
            raise RestoreError("FITS header has no END card within 64 blocks.")


def data_layout(header: fits.Header, header_offset: int, header_bytes: int) -> tuple[int, int, int]:
    try:
        bitpix, naxis = int(header["BITPIX"]), int(header["NAXIS"])
        dimensions = [int(header[f"NAXIS{axis}"]) for axis in range(1, naxis + 1)]
        pcount, gcount = int(header.get("PCOUNT", 0)), int(header.get("GCOUNT", 1))
    except (KeyError, ValueError, TypeError) as error:
        raise RestoreError("FITS HDU has no usable data-layout cards.") from error
    if bitpix != -32 or naxis != 3 or any(size <= 0 for size in dimensions) or pcount != 0 or gcount != 1:
        raise RestoreError("Edenhofer crop requires an uncompressed 3-D BITPIX=-32 image HDU.")
    bytes_per_element = abs(bitpix) // 8
    data_bytes = bytes_per_element * dimensions[0] * dimensions[1] * dimensions[2]
    padded = ((data_bytes + BLOCK - 1) // BLOCK) * BLOCK
    return header_offset + header_bytes, data_bytes, padded


def require_parent_headers(primary: fits.Header, mean: fits.Header, stddev: fits.Header) -> None:
    if int(primary["NAXIS"]) != 0:
        raise RestoreError("Expected the parent primary HDU to contain no image data.")
    for label, header in (("MEAN", mean), ("STD.", stddev)):
        if str(header.get("EXTNAME", "")).strip() != label:
            raise RestoreError(f"Expected {label} extension, found {header.get('EXTNAME')!r}.")
        if tuple(int(header[f"NAXIS{axis}"]) for axis in (1, 2, 3)) != (1251, 1251, 1251):
            raise RestoreError(f"{label} dimensions no longer match v1.0.2.")
        if [str(header.get(f"CTYPE{axis}", "")).strip() for axis in (1, 2, 3)] != ["X", "Y", "Z"]:
            raise RestoreError(f"{label} is not the declared Cartesian XYZ grid.")
        if [str(header.get(f"CUNIT{axis}", "")).strip() for axis in (1, 2, 3)] != ["pc", "pc", "pc"]:
            raise RestoreError(f"{label} axes are no longer parsecs.")
        if str(header.get("CUNIT", "")).strip() != "E of Zhang, Green, and Rix (2023)":
            raise RestoreError(f"{label} no longer has its pinned nonstandard unnumbered CUNIT.")


def require_audited_quantity_unit(parent: fits.Header) -> None:
    if str(parent.get("CUNIT", "")).strip() != "E of Zhang, Green, and Rix (2023)":
        raise RestoreError("Parent scalar quantity unit no longer matches the audited crop header.")


def fits_header(cards: Sequence[str]) -> bytes:
    raw = "".join(card.ljust(80) for card in (*cards, "END"))
    return raw.ljust(((len(raw) + BLOCK - 1) // BLOCK) * BLOCK).encode("ascii")


def audited_primary_header() -> bytes:
    return fits_header((
        "SIMPLE  =                    T / conforms to FITS standard",
        "BITPIX  =                    8 / array data type",
        "NAXIS   =                    0 / number of array dimensions",
        "EXTEND  =                    T",
        "AUTHOR  = 'Gordian Edenhofer et al.'",
        "DATE    = '2026-09-20'",
        "VERSION = 'audit crop'",
        "REF     = 'Data product accompanying Edenhofer et al. (2023).'",
        "HISTORY = 'Bounded byte-range crop of Zenodo 10658339 mean_and_std_xyz.fits.'",
        "HISTORY = 'Source MD5 13ddd81b5e35e01582b74e0ec8db0fe5.'",
    ))


def audited_extension_header(name: str) -> bytes:
    return fits_header((
        "XTENSION= 'IMAGE' / Image extension",
        "BITPIX  =                  -32 / array data type",
        "NAXIS   =                    3",
        "NAXIS1  =                   96",
        "NAXIS2  =                   96",
        "NAXIS3  =                   96",
        "PCOUNT  =                    0",
        "GCOUNT  =                    1",
        f"EXTNAME = '{name}'",
        "CTYPE1  = 'X'",
        "CUNIT1  = 'pc'",
        "CDELT1  =                    2",
        "CRVAL1  =                -1250",
        "CRPIX1  =                 -399",
        "CTYPE2  = 'Y'",
        "CUNIT2  = 'pc'",
        "CDELT2  =                    2",
        "CRVAL2  =                -1250",
        "CRPIX2  =                 -449",
        "CTYPE3  = 'Z'",
        "CUNIT3  = 'pc'",
        "CDELT3  =                    2",
        "CRVAL3  =                -1250",
        "CRPIX3  =                 -499",
        "CUNIT   = 'E of Zhang, Green, and Rix (2023)' / source nonstandard quantity unit",
        "AUTHOR  = 'Gordian Edenhofer et al.'",
        "VERSION = 'v1.0'",
        "REF     = 'Data product accompanying Edenhofer et al. (2023).'",
        "HISTORY = 'Source FITS array Z,Y,X; FITS axes X,Y,Z.'",
        "HISTORY = 'Source grid indices: X[400:496), Y[450:546), Z[500:596).'",
    ))


def encode_image(data: np.ndarray) -> bytes:
    payload = np.asarray(data, dtype=">f4").tobytes(order="C")
    return payload + bytes((-len(payload)) % BLOCK)


def plane_ranges(data_offset: int) -> list[ByteRange]:
    result: list[ByteRange] = []
    _, y0, z0 = CROP_START
    nx = ny = 1251
    plane_bytes = SHAPE[1] * nx * 4
    for z in range(z0, z0 + SHAPE[2]):
        start = data_offset + (((z * ny + y0) * nx) * 4)
        result.append((start, start + plane_bytes - 1))
    return result


def fetch_cube(fetcher: Fetcher, url: str, data_offset: int, progress: Progress | None = None) -> np.ndarray:
    ranges = plane_ranges(data_offset)
    planes: list[np.ndarray] = []
    for span in ranges:
        # One ordinary contiguous HTTP Range per selected Z plane.
        payload = fetch_range(fetcher, url, span)
        if progress is not None:
            progress(len(payload))
        plane = np.frombuffer(payload, dtype=">f4").reshape((SHAPE[1], 1251))
        planes.append(plane[:, CROP_START[0] : CROP_STOP[0]])
    return np.stack(planes).copy()


def restore(output: Path, *, url: str = URL, fetcher: Fetcher = http_fetch, expected_sha256: str | None = OUTPUT_SHA256, progress: Progress | None = None) -> tuple[int, str]:
    primary, primary_bytes = read_header(fetcher, url, 0)
    mean_offset = primary_bytes
    mean, mean_header_bytes = read_header(fetcher, url, mean_offset)
    mean_data_offset, mean_data_bytes, mean_padded_bytes = data_layout(mean, mean_offset, mean_header_bytes)
    std_offset = mean_data_offset + mean_padded_bytes
    stddev, std_header_bytes = read_header(fetcher, url, std_offset)
    std_data_offset, std_data_bytes, _ = data_layout(stddev, std_offset, std_header_bytes)
    if std_data_offset + std_data_bytes > PARENT_BYTES:
        raise RestoreError("Declared parent file ends before the STD. data array.")
    require_parent_headers(primary, mean, stddev)
    require_audited_quantity_unit(mean)
    require_audited_quantity_unit(stddev)
    mean_crop = fetch_cube(fetcher, url, mean_data_offset, progress)
    std_crop = fetch_cube(fetcher, url, std_data_offset, progress)
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise RestoreError(f"Refusing to overwrite existing output: {output}")
    output.write_bytes(
        audited_primary_header()
        + audited_extension_header("MEAN") + encode_image(mean_crop)
        + audited_extension_header("STD.") + encode_image(std_crop)
    )
    payload = output.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    if len(payload) != OUTPUT_BYTES:
        raise RestoreError(f"Output has {len(payload)} bytes; expected {OUTPUT_BYTES}.")
    if expected_sha256 is not None and digest != expected_sha256:
        raise RestoreError(f"Output SHA-256 {digest} differs from pinned {expected_sha256}.")
    return len(payload), digest


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path, help="new mean_and_std_xyz.crop-400-496-450-546-500-596.fits path")
    parser.add_argument("--url", default=URL, help="pinned Zenodo file URL; override only for an explicit mirror")
    args = parser.parse_args(argv)
    require_toolchain()
    transferred = 0
    next_report = 10 * 1024 * 1024
    def report(size: int) -> None:
        nonlocal transferred, next_report
        transferred += size
        if transferred >= next_report:
            print(f"range restoration transferred {transferred / 1_000_000:.1f} MB", file=sys.stderr)
            next_report += 10 * 1024 * 1024
    bytes_written, digest = restore(args.out, url=args.url, progress=report)
    print(f"restored {args.out}: {bytes_written} bytes sha256 {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Write a .gxct fixture with the Python implementation, for the parity check.

Deliberately stdlib-only so CI can run it without installing the pipeline.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "pipeline"))

from galaxio_pipeline.formats.catalog import write_catalog  # noqa: E402

write_catalog(
    Path(sys.argv[1]),
    count=3,
    columns={
        "posPc": {"type": "f32", "components": 3, "data": [1, 2, 3, 4, 5, 6, 7, 8, 9]},
        "hip": {"type": "i32", "data": [71683, 32349, 91262]},
        "absMag": {"type": "f64", "data": [4.38, 1.42, 0.58]},
        "name": {"type": "str", "data": ["Rigil Kentaurus", "Sirius", "β Cygni"]},
    },
    meta={"source": "parity-fixture", "epoch": "J2000"},
)

#!/usr/bin/env python3
"""pvl and numpy oracle for the ISIS2 QUBE products of Borrelly's MICAS
orthographic image and DEM components: the SFDU-prefixed PVL label is parsed by
pvl, the core is read from its record pointer, and special pixels are recognised
by their bit patterns; isis2-qube.mts must reproduce the samples and the
valid-pixel count of each cube.
Usage: .local/oracles/venv/bin/python tools/oracles/isis2/borrelly-micas.py
"""
import re, sys
from pathlib import Path
import numpy as np
import pvl
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, samples, write, find

source = ROOT / 'src/planets/comet-19p/source/micas'
paths = [source / name for name in ['ccd_near_1_ortho.cub', 'dem_x_component.cub', 'dem_y_component.cub', 'dem_z_component.cub']]
NULL, LOW_REPR, LOW_INSTR, HIGH_INSTR, HIGH_REPR = 0xFF7FFFFB, 0xFF7FFFFC, 0xFF7FFFFD, 0xFF7FFFFE, 0xFF7FFFFF
cubes = {}
for k, path in enumerate(paths):
    raw = path.read_bytes()
    text = raw[:65536].decode('latin1'); end = re.search(r'^END\s*$', text, re.M).end()
    label = pvl.loads(text[text.index('\n') + 1:end])  # the SFDU line precedes the PVL
    record = int(find(label, 'RECORD_BYTES')); pointer = int(find(label, '^QUBE')); qube = find(label, 'QUBE')
    items = [int(v) for v in qube['CORE_ITEMS']]; width, height = items[0], items[1]
    core = np.frombuffer(raw, dtype='<u4', count=width * height, offset=(pointer - 1) * record)
    special = (core >= NULL) & (core <= HIGH_REPR)
    values = np.where(special, np.nan, core.view('<f4').astype(np.float64))
    cubes[path.name] = {'width': width, 'height': height, 'coreItemType': str(qube['CORE_ITEM_TYPE']), 'axisName': [str(v) for v in qube['AXIS_NAME']],
                        'specialCounts': {name: int((core == code).sum()) for name, code in [('null', NULL), ('lowRepr', LOW_REPR), ('lowInstr', LOW_INSTR), ('highInstr', HIGH_INSTR), ('highRepr', HIGH_REPR)]},
                        'validCount': int((~special).sum()), 'samples': samples(values, 500 + k, 48, ~special)}
write('isis2/borrelly-micas.json', 'pvl', 'tools/oracles/isis2/borrelly-micas.py', {'pvl': pvl.__version__}, paths, {'cubes': cubes})

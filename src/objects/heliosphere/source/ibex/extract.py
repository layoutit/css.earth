"""Extract the publisher's Figure 8 HP grid; retain its positions and open its tail.

Python 3 standard library only. No publisher JavaScript is executed. --check
compares both checked numerical derivatives against extraction from originals.
"""
import gzip
import hashlib
import io
import json
import math
import pathlib
import sys
import tarfile
import xml.etree.ElementTree as E
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
PINS = {
    'apjsabf658.tar.gz': '879656b96640a0fa98642884cf15ee120abcb89fbffaa1c2ab027b810412682d',
    'apjsabf658f8_int.html.gz': '6f598f4576ad24a7b53930a4dd6ee92fd143aad32393c5d31f552e38b27bcb1e',
}
for filename, expected in PINS.items():
    if hashlib.sha256((ROOT / filename).read_bytes()).hexdigest() != expected:
        raise ValueError('Source hash mismatch: ' + filename)
with tarfile.open(ROOT / 'apjsabf658.tar.gz') as archive:
    workbook_bytes = archive.extractfile('Table_heliosphere_dimensions_supplement.xlsx').read()
if hashlib.sha256(workbook_bytes).hexdigest() != '29a5fd047ac9370eed6365e52542ec8f5dcc9a9d606144f221b292db13818e34':
    raise ValueError('Original workbook hash mismatch')
with zipfile.ZipFile(io.BytesIO(workbook_bytes)) as workbook:
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    strings = [''.join(t.text or '' for t in row.iter('{' + ns['m'] + '}t'))
               for row in E.fromstring(workbook.read('xl/sharedStrings.xml'))]
    table = {}
    for row in E.fromstring(workbook.read('xl/worksheets/sheet1.xml')).findall('.//m:row', ns):
        values = {}
        for cell in row.findall('m:c', ns):
            v = cell.find('m:v', ns)
            if v is not None:
                col = ''.join(c for c in cell.attrib['r'] if c.isalpha())
                values[col] = strings[int(v.text)] if cell.attrib.get('t') == 's' else v.text
        if all(k in values for k in ['B', 'C', 'L', 'N']):
            longitude, latitude = float(values['B']), float(values['C'])
            table[(longitude, latitude)] = {
                'longitudeDeg': longitude, 'latitudeDeg': latitude,
                'models': {name: {'terminationShockAu': float(values[columns[0]]),
                                  'heliosheathThicknessAu': float(values[columns[1]]),
                                  'heliopauseAu': float(values[columns[2]])}
                           for name, columns in [('uniform100Au', 'DEF'), ('voyager', 'GHI'), ('zirnsteinHeerikhuisen', 'JKL')]},
                'correlationUniform100Au': float(values['M']),
                'category': int(values['N']), 'comment': values.get('O', ''),
            }
if len(table) != 56:
    raise ValueError('Expected all 56 original macropixels')
html_bytes = gzip.decompress((ROOT / 'apjsabf658f8_int.html.gz').read_bytes())
if hashlib.sha256(html_bytes).hexdigest() != '283cab7ada16be5d8e729f3d3799fd2fec3c0ef9f26b463c0a4fa9b45729b6cf':
    raise ValueError('Original Figure 8 HTML hash mismatch')
html = html_bytes.decode()
start = html.find('[', html.rfind('Plotly.newPlot('))
traces, _ = json.JSONDecoder().raw_decode(html[start:])
hp = traces[0]
if hp['type'] != 'surface' or hp['colorscale'] != [[0, 'cyan'], [1, 'cyan']]:
    raise ValueError('Expected the original cyan heliopause surface')
if not all(len(hp[k]) == 13 and all(len(r) == 7 for r in hp[k]) for k in 'xyz'):
    raise ValueError('Expected original 13 by 7 grid')
grid, masked, matched = [], [], 0
for i in range(13):
    row = []
    for j in range(7):
        x, y, z = point = [hp[k][i][j] for k in 'xyz']
        radius = math.sqrt(x*x + y*y + z*z)
        longitude = (math.degrees(math.atan2(y, x)) + 165 + 180) % 360 - 180
        latitude = math.degrees(math.asin(z / radius))
        # The publisher places its ±85-degree polar macropixels at the poles.
        key = (0., -85. if j == 0 else 85.) if j in [0, 6] else (float(round(longitude)), float(round(latitude)))
        original = table.get(key)
        if original:
            matched += 1
            if abs(original['models']['zirnsteinHeerikhuisen']['heliopauseAu'] - radius) > 1e-10:
                raise ValueError('Figure and spreadsheet distance disagree')
        elif round(abs(latitude)) != 62:
            raise ValueError('Unexpected interpolation outside published high-latitude rings')
        if original and original['category'] == 3:
            masked.append([i, j])
            row.append(None)
        else:
            row.append(point)
    grid.append(row)
if matched != 67 or len(masked) != 13:
    raise ValueError('Figure/table correspondence or tail mask changed')
outputs = {
    'heliopause-grid.json': {'schema': 'cssearth-surface-grid@1', 'positionsUnits': grid},
    'macropixels.json': {'schema': 'cssearth-ibex-macropixels@1', 'referenceFrame': 'ecliptic-J2000',
                        'rows': list(table.values()), 'tailSoundingLimitGridIndices': masked},
}
if sys.argv[1:] not in ([], ['--check']):
    raise ValueError('Usage: python3 extract.py [--check]')
for filename, value in outputs.items():
    encoded = (json.dumps(value, indent=2) + '\n').encode()
    path = ROOT / filename
    if '--check' in sys.argv:
        if path.read_bytes() != encoded:
            raise ValueError('Checked extraction differs: ' + filename)
    else:
        path.write_bytes(encoded)
    print(filename, len(encoded), hashlib.sha256(encoded).hexdigest())
print('IBEX ORIGINAL EXTRACTION VERIFIED: 56 macropixels; 67 matching entries; 13 tail-limit entries masked')

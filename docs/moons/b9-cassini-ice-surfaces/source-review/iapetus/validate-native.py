"""Independent bounded Iapetus C/N audit. Standard library; no converter import.

Reads only five spectral planes and six navigation planes from each pinned cube.
Full-file SHA-256 is streamed. Outputs diagnostics, not a geographically filled
map or proof of absolute pointing. Coordinates/indices in the report are native.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import statistics
import struct
import zlib


PINS = {
    'C1568129671_1_ir.cub': 'e7a4d85a4e30022e9a0af4de5ba06e799e0ee0f9ddb6e36c77068eb251a6b861',
    'N1568129671_1_ir.cub': '64a4d7636de33d6458ed95640d8f6cbb3ed8c943e8ddb23fa94e16097ac229fd',
    'C1568133146_2_ir.cub': '8c70f0c76666038d19a08efefbdc0a15f988a8b5bbd0bf69c6813b62248807a2',
    'N1568133146_2_ir.cub': 'a7da80d17d7f17ae10bbc0e8340dcd779f71c760692a689b18edbfb9c43b904f',
}
WAVELENGTHS = {25: 1.28142, 44: 1.59305, 58: 1.82362, 70: 2.02129, 81: 2.20310}
VALID_MIN = struct.unpack('<f', struct.pack('<I', 0xff7ffffa))[0]
NAV_NAMES = ['Phase Angle', 'Emission Angle', 'Incidence Angle',
             'Latitude', 'Longitude', 'Pixel Resolution']
SPECIAL_BITS = {0xff7ffffb: 'NULL', 0xff7ffffc: 'LRS', 0xff7ffffd: 'LIS',
                0xff7ffffe: 'HIS', 0xff7fffff: 'HRS'}


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(65536), b''):
            h.update(block)
    return h.hexdigest()


def value(label, key):
    m = re.search(r'^\s*' + re.escape(key) + r'\s*=\s*([^\n]+)', label, re.M)
    if not m:
        raise ValueError('missing field ' + key)
    return m.group(1).strip().strip('"')


def array(label, key):
    m = re.search(r'\b' + re.escape(key) + r'\s*=\s*\((.*?)\)', label, re.S)
    if not m:
        raise ValueError('missing array ' + key)
    return [x.strip().strip('"') for x in m.group(1).split(',')]


def read(path, requested):
    assert sha256(path) == PINS[path.name], 'complete product changed'
    with path.open('rb') as f:
        raw_header = f.read(65536)
        label = raw_header.decode('ascii').rstrip('\x00')
        core = label.split('Group = Instrument', 1)[0]
        side = int(value(core, 'Samples'))
        assert side == int(value(core, 'Lines'))
        assert value(core, 'Format') == 'Tile'
        assert int(value(core, 'TileSamples')) == side
        assert int(value(core, 'TileLines')) == side
        assert value(core, 'Type') == 'Real' and value(core, 'ByteOrder') == 'Lsb'
        assert int(value(core, 'StartByte')) == 65537
        assert float(value(core, 'Base')) == 0 and float(value(core, 'Multiplier')) == 1
        assert value(label, 'TargetName') == 'IAPETUS' and value(label, 'Channel') == 'IR'
        assert value(label, 'SamplingMode') == 'NORMAL'
        count = int(value(core, 'Bands'))
        assert count == (256 if path.name.startswith('C') else 6)
        if count == 256:
            centers = [float(x) for x in array(label, 'Center')]
            original = [int(x) for x in array(label, 'OriginalBand')]
            for b in requested:
                assert centers[b-1] == WAVELENGTHS[b] and original[b-1] == b+96
        else:
            assert array(label, 'Name') == NAV_NAMES
        planes, offsets = {}, {}
        for band in requested:
            # One full native tile per band. Offset is zero-based bytes.
            offsets[band] = 65536 + 4 * side * side * (band - 1)
            f.seek(offsets[band])
            blob = f.read(4 * side * side)
            assert len(blob) == 4 * side * side
            planes[band] = struct.unpack('<' + 'f' * (side * side), blob)
    return side, label, planes, offsets


def valid(x):
    return math.isfinite(x) and x >= VALID_MIN


def sample_categories(values):
    counts = dict.fromkeys(['valid', 'zero', 'negative', 'nonfinite', 'otherInvalid', *SPECIAL_BITS.values()], 0)
    for x in values:
        bits = struct.unpack('<I', struct.pack('<f', x))[0]
        if bits in SPECIAL_BITS:
            counts[SPECIAL_BITS[bits]] += 1
        elif not math.isfinite(x):
            counts['nonfinite'] += 1
        elif x < VALID_MIN:
            counts['otherInvalid'] += 1
        else:
            counts['valid'] += 1
            counts['zero'] += x == 0
            counts['negative'] += x < 0
    return counts


def stats(values):
    v = sorted(values)
    if not v:
        return {'count': 0}
    return {'count': len(v), 'minimum': v[0], 'p10': v[int(.1*(len(v)-1))],
            'median': statistics.median(v), 'p90': v[int(.9*(len(v)-1))], 'maximum': v[-1]}


def angular_distance(a_lat, a_lon, b_lat, b_lon):
    p, q = math.radians(a_lat), math.radians(b_lat)
    h = math.sin((q-p)/2)**2 + math.cos(p)*math.cos(q)*math.sin(math.radians(b_lon-a_lon)/2)**2
    return 2 * math.asin(min(1, math.sqrt(max(0, h))))


def png(path, side, planes):
    # Diagnostic RGB only: common I/F0..0.45 scale, literal 8x sample replication.
    # No channel normalization, spatial interpolation, registration or gap filling.
    pixels = [tuple(max(0, min(255, round(255*planes[b][i]/.45))) for b in (70,44,25))
              for i in range(side*side)]
    scanlines = bytearray()
    for y in range(side):
        row = bytes(c for x in range(side) for _ in range(8) for c in pixels[y*side+x])
        for _ in range(8):
            scanlines.extend(b'\x00' + row)
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag+data))
    header = struct.pack('>IIBBBBB', side*8, side*8, 8, 2, 0, 0, 0)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header)
                     + chunk(b'IDAT', zlib.compress(scanlines, 6)) + chunk(b'IEND', b''))


def audit(native, out, cube):
    side, c_label, p, offsets = read(native / ('C'+cube+'_ir.cub'), sorted(WAVELENGTHS))
    n_side, n_label, n, n_offsets = read(native / ('N'+cube+'_ir.cub'), range(1,7))
    assert side == n_side
    for key in ('ProductId', 'NativeStartTime', 'NativeStopTime', 'StartTime', 'StopTime'):
        assert value(c_label, key) == value(n_label, key)
    n_pixels = side*side
    # Exact decimal wavelength ratio independently reduced to integers.
    weight = 19767 / 37948
    depth, continuum = [], []
    for i in range(n_pixels):
        rc = (18181*p[58][i] + 19767*p[81][i]) / 37948
        ok = all(valid(p[b][i]) for b in (58,70,81)) and math.isfinite(rc) and rc > 0
        continuum.append(rc if ok else None)
        depth.append(1-p[70][i]/rc if ok else None)
    anchors = []
    for x,y in [(0,0),(side-1,0),(0,side-1),(side-1,side-1),
                (side//4,side//4),(side//2,side//2),(3*side//4,3*side//4)]:
        i = y*side+x
        anchors.append({'sampleZeroBased': x,'lineZeroBased': y,'linearPixelZeroBased': i,
                        'depth': depth[i],'continuum': continuum[i],
                        'rgbIR70_44_25': [p[b][i] for b in (70,44,25)],
                        'depthIR58_70_81': [p[b][i] for b in (58,70,81)],
                        'latDeg': n[4][i],'lonEastDeg': n[5][i],
                        'calibratedByteOffsetsZeroBased': {b:offsets[b]+i*4 for b in WAVELENGTHS},
                        'navigationByteOffsetsZeroBased': {'latitude':n_offsets[4]+i*4,'longitude':n_offsets[5]+i*4}})
    geometry = [i for i in range(n_pixels) if all(valid(n[b][i]) for b in range(1,7))
                and 10 <= n[1][i] <= 120 and 0 <= n[2][i] < 70
                and 0 <= n[3][i] < 70 and -90 <= n[4][i] <= 90
                and 0 <= n[5][i] <= 360 and n[6][i] > 0]
    rows, edges = [], []
    for y in range(side):
        rows.append({'lineZeroBased': y,'latMedian': statistics.median(n[4][y*side:(y+1)*side]),
                     'lonMedian': statistics.median(n[5][y*side:(y+1)*side])})
        for x in range(side):
            i = y*side+x
            for dx,dy in [(1,0),(0,1)]:
                if x+dx >= side or y+dy >= side:
                    continue
                j = (y+dy)*side+x+dx
                angle = angular_distance(n[4][i],n[5][i],n[4][j],n[5][j])
                distance = angle * 736000
                nominal = (n[6][i]+n[6][j])/2
                # Diagnostic tangent-plane aperture bound, NOT an accepted
                # detector footprint: finite exposure, curved surface and
                # time-dependent pointing still require qualification.
                bound = sum(n[6][k] / math.cos(math.radians(n[2][k])) / math.sqrt(2)
                            for k in (i,j))
                edges.append({'sampleZeroBased':x,'lineZeroBased':y,'dx':dx,'dy':dy,
                              'distanceMetersOn736kmSphere':distance,
                              'spacingOverNominalPixelResolution':distance/nominal,
                              'tangentPlaneSquareDiagonalSupportMeters':bound,
                              'spacingOverDiagnosticSupport':distance/bound})
    row_gaps = []
    for y in range(side-1):
        ee = [e for e in edges if e['dy'] and e['lineZeroBased']==y]
        row_gaps.append({'lowerLineZeroBased':y,'upperLineZeroBased':y+1,
                         'distanceMeters':stats([e['distanceMetersOn736kmSphere'] for e in ee]),
                         'nominalSpacingRatios':stats([e['spacingOverNominalPixelResolution'] for e in ee]),
                         'diagnosticSupportRatios':stats([e['spacingOverDiagnosticSupport'] for e in ee]),
                         'samplesExceedingDiagnosticSupport':[e['sampleZeroBased'] for e in ee if e['spacingOverDiagnosticSupport']>1]})
    png(out / (cube+'-native-rgb.png'),side,p)
    return {'id':cube,'dimensions':[side,side],'completeSourceHashesVerified':True,
            'continuumRightWeight':weight,'rgbBandsOneBased':[70,44,25],'depthBandsOneBased':[58,70,81],
            'exactWavelengthsMicrometers':WAVELENGTHS,
            'spectral':{b:{'stats':stats([v for v in a if valid(v)]),'categories':sample_categories(a),'planeOffsetZeroBased':offsets[b]} for b,a in p.items()},
            'navigation':{b:{'name':NAV_NAMES[b-1],'stats':stats([v for v in a if valid(v)]),'categories':sample_categories(a)} for b,a in n.items()},
            'depth':stats([d for d in depth if d is not None]),
            'negativeDepthSamples':[{'sampleZeroBased':i%side,'lineZeroBased':i//side,'depth':d} for i,d in enumerate(depth) if d is not None and d<0],
            'geometryCutPassingNativeCenters':len(geometry),'nativeAnchors':anchors,'rowMedianCoordinates':rows,
            'horizontalSpacingRatio':stats([e['spacingOverNominalPixelResolution'] for e in edges if e['dx']]),
            'verticalSpacingRatio':stats([e['spacingOverNominalPixelResolution'] for e in edges if e['dy']]),
            'rowPairSpacingDiagnostics':row_gaps,
            'worstSpacingEdges':sorted(edges,key=lambda e:e['spacingOverNominalPixelResolution'],reverse=True)[:10],
            'absolutePointingAccuracy':'unresolved','detectorFootprintSupport':'unresolved; diagnostics do not authorize filled cells'}


def main():
    parser = argparse.ArgumentParser()
    root = Path(__file__).resolve().parents[5]
    parser.add_argument('--native-dir',type=Path,default=root/'output/b9-source-intake/iapetus/native')
    parser.add_argument('--output-dir',type=Path,default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True,exist_ok=True)
    report = {'schema':'iapetus-independent-native-audit@1','sourcePins':PINS,
              'method':'stdlib struct selected-plane decode; no converter imported',
              'visualization':'native lines top to bottom; samples left to right; RGB70/44/25; uniform I/F0..0.45; nearest replication8x',
              'results':[audit(args.native_dir,args.output_dir,cube) for cube in ('1568129671_1','1568133146_2')]}
    path = args.output_dir/'independent-native-validation.json'
    path.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'report':str(path),'cubes':len(report['results']),
                      'validSpectra':[r['depth']['count'] for r in report['results']],
                      'mappingRegistration':'not qualified by this source-value audit'}))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Small independent stdlib decoder; no preparer or camera imports.

Run from repository root; optional first argument is the source intake directory.
Only source planes and the original six navigation planes are read. Geometry
cuts match the trial recipe; no brightness-dependent mask is applied.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import statistics
import struct
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
INTAKE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'output/b9-source-intake/tethys'
VALID_MINIMUM = struct.unpack('<f', struct.pack('<I', 0xff7ffffa))[0]


def field(text, name):
    match = re.search(r'^\s*' + re.escape(name) + r'\s*=\s*(\([^)]*\)|[^\n]+)', text, re.M)
    if not match:
        raise ValueError(name)
    return re.sub(r'-\r?\n\s*', '', match[1]).strip()


def values(text, name):
    return [float(x.strip()) for x in field(text, name).strip('()').split(',')]


def valid(value):
    return math.isfinite(value) and value >= VALID_MINIMUM


def read(path, bands):
    with path.open('rb') as stream:
        header = stream.read(65536).split(b'\x00')[0].decode('ascii')
        w, h = int(field(header, 'Samples')), int(field(header, 'Lines'))
        assert field(header, 'Type') == 'Real' and field(header, 'ByteOrder') == 'Lsb'
        assert int(field(header, 'TileSamples')) == w and int(field(header, 'TileLines')) == h
        assert float(field(header, 'Base')) == 0 and float(field(header, 'Multiplier')) == 1
        offset = int(field(header, 'StartByte')) - 1
        planes = {}
        for band in bands:
            stream.seek(offset + (band - 1) * w * h * 4)
            planes[band] = struct.unpack('<' + 'f' * (w * h), stream.read(w * h * 4))
    return header, w, h, planes


def stats(v):
    v = sorted(v)
    if not v:
        return {'n': 0}
    def q(p):
        x = p * (len(v) - 1)
        a = int(x)
        return v[a] + (v[min(a + 1, len(v) - 1)] - v[a]) * (x - a)
    median = q(.5)
    return dict(n=len(v), minimum=v[0], p05=q(.05), median=median, p95=q(.95), maximum=v[-1],
                relativeP05P95Span=(q(.95)-q(.05))/abs(median) if median else None,
                unique=len(set(v)))


def correlation(a, b):
    if len(a) < 2:
        return None
    return statistics.correlation(a, b) if len(set(a)) > 1 and len(set(b)) > 1 else None


def main():
    recipe = json.loads((INTAKE / 'prepare-trial.json').read_text())
    policy = recipe['policy']
    results = []
    for entry in recipe['observations']:
        cpath, npath = INTAKE / entry['calibrated'], INTAKE / entry['navigation']
        bands = list(range(15, 85))
        c, w, h, planes = read(cpath, bands)
        n, nw, nh, nav = read(npath, range(1, 7))
        assert (w,h) == (nw,nh)
        assert field(c, 'ProductId') == field(n, 'ProductId')
        eligible = [i for i in range(w*h) if all(valid(nav[k][i]) for k in nav)
                    and policy['minimumPhaseDegrees'] <= nav[1][i] <= policy['maximumPhaseDegrees']
                    and 0 <= nav[2][i] < policy['maximumIncidenceEmissionDegrees']
                    and 0 <= nav[3][i] < policy['maximumIncidenceEmissionDegrees']
                    and abs(nav[4][i]) <= 90 and 0 <= nav[5][i] <= 360
                    and 0 < nav[6][i] < policy['maximumResolutionMeters']]
        waves = values(c, 'Center')
        band_stats = {}
        for band, data in planes.items():
            use = [i for i in eligible if valid(data[i])]
            both = [i for i in use if valid(planes[44][i])]
            band_stats[str(band)] = dict(wavelengthMicrometers=waves[band-1],
                originalBand=96+band, eligibleSpecialPixels=len(eligible)-len(use),
                values=stats([data[i] for i in use]),
                correlationWithIR44=correlation([data[i] for i in both], [planes[44][i] for i in both]))
        results.append(dict(id=entry['id'], calibratedSha256=hashlib.sha256(cpath.read_bytes()).hexdigest(),
            navigationSha256=hashlib.sha256(npath.read_bytes()).hexdigest(), width=w, height=h,
            exposureDuration=field(c, 'ExposureDuration'), samplingMode=field(c, 'SamplingMode'),
            phase=stats([nav[1][i] for i in eligible]), latitude=stats([nav[4][i] for i in eligible]),
            eastLongitude=stats([nav[5][i] for i in eligible]),
            eligibleIndices=eligible, eligibleCount=len(eligible), bands=band_stats,
            nativeAnchors=[dict(x=i%w,y=i//w,latitude=nav[4][i],eastLongitude=nav[5][i],
                               bands={str(b):planes[b][i] for b in (24,25,26,44,58,70,81)})
                           for i in eligible[::max(1,len(eligible)//5)]]))
    output = {'schema':'b9-tethys-native-spectral-review@1', 'method':'Independent float32 core decoding; geometry only; no brightness masks',
              'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'geometryPolicy':policy, 'observations':results}
    (HERE/'native-spectral-review.json').write_text(json.dumps(output,indent=2,allow_nan=False)+'\n')
    for r in results:
        print(r['id'],r['exposureDuration'],'eligible',r['eligibleCount'],
              'IR25',r['bands']['25']['values'], 'corr44',r['bands']['25']['correlationWithIR44'])


if __name__ == '__main__':
    main()

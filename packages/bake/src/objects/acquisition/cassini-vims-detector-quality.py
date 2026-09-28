#!/usr/bin/env python3
"""Qualify released VIMS-IR pixels against original PDS3 detector counts.

No calibrated-value brightness cutoff is used. Original core + BACKGROUND
recovers the 12-bit ADC count for the supported onboard-subtracted IR format.
Return masks in calibrated C band/sample/line order, flattened row-major.

The archive's noise/lowpass filters have a conservative dependency radius:
5x5 noise decisions (radius 2), then 3x3 replacement (radius 1) => radius 3.
This withholds possible dependencies, not a claim every withheld pixel changed.
The helper does not certify absolute calibration, pointing, or photometry.
"""
import hashlib
import json
from pathlib import Path
import re
import struct

POLICY = 'pds3-ir-adc-background-and-filter-dependencies@1'
ADC_MAXIMUM = 4095
ISIS_MISSING_BACKGROUND = 57344
REFERENCES = {
    'adc': 'https://doi.org/10.1016/j.icarus.2004.07.001',
    'background': 'https://isis.astrogeology.usgs.gov/3.5.0/Application/presentation/Tabbed/vimscal/vimscal.html',
    'pipeline': 'https://vims.univ-nantes.fr/info/isis-calibration',
    'noise': 'https://isis.astrogeology.usgs.gov/3.5.0/Application/presentation/Tabbed/noisefilter/noisefilter.html',
    'lowpass': 'https://isis.astrogeology.usgs.gov/3.5.0/Application/presentation/Tabbed/lowpass/lowpass.html',
    'fitDeltaSource': 'https://raw.githubusercontent.com/DOI-USGS/ISIS3/77c10385ee31526b54cc42b82ee30a1ac4ed8c58/isis/src/cassini/apps/vimscal/vimscal.cpp',
}


def field(text, name):
    found = re.search(r'^\s*' + re.escape(name) + r'\s*=\s*(\([^)]*\)|[^\r\n]+)', text, re.M)
    if not found:
        raise ValueError('Missing native field: ' + name)
    return re.sub(r'-\r?\n\s*', '', found[1]).strip().strip('"')


def sequence(text, name):
    return [v.strip().strip('"') for v in field(text, name).strip('()').split(',')]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def object_text(label, name, kind=None):
    for match in re.finditer(r'^Object\s*=\s*(\w+)\s*\n(.*?)^End_Object', label, re.M | re.S):
        if match[1] == name and (kind is None or field(match[2], 'Name') == kind):
            return match[2]
    raise ValueError('Missing native object: ' + name + ' ' + str(kind))


def blob(data, label, name, kind=None):
    obj = object_text(label, name, kind)
    start, length = int(field(obj, 'StartByte'))-1, int(field(obj, 'Bytes'))
    require(start >= 65536 and length > 0 and start+length <= len(data), 'Invalid attached object bounds')
    return data[start:start+length], obj


def filter_dependency(history):
    operations = list(re.finditer(r'^Object\s*=\s*(\w+)\s*\n(.*?)^End_Object', history, re.M | re.S))
    names = [m[1] for m in operations]
    require(names in (['vims2isis', 'spiceinit', 'vimscal'],
                      ['vims2isis', 'spiceinit', 'vimscal', 'noisefilter', 'lowpass']),
            'Unqualified calibration/filter history: ' + ','.join(names))
    if len(names) == 3:
        return {'radiusSamples': 0, 'radiusLines': 0, 'operations': names,
                'derivation': 'No spatial filters recorded after vimscal'}
    noise, low = operations[3][2], operations[4][2]
    for key, expected in {'TOLDEF':'stddev', 'REPLACE':'null', 'SAMPLES':'5', 'LINES':'5',
                          'NULLISNOISE':'FALSE', 'HISISNOISE':'FALSE', 'HRSISNOISE':'FALSE',
                          'LISISNOISE':'FALSE', 'LRSISNOISE':'FALSE'}.items():
        require(field(noise, key).lower() == expected.lower(), 'Unqualified noisefilter ' + key)
    for key, expected in {'SAMPLES':'3', 'LINES':'3', 'FILTER':'outside', 'NULL':'yes',
                          'HRS':'no', 'HIS':'no', 'LRS':'no', 'REPLACEMENT':'center'}.items():
        require(field(low, key).lower() == expected.lower(), 'Unqualified lowpass ' + key)
    require(field(low, 'LIS').lower() in ('true','yes'), 'Unqualified lowpass LIS')
    return {'radiusSamples': 3, 'radiusLines': 3, 'operations': names,
            'derivation': 'Minkowski sum: radius 2 for 5x5 noise classification plus radius 1 for 3x3 replacement',
            'interpretation': 'Possible source dependency; not a reconstruction of which pixels were replaced'}


def dependency_mask(bad, width, height, rx, ry):
    result = [True] * (width * height)
    for i, value in enumerate(bad):
        if value:
            x, y = i % width, i // width
            for yy in range(max(0,y-ry), min(height,y+ry+1)):
                for xx in range(max(0,x-rx), min(width,x+rx+1)):
                    result[yy*width+xx] = False
    return result


def quality_for_pair(raw_path, calibrated_path, bands):
    """Return {'validByBand': {int: [bool...]}, 'report': JSON-safe evidence}.

    Caller must pin both files in its recipe and intersect these masks with
    calibrated special-value and geometry validity. High ADC clipping and
    out-of-range counts are withheld. Ordinary zero/negative background-
    subtracted values are retained when original codes are otherwise valid.
    """
    raw_path, calibrated_path = Path(raw_path), Path(calibrated_path)
    require(bands and all(type(b) is int and 1 <= b <= 256 for b in bands), 'Invalid IR bands')
    require(len(set(bands)) == len(bands), 'Duplicate IR bands')
    require(raw_path.stat().st_size <= 10_000_000 and calibrated_path.stat().st_size <= 10_000_000,
            'Unqualified large source cube')
    raw, cal = raw_path.read_bytes(), calibrated_path.read_bytes()
    r = raw[:min(len(raw),32768)].decode('ascii', 'replace')
    c = cal[:65536].split(b'\0')[0].decode('ascii')
    width, raw_bands, height = map(int, sequence(r, 'CORE_ITEMS'))
    require(0 < width <= 64 and 0 < height <= 64 and raw_bands == 352, 'Unsupported original dimensions')
    require(tuple(sequence(r, 'AXIS_NAME')) == ('SAMPLE','BAND','LINE'), 'Unsupported original pixel order')
    require(sequence(r, 'SUFFIX_ITEMS') == ['1','4','0'], 'Unsupported original suffix layout')
    for key, expected in {'CORE_ITEM_TYPE':'SUN_INTEGER', 'CORE_ITEM_BYTES':'2',
                          'CORE_BASE':'0.0', 'CORE_MULTIPLIER':'1.0', 'SUFFIX_BYTES':'4',
                          'SAMPLE_SUFFIX_NAME':'BACKGROUND', 'SAMPLE_SUFFIX_ITEM_TYPE':'SUN_INTEGER',
                          'SAMPLE_SUFFIX_ITEM_BYTES':'4', 'SAMPLE_SUFFIX_BASE':'0.0',
                          'SAMPLE_SUFFIX_MULTIPLIER':'1.0', 'SPECTRAL_EDITING_FLAG':'OFF',
                          'SPECTRAL_SUMMING_FLAG':'OFF', 'PACKING':'OFF'}.items():
        require(field(r, key) == expected, 'Unsupported original ' + key)
    require(field(r, 'COMPRESSOR_ID') == field(c, 'CompressorId') == '1', 'Unqualified onboard subtraction/compression')
    require(sequence(r, 'BACKGROUND_SAMPLING_MODE_ID')[0] == 'SINGLE', 'Unqualified IR background sampling')
    require(sequence(r, 'BAND_BIN_ORIGINAL_BAND') == [str(i) for i in range(1,353)], 'Original bands reordered')
    require(sequence(c, 'OriginalBand') == [str(i) for i in range(97,353)], 'Calibrated IR bands reordered')
    require(field(c, 'Channel') == 'IR' and int(field(c, 'Bands')) == 256, 'Calibrated cube is not full IR')
    require(field(c,'Type') == 'Real' and field(c,'ByteOrder') == 'Lsb'
            and float(field(c,'Base')) == 0 and float(field(c,'Multiplier')) == 1,
            'Unsupported calibrated core format')
    require(int(field(c,'TileSamples')) == width and int(field(c,'TileLines')) == height,
            'Unsupported calibrated tile order')
    require(int(field(c, 'Samples')) == width and int(field(c, 'Lines')) == height, 'C/QUB dimensions mismatch')
    for raw_key, cal_key in [('TARGET_NAME','TargetName'), ('PRODUCT_ID','ProductId'),
                             ('NATIVE_START_TIME','NativeStartTime'), ('NATIVE_STOP_TIME','NativeStopTime')]:
        require(field(r, raw_key) == field(c, cal_key), 'C/QUB identity mismatch: ' + raw_key)
    for raw_key, cal_key in [('START_TIME','StartTime'), ('STOP_TIME','StopTime')]:
        require(field(r, raw_key).removesuffix('Z') == field(c, cal_key), 'C/QUB time mismatch')
    require(sequence(r, 'SAMPLING_MODE_ID')[0] == field(c, 'SamplingMode'), 'C/QUB sampling mismatch')
    require(float(sequence(r, 'EXPOSURE_DURATION')[0]) == float(sequence(c, 'ExposureDuration')[0].split()[0]),
            'C/QUB exposure mismatch')
    require(field(c,'CalibrationVersion') == 'RC19' and field(c,'OutputUnits') == 'I/F', 'Unsupported calibration')
    require(field(c,'SideplaneCorrection') == 'Fit Delta', 'Unsupported background recalibration')
    record_bytes = int(field(r,'RECORD_BYTES'))
    require(record_bytes == 512 and len(raw) % record_bytes == 0, 'Original record layout mismatch')
    declared_bytes = int(field(r,'FILE_RECORDS')) * record_bytes
    offset = (int(field(r,'^QUBE'))-1) * record_bytes
    band_stride = width*2 + 4
    line_stride = raw_bands*band_stride + (width+1)*4*4
    core_end = offset+height*line_stride
    require(offset > 0 and core_end <= len(raw) and len(raw)-core_end < record_bytes, 'Original core bounds invalid')
    require(declared_bytes-len(raw) in (0,record_bytes), 'Unqualified original FILE_RECORDS discrepancy')
    history, _ = blob(cal,c,'History')
    filtering = filter_dependency(history.decode('ascii'))
    side_bytes, side_label = blob(cal,c,'Table','SideplaneIr')
    require(field(side_label,'ByteOrder') == 'Lsb' and int(field(side_label,'Records')) == height*256,
            'Invalid calibrated background table')
    require(len(side_bytes) == height*256*12, 'Unexpected background table schema')
    side = {}
    for line, band, value in struct.iter_unpack('<iii',side_bytes):
        require((line,band) not in side and 1<=line<=height and 1<=band<=256, 'Invalid background table ordering')
        side[line,band] = value
    raw_minimum = int(field(r,'CORE_VALID_MINIMUM'))
    require(raw_minimum == -4095, 'Unexpected raw valid minimum')
    raw_specials = {int(field(r,key)) for key in ['CORE_NULL','CORE_LOW_REPR_SATURATION','CORE_LOW_INSTR_SATURATION',
                                                 'CORE_HIGH_REPR_SATURATION','CORE_HIGH_INSTR_SATURATION']}
    bg_minimum = int(field(r,'SAMPLE_SUFFIX_VALID_MINIMUM'))
    require(bg_minimum == 0, 'Unexpected BACKGROUND minimum')
    valid_by_band, per_band = {}, {}
    for band in bands:
        bad, reasons, adc_values, backgrounds = [], {}, [], []
        original_index = band+95
        for y in range(height):
            start = offset+y*line_stride+original_index*band_stride
            background = struct.unpack_from('>i',raw,start+2*width)[0]
            require(background == side[y+1,band], 'C/QUB background values mismatch')
            backgrounds.append(background)
            for x in range(width):
                dn = struct.unpack_from('>h',raw,start+2*x)[0]
                adc = dn+background
                reason = ('raw-special-or-invalid' if dn in raw_specials or dn<raw_minimum else
                          'background-invalid' if not bg_minimum<=background<ADC_MAXIMUM else
                          'adc-high-clipped' if adc>=ADC_MAXIMUM else
                          'adc-out-of-range' if adc<0 else None)
                bad.append(reason is not None)
                adc_values.append(adc)
                if reason:
                    reasons[reason] = reasons.get(reason,0)+1
        # ISIS 3.5.2 maps exact 57344 to Null and excludes it from the fit.
        # Other invalid/clipped backgrounds can contaminate the global fit.
        fit_backgrounds = [v for v in backgrounds if v != ISIS_MISSING_BACKGROUND]
        invalid_background = (len(fit_backgrounds) < 2 or
                              any(not bg_minimum <= v < ADC_MAXIMUM for v in fit_backgrounds))
        if invalid_background:
            mask = [False] * (width*height)
        else:
            mask = dependency_mask(bad,width,height,filtering['radiusSamples'],filtering['radiusLines'])
        valid_by_band[band] = mask
        per_band[str(band)] = {'originalBand':band+96, 'rawReasons':reasons,
            'directInvalidCount':sum(bad), 'validAfterDependencies':sum(mask),
            'invalidAfterDependencies':len(mask)-sum(mask), 'wholeBandBackgroundRejected':invalid_background,
            'backgroundRowsSkippedByIsisFit':[y for y,v in enumerate(backgrounds) if v == ISIS_MISSING_BACKGROUND],
            'backgroundRange':[min(backgrounds),max(backgrounds)],
            'reconstructedAdcRange':[min(adc_values),max(adc_values)],
            'maskSha256':hashlib.sha256(bytes(mask)).hexdigest(),
            'directInvalidIndices':[i for i,b in enumerate(bad) if b]}
    report = {'policy':POLICY, 'target':field(c,'TargetName'), 'productId':field(c,'ProductId'),
        'nativeStartTime':field(c,'NativeStartTime'), 'dimensions':[width,height],
        'originalLayout':{'recordBytes':record_bytes, 'declaredBytes':declared_bytes,
                          'actualBytes':len(raw),'coreStartByteZeroBased':offset,'coreEndByteExclusive':core_end,
                          'declaredMinusActualBytes':declared_bytes-len(raw)},
        'rawSha256':hashlib.sha256(raw).hexdigest(), 'calibratedSha256':hashlib.sha256(cal).hexdigest(),
        'pixelOrder':'original sample-fastest, line-next; calibrated IR band k = original band k+96',
        'reconstructedAdc':'signed original core DN + original per-band/per-line BACKGROUND suffix',
        'adcPolicy':'Withhold ADC codes <0 and >=4095 plus original specials/invalid backgrounds; no C brightness threshold',
        'filterDependencies':filtering, 'bands':per_band, 'sources':REFERENCES,
        'limits':'Does not recover lost saturation, undo archive filtering, detect every noise defect, or establish absolute calibration/pointing.'}
    return {'validByBand':valid_by_band,'report':report}


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('raw')
    parser.add_argument('calibrated')
    parser.add_argument('--bands', type=int, nargs='+', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(json.dumps(quality_for_pair(args.raw,args.calibrated,args.bands),indent=2)+'\n')

"""Render exact native C-cube bands for registration review; no map or fitted mask."""
from pathlib import Path
import hashlib
import json
import math
import re
import struct
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[5]
INPUT = ROOT/'output/b9-source-intake/phoebe/native'
OUTPUT = Path(__file__).resolve().parent
panel = Image.new('RGB', (1000, 760), '#171b22')
draw = ImageDraw.Draw(panel)
font = ImageFont.load_default(size=17)
small = ImageFont.load_default(size=13)
draw.text((20, 14), 'Phoebe: original calibrated native pixels', font=font, fill='white')
draw.text((20, 40), 'Linear min/max display per band. Nearest-neighbor enlargement. Magenta = source special pixel.', font=small, fill='#bec8d2')
receipt = {'scope': 'Native C-band byte display only; no reprojection, image classification, fitting, thresholded silhouette or registration claim.', 'images': []}
for row, ident in enumerate(['1465670650_1', '1465671822_1']):
    for col, channel in enumerate(['vis', 'ir']):
        path = INPUT/f'C{ident}_{channel}.cub'
        data = path.read_bytes()
        label = data[:65536].decode('latin1').split('End\n', 1)[0]
        def integer(key): return int(re.search(r'^\s*'+key+r'\s*=\s*(\d+)', label, re.M).group(1))
        width, height, count = [integer(k) for k in ['Samples', 'Lines', 'Bands']]
        assert integer('TileSamples') == width and integer('TileLines') == height
        bb = re.search(r'Group = BandBin\n(.*?)End_Group', label, re.S).group(1)
        wavelength = [float(v) for v in re.search(r'Center\s*=\s*\((.*?)\)', bb, re.S).group(1).split(',')]
        target = .7 if channel == 'vis' else 1.8
        band = min(range(count), key=lambda k: abs(wavelength[k]-target))
        offset = integer('StartByte')-1+band*width*height*4
        values = struct.unpack_from('<'+'f'*(width*height), data, offset)
        valid = [v for v in values if math.isfinite(v) and abs(v) < 1e30]
        lower, upper = min(valid), max(valid)
        pixels = []
        for value in values:
            if not math.isfinite(value) or abs(value) >= 1e30:
                pixels.append((235, 70, 205))
            else:
                g = round(255*(value-lower)/(upper-lower))
                pixels.append((g, g, g))
        im = Image.new('RGB', (width, height)); im.putdata(pixels)
        x, y = 20+col*490, 88+row*335
        draw.text((x, y), f'{ident} {channel.upper()} / {wavelength[band]:.5f} um', font=font, fill='white')
        draw.text((x, y+25), f'Band {band+1}/{count}; {width}x{height}; I/F {lower:.5g} to {upper:.5g}', font=small, fill='#bec8d2')
        scale = 9
        panel.paste(im.resize((width*scale, height*scale), Image.Resampling.NEAREST), (x, y+55))
        entry = {'observationId': ident, 'channel': channel, 'path': str(path.relative_to(ROOT)),
                 'sourceBytes': len(data), 'sourceSha256': hashlib.sha256(data).hexdigest(),
                 'width': width, 'height': height, 'bandOneBased': band+1,
                 'wavelengthMicrometers': wavelength[band], 'bandStartByteZeroBased': offset,
                 'finiteCount': len(valid), 'minimumIf': lower, 'maximumIf': upper}
        receipt['images'].append(entry)
panel.save(OUTPUT/'native-calibrated-panels.png')
(OUTPUT/'native-calibrated-panels.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps(receipt, indent=2))

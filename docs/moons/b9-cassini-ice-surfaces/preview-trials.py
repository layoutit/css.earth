"""Small source-map inspection panels; no scene rendering or release claim."""
from pathlib import Path
import hashlib
import json
import numpy as np
import rasterio
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / 'source-review'
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 18)
small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13)
canvas = Image.new('RGB', (1080, 1320), '#12171f')
draw = ImageDraw.Draw(canvas)
draw.text((20, 12), 'Cassini VIMS source trials — alignment and detector quality under review', font=font, fill='white')
draw.text((20, 39), 'Native RC19 I/F; no photometric correction. Gray marks missing measurements. These are source maps, not mounted scenes.', font=small, fill='#b9c7d8')
colors = np.array([[49, 43, 102], [50, 124, 175], [127, 205, 187], [237, 248, 177]])
receipts = []
for i, body in enumerate(('iapetus', 'tethys')):
    directory = ROOT / 'output/b9-source-intake' / body
    recipe = json.loads((directory / 'prepare-trial.json').read_text())
    for j, kind in enumerate(('rgb', 'depth')):
        path = directory / recipe['outputs'][kind]
        owner_path = path.with_name(path.stem + '-observation.tif')
        with rasterio.open(path) as dataset:
            source = dataset.read()
        with rasterio.open(owner_path) as dataset:
            valid = dataset.read(1) > 0
        if kind == 'rgb':
            rgb = np.stack([np.clip((source[c]-lo)/(hi-lo), 0, 1) ** (1/recipe['rgbDisplay']['gamma'])
                            for c, (lo, hi) in enumerate(recipe['rgbDisplay']['ranges'])], axis=-1)*255
        else:
            value = np.clip(source[0], 0, 1)
            rgb = np.stack([np.interp(value, np.linspace(0, 1, 4), colors[:, c]) for c in range(3)], axis=-1)
        rgb[~valid] = [48, 53, 63]
        panel = Image.fromarray(np.rint(rgb).astype('uint8')).resize((512, 256), Image.Resampling.NEAREST)
        x, y = 24 + 540*j, 102 + 606*i
        draw.text((x, y-32), body.title() + (' / measured infrared' if kind == 'rgb' else ' / ~2 µm absorption depth'), font=font, fill='white')
        canvas.paste(panel, (x, y))
        draw.text((x, y+262), '180°W                                0°                                180°E', font=small, fill='#b9c7d8')
        # Enlarge an observed portion using the same explicit native map codes.
        ys, xs = np.nonzero(valid)
        box = (int(xs.min()), int(ys.min()), int(xs.max())+1, int(ys.max())+1)
        crop = Image.fromarray(np.rint(rgb).astype('uint8')).crop(box)
        crop.thumbnail((512, 250), Image.Resampling.NEAREST)
        canvas.paste(crop, (x, y+308))
        draw.text((x, y+286), 'Observed extent crop / nearest display', font=small, fill='#b9c7d8')
        receipts.append({'body': body, 'kind': kind, 'source': str(path.relative_to(ROOT)),
                         'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'crop': box,
                         'interpretation': recipe['rgbDisplay'] if kind == 'rgb' else '0..1 display only; original unclipped float map retained'})
output = OUT / 'source-trial-maps.png'
canvas.save(output)
(OUT / 'source-trial-maps.json').write_text(json.dumps({'status': 'UNQUALIFIED SOURCE TRIAL', 'inputs': receipts,
    'imageSha256': hashlib.sha256(output.read_bytes()).hexdigest()}, indent=2)+'\n')
print(output)

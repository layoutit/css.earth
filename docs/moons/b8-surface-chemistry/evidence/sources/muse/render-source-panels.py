"""Small independent MUSE source panels and integration audit; no preparation jobs.

Reads the original pinned FITS doubles directly. The three nightly panels show
every finite native value. The fourth applies the stated one-node cardinal mask
buffer and first-valid-night order independently of the production converter.
Spatial display uses only integer nearest-neighbor enlargement. Palette colors
follow scientific-raster.mjs's configured 1024-entry scalar palette.
"""
import hashlib
import json
from pathlib import Path
import resource
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import rasterio


ROOT = Path.cwd()  # Run from the repository root.
OUT = Path(__file__).resolve().parent
MISSING = -9999
CASES = [('io', 'spectral-slope', '485nm_slope', '477.5–495 nm slope; normalized at 495 nm; unit: µm^-1'),
         ('io', 'visible-absorption', '560nm_band', 'Mean continuum-removed 520-660 nm band depth (fraction); 578-605 nm omitted'),
         ('ganymede', 'oxygen-signature', '577.3nm_band', '565 / 577.3 nm reflectance ratio; unitless; not oxygen concentration')]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size):
    for filename in ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        if Path(filename).exists():
            return ImageFont.truetype(filename, size)
    return ImageFont.load_default(size=size)


def read_original(path):
    data = path.read_bytes()
    assert len(data) == 132480
    return np.frombuffer(data[2880:], dtype='>f8').reshape(90, 180)


def retain_interior(values):
    valid = np.isfinite(values)
    north = np.zeros_like(valid); north[1:] = valid[:-1]
    south = np.zeros_like(valid); south[:-1] = valid[1:]
    return np.where(valid & north & south & np.roll(valid, -1, axis=1) & np.roll(valid, 1, axis=1), values, np.nan)


def panel_order(values):
    return np.roll(values[::-1], 90, axis=1)


def palette(recipe):
    colors = np.array([[int(c[i:i+2], 16) for i in (1, 3, 5)] for c in recipe['colors']])
    t = np.linspace(0, len(colors)-1, 1024)
    lower = np.minimum(np.floor(t).astype(int), len(colors)-2)
    # Positive RGB Math.round, as in the existing JavaScript scientific palette.
    return np.floor(colors[lower] + (colors[lower+1]-colors[lower])*(t-lower)[:,None] + .5).astype('uint8')


def paint_values(values, recipe, colors):
    finite = np.isfinite(values)
    normalized = np.nan_to_num((values-recipe['minimum'])/(recipe['maximum']-recipe['minimum']))
    index = np.floor(np.clip(normalized, 0, 1)*1023 + .5).astype(int)
    rgb = colors[index]
    rgb[~finite] = [206, 211, 218]
    return Image.fromarray(rgb).resize((540, 270), Image.Resampling.NEAREST)


def draw_map(draw, image, x, y, values, recipe, colors, title, note):
    draw.text((x, y-51), title, fill='#18273b', font=font(20))
    draw.text((x, y-25), note, fill='#516174', font=font(15))
    image.paste(paint_values(panel_order(values), recipe, colors), (x, y))
    draw.rectangle((x, y, x+539, y+269), outline='#6d7a89', width=1)
    for lon in [-180, -90, 0, 90, 178]:
        xx = x + (lon+180)/2*3+1.5
        draw.line((xx, y+270, xx, y+275), fill='#516174')
        draw.text((xx, y+280), str(lon), fill='#516174', font=font(14), anchor='mt')
    for lat in [88, 0, -90]:
        yy = y + (88-lat)/2*3+1.5
        draw.line((x-5, yy, x-1, yy), fill='#516174')
        draw.text((x-10, yy), str(lat), fill='#516174', font=font(14), anchor='rm')


def main():
    started = time.monotonic()
    records = []
    audited_bodies = {}
    for body, identifier, kind, quantity in CASES:
        source = ROOT/'src/planets'/body/'source'
        recipe_path = source/'preparation/terrestrial.json'
        content_path = source/'content/object.json'
        manifest_path = source/'manifest.json'
        recipe = next(item for item in json.loads(recipe_path.read_text())['raster']['scientific'] if item['id']==identifier)
        control = next(item for item in json.loads(content_path.read_text())['lenses']['controls'] if item['id']==identifier)
        conversion_path = source/'muse'/f'{body}-recipe.json'
        conversion = json.loads(conversion_path.read_text())
        receipt_path = source/'muse'/body/'conversion-receipt.json'
        receipt = json.loads(receipt_path.read_text())
        if body not in audited_bodies:
            inputs = [item for item in json.loads(manifest_path.read_text())['inputs'] if item['path'].startswith('muse/')]
            for item in inputs:
                path = source/item['path']
                assert path.stat().st_size == item['expectedBytes'], path
                assert digest(path) == item['expectedSha256'], path
            for name, expected in conversion['pins'].items():
                assert digest(source/'muse'/name) == expected, name
            assert digest(conversion_path) == receipt['recipeSha256']
            assert digest(ROOT/'tools/objects/acquisition/muse-spectral-maps.py') == receipt['preparerSha256']
            audited_bodies[body] = {'manifestEntriesVerified': len(inputs), 'conversionPinsVerified': len(conversion['pins']),
                                   'sourceManifestSha256': digest(manifest_path), 'contentSha256': digest(content_path),
                                   'preparationSha256': digest(recipe_path), 'recipeSha256': digest(conversion_path),
                                   'receiptSha256': digest(receipt_path)}
        assert recipe['sampling'] == recipe['displaySampling'] == 'nearest'
        assert recipe.get('valueTransform') is None
        assert conversion['edgeWithholdNodes'] == 1
        assert conversion['overlapPolicy'] == 'first-valid-night-1-2-3'
        assert recipe['labels'] == control['legend']['labels']
        paths = [recipe['path']] + [item['path'] for item in recipe['additionalGrids']]
        expected_paths = [f'muse/{body}/{kind}-night-{night}.tif' for night in [1,2,3]]
        assert paths == expected_paths, paths
        originals = [source/'muse'/f'{kind}_{body}_night_{night}.fits' for night in [1,2,3]]
        original_values = [read_original(path) for path in originals]
        retained = [retain_interior(values) for values in original_values]
        grids = [recipe['grid']] + [item['grid'] for item in recipe['additionalGrids']]
        errors = []
        for path, grid, values in zip(paths, grids, retained):
            for key in ['width', 'height', 'centerLongitude', 'referenceRadiusMeters', 'origin', 'resolution', 'wrapLongitude']:
                assert grid[key] == receipt['registration'][key], (path, key)
            assert grid['noData'] == MISSING
            with rasterio.open(source/path) as raster:
                output = raster.read(1)
                wanted = np.where(np.isfinite(panel_order(values)), panel_order(values), MISSING).astype('float32')
                np.testing.assert_array_equal(output, wanted)
                assert raster.dtypes == ('float32',) and raster.nodata == MISSING
                np.testing.assert_allclose([raster.transform.c, raster.transform.f], grid['origin'], rtol=0, atol=0)
                np.testing.assert_allclose([raster.transform.a, raster.transform.e], grid['resolution'], rtol=0, atol=0)
                mask = np.isfinite(values)
                errors.append(float(np.max(np.abs(values[mask].astype('float32').astype('float64')-values[mask]))))
        mosaic = np.full((90,180), np.nan)
        owner = np.zeros((90,180), dtype='uint8')
        for night, values in enumerate(retained,1):
            use = np.isfinite(values) & np.isnan(mosaic)
            mosaic[use] = values[use]; owner[use] = night
        valid_count = int(np.isfinite(mosaic).sum())
        assert valid_count == receipt['composites'][kind]['validNodes']
        for values in original_values:
            assert np.nanmin(values) >= recipe['minimum'] and np.nanmax(values) <= recipe['maximum']
        colors = palette(recipe)
        image = Image.new('RGB', (1260, 1005), '#f8fafc')
        draw = ImageDraw.Draw(image)
        draw.text((60, 28), f'{body.title()} | {recipe["label"]}', fill='#172a42', font=font(30))
        draw.text((60, 72), quantity, fill='#34475f', font=font(18))
        draw.text((60, 100), 'Original numerical source panels | July 2019 VLT/MUSE observations | CC BY 4.0', fill='#516174', font=font(16))
        for index,(x,y) in enumerate([(70,190),(670,190),(70,590)]):
            count = int(np.isfinite(original_values[index]).sum())
            draw_map(draw, image, x, y, original_values[index], recipe, colors,
                     f'Night {index+1} | original finite values', f'{count:,} native nodes; original coverage; no edge buffer')
        draw_map(draw, image, 670, 590, mosaic, recipe, colors, 'First valid night 1 -> 2 -> 3',
                 f'{valid_count:,} native nodes; one-node mask-edge buffer; no averaging')
        draw.text((70, 505), 'East-positive longitude; north-positive latitude. Gray = missing or withheld.', fill='#516174', font=font(15))
        bar = Image.fromarray(colors[None,:,:]).resize((540,15), Image.Resampling.NEAREST)
        image.paste(bar,(70,917))
        for xx,label in zip([70,340,610],recipe['labels']):
            draw.text((xx,937), label, fill='#34475f', font=font(15), anchor='mt')
        draw.text((670,909), 'Native grid: 2 degrees; spatial enlargement is nearest only.', fill='#34475f', font=font(15))
        draw.text((670,933), 'Absolute subpixel registration unresolved. Night seams retained.', fill='#34475f', font=font(15))
        draw.text((70,979), 'Data: Oliver King, v0.1.0, doi:10.5281/zenodo.11402374 | Interpretation: King et al. (2025), doi:10.1029/2024JE008511',
                  fill='#516174', font=font(14))
        destination = OUT/f'{body}-{identifier}-source-panel.png'
        image.save(destination, optimize=False)
        records.append({'body':body,'id':identifier,'quantity':quantity,'paletteColors':recipe['colors'],
                        'minimum':recipe['minimum'],'maximum':recipe['maximum'],'focus':recipe['focus'],
                        'originals':[{'path':str(path.relative_to(ROOT)),'sha256':digest(path),'bytes':path.stat().st_size} for path in originals],
                        'finiteOriginalNodes':[int(np.isfinite(values).sum()) for values in original_values],
                        'retainedNodes':[int(np.isfinite(values).sum()) for values in retained],
                        'fallbackValidNodes':valid_count,'fallbackSourceNodes':[int((owner==night).sum()) for night in [1,2,3]],
                        'independentlyDecodedTiffValuesMatchSourceAfterFloat32AndMask':True,
                        'maximumFloat32Errors':errors,'allFiniteValuesWithinConfiguredRange':True,
                        'panel':destination.name,'panelSha256':digest(destination),'panelBytes':destination.stat().st_size})
    report={'schema':'cssearth-muse-source-panel-review@1','scriptSha256':digest(Path(__file__)),
            'auditedBodies':audited_bodies,'observables':records,
            'sourceBinding':'Raw original FITS doubles, not prepared scene imagery; original per-night panels retain full source masks. Fourth panel independently applies the configured mask and first-valid priority.',
            'spatialInterpolation':False,'nearestIntegerEnlargement':3,
            'paletteQuantization':'1024 configured scalar colors; continuous RGB interpolation only within the legend palette, never spatial interpolation of source values.',
            'elapsedSeconds':time.monotonic()-started,
            'processPeakResidentBytesMacOS':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
    (OUT/'source-panel-review.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'panels':[record['panel'] for record in records],'bodies':audited_bodies,
                      'elapsedSeconds':report['elapsedSeconds'],'processPeakResidentBytesMacOS':report['processPeakResidentBytesMacOS']},indent=2))


if __name__ == '__main__':
    main()

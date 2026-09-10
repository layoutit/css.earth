"""Verify the actual prepared image's aperture, two bands and gap."""
import hashlib
import json
from pathlib import Path
from PIL import Image

path = Path('public/scenes/quaoar/quaoar-rings.webp')
image = Image.open(path).convert('RGBA')
width, height = image.size
row = [image.getpixel((x, height // 2))[3] for x in range(width)]
runs = []
for x, alpha in enumerate(row):
    if alpha and (x == 0 or not row[x - 1]):
        start = x
    if alpha and (x == width - 1 or not row[x + 1]):
        runs.append([start, x])
assert len(runs) == 4, runs
assert image.getpixel((width // 2, height // 2))[3] == 0
assert all(row[(start + end) // 2] == 102 for start, end in runs)
for (_, previous_end), (next_start, _) in zip(runs, runs[1:]):
    assert all(alpha == 0 for alpha in row[previous_end + 1:next_start])
report = {
    'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    'width': width, 'height': height,
    'horizontalAlphaSpansInclusive': runs,
    'centerAlpha': 0, 'bandInteriorAlpha': 102,
    'alphaExtrema': image.getchannel('A').getextrema(),
    'scope': 'Actual prepared WebP decoded to RGBA. Four horizontal crossings identify two separate annuli; the aperture and inter-ring gap are transparent. Band interiors retain authored alpha 102; edge antialiasing and incident prepared quads can vary alpha. Display opacity is illustrative, not measured optical depth.',
}
Path('docs/trans-neptunian/ring-image-check.json').write_text(json.dumps(report, indent=2) + '\n')
print('Prepared Quaoar ring image: separate bands, transparent aperture and gap passed.')

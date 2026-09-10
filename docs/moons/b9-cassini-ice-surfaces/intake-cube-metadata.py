"""Small, replayable Nantes VIMS page/header intake; no cube decoding or baking."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
from html import unescape
import json
from pathlib import Path
import re
import sys
import urllib.request

BASE = 'https://vims.univ-nantes.fr'


def fetch(url, limit, prefix=False):
    request = urllib.request.Request(url, headers={'User-Agent': 'cssEarth-source-intake'})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = response.read(limit if prefix else limit + 1)
        if len(data) > limit:
            raise ValueError('Metadata response exceeded bounded intake')
        return data, {'url': url, 'resolvedUrl': response.url,
                      'httpStatus': response.status,
                      'contentLength': response.headers.get('Content-Length'),
                      'retainedBytes': len(data),
                      'sha256': hashlib.sha256(data).hexdigest()}


def plain(html):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', html))).strip()


def intake(cube_id, root, headers):
    if not re.fullmatch(r'\d{10}_\d+', cube_id):
        raise ValueError('Invalid cube ID')
    page, receipt = fetch(f'{BASE}/cube/{cube_id}', 300000)
    (root / f'{cube_id}.html').write_bytes(page)
    text = page.decode()
    fields = {}
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', text, re.S):
        cells = re.findall(r'<t[dh]\b[^>]*>(.*?)</t[dh]>', row, re.S)
        if len(cells) == 2:
            fields[plain(cells[0])] = plain(cells[1])
    result = {'id': cube_id, 'metadata': fields, 'page': receipt, 'headers': []}
    if headers:
        for prefix in ['C', 'N']:
            name = f'{prefix}{cube_id}_ir.cub'
            data, header_receipt = fetch(f'{BASE}/cube/{name}', 65536, prefix=True)
            label = data.decode('ascii', errors='strict').rstrip('\x00')
            (root / f'{name}.label').write_text(label)
            header_receipt['retainedLabelSha256'] = hashlib.sha256(label.encode()).hexdigest()
            header_receipt['fullCubeDownloaded'] = False
            result['headers'].append(header_receipt)
    return result


if __name__ == '__main__':
    body, flyby, *ids = sys.argv[1:]
    headers = '--headers' in ids
    ids = [s for s in ids if s != '--headers']
    root = Path('output/b9-source-intake') / body
    root.mkdir(parents=True, exist_ok=True)
    if not ids:
        page, receipt = fetch(f'{BASE}/flyby/{flyby}', 700000)
        (root / 'flyby.html').write_bytes(page)
        ids = list(dict.fromkeys(re.findall(r'/cube/(\d{10}_\d+)', page.decode())))
        if len(ids) > 24:
            raise ValueError('Select at most 24 explicit cube IDs from this flyby')
    if len(ids) > 24:
        raise ValueError('Select at most 24 IDs')
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda key: intake(key, root, headers), ids))
    (root / ('headers.json' if headers else 'metadata.json')).write_text(
        json.dumps(results, indent=2) + '\n')
    for record in results:
        print(json.dumps({'id': record['id'], 'metadata': record['metadata']}, ensure_ascii=False), flush=True)

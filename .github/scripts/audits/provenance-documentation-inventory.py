#!/usr/bin/env python3
"""Read Git objects, not working assets. This inventory is not a qualification gate."""
import argparse
import collections
import datetime
import hashlib
import json
import re
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--repo', required=True)
parser.add_argument('--ref', action='append', required=True)
parser.add_argument('--index', action='store_true')
parser.add_argument('--output', required=True)
args = parser.parse_args()

def git(*argv, data=None):
    return subprocess.check_output(['git', '-C', args.repo, *argv], input=data)

def tree(ref):
    result = {}
    for line in git('ls-tree', '-rlz', ref).split(b'\0'):
        if not line:
            continue
        meta, path = line.split(b'\t', 1)
        mode, kind, oid, size = meta.decode().split()
        if kind == 'blob':
            result[path.decode()] = {'oid': oid, 'bytes': int(size), 'mode': mode}
    return result

def index_tree(raw):
    result = {}
    for line in raw.split(b'\0'):
        if not line:
            continue
        meta, path = line.split(b'\t', 1)
        mode, oid, stage = meta.decode().split()
        if stage != '0':
            raise RuntimeError('Unmerged index cannot be treated as a candidate')
        result[path.decode()] = {'oid': oid, 'mode': mode}
    oids = sorted({v['oid'] for v in result.values()})
    sizes = {}
    for line in git('cat-file', '--batch-check', data=('\n'.join(oids)+'\n').encode()).decode().splitlines():
        oid, kind, size = line.split()
        if kind == 'blob':
            sizes[oid] = int(size)
    return {p: {**v, 'bytes': sizes[v['oid']]} for p, v in result.items() if v['oid'] in sizes}

def blobs(entries, paths):
    paths = sorted(paths)
    raw = git('cat-file', '--batch', data=('\n'.join(entries[p]['oid'] for p in paths)+'\n').encode())
    offset, result = 0, {}
    for path in paths:
        end = raw.index(b'\n', offset)
        size = int(raw[offset:end].split()[2])
        result[path] = raw[end+1:end+1+size]
        offset = end+size+2
    return result

def stats(entries):
    return {'files': len(entries), 'bytes': sum(v['bytes'] for v in entries.values())}

def summarize(label, entries):
    docs = {p:v for p,v in entries.items() if p.startswith('docs/')}
    source_html = {p:v for p,v in entries.items() if re.match(r'src/objects/[^/]+/source/', p)
                   and Path(p).suffix.lower() in ('.html', '.htm')}
    html_blobs = collections.defaultdict(list)
    for path, entry in source_html.items():
        html_blobs[entry['oid']].append(path)
    duplicate_html = sorted(
        ({'oid':oid, 'bytesEach':entries[paths[0]]['bytes'], 'paths':paths}
         for oid, paths in html_blobs.items() if len(paths) > 1),
        key=lambda group: group['bytesEach'] * (len(group['paths']) - 1), reverse=True)
    groups = collections.defaultdict(dict)
    extensions = collections.defaultdict(dict)
    duplicates = collections.defaultdict(list)
    for p,v in docs.items():
        parts = p.split('/')
        groups[parts[1] if len(parts)>2 else '(root files)'][p] = v
        ext = '.tar.gz' if p.endswith('.tar.gz') else Path(p).suffix.lower()
        extensions[ext][p] = v
        duplicates[v['oid']].append(p)
    selected = {p for p in entries if re.fullmatch(r'src/objects/[^/]+/(object|source/manifest|prepared/provenance)\.json', p)}
    selected.update(p for p,v in docs.items() if Path(p).suffix in ('.md','.json') and v['bytes'] < 6_000_000)
    registry = next((path for path in ('site/objects.mts', 'site/objects.mjs') if path in entries), None)
    if registry is None:
        raise RuntimeError('The selected revision has no object registry')
    selected.add(registry)
    content = blobs(entries, selected)
    registry_source = content[registry].decode()
    if re.search(r"from ['\"]\./prepared-object-catalog\.m[jt]s['\"]", registry_source):
        registry_basis = 'descriptor properties.catalog'
        registry_ids = []
        for path, raw in content.items():
            match = re.fullmatch(r'src/objects/([^/]+)/object\.json', path)
            if not match:
                continue
            descriptor = json.loads(raw)
            properties = descriptor.get('properties', {})
            if 'catalog' not in properties:
                continue
            if descriptor.get('id') != match[1] or not isinstance(properties['catalog'], dict):
                raise RuntimeError(f'Invalid catalogue identity or entry: {path}')
            registry_ids.append(match[1])
        registry_ids.sort()
    else:
        registry_basis = 'legacy static descriptor imports'
        registry_ids = sorted(set(re.findall(r'\.\./src/objects/([^/]+)/object\.json', registry_source)))
    if not registry_ids:
        raise RuntimeError(f'No registered bodies found in {label}; update registry discovery before using this inventory')
    # Read the selected Git snapshot, never execute its JavaScript or use local assets.
    manifests = [p for p in content if p.endswith('/source/manifest.json')]
    required = ['README.md','NOTICE.md','source/manifest.json','object.json','prepared/provenance.json','inventory.json']
    missing = {suffix:[i for i in registry_ids if f'src/objects/{i}/{suffix}' not in entries] for suffix in required}
    source_counts, rights_counts, bases = collections.Counter(), collections.Counter(), collections.Counter()
    invalid_json = []
    for p in manifests:
        m = json.loads(content[p])
        root = p.removesuffix('manifest.json')
        for collection in ('inputs','documents','generatedIntermediates'):
            for item in m.get(collection, []):
                source_counts[collection] += 1
                present = root+item['path'] in entries
                source_counts[collection+('_in_git' if present else '_outside_git')] += 1
                if collection == 'inputs':
                    rights_counts['with_license_evidence' if item.get('licenseEvidence') else 'without_license_evidence'] += 1
    for p in content:
        if p.endswith('/prepared/provenance.json'):
            m = json.loads(content[p])
            bases[str(m.get('basis'))] += 1
    local_refs, doc_json_keys = [], collections.Counter()
    for p,raw in content.items():
        if not p.startswith('docs/'):
            continue
        value = raw.decode(errors='replace')
        hits = sum(bool(re.search(r'/Users/[^/\s]+/|/private/(?:tmp|var)/|(?<!https:)(?<!http:)/tmp/|(?<![\w/])\.local/|localhost:\d+|127\.0\.0\.1:\d+', line)) for line in value.splitlines())
        if hits:
            local_refs.append({'path':p,'matchingLines':hits})
        if p.endswith('.json'):
            try:
                m = json.loads(raw)
                if isinstance(m,dict):
                    doc_json_keys.update(m.keys())
            except ValueError:
                invalid_json.append(p)
    duplicate_groups = [{'oid':oid,'bytesEach':entries[paths[0]]['bytes'],'paths':paths} for oid,paths in duplicates.items() if len(paths)>1]
    duplicate_groups.sort(key=lambda g:g['bytesEach']*(len(g['paths'])-1), reverse=True)
    return {
        'label':label, 'gitBlobTotals':stats(entries), 'docs':stats(docs),
        'docsByGroup':{k:stats(v) for k,v in sorted(groups.items())},
        'docsByExtension':{k:stats(v) for k,v in sorted(extensions.items())},
        'largestDocs':[{'path':p,**v} for p,v in sorted(docs.items(),key=lambda x:x[1]['bytes'],reverse=True)[:15]],
        'duplicateDocBlobGroups':len(duplicate_groups),
        'duplicateDocWorkingBytes':sum(g['bytesEach']*(len(g['paths'])-1) for g in duplicate_groups),
        'largestDuplicateDocGroups':duplicate_groups[:8],
        'sourceHtml': {**stats(source_html), 'uniqueBlobs':len(html_blobs),
                       'uniqueBlobBytes':sum(entries[paths[0]]['bytes'] for paths in html_blobs.values()),
                       'duplicateWorkingBytes':sum(group['bytesEach'] * (len(group['paths']) - 1) for group in duplicate_html),
                       'largestDuplicateGroups':duplicate_html[:8]},
        'registeredBodies':len(registry_ids), 'registryBasis':registry_basis, 'sourceManifests':len(manifests),
        'missingRequiredFilesByRegisteredBody':missing,
        'sourceEntries':dict(source_counts), 'sourceLicenseEvidenceField':dict(rights_counts),
        'preparedProvenanceBasis':dict(bases),
        'provenanceCoverageMeasurement':'Not measured in this snapshot; no all-body coverage-gap claim.',
        'docJsonTopLevelKeys':dict(doc_json_keys.most_common(30)),
        'docsWithLocalReferences':len(local_refs),'localReferenceExamples':local_refs[:25],
        'invalidDocJson':invalid_json,
        'bodyEntryPoints':{suffix:sum(f'src/objects/{i}/{suffix}' in entries for i in registry_ids) for suffix in ('README.md','EVIDENCE.md')},
    }

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
initial_index = git('ls-files','--stage','-z') if args.index else None
initial_head = git('rev-parse','HEAD').decode().strip()
snapshots = []
for ref in args.ref:
    commit = git('rev-parse',ref+'^{commit}').decode().strip()
    result = summarize(commit, tree(commit))
    result['treeOid'] = git('rev-parse',commit+'^{tree}').decode().strip()
    snapshots.append(result)
if args.index:
    result = summarize('index', index_tree(initial_index))
    result['lsFilesStageSha256'] = hashlib.sha256(initial_index).hexdigest()
    snapshots.append(result)
report = {
    'schema':'cssearth-provenance-documentation-inventory@1',
    'startedAt':started, 'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'headAtStart':initial_head, 'headAtEnd':git('rev-parse','HEAD').decode().strip(),
    'indexUnchangedDuringRead': initial_index == git('ls-files','--stage','-z') if args.index else None,
    'method': 'Git blob logical bytes; no history/pack size, LFS payload, source acquisition, license verification, or browser qualification. Registry membership comes from descriptor catalogue entries or legacy static imports in the selected snapshot; no JavaScript is executed. Missing source bytes in Git are expected for restorable inputs. Local-path matches are triage, not broken-link verdicts. Identical Git blobs are stored once in the object database.',
    'snapshots':snapshots,
}
Path(args.output).write_text(json.dumps(report,indent=2)+'\n')
for s in snapshots:
    print(json.dumps({k:s[k] for k in ('label','gitBlobTotals','docs','registeredBodies','registryBasis','sourceManifests','sourceEntries','preparedProvenanceBasis','bodyEntryPoints','docsWithLocalReferences','duplicateDocWorkingBytes')}))

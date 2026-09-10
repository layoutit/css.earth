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
    groups = collections.defaultdict(dict)
    extensions = collections.defaultdict(dict)
    duplicates = collections.defaultdict(list)
    for p,v in docs.items():
        parts = p.split('/')
        groups[parts[1] if len(parts)>2 else '(root files)'][p] = v
        ext = '.tar.gz' if p.endswith('.tar.gz') else Path(p).suffix.lower()
        extensions[ext][p] = v
        duplicates[v['oid']].append(p)
    selected = {p for p in entries if re.fullmatch(r'src/planets/[^/]+/(source/manifest|prepared/provenance)\.json', p)}
    selected.update(p for p,v in docs.items() if Path(p).suffix in ('.md','.json') and v['bytes'] < 6_000_000)
    registry = next((path for path in ('site/objects.mts', 'site/objects.mjs') if path in entries), None)
    if registry is None:
        raise RuntimeError('The selected revision has no object registry')
    selected.add(registry)
    content = blobs(entries, selected)
    registry_ids = sorted(set(re.findall(r'\.\./src/planets/([^/]+)/object\.json', content[registry].decode())))
    # The inventory reports imports as static registry candidates, without executing JS.
    manifests = [p for p in content if p.endswith('/source/manifest.json')]
    required = ['README.md','NOTICE.md','source/manifest.json','object.json','prepared/provenance.json','runtime-assets.json']
    missing = {suffix:[i for i in registry_ids if f'src/planets/{i}/{suffix}' not in entries] for suffix in required}
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
        'registryDescriptorImports':len(registry_ids), 'sourceManifests':len(manifests),
        'missingRequiredFilesByRegistryImport':missing,
        'sourceEntries':dict(source_counts), 'sourceLicenseEvidenceField':dict(rights_counts),
        'preparedProvenanceBasis':dict(bases),
        'provenanceCoverageMeasurement':'Not measured in this snapshot; no all-body coverage-gap claim.',
        'docJsonTopLevelKeys':dict(doc_json_keys.most_common(30)),
        'docsWithLocalReferences':len(local_refs),'localReferenceExamples':local_refs[:25],
        'invalidDocJson':invalid_json,
        'bodyEntryPoints':{suffix:sum(f'src/planets/{i}/{suffix}' in entries for i in registry_ids) for suffix in ('README.md','EVIDENCE.md')},
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
    'method': 'Git blob logical bytes; no history/pack size, LFS payload, source acquisition, license verification, or browser qualification. Registry counts are static descriptor imports. Missing source bytes in Git are expected for restorable inputs. Local-path matches are triage, not broken-link verdicts. Identical Git blobs are stored once in the object database.',
    'snapshots':snapshots,
}
Path(args.output).write_text(json.dumps(report,indent=2)+'\n')
for s in snapshots:
    print(json.dumps({k:s[k] for k in ('label','gitBlobTotals','docs','registryDescriptorImports','sourceManifests','sourceEntries','preparedProvenanceBasis','bodyEntryPoints','docsWithLocalReferences','duplicateDocWorkingBytes')}))

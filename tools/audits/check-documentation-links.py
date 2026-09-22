#!/usr/bin/env python3
"""Check Markdown links and documentation placement, including sparse trees.

This checks repository paths, Markdown heading anchors and the docs index, not
external URLs, writing quality or scientific claims. It requires no body assets.
"""
import argparse
import json
import posixpath
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

parser = argparse.ArgumentParser()
selection = parser.add_mutually_exclusive_group(required=True)
selection.add_argument('--base', help='Git commit/ref to compare with the working tree')
selection.add_argument('--all', action='store_true', help='Check all current Markdown files')
args = parser.parse_args()

def git(*argv):
    return subprocess.check_output(['git', *argv]).decode()

root = Path(git('rev-parse', '--show-toplevel').strip())
if root != Path.cwd():
    parser.error('Run from the repository root')
base = git('rev-parse', '--verify', args.base + '^{commit}').strip() if args.base else None
untracked = set(git('ls-files', '--others', '--exclude-standard').splitlines())
changed = set(git('diff', '--name-only', '--diff-filter=ACMR', base).splitlines()) | untracked if base else set()
known = set(git('ls-files').splitlines()) | untracked
deleted = set(git('diff', '--name-only', '--diff-filter=D', base).splitlines()) if base else set()
# A file added since the review base and removed locally has no net diff to base.
deleted.update(git('diff', '--name-only', '--diff-filter=D', 'HEAD').splitlines())
known -= deleted
cache = {}

def contents(path):
    if path not in cache:
        file = root / path
        cache[path] = file.read_text() if file.is_file() else git('show', 'HEAD:' + path)
    return cache[path]

def without_fences(text):
    result, fence = [], None
    for line in text.splitlines():
        match = re.match(r'^\s{0,3}(`{3,}|~{3,})', line)
        if match:
            marker = match[1]
            if fence is None:
                fence = marker
            elif marker[0] == fence[0] and len(marker) >= len(fence):
                fence = None
            continue
        if fence is None:
            result.append(line)
    return '\n'.join(result)

def anchors(text):
    result = set(re.findall(r'(?:id|name)=["\x27]([^"\x27]+)', text))
    seen = {}
    for heading in re.findall(r'^#{1,6}\s+(.+?)\s*#*$', without_fences(text), re.M):
        heading = re.sub(r'<[^>]+>', '', heading)
        heading = re.sub(r'[^\w\- ]', '', heading.lower()).replace(' ', '-')
        occurrence = seen.get(heading, 0)
        seen[heading] = occurrence + 1
        result.add(heading + (f'-{occurrence}' if occurrence else ''))
    return result

class HtmlLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.targets = []

    def handle_starttag(self, tag, attrs):
        attribute = {'a': 'href', 'img': 'src'}.get(tag)
        target = dict(attrs).get(attribute) if attribute else None
        if target:
            self.targets.append(target)

def local_links(file):
    source = without_fences(contents(file))
    targets = re.findall(r'!?\[[^\]]*\]\(([^)\n]+)\)', source)
    key = lambda label: ' '.join(label.split()).casefold()
    references = {key(label): target for label, target in re.findall(
        r'^ {0,3}\[([^\]\n]+)\]:\s*(<[^>\n]+>|\S+)', source, re.M)}
    for label, reference in re.findall(r'!?\[([^\]\n]+)\](?:\[([^\]\n]*)\])?(?![(:])', source):
        target = references.get(key(reference or label))
        if target:
            targets.append(target)
    html = HtmlLinks()
    html.feed(source)
    targets.extend(html.targets)
    for target in targets:
        target = target.strip()
        target = target[1:target.index('>')] if target.startswith('<') else re.split(r'\s+["\x27(]', target, maxsplit=1)[0]
        if re.match(r'^[a-z][a-z0-9+.-]*:|^//', target, re.I):
            continue
        parsed = urlsplit(target)
        path = unquote(parsed.path)
        path = posixpath.normpath(posixpath.join(posixpath.dirname(file), path)) if path else file
        yield target, path, unquote(parsed.fragment)

# `prepared/provenance.json` and `prepared/page.json` are build outputs, never committed: the
# contract in CLAUDE.md says `prepare-provenance.mts` and `restore-object-json.mts` write them in
# `predev`/`prebuild`. A checkout therefore never holds one, so a body README that cites its own
# generated contract file is describing the record correctly, not linking at nothing. Accept the
# path only where the object's tracked `prepared/` directory proves the object exists.
BUILD_OUTPUTS = {'prepared/provenance.json', 'prepared/page.json'}

def build_output(path):
    directory = posixpath.dirname(posixpath.dirname(path))
    return path[len(directory) + 1:] in BUILD_OUTPUTS and f'{directory}/inventory.json' in known

errors, checked = [], 0
markdown = sorted(path for path in (known if args.all else changed) if path.endswith('.md'))
for file in markdown:
    for target, path, fragment in local_links(file):
        checked += 1
        directory = any(candidate.startswith(path.rstrip('/') + '/') for candidate in known)
        if path not in known and not build_output(path) and not directory:
            errors.append({'file': file, 'target': target, 'reason': 'missing repository path'})
        elif fragment and path.endswith('.md') and path in known:
            if fragment not in anchors(contents(path)):
                errors.append({'file': file, 'target': target, 'reason': 'missing Markdown anchor'})

# Shared docs contain guides and their illustrations. Walk from the index so
# adding a folder or linking two otherwise orphaned reports cannot hide them.
docs = {path for path in known if path.startswith('docs/')}
guides = {path for path in docs if path.endswith('.md')}
image_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg'}
illustrations = {path for path in docs if path.startswith('docs/images/')
                 and Path(path).suffix.lower() in image_extensions}
for file in sorted(docs - guides - illustrations):
    errors.append({'file': file, 'reason': 'docs/ accepts Markdown guides and illustrations under docs/images/; move code, fixtures and raw output to their owner'})
index = 'docs/README.md'
if index not in guides:
    errors.append({'file': index, 'reason': 'missing documentation index'})
pending = [index] if index in guides else []
reachable, used_illustrations = set(), set()
while pending:
    file = pending.pop()
    if file in reachable:
        continue
    reachable.add(file)
    for _, target, _ in local_links(file):
        if target in guides:
            pending.append(target)
        elif target in illustrations:
            used_illustrations.add(target)
for file in sorted(guides - reachable):
    errors.append({'file': file, 'reason': 'guide is not reachable through links from docs/README.md'})
for file in sorted(illustrations - used_illustrations):
    errors.append({'file': file, 'reason': 'illustration is not linked from a guide reachable from docs/README.md'})
for file in sorted(known):
    if re.fullmatch(r'src/objects/[^/]+/(?:SOURCE|EVIDENCE|USAGE)\.md', file, re.I):
        errors.append({'file': file, 'reason': 'use the body README for sources and evidence; shared guides cover usage'})

print(json.dumps({'base': base, 'markdownFiles': len(markdown),
                  'localLinksChecked': checked, 'errors': errors,
                  'documentation': {'guides': len(guides), 'reachableGuides': len(reachable),
                                    'illustrations': len(illustrations), 'usedIllustrations': len(used_illustrations)},
                  'scope': 'Checks inline Markdown, used reference links and HTML a/img targets and Markdown heading anchors, docs placement and duplicate body accounts. Excludes fenced examples, external URL availability and content quality.'}, indent=2))
raise SystemExit(bool(errors))

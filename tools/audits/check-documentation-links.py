#!/usr/bin/env python3
"""Check relative Markdown links in a diff or the current tree, including sparse trees.

This checks repository paths and Markdown heading anchors, not external URLs or
scientific claims. It does not execute linked files or require body assets.
"""
import argparse
import json
import posixpath
import re
import subprocess
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

errors, checked = [], 0
markdown = sorted(path for path in (known if args.all else changed) if path.endswith('.md'))
for file in markdown:
    source = without_fences(contents(file))
    for target in re.findall(r'!?\[[^\]]*\]\(([^)\n]+)\)', source):
        target = target.strip().strip('<>').split(' "')[0]
        if re.match(r'^[a-z][a-z0-9+.-]*:', target, re.I):
            continue
        parsed = urlsplit(target)
        path = unquote(parsed.path)
        path = posixpath.normpath(posixpath.join(posixpath.dirname(file), path)) if path else file
        checked += 1
        directory = any(candidate.startswith(path.rstrip('/') + '/') for candidate in known)
        if path not in known and not directory:
            errors.append({'file': file, 'target': target, 'reason': 'missing repository path'})
        elif parsed.fragment and path.endswith('.md') and path in known:
            if unquote(parsed.fragment) not in anchors(contents(path)):
                errors.append({'file': file, 'target': target, 'reason': 'missing Markdown anchor'})

print(json.dumps({'base': base, 'markdownFiles': len(markdown),
                  'localInlineLinksChecked': checked, 'errors': errors,
                  'scope': 'Relative inline Markdown links and ATX heading/HTML anchors; excludes fenced examples, reference-style links and external URL availability.'}, indent=2))
raise SystemExit(bool(errors))

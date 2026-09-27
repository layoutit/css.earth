import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { astroqueryToolchain } from '@cssearth/telescope/node';

export type VoPackageMember = { path: string; bytes: number; sha256: string };
/** `science` is retained for legacy one-raster packages. `fitsMembers` is the complete non-arbitrary FITS candidate set. */
export type VoPackage = { science: string | null; fitsMembers: readonly string[]; members: VoPackageMember[]; format: 'zip' | 'tar' };
export type VoPackageLimits = { expandedBytes: number; members: number };

const PYTHON = String.raw`
import hashlib, json, os, posixpath, re, shutil, stat, sys, tarfile, tempfile, zipfile
import xml.etree.ElementTree as ET
from astropy.io import fits
from pathlib import Path, PureWindowsPath

def fail(message):
    raise ValueError(message)

def normalized(name, label_reference=False):
    if not isinstance(name, str) or not name or '\x00' in name or '\\' in name:
        fail('unsafe archive member path')
    if name.startswith('/') or PureWindowsPath(name).is_absolute() or re.match(r'^[A-Za-z]:', name):
        fail('absolute archive member path')
    if not label_reference and '..' in name.split('/'):
        fail('archive member path contains traversal')
    result = posixpath.normpath(name)
    if result in ('', '.', '..') or result.startswith('../') or result.startswith('/'):
        fail('archive member path escapes its package')
    return result

def fits_image(path):
    try:
        with fits.open(path, mode='readonly', memmap=False, lazy_load_hdus=False, ignore_missing_end=False) as product:
            product.verify('exception')
            return any(isinstance(hdu, (fits.PrimaryHDU, fits.ImageHDU, fits.CompImageHDU)) and hdu.data is not None and hdu.data.ndim >= 2 for hdu in product)
    except (OSError, ValueError, KeyError, fits.VerifyError):
        return False

def pds3_dependency(value, logical):
    value = value.strip()
    if re.fullmatch(r'\d+(?:\s*<BYTES>)?', value, re.IGNORECASE):
        return None
    if value.startswith('(') and value.endswith(')'):
        value = value[1:-1].strip()
    if ',' in value:
        value = value.split(',', 1)[0].strip()
    if value.startswith(('"', "'")):
        quote = value[0]
        end = value.find(quote, 1)
        if end < 0 or value[end + 1:].strip() not in ('',) and not value[end + 1:].lstrip().startswith(','):
            fail('unsupported PDS3 pointer syntax: ' + logical)
        return value[1:end]
    if re.fullmatch(r'[^\s,(){}<>"\']+', value):
        return value
    fail('unsupported PDS3 pointer syntax: ' + logical)

def declared_dependencies(logical, path):
    lower = logical.lower()
    if not lower.endswith(('.lbl', '.lab', '.fmt', '.xml')):
        return []
    try:
        if lower.endswith('.xml'):
            root = ET.parse(path).getroot()
            names = [(element.text or '').strip() for element in root.iter() if element.tag.rsplit('}', 1)[-1] == 'file_name']
            if any(not name for name in names): fail('empty PDS4 file_name: ' + logical)
        else:
            text = Path(path).read_text(encoding='latin1')
            names = []
            for line in text.splitlines():
                statement = line.strip()
                if statement.upper() == 'END': break
                if not statement.startswith('^'): continue
                key, separator, value = statement.partition('=')
                if not separator or not re.fullmatch(r'\^[A-Za-z][A-Za-z0-9_:-]*', key.strip()): fail('unsupported PDS3 pointer syntax: ' + logical)
                name = pds3_dependency(value, logical)
                if name is not None: names.append(name)
    except (OSError, UnicodeDecodeError, ET.ParseError):
        fail('unreadable PDS label: ' + logical)
    base = posixpath.dirname(logical)
    return [normalized(posixpath.join(base, name), True) for name in names]

def entries(archive, kind, member_limit, expanded_limit):
    if kind == 'zip':
        with zipfile.ZipFile(archive) as source:
            result = []
            if len(source.infolist()) > member_limit: fail('archive member limit exceeded')
            for item in source.infolist():
                mode = item.external_attr >> 16
                directory = item.is_dir()
                if stat.S_IFMT(mode) == stat.S_IFLNK:
                    fail('symbolic link in ZIP archive')
                if not directory and stat.S_IFMT(mode) not in (0, stat.S_IFREG):
                    fail('non-regular member in ZIP archive')
                result.append((normalized(item.filename), directory, item))
            return result
    with tarfile.open(archive, 'r:*') as source:
        result, declared_bytes = [], 0
        for item in source:
            if len(result) >= member_limit: fail('archive member limit exceeded')
            declared_bytes += item.size
            if declared_bytes > expanded_limit: fail('expanded archive byte limit exceeded')
            if not (item.isdir() or item.isfile()):
                fail('link or device in TAR archive')
            result.append((normalized(item.name), item.isdir(), item))
        return result

def extract(archive, destination, expanded_limit, member_limit):
    kind = 'zip' if zipfile.is_zipfile(archive) else 'tar' if tarfile.is_tarfile(archive) else None
    if kind is None:
        fail('archive is neither ZIP nor TAR')
    items = entries(archive, kind, member_limit, expanded_limit)
    if len(items) > member_limit:
        fail('archive member limit exceeded')
    names = [item[0] for item in items]
    if len(set(names)) != len(names):
        fail('duplicate normalized archive member path')
    if (destination / 'members').exists():
        fail('destination already contains members')
    stage = Path(tempfile.mkdtemp(prefix='.vo-package-', dir=destination))
    output = stage / 'members'
    output.mkdir()
    pins, total = [], 0
    try:
        def copy_member(logical, source):
            nonlocal total
            target = output / logical
            target.parent.mkdir(parents=True, exist_ok=True)
            digest, count = hashlib.sha256(), 0
            with source, open(target, 'xb') as sink:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    if total + len(chunk) > expanded_limit:
                        fail('expanded archive byte limit exceeded')
                    sink.write(chunk); digest.update(chunk); count += len(chunk); total += len(chunk)
            pins.append({'path': logical, 'bytes': count, 'sha256': digest.hexdigest()})
        if kind == 'zip':
            with zipfile.ZipFile(archive) as source:
                for logical, directory, item in items:
                    if not directory:
                        copy_member(logical, source.open(item, 'r'))
        else:
            with tarfile.open(archive, 'r:*') as source:
                for logical, directory, item in items:
                    if not directory:
                        stream = source.extractfile(item)
                        if stream is None:
                            fail('TAR member cannot be read')
                        copy_member(logical, stream)
        logical_files = {pin['path'] for pin in pins}
        for logical in logical_files:
            for dependency in declared_dependencies(logical, output / logical):
                if dependency not in logical_files:
                    fail('declared label dependency is missing: ' + dependency)
        science = [pin['path'] for pin in pins if pin['path'].lower().endswith(('.fits', '.fit', '.fts')) and fits_image(output / pin['path'])]
        fits = [pin['path'] for pin in pins if pin['path'].lower().endswith(('.fits', '.fit', '.fts'))]
        os.rename(output, destination / 'members')
        shutil.rmtree(stage)
        return {'science': science[0] if len(science) == 1 else None, 'fitsMembers': sorted(fits), 'members': sorted(pins, key=lambda pin: pin['path']), 'format': kind}
    except BaseException:
        shutil.rmtree(stage, ignore_errors=True)
        raise

request = json.load(sys.stdin)
archive = Path(request['archive']).resolve()
destination = Path(request['destination']).resolve()
if not archive.is_file() or not destination.is_dir():
    fail('archive file and caller-created destination directory are required')
print(json.dumps(extract(archive, destination, request['expandedBytes'], request['members']), separators=(',', ':')))
`;

function positiveLimit(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive safe integer.`);
  return value;
}

function parsePackage(value: unknown): VoPackage {
  if (!value || typeof value !== 'object') throw new Error('Package extractor returned no result.');
  const result = value as Record<string, unknown>;
  if ((result.science !== null && typeof result.science !== 'string') || !Array.isArray(result.fitsMembers) || (result.format !== 'zip' && result.format !== 'tar') || !Array.isArray(result.members))
    throw new Error('Package extractor returned an invalid result.');
  const members = result.members.map((member): VoPackageMember => {
    if (!member || typeof member !== 'object') throw new Error('Package extractor returned an invalid member.');
    const pin = member as Record<string, unknown>;
    if (typeof pin.path !== 'string' || typeof pin.bytes !== 'number' || !Number.isSafeInteger(pin.bytes) || pin.bytes < 0 || typeof pin.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(pin.sha256))
      throw new Error('Package extractor returned an invalid member pin.');
    return { path: pin.path, bytes: pin.bytes, sha256: pin.sha256 };
  });
  const fitsMembers = result.fitsMembers.map(path => { if (typeof path !== 'string' || !members.some(member => member.path === path)) throw new Error('Package FITS member is not pinned.'); return path; });
  if (result.science !== null && !members.some(member => member.path === result.science)) throw new Error('Package science member is not pinned.');
  return { science: result.science, fitsMembers, members, format: result.format };
}

/** Safely stage one archive's complete pinned member closure into `destination/members`. */
export async function extractVoPackage(archivePath: string, destination: string, limits: VoPackageLimits): Promise<VoPackage> {
  positiveLimit(limits.expandedBytes, 'expandedBytes');
  positiveLimit(limits.members, 'members');
  await access(destination);
  const toolchain = await astroqueryToolchain();
  return await new Promise<VoPackage>((resolve, reject) => {
    const child = spawn(toolchain.python, ['-c', PYTHON], { env: { ...process.env, ...toolchain.env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.on('error', error => reject(new Error(`VO package extractor could not start: ${error.message}`)));
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`VO package extraction failed: ${stderr.trim() || stdout.trim() || `Python exited ${code}`}`));
      try { resolve(parsePackage(JSON.parse(stdout))); } catch (error) { reject(error); }
    });
    child.stdin.end(JSON.stringify({ archive: archivePath, destination, expandedBytes: limits.expandedBytes, members: limits.members }));
  });
}

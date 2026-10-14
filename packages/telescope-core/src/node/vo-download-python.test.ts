import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { DOWNLOAD_BYTES, downloadFixture } from './download-fixture.js';
import { VO_DOWNLOAD_PYTHON } from './vo-download-python.js';

const runPython = promisify(execFile);
test('the actual Astroquery inline program includes and compiles the tested transfer loop', async () => {
  const source = await readFile(new URL('./astroquery.ts', import.meta.url), 'utf8');
  const template = /const PYTHON = String\.raw`([\s\S]*?)`;/u.exec(source)?.[1];
  assert.ok(template !== undefined && template.includes('${VO_DOWNLOAD_PYTHON}'), 'Astroquery must install the tested transfer loop');
  await runPython('python3', ['-c', 'import ast,sys;ast.parse(sys.argv[1]);print("compiled")', template.replace('${VO_DOWNLOAD_PYTHON}', VO_DOWNLOAD_PYTHON)]);
});
const imports = String.raw`
import json, sys, time
try: import requests
except ModuleNotFoundError:
    from pip._vendor import requests
    sys.modules['requests'] = requests
time.sleep = lambda seconds: None
class TransferFailure(Exception):
    def __init__(self, code, message): self.code = code; super().__init__(message)
`;
const network = String.raw`
session = requests.Session()
session.trust_env = False
session.headers['Accept-Encoding'] = 'identity'
class Query:
    def submit(self): return session.get(sys.argv[1], stream=True, timeout=(2, 2))
try:
    size, response = stream_vo_download(Query(), session, sys.argv[2], 10000000, TransferFailure)
    print(json.dumps({'bytes':size}))
except TransferFailure as error:
    print(json.dumps({'code':error.code, 'message':str(error), 'rawMessage':error.raw_message}))
`;
for (const mode of ['resume', 'ignore', 'invalid-range', 'fail'] as const) test(`inline VO Python handles a local archive ${mode}`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vo-download-'));
  let fixture: Awaited<ReturnType<typeof downloadFixture>> | undefined;
  try {
    fixture = await downloadFixture(mode);
    const destination = join(directory, 'science.partial');
    const result = await runPython('python3', ['-c', imports + VO_DOWNLOAD_PYTHON + network, fixture.url, destination]);
    const answer: unknown = JSON.parse(result.stdout);
    assert.ok(answer && typeof answer === 'object');
    assert.match(fixture.ranges[1] ?? '', /^bytes=\d+-$/u);
    if (mode === 'fail') {
      assert.equal(fixture.ranges.length, 3);
      assert.ok('message' in answer && typeof answer.message === 'string');
      assert.match(answer.message, /^Download interrupted at [\d.]+ of [\d.]+ MB after 3 attempts\. Run the same command again to retry\.$/u);
      assert.ok('rawMessage' in answer && typeof answer.rawMessage === 'string' && answer.rawMessage.includes('IncompleteRead'));
    } else {
      assert.deepEqual(answer, { bytes: DOWNLOAD_BYTES.length }); assert.deepEqual(await readFile(destination), DOWNLOAD_BYTES);
      if (mode === 'invalid-range') assert.equal(fixture.ranges[2], undefined);
    }
  } finally { await fixture?.close(); await rm(directory, { recursive: true, force: true }); }
});

const injected = String.raw`
session = requests.Session()
calls = []
mode = sys.argv[1]
class Response:
    status_code = 200
    headers = {'Content-Length':'8', 'Accept-Ranges':'bytes'}
    def __init__(self, offset, attempt):
        self.offset = offset
        self.attempt = attempt
        self.headers = dict(self.headers)
        if offset and mode != 'ignore':
            self.status_code = 206
            self.headers['Content-Length'] = str(8 - offset)
            self.headers['Content-Range'] = f'bytes {offset if mode != "invalid" else offset + 1}-7/8'
    def raise_for_status(self): pass
    def close(self): pass
    def iter_content(self, chunk_size):
        if self.attempt == 1 or mode == 'fail':
            yield b'12'
            raise requests.exceptions.ChunkedEncodingError('fixture IncompleteRead')
        yield b'12345678'[self.offset if self.status_code == 206 else 0:]
class Query:
    def submit(self):
        value = session.headers.get('Range')
        calls.append(value)
        return Response(int(value[6:-1]) if value else 0, len(calls))
try:
    size, _ = stream_vo_download(Query(), session, sys.argv[2], 8, TransferFailure)
    with open(sys.argv[2], 'rb') as f: data = f.read().decode()
    print(json.dumps({'bytes':size, 'data':data, 'ranges':calls}))
except TransferFailure as error:
    print(json.dumps({'code':error.code, 'message':str(error), 'rawMessage':error.raw_message, 'ranges':calls}))
`;
test('inline VO transfer control flow guards resume, restart, invalid ranges and the three-attempt cap without sockets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vo-control-'));
  try {
    for (const mode of ['resume', 'ignore', 'invalid', 'fail']) {
      const result = await runPython('python3', ['-c', imports + VO_DOWNLOAD_PYTHON + injected, mode, join(directory, mode)]);
      const answer: unknown = JSON.parse(result.stdout);
      if (mode === 'fail') assert.deepEqual(answer, { code: 'interrupted',
        message: 'Download interrupted at 0.0 of 0.0 MB after 3 attempts. Run the same command again to retry.',
        rawMessage: 'fixture IncompleteRead', ranges: [null, 'bytes=2-', 'bytes=4-'] });
      else assert.deepEqual(answer, { bytes: 8, data: '12345678', ranges: mode === 'invalid' ? [null, 'bytes=2-', null] : [null, 'bytes=2-'] });
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the exhaustion fixture leaves outstanding bytes after three resumed MiB attempts without sockets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vo-fixture-cap-'));
  const fixture = injected.replace("'Content-Length':'8'", `'Content-Length':'${DOWNLOAD_BYTES.length}'`)
    .replace("str(8 - offset)", `str(${DOWNLOAD_BYTES.length} - offset)`)
    .replace("}-7/8'", `}-${DOWNLOAD_BYTES.length - 1}/${DOWNLOAD_BYTES.length}'`)
    .replace("yield b'12'", `yield b'x' * min(1024 * 1024, ${DOWNLOAD_BYTES.length} - self.offset)`)
    .replace("raise requests.exceptions.ChunkedEncodingError('fixture IncompleteRead')", `if self.offset + 1024 * 1024 < ${DOWNLOAD_BYTES.length}: raise requests.exceptions.ChunkedEncodingError('fixture IncompleteRead')\n            return`)
    .replace("with open(sys.argv[2], 'rb') as f: data = f.read().decode()", "data = 'completed'")
    .replace("sys.argv[2], 8, TransferFailure", `sys.argv[2], ${DOWNLOAD_BYTES.length}, TransferFailure`);
  try {
    const result = await runPython('python3', ['-c', imports + VO_DOWNLOAD_PYTHON + fixture, 'fail', join(directory, 'partial')]);
    const answer: unknown = JSON.parse(result.stdout);
    assert.ok(answer && typeof answer === 'object' && 'code' in answer && answer.code === 'interrupted',
      'The fixture must exhaust three attempts with outstanding bytes');
    assert.ok('ranges' in answer); assert.deepEqual(answer.ranges, [null, 'bytes=1048576-', 'bytes=2097152-']);
    assert.ok('message' in answer && typeof answer.message === 'string');
    assert.match(answer.message, /after 3 attempts/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

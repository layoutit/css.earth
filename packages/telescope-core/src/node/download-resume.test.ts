import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { downloadHttpFile, DownloadInterruptedError } from './http-download.js';
import { withDownloadProgress, type DownloadProgress } from './download-progress.js';
import { VO_DOWNLOAD_PYTHON } from './vo-download-python.js';

const runPython = promisify(execFile);
function brokenBody() {
  let emitted = false;
  return new ReadableStream<Uint8Array>({ pull(controller) {
    if (emitted) controller.error(new Error('connection reset'));
    else { emitted = true; controller.enqueue(Buffer.from('ab')); }
  } }, { highWaterMark: 0 });
}
test('HTTP interactive transfer retains bytes across invocations, sends Range/If-Range, and publishes exact bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'http-persistent-')), events: DownloadProgress[] = [], ranges: (string | null)[] = [];
  const destination = join(directory, 'science.fits'), signal = new AbortController().signal;
  const context = { report: (event: DownloadProgress) => events.push(event), signal, retainPartial: true };
  try {
    await assert.rejects(withDownloadProgress(context, () => downloadHttpFile('https://fixture.test/science', destination, {
      byteLimit: 8, attempts: 1, fetcher: async () => new Response(brokenBody(), { headers: { 'Content-Length': '8', 'Accept-Ranges': 'bytes', ETag: '"v1"' } }),
    })), DownloadInterruptedError);
    assert.equal(await readFile(`${destination}.download.partial`, 'utf8'), 'ab');
    await assert.rejects(readFile(destination), { code: 'ENOENT' });
    await withDownloadProgress(context, () => downloadHttpFile('https://fixture.test/science', destination, {
      byteLimit: 8, attempts: 1, fetcher: async (_url, options) => {
        const headers = new Headers(options.headers); ranges.push(headers.get('range'), headers.get('if-range'));
        return new Response('cdefgh', { status: 206, headers: { 'Content-Length': '6', 'Content-Range': 'bytes 2-7/8' } });
      },
    }));
    assert.deepEqual(ranges, ['bytes=2-', '"v1"']); assert.equal(await readFile(destination, 'utf8'), 'abcdefgh');
    assert.deepEqual(await readdir(directory), ['science.fits']); assert.ok(events.some(event => event.received === 2 && event.total === 8));
    assert.deepEqual(events.at(-1), { received: 8, total: 8, checking: true });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('persistent HTTP partial refuses a different source and Ctrl-C retains bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'http-cancelled-')), controller = new AbortController();
  const destination = join(directory, 'science.fits');
  try {
    await assert.rejects(withDownloadProgress({ report: event => { if (event.received === 2) controller.abort(new Error('cancelled')); }, signal: controller.signal, retainPartial: true },
      () => downloadHttpFile('https://fixture.test/first', destination, { byteLimit: 8, attempts: 1, fetcher: async () => new Response(brokenBody(), { headers: { 'Content-Length': '8', 'Accept-Ranges': 'bytes' } }) })), /cancelled/u);
    assert.equal(await readFile(`${destination}.download.partial`, 'utf8'), 'ab');
    await assert.rejects(withDownloadProgress({ report: () => {}, signal: new AbortController().signal, retainPartial: true },
      () => downloadHttpFile('https://fixture.test/other', destination, { byteLimit: 8, fetcher: async () => assert.fail('identity must fail before networking') })), /another acquisition/u);
    assert.equal(await readFile(`${destination}.download.partial`, 'utf8'), 'ab');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const pythonFixture = String.raw`
import sys, json, time
try: import requests
except ModuleNotFoundError:
    from pip._vendor import requests
    sys.modules['requests'] = requests
time.sleep = lambda seconds: None
class Failure(Exception):
    def __init__(self, code, message): self.code = code; super().__init__(message)
session = requests.Session()
calls = []
class Response:
    status_code = 200
    def __init__(self, offset):
        self.offset = offset
        self.headers = {'Content-Length':str(8-offset), 'Accept-Ranges':'bytes', 'ETag':'"v1"'}
        if offset:
            self.status_code = 206
            self.headers['Content-Range'] = f'bytes {offset}-7/8'
    def raise_for_status(self): pass
    def close(self): pass
    def iter_content(self, chunk_size):
        if sys.argv[1] == 'fail':
            yield b'abcdefgh'[self.offset:self.offset+2]
            raise requests.exceptions.ChunkedEncodingError('reset')
        yield b'abcdefgh'[self.offset:]
class Query:
    def submit(self):
        value = session.headers.get('Range')
        calls.append([value, session.headers.get('If-Range')])
        return Response(int(value[6:-1]) if value else 0)
try:
    size, response = stream_vo_download(Query(), session, sys.argv[2], 8, Failure, sys.argv[3], True)
    print(json.dumps({'bytes':size, 'calls':calls}))
except Failure as error:
    print(json.dumps({'code':error.code, 'calls':calls}))
`;
test('inline Python resumes a persisted transfer in a new process without sockets and refuses a changed identity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vo-persistent-')), destination = join(directory, 'science.fits.download.partial');
  try {
    const source = VO_DOWNLOAD_PYTHON + pythonFixture;
    const first = await runPython('python3', ['-c', source, 'fail', destination, 'same source']);
    assert.deepEqual(JSON.parse(first.stdout), { code: 'interrupted', calls: [[null, null], ['bytes=2-', '"v1"'], ['bytes=4-', '"v1"']] });
    assert.equal(await readFile(destination, 'utf8'), 'abcdef'); assert.match(first.stderr, /VO progress: .*"received": 6/u);
    const other = await runPython('python3', ['-c', source, 'resume', destination, 'another source']);
    assert.deepEqual(JSON.parse(other.stdout), { code: 'identity', calls: [] });
    const second = await runPython('python3', ['-c', source, 'resume', destination, 'same source']);
    assert.deepEqual(JSON.parse(second.stdout), { bytes: 8, calls: [['bytes=6-', '"v1"']] });
    assert.equal(await readFile(destination, 'utf8'), 'abcdefgh');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

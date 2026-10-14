/** Inline Python remains source-owned TypeScript and is exercised against a local HTTP archive. */
export const VO_DOWNLOAD_PYTHON = String.raw`
def stream_vo_download(query, session, temporary, limit, failure):
    import http.client, re, requests, time
    size, total, mark = 0, None, 10000000
    resumable, validator, response = False, None, None
    interrupted = (requests.exceptions.ChunkedEncodingError, requests.exceptions.ConnectionError,
                   http.client.IncompleteRead, ConnectionResetError)
    with open(temporary, 'wb') as output:
        for attempt in range(1, 4):
            if attempt > 1: time.sleep(2 ** (attempt - 2))
            offset = size if resumable else 0
            if offset:
                session.headers['Range'] = 'bytes=' + str(offset) + '-'
                if validator: session.headers['If-Range'] = validator
            else:
                session.headers.pop('Range', None)
                session.headers.pop('If-Range', None)
                output.seek(0); output.truncate(); size = 0
            try:
                response = query.submit()
                if response.status_code == 204: raise failure('no-content', 'No science content (HTTP 204)')
                if response.status_code in (401,403): raise failure('authentication', 'Archive authorization failed (HTTP ' + str(response.status_code) + ')')
                response.raise_for_status()
                length = response.headers.get('Content-Length')
                encoded = bool(response.headers.get('Content-Encoding'))
                length = int(length) if length and not encoded else None
                if offset and response.status_code == 206:
                    match = re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)', response.headers.get('Content-Range', ''))
                    if not match or int(match[1]) != offset or int(match[2]) < offset or int(match[2]) + 1 != int(match[3]) or int(match[3]) != total or encoded or (length is not None and length != total - offset):
                        resumable = False
                        output.seek(0); output.truncate(); size = 0
                        raise requests.exceptions.ChunkedEncodingError('Archive returned an inconsistent Content-Range')
                else:
                    if response.status_code == 206: raise failure('protocol', 'Unrequested partial science response')
                    output.seek(0); output.truncate(); size = 0; total = length
                    resumable = response.headers.get('Accept-Ranges', '').lower() == 'bytes' and total is not None and not encoded
                    validator = response.headers.get('ETag')
                    if validator and validator.startswith('W/'): validator = None
                    validator = validator or response.headers.get('Last-Modified')
                if total is not None and total > limit: raise failure('byte-limit', 'Science transfer byte limit exceeded')
                for chunk in response.iter_content(chunk_size=65536):
                    if size + len(chunk) > limit: raise failure('byte-limit', 'Science transfer byte limit exceeded')
                    output.write(chunk); size += len(chunk)
                    if size >= mark:
                        print(f'VO product: {size / 1e6:.1f} MB', file=sys.stderr, flush=True)
                        mark = (size // 10000000 + 1) * 10000000
                if not size: raise failure('no-content', 'Empty science response')
                if total is not None and total != size: raise requests.exceptions.ChunkedEncodingError('Incomplete science Content-Length')
                output.flush()
                return size, response
            except interrupted as error:
                if attempt == 3:
                    expected = '' if total is None else f' of {total / 1e6:.1f}'
                    message = f'Download interrupted at {size / 1e6:.1f}{expected} MB after 3 attempts. Run the same command again to retry.'
                    raised = failure('interrupted', message)
                    raised.raw_message = str(error)
                    raised.http_status = response.status_code if response is not None else None
                    raise raised from error
            except Exception as error:
                error.http_status = response.status_code if response is not None else None
                raise
            finally:
                if response is not None: response.close()
`;

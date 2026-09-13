/** Warm prepared bytes without flooding the browser's pending-request limit. */
export async function prefetchPreparedResources(urls: readonly string[], fetchResource: typeof fetch, signal: AbortSignal): Promise<void> {
  const queue = [...new Set(urls)];
  let next = 0;
  const worker = async () => {
    while (!signal.aborted && next < queue.length) {
      const url = queue[next++]!;
      try {
        const response = await fetchResource(url, { priority: 'low', signal });
        // Consume each response before admitting another request. Fetch resolving
        // only means headers arrived, not that its body released the connection.
        await response.arrayBuffer();
      } catch {
        // Speculative warming is optional. Actual displayed images own their load.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
}

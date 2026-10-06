/** A page's report of its own failure (site/startup/error-report.mts), written to the Worker's log and answered with no
 * content. Nothing is stored. The body is capped: this endpoint is public. */
export async function report(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const text = (await request.text()).slice(0, 2500);
  console.error(`client-error ${JSON.stringify({ agent: (request.headers.get('user-agent') ?? '').slice(0, 200), report: text })}`);
  return new Response(null, { status: 204 });
}

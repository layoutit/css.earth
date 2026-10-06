// A page's report of its own failure (site/startup/error-report.mts), written to the function log and answered with no content.
// Nothing is stored. The body is capped: this endpoint is public.
export default async (request: Request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const report = (await request.text()).slice(0, 2500);
  console.error(`client-error ${JSON.stringify({ agent: (request.headers.get('user-agent') ?? '').slice(0, 200), report })}`);
  return new Response(null, { status: 204 });
};

// Entry script: node deploy/cloudflare/analytics.mts [days]
/**
 * Page views, visits and referrers of css.earth, read from Cloudflare Web Analytics through the GraphQL Analytics API.
 * Cloudflare writes the beacon into every page it serves; this repository holds no analytics code. The dashboard shows a
 * referrer's host only; the API also gives its path.
 *
 * A page view is one HTML page load. A visit is a page view whose referrer is another site, or none.
 *
 * Two values come from the environment or, on macOS, from the Keychain, and neither is printed:
 * - CLOUDFLARE_ANALYTICS_TOKEN (Keychain service `cssearth-cloudflare-analytics`): an API token whose only permission is
 *   Account Analytics: Read.
 * - CLOUDFLARE_ACCOUNT_ID (Keychain service `cssearth-cloudflare-account`).
 */
import { execFileSync } from 'node:child_process';

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
const HOSTS = ['css.earth', 'www.css.earth'];
const MAX_DAYS = 180;

interface Group { count: number; visits: number; sampleInterval: number; dimensions: Record<string, string> }

function secret(variable: string, service: string): string {
  const fromEnvironment = process.env[variable]?.trim();
  if (fromEnvironment) return fromEnvironment;
  try {
    return execFileSync('security', ['find-generic-password', '-s', service, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    throw new Error(`${variable} is not set and the Keychain has no "${service}" item.`);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The groups of one answer, or an error that quotes what the API said instead. */
function groupsOf(answer: unknown): Group[] {
  const refuse = (): never => { throw new Error(`Unexpected answer from the Analytics API: ${JSON.stringify(answer).slice(0, 600)}`); };
  if (!isRecord(answer) || !isRecord(answer.data) || !isRecord(answer.data.viewer)) return refuse();
  const accounts = answer.data.viewer.accounts;
  if (!Array.isArray(accounts) || !isRecord(accounts[0]) || !Array.isArray(accounts[0].rows)) return refuse();
  return accounts[0].rows.map((row: unknown): Group => {
    if (!isRecord(row) || typeof row.count !== 'number' || !isRecord(row.sum) || typeof row.sum.visits !== 'number') return refuse();
    if (!isRecord(row.avg) || typeof row.avg.sampleInterval !== 'number' || !isRecord(row.dimensions)) return refuse();
    const dimensions: Record<string, string> = {};
    for (const [name, value] of Object.entries(row.dimensions)) dimensions[name] = typeof value === 'string' ? value : refuse();
    return { count: row.count, visits: row.sum.visits, sampleInterval: row.avg.sampleInterval, dimensions };
  });
}

async function groups(filter: Record<string, unknown>, dimensions: string[], orderBy: string, limit: number): Promise<Group[]> {
  const query = `query ($account: string, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {
    viewer { accounts(filter: { accountTag: $account }) {
      rows: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: ${limit}, orderBy: [${orderBy}]) {
        count sum { visits } avg { sampleInterval } dimensions { ${dimensions.join(' ')} }
      } } } }`;
  const response = await fetch(GRAPHQL, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret('CLOUDFLARE_ANALYTICS_TOKEN', 'cssearth-cloudflare-analytics')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { account: secret('CLOUDFLARE_ACCOUNT_ID', 'cssearth-cloudflare-account'), filter } }),
  });
  return groupsOf(await response.json());
}

function table(title: string, rows: readonly Group[], label: (row: Group) => string): string {
  const sampled = rows.some(row => row.sampleInterval > 1) ? ' (estimated from a sample)' : '';
  const lines = rows.map(row => `${String(row.count).padStart(10)} ${String(row.visits).padStart(8)}  ${label(row)}`);
  return [`\n${title}${sampled}`, `${'page views'.padStart(10)} ${'visits'.padStart(8)}`, ...lines].join('\n');
}

const days = Number(process.argv[2] ?? 7);
if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) throw new Error(`days must be a whole number from 1 to ${MAX_DAYS}`);
const since = { datetime_geq: new Date(Date.now() - days * 86_400_000).toISOString() };

// Cloudflare may hold more than one Web Analytics site for css.earth. Adding them would count a page twice, so the
// site with the most page views is the one reported.
const sites = await groups({ ...since, requestHost_in: HOSTS }, ['siteTag'], 'count_DESC', 10);
const siteTag = sites[0]?.dimensions.siteTag;
if (siteTag === undefined) throw new Error(`Cloudflare has no page views for ${HOSTS.join(' or ')} in the last ${days} days.`);
const site = { ...since, siteTag };

console.log(table(`Sites, last ${days} days`, sites, row => `site …${(row.dimensions.siteTag ?? '').slice(-4)}`));
console.log(table('By day', await groups(site, ['date'], 'date_ASC', MAX_DAYS + 1), row => row.dimensions.date ?? ''));
console.log(table('Referrers', await groups({ ...site, refererHost_notin: ['', ...HOSTS] }, ['refererHost', 'refererPath'], 'sum_visits_DESC', 50),
  row => `${row.dimensions.refererHost ?? ''}${row.dimensions.refererPath ?? ''}`));
console.log(table('Pages', await groups(site, ['requestPath'], 'count_DESC', 30), row => row.dimensions.requestPath ?? ''));

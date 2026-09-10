const advisoryUrl = 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml';
export function parseEnsoAdvisory(html: string) {
  const plain = html.replace(/<[^>]*>/g, ' ').replaceAll('&ntilde;', 'ñ').replaceAll('&nbsp;', ' ').replace(/\s+/g, ' ');
  const date = plain.match(/issued by.*?CLIMATE PREDICTION CENTER[^]*?(\d{1,2} [A-Za-z]+ \d{4})/i)?.[1];
  const status = plain.match(/ENSO Alert System Status:\s*(.*?)\s*Synopsis:/i)?.[1]?.trim();
  if (!date || !status || status.length > 90 || !/Advisory|Watch|Not Active|Inactive/i.test(status)) throw new Error('NOAA advisory format changed; no guessed status will be published.');
  return { date, status, url: advisoryUrl };
}

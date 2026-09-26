import { handleFindRequest } from '../../site/server/find.mts';
import { parseFeaturePin } from '../../site/search/feature-search.mts';
import pin from '../../site/prepared-feature-index.json' with { type: 'json' };

const featurePin = parseFeaturePin(JSON.stringify(pin));

export default (request: Request) => featurePin ? handleFindRequest(request, featurePin)
  : new Response(JSON.stringify({ results: [] }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

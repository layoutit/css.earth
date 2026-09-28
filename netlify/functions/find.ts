import { handleFindRequest } from '../../site/server/find.mts';
import { builtSearchData } from '../../site/server/search-data.mts';
import { FEATURE_PIN } from '../../site/server/feature-pin.mts';

const data = builtSearchData(FEATURE_PIN);

export default (request: Request) => handleFindRequest(request, data);

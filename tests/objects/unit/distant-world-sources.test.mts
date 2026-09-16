import { testDistantWorldSources } from './distant-worlds/source-contract.mts';
import { selectedObjectIds } from './anchor-table.mts';

// Distant worlds whose every declared source must retain its pinned bytes.
const WORLDS = ['achlys', 'asteroid-2002-tc302', 'asteroid-2002-tx300', 'asteroid-2003-vs2', 'deedee', 'gonggong', 'huya',
  'ixion', 'mani', 'orcus', 'oumuamua', 'salacia', 'sedna', 'varda', 'varuna'];
for (const id of selectedObjectIds(WORLDS)) testDistantWorldSources(id);

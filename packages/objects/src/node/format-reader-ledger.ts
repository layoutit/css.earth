/** Node-owned inventory admission; never imported by a browser entry. */
import { INVENTORY_SCHEMA } from './runtime-asset-closure.js';
import type { FormatReaderPolicy } from '../prepared-data/format-reader-ledger.js';
export const NODE_FORMAT_READER_POLICIES: readonly FormatReaderPolicy[] = [
  { schema: INVENTORY_SCHEMA, readers: ['requireInventory', 'validateInventory'], paths: ['inventory.json'] },
];

import { INVESTIGATION_LEDGER_SCHEMA } from './source-schema-identifiers.ts';

export const INVESTIGATION_STATUSES = ['included', 'excluded', 'unresolved', 'deferred'] as const;
export type InvestigationStatus = typeof INVESTIGATION_STATUSES[number];

export interface InvestigationEntry {
  id: string; subject: string; status: InvestigationStatus; finding: string; revisitWhen?: string;
  /** The shared record this decision leans on (data/investigations), when the reasoning is not this body's own. */
  survey?: string;
  evidence: string[];
}
export interface InvestigationLedger { schema: typeof INVESTIGATION_LEDGER_SCHEMA; objectId: string; entries: InvestigationEntry[] }
export interface FacilityInvestigationLedger { schema: typeof INVESTIGATION_LEDGER_SCHEMA; facilityId: string; entries: InvestigationEntry[] }

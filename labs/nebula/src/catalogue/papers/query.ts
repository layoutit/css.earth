import { readTapTable } from '../tap';
import { readPaper, type Paper } from './types';

export const countQuery = "SELECT i.id AS messier_id,COUNT(*) AS ref_count FROM ident AS i JOIN has_ref AS h ON i.oidref=h.oidref WHERE i.id LIKE 'M %' GROUP BY i.id";
export function readPaperCounts(value: unknown) {
  const table = readTapTable(value);
  if (table.overflow || table.rows.length !== 110) throw new TypeError('Expected all 110 Messier bibliography counts.');
  const rows = table.rows.map(row => {
    if (typeof row.messier_id !== 'string' || !/^M\s+\d+$/.test(row.messier_id) || typeof row.ref_count !== 'number' || !Number.isSafeInteger(row.ref_count) || row.ref_count < 0) throw new TypeError('Invalid bibliography count.');
    return {objectId:row.messier_id.toLowerCase().replace(/\s/g,''),simbadId:row.messier_id,expectedCount:row.ref_count};
  });
  if (new Set(rows.map(row=>row.objectId)).size !== 110 || rows.some(row=> !/^m(?:[1-9]|[1-9]\d|10\d|110)$/.test(row.objectId))) throw new TypeError('Invalid bibliography identities.');
  return rows;
}
export function papersQuery(simbadId: string, limit: number) {
  if (!/^M\s+\d+$/.test(simbadId) || !Number.isSafeInteger(limit) || limit < 1 || limit > 50000) throw new TypeError('Invalid bibliography query.');
  return `SELECT TOP ${limit} r.bibcode,r.title,r.doi,r."year" AS pubyear,r.journal,r.abstract,h.ref_raw_id FROM ident AS i JOIN has_ref AS h ON i.oidref=h.oidref JOIN ref AS r ON h.oidbibref=r.oidbib WHERE i.id='${simbadId}' ORDER BY bibcode DESC`;
}
export function papersFromRows(rows: Record<string,unknown>[]): Paper[] {
  const papers = rows.map(row=>readPaper({bibcode:row.bibcode,title:row.title ?? '',doi:row.doi,year:row.pubyear,journal:row.journal,abstract:row.abstract,objectNames:row.ref_raw_id}));
  if (new Set(papers.map(p=>p.bibcode)).size !== papers.length) throw new TypeError('Duplicate bibliography rows.');
  return papers;
}

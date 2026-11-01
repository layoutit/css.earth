/** The model's three datasets: the Horálek photograph it was calibrated to, and two regrades of the same model. */
import { readFileSync } from 'node:fs';
import type { Grade } from '../grade.mts';
import { readGrade } from '../grade.mts';
import { RECORDS } from '../scene.mts';

export type DatasetArm = 'horalek' | 'decam' | 'vista';
export const DATASET_ARMS: readonly DatasetArm[] = ['horalek', 'decam', 'vista'];
type GradeRecord = Record<string, { grade: unknown; channelGains: number[] }>;
const record = () => JSON.parse(readFileSync(RECORDS + 'image-grades.json', 'utf8')) as GradeRecord;
/** A regraded dataset's grade; the Horálek dataset uses the model's own. */
export const armGrade = (arm: DatasetArm): Grade | undefined =>
  arm === 'horalek' ? undefined : readGrade(record()[arm]!.grade);
export const armChannelGains = (arm: 'decam' | 'vista') => record()[arm]!.channelGains;

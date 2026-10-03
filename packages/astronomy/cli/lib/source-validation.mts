// Structural decoding is shared with the published source-record contracts.
import { sourceRecordReaders } from '@cssearth/objects';
export const { string, number, vector, optional, array, dictionary, boolean, literal, shape } = sourceRecordReaders;
export type Parser<T> = (value: unknown) => T;

/** A position and velocity: kilometres and kilometres per second in a reference frame, as SPK segments give them. */
export interface State { readonly position: readonly [number, number, number]; readonly velocity: readonly [number, number, number] }

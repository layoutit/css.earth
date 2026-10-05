/** Only preview listens; port zero asks the OS for a distinct free socket. */
export function hostPort(target: string): 0 | undefined {
  return target === 'preview' ? 0 : undefined;
}

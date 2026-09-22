/** The positional arguments of a command line: everything that is neither a `--flag` nor the value that follows one of
 * `valueFlags`. An absent flag has index -1, and "the argument after it" would then be argument zero; filtering on
 * `index !== flagIndex + 1` without checking for absence silently drops the first positional. This is the one place that
 * decides it. */
export function positionalArguments(args: readonly string[], valueFlags: readonly string[] = []): string[] {
  const values = new Set<number>();
  args.forEach((argument, index) => { if (valueFlags.includes(argument)) values.add(index + 1); });
  return args.filter((argument, index) => !argument.startsWith('--') && !values.has(index));
}

/** The value given after `flag`, or undefined when the flag is absent or is the last argument. */
export const flagValue = (args: readonly string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};

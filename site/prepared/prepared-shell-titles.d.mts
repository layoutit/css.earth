export interface PreparedShellTitle {
  readonly label: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

export const PREPARED_SHELL_TITLES: Readonly<Record<string, PreparedShellTitle>>;

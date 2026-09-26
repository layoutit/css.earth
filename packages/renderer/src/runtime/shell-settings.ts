/** The settings the shared shell owns (site/components/ObjectShell.astro). An object package declares its own
 * settings under other names, and the shell's are never bound as the object's. */
export const SHELL_SETTING_NAMES: ReadonlySet<string> = new Set(['motion', 'heliosphere', 'illustrationModels', 'surfaceLabels', 'threeDStars']);

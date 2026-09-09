export function validateDatasetText(lens: {
  readonly id: string;
  readonly title?: string;
  readonly label?: string;
  readonly description?: string;
  readonly summary?: string;
}): { title: string; description: string };

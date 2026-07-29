export const OFFICIAL_AWS_DOCUMENTATION_HOSTS: ReadonlySet<string>;
export function isOfficialAwsDocumentationUrl(value: unknown): boolean;
export function normalizeText(value: string): string;
export function fingerprintQuestion(
  prompt: string,
  concepts: string[]
): string;

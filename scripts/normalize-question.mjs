import { createHash } from "node:crypto";

export const OFFICIAL_AWS_DOCUMENTATION_HOSTS = new Set([
  "aws.amazon.com",
  "docs.aws.amazon.com",
  "kiro.dev",
  "strandsagents.com"
]);

export function isOfficialAwsDocumentationUrl(value) {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.port === "" &&
      OFFICIAL_AWS_DOCUMENTATION_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
}

const aliases = [
  [/\bamazon sagemaker ai\b/g, "amazon sagemaker"],
  [/\baws sagemaker\b/g, "amazon sagemaker"],
  [/\baws bedrock\b/g, "amazon bedrock"],
  [/\bsimple storage service\b/g, "amazon s3"],
  [/\baws identity and access management\b/g, "aws iam"]
];

export function normalizeText(value) {
  let normalized = String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of aliases) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

export function fingerprintQuestion(prompt, concepts = []) {
  const normalizedConcepts = concepts.map(normalizeText).filter(Boolean).sort();
  const payload = [normalizeText(prompt), ...normalizedConcepts].join("|");

  return createHash("sha256").update(payload).digest("hex");
}

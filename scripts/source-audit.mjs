export const auditDispositions = [
  "represented",
  "new-rewrite",
  "semantic-duplicate",
  "outdated",
  "ambiguous",
  "out-of-scope",
  "incorrect-source-answer"
];

const mappedDispositions = new Set([
  "represented",
  "new-rewrite",
  "semantic-duplicate",
  "incorrect-source-answer"
]);

export function isMappedDisposition(disposition) {
  return mappedDispositions.has(disposition);
}

export function sourceFilterKey(source) {
  return source.sourceType === "examtopics"
    ? "examtopics:aif-c01"
    : `youtube:${source.videoId}`;
}

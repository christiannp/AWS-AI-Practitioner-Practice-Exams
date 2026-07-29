import type { SourceRef } from "../src/data/types";

export type AuditDisposition =
  | "represented"
  | "new-rewrite"
  | "semantic-duplicate"
  | "outdated"
  | "ambiguous"
  | "out-of-scope"
  | "incorrect-source-answer";

export type MappedDisposition =
  | "represented"
  | "new-rewrite"
  | "semantic-duplicate"
  | "incorrect-source-answer";

export declare const auditDispositions: AuditDisposition[];
export declare function isMappedDisposition(
  disposition: AuditDisposition
): disposition is MappedDisposition;
export declare function sourceFilterKey(source: SourceRef): string;

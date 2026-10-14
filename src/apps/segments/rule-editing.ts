import type { SegmentField, SegmentRule } from "./definition";

/**
 * Small pure helpers the segment builder uses to keep a rule valid while it
 * is being edited. They take the field catalog as plain data, so they run in
 * the browser without pulling in any database code.
 */

/** A sensible starting value for an operator, so a new rule is valid at once. */
function defaultValue(field: SegmentField, op: string): string | number | undefined {
  const operator = field.operators.find((candidate) => candidate.op === op);
  switch (operator?.value) {
    case "choice":
      return field.choices?.[0]?.value;
    case "number":
      return field.field === "last_open" ? 30 : 1;
    case "date":
      return "";
    case "text":
      return "";
    default:
      return undefined;
  }
}

/** A new rule on a field, using its first operator. */
export function newRule(field: SegmentField): SegmentRule {
  const op = field.operators[0].op;
  return { field: field.field, op, value: defaultValue(field, op) };
}

/** The same rule with a different operator. The value is kept when it still fits. */
export function withOperator(rule: SegmentRule, field: SegmentField, op: string): SegmentRule {
  const before = field.operators.find((candidate) => candidate.op === rule.op);
  const after = field.operators.find((candidate) => candidate.op === op);
  const keepValue = before?.value === after?.value;
  return { field: rule.field, op, value: keepValue ? rule.value : defaultValue(field, op) };
}

/** The same rule with a new value, read from a form input. */
export function withValue(rule: SegmentRule, field: SegmentField, text: string): SegmentRule {
  const operator = field.operators.find((candidate) => candidate.op === rule.op);
  const value = operator?.value === "number" ? Number.parseInt(text, 10) : text;
  return { ...rule, value: typeof value === "number" && Number.isNaN(value) ? undefined : value };
}

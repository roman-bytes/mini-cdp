import { APP_EVENT_NAMES } from "@/apps/mobile/schema";
import { SUBSCRIPTION_STATUSES } from "@/apps/newsletter/schema";
import { PERSON_KINDS } from "@/apps/people/profiles-view";
import { CHANNEL_LABELS } from "@/shared/channels";
import { isIsoDate } from "@/shared/dates";

/** One condition, e.g. { field: "source", op: "is", value: "instagram" }. */
export type SegmentRule = {
  field: string;
  op: string;
  value?: string | number;
};

/** A segment: rules joined by AND ("all") or OR ("any"). No rules means everyone. */
export type SegmentDefinition = {
  match: "all" | "any";
  rules: SegmentRule[];
};

/** What kind of value an operator needs. */
type ValueKind = "none" | "number" | "date" | "text" | "choice";

type FieldOperator = { op: string; label: string; value: ValueKind };

export type SegmentField = {
  field: string;
  label: string;
  operators: FieldOperator[];
  /** The allowed values, for operators that take a choice. */
  choices?: { value: string; label: string }[];
};

function choicesFrom(values: readonly string[], labels: Record<string, string> = {}) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

/**
 * Everything a segment can filter on. The builder draws its menus from this
 * list and the server checks every rule against it, so a rule can only ever
 * name a field, operator and value that appear here.
 */
export const SEGMENT_FIELDS: SegmentField[] = [
  {
    field: "source",
    label: "Signup source",
    operators: [
      { op: "is", label: "is", value: "choice" },
      { op: "is_not", label: "is not", value: "choice" },
    ],
    choices: choicesFrom(Object.keys(CHANNEL_LABELS), CHANNEL_LABELS),
  },
  {
    field: "status",
    label: "Newsletter status",
    operators: [
      { op: "is", label: "is", value: "choice" },
      { op: "is_not", label: "is not", value: "choice" },
    ],
    choices: choicesFrom(SUBSCRIPTION_STATUSES, { active: "Active", unsubscribed: "Unsubscribed" }),
  },
  {
    field: "kind",
    label: "Person type",
    operators: [
      { op: "is", label: "is", value: "choice" },
      { op: "is_not", label: "is not", value: "choice" },
    ],
    choices: choicesFrom(PERSON_KINDS, {
      subscriber: "Subscriber",
      app_only: "App only",
      unknown: "Unknown",
    }),
  },
  {
    field: "signup_date",
    label: "Signup date",
    operators: [
      { op: "on_or_after", label: "is on or after", value: "date" },
      { op: "on_or_before", label: "is on or before", value: "date" },
    ],
  },
  {
    field: "last_open",
    label: "Last email open",
    operators: [
      { op: "not_within_days", label: "was not in the last (days)", value: "number" },
      { op: "within_days", label: "was in the last (days)", value: "number" },
      { op: "never", label: "never happened", value: "none" },
    ],
  },
  {
    field: "app_account",
    label: "App account",
    operators: [
      { op: "has", label: "exists", value: "none" },
      { op: "has_not", label: "does not exist", value: "none" },
    ],
  },
  {
    field: "web_visits",
    label: "Website visits",
    operators: [
      { op: "at_least", label: "are at least", value: "number" },
      { op: "at_most", label: "are at most", value: "number" },
    ],
  },
  {
    field: "viewed_page",
    label: "Website page",
    operators: [
      { op: "viewed", label: "was viewed", value: "text" },
      { op: "not_viewed", label: "was never viewed", value: "text" },
    ],
  },
  {
    field: "app_event",
    label: "App event",
    operators: [
      { op: "did", label: "happened", value: "choice" },
      { op: "did_not", label: "never happened", value: "choice" },
    ],
    choices: choicesFrom(APP_EVENT_NAMES),
  },
];

export function findField(field: string): SegmentField | undefined {
  return SEGMENT_FIELDS.find((candidate) => candidate.field === field);
}

/** Why a rule's value does not fit its operator, or null when it does. */
function findValueProblem(field: SegmentField, kind: ValueKind, value: unknown): string | null {
  if (kind === "none") return null;
  if (kind === "number") {
    return Number.isInteger(value) && (value as number) >= 0 ? null : "needs a whole number";
  }
  if (typeof value !== "string" || value.trim() === "") return "needs a value";
  if (kind === "date") return isIsoDate(value) ? null : "needs a YYYY-MM-DD date";
  if (kind === "choice") {
    return field.choices?.some((choice) => choice.value === value) ? null : "is not an allowed value";
  }
  return null;
}

/** Why a rule is not usable, or null when it is fine. */
export function findRuleProblem(rule: SegmentRule): string | null {
  const field = findField(rule?.field);
  if (!field) return `Unknown field "${rule?.field}"`;

  const operator = field.operators.find((candidate) => candidate.op === rule.op);
  if (!operator) return `${field.label}: unknown operator "${rule.op}"`;

  const problem = findValueProblem(field, operator.value, rule.value);
  return problem ? `${field.label} ${problem}` : null;
}

export type DefinitionCheck =
  | { ok: true; definition: SegmentDefinition }
  | { ok: false; errors: string[] };

/**
 * Checks anything that claims to be a segment definition (from the builder,
 * the database or, later, the assistant) before it is turned into a query.
 */
export function checkDefinition(input: unknown): DefinitionCheck {
  const candidate = input as Partial<SegmentDefinition> | null;
  if (!candidate || !Array.isArray(candidate.rules)) {
    return { ok: false, errors: ["A segment needs a list of rules"] };
  }
  if (candidate.match !== "all" && candidate.match !== "any") {
    return { ok: false, errors: ['"match" must be "all" or "any"'] };
  }

  const errors = candidate.rules
    .map((rule) => findRuleProblem(rule))
    .filter((problem): problem is string => problem !== null);
  if (errors.length > 0) return { ok: false, errors };

  const rules = candidate.rules.map(({ field, op, value }) => ({ field, op, value }));
  return { ok: true, definition: { match: candidate.match, rules } };
}

/** A rule in plain words, e.g. "Signup source is Instagram". */
export function describeRule(rule: SegmentRule): string {
  const field = findField(rule.field);
  const operator = field?.operators.find((candidate) => candidate.op === rule.op);
  if (!field || !operator) return "Unknown rule";

  if (operator.value === "none") return `${field.label} ${operator.label}`;
  if (operator.value === "number") {
    return `${field.label} ${operator.label.replace("(days)", `${rule.value} days`)}`.replace(
      /(at least|at most)$/,
      `$1 ${rule.value}`,
    );
  }
  const choice = field.choices?.find((candidate) => candidate.value === rule.value);
  return `${field.label} ${operator.label} ${choice?.label ?? rule.value}`;
}

/** The brief's example: Instagram signups who have not opened in 30 days. */
export const EXAMPLE_DEFINITION: SegmentDefinition = {
  match: "all",
  rules: [
    { field: "source", op: "is", value: "instagram" },
    { field: "last_open", op: "not_within_days", value: 30 },
  ],
};

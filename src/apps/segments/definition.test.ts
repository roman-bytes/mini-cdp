import { describe, expect, it } from "vitest";

import { checkDefinition, describeRule, EXAMPLE_DEFINITION, findRuleProblem, SEGMENT_FIELDS } from "./definition";

describe("findRuleProblem", () => {
  it("accepts a rule for every operator in the catalog", () => {
    const sample = { none: undefined, number: 30, date: "2026-08-01", text: "/about", choice: "" };

    for (const field of SEGMENT_FIELDS) {
      for (const operator of field.operators) {
        const value = operator.value === "choice" ? field.choices![0].value : sample[operator.value];
        expect(findRuleProblem({ field: field.field, op: operator.op, value })).toBeNull();
      }
    }
  });

  it("refuses a field that is not in the catalog", () => {
    expect(findRuleProblem({ field: "email", op: "is", value: "x" })).toBe('Unknown field "email"');
  });

  it("refuses an operator the field does not have", () => {
    expect(findRuleProblem({ field: "source", op: "contains", value: "insta" })).toMatch(/unknown operator/);
  });

  it("refuses a choice that is not on the list", () => {
    expect(findRuleProblem({ field: "status", op: "is", value: "paused" })).toBe(
      "Newsletter status is not an allowed value",
    );
  });

  it.each([-1, 1.5, "30", undefined])("refuses %j where a whole number is needed", (value) => {
    expect(findRuleProblem({ field: "last_open", op: "not_within_days", value })).toBe(
      "Last email open needs a whole number",
    );
  });

  it("refuses a value that is not a date where a date is needed", () => {
    expect(findRuleProblem({ field: "signup_date", op: "on_or_after", value: "last week" })).toBe(
      "Signup date needs a YYYY-MM-DD date",
    );
  });

  it("refuses an empty text value", () => {
    expect(findRuleProblem({ field: "viewed_page", op: "viewed", value: " " })).toBe(
      "Website page needs a value",
    );
  });
});

describe("checkDefinition", () => {
  it("accepts a valid definition and keeps only the known keys", () => {
    const check = checkDefinition({
      match: "all",
      rules: [{ field: "source", op: "is", value: "instagram", extra: "ignored" }],
      somethingElse: true,
    });

    expect(check).toEqual({
      ok: true,
      definition: { match: "all", rules: [{ field: "source", op: "is", value: "instagram" }] },
    });
  });

  it("accepts no rules, meaning everyone", () => {
    expect(checkDefinition({ match: "any", rules: [] })).toEqual({
      ok: true,
      definition: { match: "any", rules: [] },
    });
  });

  it.each([null, "text", {}, { match: "all" }])("refuses %j", (input) => {
    expect(checkDefinition(input).ok).toBe(false);
  });

  it("refuses an unknown match mode", () => {
    expect(checkDefinition({ match: "most", rules: [] })).toEqual({
      ok: false,
      errors: ['"match" must be "all" or "any"'],
    });
  });

  it("reports every bad rule", () => {
    const check = checkDefinition({
      match: "all",
      rules: [
        { field: "source", op: "is", value: "instagram" },
        { field: "nope", op: "is" },
        { field: "status", op: "is", value: "paused" },
      ],
    });

    expect(check).toEqual({
      ok: false,
      errors: ['Unknown field "nope"', "Newsletter status is not an allowed value"],
    });
  });
});

describe("describeRule", () => {
  it.each([
    [{ field: "source", op: "is", value: "instagram" }, "Signup source is Instagram"],
    [{ field: "status", op: "is_not", value: "unsubscribed" }, "Newsletter status is not Unsubscribed"],
    [{ field: "last_open", op: "not_within_days", value: 30 }, "Last email open was not in the last 30 days"],
    [{ field: "last_open", op: "never" }, "Last email open never happened"],
    [{ field: "web_visits", op: "at_least", value: 3 }, "Website visits are at least 3"],
    [{ field: "signup_date", op: "on_or_after", value: "2026-08-01" }, "Signup date is on or after 2026-08-01"],
    [{ field: "viewed_page", op: "viewed", value: "/about" }, "Website page was viewed /about"],
    [{ field: "app_account", op: "has" }, "App account exists"],
    [{ field: "nope", op: "is" }, "Unknown rule"],
  ])("describes %j", (rule, expected) => {
    expect(describeRule(rule)).toBe(expected);
  });
});

describe("EXAMPLE_DEFINITION", () => {
  it("is a valid segment", () => {
    expect(checkDefinition(EXAMPLE_DEFINITION).ok).toBe(true);
  });
});

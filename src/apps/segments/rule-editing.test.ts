import { describe, expect, it } from "vitest";

import { findField, findRuleProblem } from "./definition";
import { newRule, withOperator, withValue } from "./rule-editing";

const source = findField("source")!;
const lastOpen = findField("last_open")!;
const webVisits = findField("web_visits")!;
const viewedPage = findField("viewed_page")!;
const appAccount = findField("app_account")!;

describe("newRule", () => {
  it("starts a choice field on its first choice, which is already valid", () => {
    const rule = newRule(source);

    expect(rule).toEqual({ field: "source", op: "is", value: "instagram" });
    expect(findRuleProblem(rule)).toBeNull();
  });

  it("starts the last-open rule at 30 days", () => {
    expect(newRule(lastOpen)).toEqual({ field: "last_open", op: "not_within_days", value: 30 });
  });

  it("starts a count rule at 1 and a no-value rule with no value", () => {
    expect(newRule(webVisits).value).toBe(1);
    expect(newRule(appAccount)).toEqual({ field: "app_account", op: "has", value: undefined });
  });
});

describe("withOperator", () => {
  it("keeps the value when the new operator takes the same kind", () => {
    const rule = withOperator({ field: "last_open", op: "not_within_days", value: 45 }, lastOpen, "within_days");

    expect(rule).toEqual({ field: "last_open", op: "within_days", value: 45 });
  });

  it("drops the value when the new operator takes none", () => {
    const rule = withOperator({ field: "last_open", op: "not_within_days", value: 45 }, lastOpen, "never");

    expect(rule).toEqual({ field: "last_open", op: "never", value: undefined });
  });

  it("gives a default when moving from no value to one", () => {
    const rule = withOperator({ field: "last_open", op: "never" }, lastOpen, "within_days");

    expect(rule.value).toBe(30);
  });
});

describe("withValue", () => {
  it("reads a number field as a whole number", () => {
    expect(withValue({ field: "web_visits", op: "at_least", value: 1 }, webVisits, "12").value).toBe(12);
  });

  it("clears a number field that is not a number", () => {
    expect(withValue({ field: "web_visits", op: "at_least", value: 1 }, webVisits, "").value).toBeUndefined();
  });

  it("keeps text as typed", () => {
    expect(withValue({ field: "viewed_page", op: "viewed", value: "" }, viewedPage, "/about").value).toBe("/about");
  });
});

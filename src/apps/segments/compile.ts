import { and, eq, gte, isNull, lt, lte, ne, not, or, sql, type SQL } from "drizzle-orm";

import { events } from "@/apps/mobile/schema";
import { neverOpened, profiles } from "@/apps/people/profiles-view";
import { visits } from "@/apps/web/schema";
import { daysBefore } from "@/shared/dates-math";

import type { SegmentDefinition, SegmentRule } from "./definition";

/** "Is not X" should also match people who have no value at all. */
function isNot(column: SQL, value: string): SQL {
  return or(sql`${column} is null`, ne(column, value))!;
}

/** Conditions on the last email open. They only ever match subscribers. */
function lastOpenCondition(rule: SegmentRule, today: string): SQL {
  const isSubscriber = eq(profiles.kind, "subscriber");
  if (rule.op === "never") return neverOpened;

  const cutoff = daysBefore(today, Number(rule.value));
  if (rule.op === "within_days") {
    return and(isSubscriber, gte(profiles.lastOpenDate, cutoff))!;
  }
  // "Not in the last N days" includes people who never opened.
  return and(isSubscriber, or(isNull(profiles.lastOpenDate), lt(profiles.lastOpenDate, cutoff)))!;
}

function viewedPage(page: string): SQL {
  return sql`exists (
    select 1 from ${visits}
    where ${visits.personId} = ${profiles.personId} and ${visits.page} = ${page}
  )`;
}

function didAppEvent(eventName: string): SQL {
  return sql`exists (
    select 1 from ${events}
    where ${events.personId} = ${profiles.personId} and ${events.event} = ${eventName}
  )`;
}

/**
 * Turns one checked rule into a SQL condition on the profiles view. Values
 * are always passed as parameters, never pasted into the SQL text.
 */
export function compileRule(rule: SegmentRule, today: string): SQL {
  const value = String(rule.value ?? "");

  switch (rule.field) {
    case "source":
      return rule.op === "is"
        ? eq(profiles.acquisitionSource, value)
        : isNot(sql`${profiles.acquisitionSource}`, value);
    case "status":
      return rule.op === "is" ? sql`${profiles.status} = ${value}` : isNot(sql`${profiles.status}`, value);
    case "kind":
      return rule.op === "is" ? sql`${profiles.kind} = ${value}` : sql`${profiles.kind} <> ${value}`;
    case "signup_date":
      return rule.op === "on_or_after" ? gte(profiles.signupDate, value) : lte(profiles.signupDate, value);
    case "last_open":
      return lastOpenCondition(rule, today);
    case "app_account":
      return eq(profiles.hasAppAccount, rule.op === "has");
    case "web_visits":
      return rule.op === "at_least"
        ? gte(profiles.webVisitCount, Number(rule.value))
        : lte(profiles.webVisitCount, Number(rule.value));
    case "viewed_page":
      return rule.op === "viewed" ? viewedPage(value) : not(viewedPage(value));
    case "app_event":
      return rule.op === "did" ? didAppEvent(value) : not(didAppEvent(value));
    default:
      throw new Error(`No SQL for segment field "${rule.field}"`);
  }
}

/** The WHERE condition for a whole segment. Undefined means "everyone". */
export function compileDefinition(definition: SegmentDefinition, today: string): SQL | undefined {
  const conditions = definition.rules.map((rule) => compileRule(rule, today));
  if (conditions.length === 0) return undefined;
  return definition.match === "all" ? and(...conditions) : or(...conditions);
}

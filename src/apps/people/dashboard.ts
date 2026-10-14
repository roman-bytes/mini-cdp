import { and, count, desc, eq, gt, gte, isNull, lt, sql, type SQL } from "drizzle-orm";

import type { Db } from "@/shared/db/client";
import { daysBefore, startOfWeek } from "@/shared/dates-math";

import { neverOpened, profiles } from "./profiles-view";

/**
 * The numbers on the People home screen. Everything is counted from the
 * profiles view on every request, relative to "today" (CDP_TODAY).
 */

/** A subscriber counts as engaged when they opened an email this recently. */
export const ENGAGED_WINDOW_DAYS = 30;

const isSubscriber = eq(profiles.kind, "subscriber");

/** count(*) for only the rows that match a condition. */
function countWhere(condition: SQL) {
  return sql<number>`count(*) filter (where ${condition})`.mapWith(Number);
}

function engagedSince(today: string): string {
  return daysBefore(today, ENGAGED_WINDOW_DAYS);
}

export type HeadlineStats = {
  people: number;
  subscribers: number;
  activeSubscribers: number;
  openedRecently: number;
  neverOpened: number;
  subscribersOnApp: number;
  subscribersOnWeb: number;
};

export async function getHeadlineStats(db: Db, today: string): Promise<HeadlineStats> {
  const cutoff = engagedSince(today);
  const [row] = await db
    .select({
      people: count(),
      subscribers: countWhere(isSubscriber),
      activeSubscribers: countWhere(and(isSubscriber, eq(profiles.status, "active"))!),
      openedRecently: countWhere(and(isSubscriber, gte(profiles.lastOpenDate, cutoff))!),
      neverOpened: countWhere(neverOpened),
      subscribersOnApp: countWhere(and(isSubscriber, eq(profiles.hasAppAccount, true))!),
      subscribersOnWeb: countWhere(and(isSubscriber, gt(profiles.webVisitCount, 0))!),
    })
    .from(profiles);
  return row;
}

export type WeeklySignups = {
  /** The Monday the week starts on, YYYY-MM-DD. */
  weekStart: string;
  signups: number;
  /** True for the week that contains today, which is not over yet. */
  inProgress: boolean;
};

/** Marks the week that contains today, so a chart can show it as unfinished. */
export function markWeekInProgress(
  weeks: { weekStart: string; signups: number }[],
  today: string,
): WeeklySignups[] {
  const currentWeek = startOfWeek(today);
  return weeks.map((week) => ({ ...week, inProgress: week.weekStart === currentWeek }));
}

/** New subscribers per week, oldest first. */
export async function getWeeklySignups(db: Db, today: string): Promise<WeeklySignups[]> {
  const weekStart = sql<string>`to_char(date_trunc('week', ${profiles.signupDate}), 'YYYY-MM-DD')`;
  const rows = await db
    .select({ weekStart, signups: count() })
    .from(profiles)
    .where(isSubscriber)
    .groupBy(weekStart)
    .orderBy(weekStart);
  return markWeekInProgress(rows, today);
}

export type SourceEngagement = {
  /** Stored channel name, or null when the source is unknown. */
  source: string | null;
  total: number;
  /** Opened an email within the engaged window. */
  engaged: number;
  /** Opened at some point, but not within the window. */
  lapsed: number;
  neverOpened: number;
};

/** For each signup source: how many subscribers, and how many are still opening. Biggest first. */
export async function getEngagementBySource(db: Db, today: string): Promise<SourceEngagement[]> {
  const cutoff = engagedSince(today);
  return db
    .select({
      source: profiles.acquisitionSource,
      total: count(),
      engaged: countWhere(gte(profiles.lastOpenDate, cutoff)),
      lapsed: countWhere(lt(profiles.lastOpenDate, cutoff)),
      neverOpened: countWhere(isNull(profiles.lastOpenDate)),
    })
    .from(profiles)
    .where(isSubscriber)
    .groupBy(profiles.acquisitionSource)
    .orderBy(desc(count()), profiles.acquisitionSource);
}

/** The channels a subscriber can be reached on besides email. */
export const REACH_GROUPS = [
  { key: "email_only", label: "Email only", onWeb: false, onApp: false },
  { key: "email_web", label: "Email and website", onWeb: true, onApp: false },
  { key: "email_app", label: "Email and app", onWeb: false, onApp: true },
  { key: "email_web_app", label: "Email, website and app", onWeb: true, onApp: true },
] as const;

export type ReachRow = { key: string; label: string; subscribers: number };

/** Puts counts per (website?, app?) pair into the four fixed groups, filling gaps with zero. */
export function toReachRows(groups: { onWeb: boolean; onApp: boolean; subscribers: number }[]): ReachRow[] {
  return REACH_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    subscribers:
      groups.find((found) => found.onWeb === group.onWeb && found.onApp === group.onApp)?.subscribers ?? 0,
  }));
}

/** How many subscribers have also been seen on the website, in the app, or both. */
export async function getReach(db: Db): Promise<ReachRow[]> {
  const onWeb = sql<boolean>`${profiles.webVisitCount} > 0`;
  const groups = await db
    .select({ onWeb, onApp: profiles.hasAppAccount, subscribers: count() })
    .from(profiles)
    .where(isSubscriber)
    .groupBy(onWeb, profiles.hasAppAccount);
  return toReachRows(groups);
}

/** Everything the Home page draws, read in one go. */
export async function getOverview(db: Db, today: string) {
  return {
    stats: await getHeadlineStats(db, today),
    weeks: await getWeeklySignups(db, today),
    sources: await getEngagementBySource(db, today),
    reach: await getReach(db),
  };
}

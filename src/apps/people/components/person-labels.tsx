import { Badge } from "@/components/ui/badge";
import { channelLabel } from "@/shared/channels";
import { formatDate } from "@/shared/format";

import type { Profile } from "../directory";
import type { PersonKind } from "../profiles-view";

export const KIND_LABELS: Record<PersonKind, string> = {
  subscriber: "Subscriber",
  app_only: "App only",
  unknown: "Unknown",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  unsubscribed: "Unsubscribed",
};

/** What to show where a value is missing. */
export const EMPTY = "—";

/** A person's name on screen: their email, or a note that there is none. */
export function personName(profile: Pick<Profile, "email">): string {
  return profile.email ?? "No email on file";
}

export function KindBadge({ kind }: { kind: PersonKind }) {
  return <Badge variant={kind === "subscriber" ? "secondary" : "outline"}>{KIND_LABELS[kind]}</Badge>;
}

/** The tag for a subscriber who has never opened an email. */
export function NeverOpenedTag() {
  return <Badge variant="outline">Never opened</Badge>;
}

/** The last-open cell: a date, the Never opened tag, or nothing for non-subscribers. */
export function LastOpen({ profile }: { profile: Pick<Profile, "kind" | "lastOpenDate"> }) {
  if (profile.lastOpenDate) return <>{formatDate(profile.lastOpenDate)}</>;
  return profile.kind === "subscriber" ? <NeverOpenedTag /> : <>{EMPTY}</>;
}

export function sourceLabel(source: string | null): string {
  return source ? channelLabel(source) : EMPTY;
}

export function statusLabel(status: string | null): string {
  return status ? (STATUS_LABELS[status] ?? status) : EMPTY;
}

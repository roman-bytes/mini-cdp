import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Account } from "@/apps/mobile/activity";
import type { ActivitySummary } from "@/apps/mobile/activity-summary";
import { daysBetween } from "@/shared/dates-math";
import { formatDate, formatDateTime, formatNumber } from "@/shared/format";

import type { Profile } from "../directory";
import type { IdentifierType } from "../schema";
import { EMPTY, LastOpen, sourceLabel, statusLabel } from "./person-labels";

/** A label and its value, stacked. Cards are built from rows of these. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-right">{children}</dd>
    </div>
  );
}

function FactCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** "12 days ago", "today", or nothing when there is no date. */
export function daysAgo(isoDate: string | null, today: string): string {
  if (!isoDate) return EMPTY;
  const days = daysBetween(isoDate, today);
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : `${formatNumber(days)} days ago`;
}

/** What the newsletter knows about the person. */
export function NewsletterCard({ profile, today }: { profile: Profile; today: string }) {
  if (profile.kind !== "subscriber") {
    return (
      <FactCard title="Newsletter">
        <p className="text-sm text-muted-foreground">Not a newsletter subscriber.</p>
      </FactCard>
    );
  }

  return (
    <FactCard title="Newsletter">
      <dl>
        <Fact label="Status">{statusLabel(profile.status)}</Fact>
        <Fact label="Signup source">{sourceLabel(profile.acquisitionSource)}</Fact>
        <Fact label="Signed up">{profile.signupDate ? formatDate(profile.signupDate) : EMPTY}</Fact>
        <Fact label="Last open">
          <LastOpen profile={profile} />
        </Fact>
        <Fact label="Since last open">{daysAgo(profile.lastOpenDate, today)}</Fact>
      </dl>
    </FactCard>
  );
}

/** What the website knows about the person. */
export function WebCard({ profile }: { profile: Profile }) {
  return (
    <FactCard title="Website">
      <dl>
        <Fact label="Visits">{formatNumber(profile.webVisitCount)}</Fact>
        <Fact label="First visit">{profile.firstVisitAt ? formatDateTime(profile.firstVisitAt) : EMPTY}</Fact>
        <Fact label="Last visit">{profile.lastVisitAt ? formatDateTime(profile.lastVisitAt) : EMPTY}</Fact>
      </dl>
    </FactCard>
  );
}

/** What the mobile app knows about the person. */
export function AppCard({ accounts, summary }: { accounts: Account[]; summary: ActivitySummary }) {
  const totalEvents = Object.values(summary.counts).reduce((sum, count) => sum + count, 0);
  if (accounts.length === 0 && totalEvents === 0) {
    return (
      <FactCard title="Mobile app">
        <p className="text-sm text-muted-foreground">No app account and no app activity.</p>
      </FactCard>
    );
  }

  return (
    <FactCard title="Mobile app">
      <dl>
        {accounts.map((account) => (
          <Fact key={account.userId} label={`Account ${account.userId}`}>
            Created {formatDate(account.createdOn)}
          </Fact>
        ))}
        {Object.entries(summary.counts).map(([name, count]) => (
          <Fact key={name} label={name}>
            {formatNumber(count)}
          </Fact>
        ))}
        <Fact label="Devices">{summary.devices.length > 0 ? summary.devices.join(", ") : EMPTY}</Fact>
      </dl>
    </FactCard>
  );
}

export const IDENTIFIER_LABELS: Record<IdentifierType, string> = {
  email: "Email",
  visitor_id: "Web visitor ID",
  user_id: "App user ID",
  device_id: "App device ID",
};

export type IdentifierRow = {
  type: IdentifierType;
  value: string;
  source: string;
  createdAt: Date;
};

/** Every ID that points at this person, and which app linked it. */
export function IdentityTable({ identifiers }: { identifiers: IdentifierRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kind</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Linked by</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {identifiers.map((identifier) => (
          <TableRow key={`${identifier.type}:${identifier.value}`}>
            <TableCell>{IDENTIFIER_LABELS[identifier.type]}</TableCell>
            <TableCell className="font-mono text-sm">{identifier.value}</TableCell>
            <TableCell>
              <Badge variant="outline">{identifier.source}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

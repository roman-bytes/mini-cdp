import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/shared/format";

import type { ImportChecks as ImportChecksData } from "../report";

/** The headline numbers, in display order, with what each one means. */
export const CHECK_LABELS: { key: keyof ImportChecksData; label: string; hint: string }[] = [
  { key: "subscriberProfiles", label: "Subscriber profiles", hint: "One per distinct email" },
  { key: "duplicateRowsMerged", label: "Duplicate rows merged", hint: "Same email in a different case or with padding" },
  { key: "rowsSetAside", label: "Rows set aside", hint: "Blank rows and unusable values" },
  { key: "appAccountsLinkedToSubscriber", label: "App accounts linked to a subscriber", hint: "Matched on email" },
  { key: "appOnlyProfiles", label: "App-only profiles", hint: "App users who are not on the newsletter" },
  { key: "webVisitsAttachedToSubscriber", label: "Web visits attached to a subscriber", hint: "Linked through the visitor ID" },
  { key: "webVisitsAnonymous", label: "Web visits left anonymous", hint: "The visitor never gave an email" },
];

/** One card per headline number. */
export function ImportChecks({ checks }: { checks: ImportChecksData }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CHECK_LABELS.map(({ key, label, hint }) => (
        <li key={key}>
          <Card className="h-full">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">
                {formatNumber(checks[key])}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{hint}</CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

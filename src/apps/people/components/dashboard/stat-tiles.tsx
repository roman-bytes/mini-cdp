import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/shared/format";

import { ENGAGED_WINDOW_DAYS, type HeadlineStats } from "../../dashboard";

type Tile = { label: string; value: number; detail: string };

/** The four headline numbers, each with what it is out of. */
export function headlineTiles(stats: HeadlineStats): Tile[] {
  return [
    {
      label: "Subscribers",
      value: stats.subscribers,
      detail: `${formatNumber(stats.activeSubscribers)} active · ${formatNumber(stats.people - stats.subscribers)} more people in the app only`,
    },
    {
      label: `Opened in the last ${ENGAGED_WINDOW_DAYS} days`,
      value: stats.openedRecently,
      detail: `${formatPercent(stats.openedRecently, stats.subscribers)} of subscribers`,
    },
    {
      label: "Never opened",
      value: stats.neverOpened,
      detail: `${formatPercent(stats.neverOpened, stats.subscribers)} of subscribers`,
    },
    {
      label: "Also use the app",
      value: stats.subscribersOnApp,
      detail: `${formatPercent(stats.subscribersOnApp, stats.subscribers)} of subscribers · ${formatNumber(stats.subscribersOnWeb)} seen on the website`,
    },
  ];
}

/** A row of headline numbers. */
export function StatTiles({ stats }: { stats: HeadlineStats }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {headlineTiles(stats).map((tile) => (
        <li key={tile.label}>
          <Card className="h-full">
            <CardHeader>
              <CardDescription>{tile.label}</CardDescription>
              <CardTitle className="text-3xl font-semibold">{formatNumber(tile.value)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{tile.detail}</CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

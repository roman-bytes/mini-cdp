import {
  ENGAGED_WINDOW_DAYS,
  type HeadlineStats,
  type ReachRow,
  type SourceEngagement,
  type WeeklySignups,
} from "../../dashboard";
import { ChartCard } from "./chart-card";
import { reachBars, reachTable, signupBars, signupTable, sourceBars, sourceTable } from "./chart-data";
import { ReachChart, SignupsChart, SourceEngagementChart } from "./charts";
import { StatTiles } from "./stat-tiles";

export type OverviewData = {
  stats: HeadlineStats;
  weeks: WeeklySignups[];
  sources: SourceEngagement[];
  reach: ReachRow[];
};

/** The headline numbers and charts at the top of the People screen. */
export function PeopleOverview({ data }: { data: OverviewData }) {
  return (
    <div className="space-y-4">
      <StatTiles stats={data.stats} />

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="New subscribers per week"
          description="Weeks start on Monday. The grey bar is the current week, which is not over yet."
          table={signupTable(data.weeks)}
        >
          <SignupsChart bars={signupBars(data.weeks)} />
        </ChartCard>

        <ChartCard
          title="Where subscribers can be reached"
          description="Every subscriber gets email. These are the ones also seen on the website, in the app, or both."
          table={reachTable(data.reach)}
        >
          <ReachChart bars={reachBars(data.reach)} />
        </ChartCard>
      </div>

      <ChartCard
        title="Engagement by signup source"
        description={`How many subscribers each source brought in, and how many opened an email in the last ${ENGAGED_WINDOW_DAYS} days.`}
        table={sourceTable(data.sources)}
      >
        <SourceEngagementChart bars={sourceBars(data.sources)} />
      </ChartCard>
    </div>
  );
}

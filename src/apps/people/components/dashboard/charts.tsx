"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import type { ReachBar, SignupBar, SourceBar } from "./chart-data";

/** Rounds an axis maximum up to a clean step, so ticks read 0, 50, 100... */
export function roundAxisMax(max: number, step: number): number {
  return Math.max(step, Math.ceil(max / step) * step);
}

/** Bars are capped at 24px thick and separated by a 2px gap in the page colour. */
const MAX_BAR_SIZE = 24;
const SURFACE_GAP = { stroke: "var(--background)", strokeWidth: 2 };

const signupConfig = {
  signups: { label: "Signups", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** New subscribers per week. The week still in progress is drawn in grey. */
export function SignupsChart({ bars }: { bars: SignupBar[] }) {
  return (
    <ChartContainer
      config={signupConfig}
      className="aspect-auto h-64 w-full"
      role="img"
      aria-label="Column chart of new subscribers per week. The table below lists every value."
    >
      <BarChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
          domain={[0, (max: number) => roundAxisMax(max, 50)]}
          tickCount={6}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(label, payload) =>
                `Week of ${label}${payload?.[0]?.payload?.inProgress ? " (so far)" : ""}`
              }
            />
          }
        />
        <Bar dataKey="signups" maxBarSize={MAX_BAR_SIZE} radius={[4, 4, 0, 0]}>
          {bars.map((bar) => (
            <Cell key={bar.weekStart} fill={bar.inProgress ? "var(--chart-muted)" : "var(--color-signups)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const sourceConfig = {
  engaged: { label: "Opened in last 30 days", color: "var(--chart-engaged)" },
  lapsed: { label: "Lapsed", color: "var(--chart-lapsed)" },
  neverOpened: { label: "Never opened", color: "var(--chart-never)" },
} satisfies ChartConfig;

/**
 * Subscribers per signup source, split by how recently they opened. Darker is
 * more engaged; the total and the share not opening are written at the end.
 */
export function SourceEngagementChart({ bars }: { bars: SourceBar[] }) {
  return (
    <ChartContainer
      config={sourceConfig}
      className="aspect-auto w-full"
      style={{ height: 72 + bars.length * 40 }}
      role="img"
      aria-label="Stacked bar chart of subscribers by signup source and email engagement. The table below lists every value."
    >
      <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 150, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={80} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} verticalAlign="top" />
        <Bar dataKey="engaged" stackId="source" fill="var(--color-engaged)" maxBarSize={MAX_BAR_SIZE} {...SURFACE_GAP} />
        <Bar dataKey="lapsed" stackId="source" fill="var(--color-lapsed)" maxBarSize={MAX_BAR_SIZE} {...SURFACE_GAP} />
        <Bar
          dataKey="neverOpened"
          stackId="source"
          fill="var(--color-neverOpened)"
          maxBarSize={MAX_BAR_SIZE}
          radius={[0, 4, 4, 0]}
          {...SURFACE_GAP}
        >
          <LabelList dataKey="endLabel" position="right" offset={8} className="fill-foreground" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const reachConfig = {
  subscribers: { label: "Subscribers", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** How many subscribers can be reached on the website or in the app as well as by email. */
export function ReachChart({ bars }: { bars: ReachBar[] }) {
  return (
    <ChartContainer
      config={reachConfig}
      className="aspect-auto h-56 w-full"
      role="img"
      aria-label="Bar chart of subscribers by the channels they can be reached on. The table below lists every value."
    >
      <BarChart data={bars} layout="vertical" margin={{ top: 8, right: 110, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={150} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel={false} />} />
        <Bar dataKey="subscribers" fill="var(--color-subscribers)" maxBarSize={MAX_BAR_SIZE} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="endLabel" position="right" offset={8} className="fill-foreground" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

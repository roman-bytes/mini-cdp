import Link from "next/link";

import { AutoSubmit } from "@/components/auto-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHANNEL_LABELS } from "@/shared/channels";

import { DEFAULT_SORT, PEOPLE_PAGE_SIZE } from "../directory";
import { hasFilters, peopleHref, type PeopleParams } from "../people-params";
import { KIND_LABELS, STATUS_LABELS } from "./person-labels";

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Option = { value: string; label: string };

function yesNo(value: boolean | undefined): string {
  if (value === undefined) return "";
  return value ? "yes" : "no";
}

/** The filters, in display order, each with its address name, its choices and its current value. */
export function filterFields(params: PeopleParams): { name: string; label: string; value: string; options: Option[] }[] {
  const { filters } = params;
  return [
    { name: "type", label: "Type", value: filters.kind ?? "", options: Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })) },
    { name: "status", label: "Status", value: filters.status ?? "", options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })) },
    { name: "source", label: "Signup source", value: filters.source ?? "", options: Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label })) },
    {
      name: "engagement",
      label: "Email engagement",
      value: filters.engagement ?? "",
      options: [
        { value: "engaged", label: "Opened in last 30 days" },
        { value: "lapsed", label: "Lapsed" },
        { value: "never", label: "Never opened" },
      ],
    },
    { name: "app", label: "App account", value: yesNo(filters.hasAppAccount), options: [{ value: "yes", label: "Has an account" }, { value: "no", label: "No account" }] },
    { name: "web", label: "Website", value: yesNo(filters.hasVisitedWebsite), options: [{ value: "yes", label: "Has visited" }, { value: "no", label: "Never visited" }] },
  ];
}

type PeopleFiltersProps = {
  params: PeopleParams;
  /** The page the table is on, e.g. /people or a saved segment's page. */
  basePath?: string;
  /** What the search box searches, e.g. "Search people" or "Search this segment". */
  searchLabel?: string;
};

/**
 * Search and filters for a people table. A plain GET form, so every view of
 * the list has its own shareable address. The search here only searches this
 * table; the box in the top bar searches everyone.
 */
export function PeopleFilters({ params, basePath = "/people", searchLabel = "Search people" }: PeopleFiltersProps) {
  const clearHref = peopleHref({ filters: {}, sort: params.sort, page: 1, pageSize: params.pageSize }, basePath);

  return (
    <form action={basePath} className="space-y-3" role="search">
      <AutoSubmit />
      <div className="flex max-w-xl gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={params.filters.query ?? ""}
          placeholder="Email, user ID, visitor ID or device ID"
          aria-label={searchLabel}
        />
        <Button type="submit">Search</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filterFields(params).map((field) => (
          <select key={field.name} name={field.name} aria-label={field.label} defaultValue={field.value} className={selectClass}>
            <option value="">{field.label}: any</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
        {params.sort.column !== DEFAULT_SORT.column || params.sort.direction !== DEFAULT_SORT.direction ? (
          <>
            <input type="hidden" name="sort" value={params.sort.column} />
            <input type="hidden" name="dir" value={params.sort.direction} />
          </>
        ) : null}
        {params.pageSize !== PEOPLE_PAGE_SIZE ? <input type="hidden" name="size" value={params.pageSize} /> : null}
        {hasFilters(params.filters) ? (
          <Link href={clearHref} className="px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}

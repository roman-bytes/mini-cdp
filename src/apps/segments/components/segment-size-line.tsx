/** "229 people · 146 never opened". */
export function SegmentSizeLine({ total, neverOpened }: { total: number; neverOpened: number }) {
  return (
    <p className="text-sm">
      <span className="text-2xl font-semibold tabular-nums">{total.toLocaleString("en-US")}</span>{" "}
      {total === 1 ? "person" : "people"}
      {neverOpened > 0 ? (
        <span className="text-muted-foreground"> · {neverOpened.toLocaleString("en-US")} never opened</span>
      ) : null}
    </p>
  );
}

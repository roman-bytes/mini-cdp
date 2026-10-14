/** Shown in place of a section while its data loads. */
export function LoadingMessage() {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      Loading…
    </p>
  );
}

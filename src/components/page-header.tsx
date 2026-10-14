/** The title block at the top of every screen. */
export function PageHeader({ title, description, children }: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </header>
  );
}

/** A titled block within a screen. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

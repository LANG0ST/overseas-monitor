type RoutePlaceholderProps = {
  title: string;
  description?: string;
};

export function RoutePlaceholder({
  title,
  description = "This route is scaffolded and ready for implementation.",
}: RoutePlaceholderProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Overseas Services</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-muted-foreground">{description}</p>
      </section>
    </main>
  );
}

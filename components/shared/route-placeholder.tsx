type RoutePlaceholderProps = {
  title: string;
  description?: string;
};

export function RoutePlaceholder({
  title,
  description = "This route is scaffolded and ready for implementation.",
}: RoutePlaceholderProps) {
  return (
    <section className="glass-card max-w-xl rounded-3xl p-8">
      <p className="text-sm font-medium text-neutral-500">Overseas Services</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
      <p className="mt-3 text-neutral-600">{description}</p>
    </section>
  );
}

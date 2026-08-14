import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Overseas Services</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Project scaffold</h1>
        <p className="mt-3 text-muted-foreground">
          The application routes are ready for the first implementation phase.
        </p>
        <Link className="mt-6 inline-flex text-sm font-medium underline underline-offset-4" href="/dashboard">
          Open dashboard placeholder
        </Link>
      </section>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAvoirDraftAction } from "@/app/(app)/avoirs/actions";

type Facture = { id: string; number: string; date: string; client_name: string };

export function AvoirCreateForm({ facture }: { facture: Facture }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createAvoirDraftAction({ factureId: facture.id });
      if (result.ok) router.push(`/avoirs/${result.document.id}`);
      else setError(result.error);
    });
  }

  return (
    <form className="glass-card max-w-2xl space-y-6 rounded-3xl p-6 md:p-8" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Facture sélectionnée</h2>
        <p className="mt-1 text-sm text-neutral-600">Le client et sa référence seront repris automatiquement depuis la facture.</p>
      </div>
      {error ? <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">{error}</p> : null}
      <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-950"><p className="font-semibold">{facture.number}</p><p className="mt-1">{facture.client_name} · {facture.date}</p></div>
      <Link className="inline-block text-sm font-semibold text-primary-700 underline-offset-4 hover:underline" href="/avoirs/new">Changer de facture</Link>
      <button className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60" disabled={pending} type="submit">{pending ? "Création…" : "Créer l’avoir"}</button>
    </form>
  );
}

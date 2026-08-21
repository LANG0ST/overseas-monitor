"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBonCommandeDraftAction } from "@/app/(app)/bons-commande/actions";

type Partner = { id: string; name: string; ice: string | null; address: string | null };

export function BonCommandeCreateForm({ partners }: { partners: Partner[] }) {
  const router = useRouter();
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    const partnerId = manual ? "" : String(formData.get("partner_id") ?? "");
    startTransition(async () => {
      const result = await createBonCommandeDraftAction({
        partnerId: partnerId || undefined,
        clientName: String(formData.get("client_name") ?? ""),
        clientIce: String(formData.get("client_ice") ?? ""),
        clientAddress: String(formData.get("client_address") ?? ""),
      });
      if (result.ok) router.push(`/bons-commande/${result.document.id}`);
      else setError(result.error);
    });
  }

  return (
    <form
      className="glass-card max-w-2xl space-y-6 rounded-3xl p-6 md:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        submit(new FormData(event.currentTarget));
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Fournisseur du bon de commande</h2>
          <p className="mt-1 text-sm text-neutral-600">Les coordonnées seront figées sur ce bon de commande.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <input checked={manual} onChange={(event) => setManual(event.target.checked)} type="checkbox" />
          Saisie manuelle
        </label>
      </div>
      {error ? <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">{error}</p> : null}
      {!manual ? (
        <label className="block text-sm font-semibold text-neutral-900">
          Partenaire
          <select className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5" name="partner_id" required={!manual}>
            <option value="">Sélectionner un fournisseur</option>
            {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}{partner.ice ? ` · ICE ${partner.ice}` : ""}</option>)}
          </select>
        </label>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-neutral-900 sm:col-span-2">Nom du fournisseur<input className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5" name="client_name" required={manual} /></label>
          <label className="text-sm font-semibold text-neutral-900">ICE<input className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5" name="client_ice" /></label>
          <label className="text-sm font-semibold text-neutral-900 sm:col-span-2">Adresse<textarea className="mt-1 min-h-24 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5" name="client_address" /></label>
        </div>
      )}
      <button className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60" disabled={pending} type="submit">{pending ? "Création…" : "Créer le bon de commande"}</button>
    </form>
  );
}

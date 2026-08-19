"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateAvoirButton({ factureId, factureNumber }: { factureId: string; factureNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="rounded-full border border-primary-300 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-900 hover:bg-primary-100"
        onClick={() => setOpen(true)}
        type="button"
      >
        Créer un avoir
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="avoir-dialog-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-900" id="avoir-dialog-title">Créer un avoir</h2>
            <p className="mt-2 text-sm text-neutral-700">Vous allez créer un avoir à partir de la facture {factureNumber}. Le client et la référence seront préremplis.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800" onClick={() => setOpen(false)} type="button">Annuler</button>
              <button className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => router.push(`/avoirs/new?facture=${encodeURIComponent(factureId)}`)} type="button">Continuer</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

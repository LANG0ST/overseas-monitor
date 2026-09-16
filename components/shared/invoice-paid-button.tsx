"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { setInvoicePaidAction } from "@/app/(app)/factures/actions";
import { useConfirmDialog } from "@/components/shared/use-confirm-dialog";

export function InvoicePaidButton({
  factureId,
  factureNumber,
  paid,
}: {
  factureId: string;
  factureNumber: string;
  paid: boolean;
}) {
  const router = useRouter();
  const { confirm, confirmationDialog } = useConfirmDialog();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function togglePaid() {
    const nextPaid = !paid;
    const accepted = await confirm({
      title: nextPaid ? "Marquer comme payée ?" : "Marquer comme impayée ?",
      description: nextPaid
        ? `Voulez-vous marquer la facture ${factureNumber} comme payée ?`
        : `Voulez-vous marquer la facture ${factureNumber} comme impayée ?`,
      confirmLabel: "Confirmer",
    });
    if (!accepted) return;
    startTransition(async () => {
      const result = await setInvoicePaidAction(factureId, nextPaid);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <>
      {confirmationDialog}
      <button
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${paid ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100" : "border-green-300 bg-green-50 text-green-900 hover:bg-green-100"}`}
        disabled={pending}
        onClick={togglePaid}
        title={error ?? undefined}
        type="button"
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : paid ? (
          <CircleX className="size-3.5" />
        ) : (
          <CircleCheck className="size-3.5" />
        )}
        {pending ? "Mise à jour…" : paid ? "Impayé" : "Payé"}
      </button>
      {error ? <span aria-live="polite" className="basis-full text-right text-xs font-medium text-red-700">{error}</span> : null}
    </>
  );
}

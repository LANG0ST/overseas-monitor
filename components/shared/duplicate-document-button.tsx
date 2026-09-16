"use client";

import { Copy, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { duplicateDocumentAction } from "@/app/(app)/documents/actions";

export function DuplicateDocumentButton({
  documentId,
  path,
}: {
  documentId: string;
  path: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateDocumentAction(documentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`${path}/${result.document.id}`);
    });
  }

  return (
    <>
      <button
        className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending}
        onClick={duplicate}
        title={error ?? "Créer un brouillon identique sans numéro"}
        type="button"
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
        {pending ? "Duplication…" : "Dupliquer"}
      </button>
      {error ? <span aria-live="polite" className="basis-full text-right text-xs font-medium text-red-700">{error}</span> : null}
    </>
  );
}

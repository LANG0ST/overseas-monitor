"use server";

import {
  DocumentError,
  duplicateDocument,
  type DocumentType,
} from "@/lib/db/documents";

type DuplicateDocumentResult =
  | { ok: true; document: { id: string; type: DocumentType } }
  | { ok: false; error: string };

export async function duplicateDocumentAction(
  documentId: string,
): Promise<DuplicateDocumentResult> {
  try {
    return { ok: true, document: await duplicateDocument(documentId) };
  } catch (error) {
    if (error instanceof DocumentError) return { ok: false, error: error.message };
    return { ok: false, error: "Une erreur inattendue est survenue. Réessayez." };
  }
}

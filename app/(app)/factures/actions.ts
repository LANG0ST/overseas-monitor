"use server";

import {
  assignNumber,
  assignNumberManually,
  createDraftDocument,
  DocumentError,
  lockDocument,
  setPaid,
  softDelete,
  updateLineItems,
  type DocumentRow,
  type LineItem,
} from "@/lib/db/documents";

type ActionResult = { ok: true; document: DocumentRow } | { ok: false; error: string };

function result(error: unknown): ActionResult {
  if (error instanceof DocumentError) return { ok: false, error: error.message };
  return { ok: false, error: "Une erreur inattendue est survenue. Réessayez." };
}

export async function createInvoiceDraftAction(input: {
  partnerId?: string;
  clientName?: string;
  clientIce?: string;
  clientAddress?: string;
}): Promise<ActionResult> {
  try {
    const document = await createDraftDocument(
      "facture",
      input.partnerId || {
        name: input.clientName ?? "",
        ice: input.clientIce,
        address: input.clientAddress,
      }
    );
    return { ok: true, document };
  } catch (error) {
    return result(error);
  }
}

export async function assignInvoiceNumberAction(documentId: string): Promise<ActionResult> {
  try {
    return { ok: true, document: await assignNumber(documentId) };
  } catch (error) {
    return result(error);
  }
}

export async function assignInvoiceNumberManuallyAction(documentId: string, number: string): Promise<ActionResult> {
  try {
    return { ok: true, document: await assignNumberManually(documentId, number) };
  } catch (error) {
    return result(error);
  }
}

export async function saveInvoiceAction(
  documentId: string,
  lineItems: LineItem[],
  tvaRate: number,
  shouldLock: boolean,
  date?: string,
  city?: string
): Promise<ActionResult> {
  try {
    let document = await updateLineItems(documentId, lineItems, tvaRate, date, city);
    if (shouldLock) document = await lockDocument(documentId);
    return { ok: true, document };
  } catch (error) {
    return result(error);
  }
}

export async function setInvoicePaidAction(documentId: string, paid: boolean): Promise<ActionResult> {
  try {
    return { ok: true, document: await setPaid(documentId, paid) };
  } catch (error) {
    return result(error);
  }
}

export async function deleteInvoiceAction(documentId: string): Promise<ActionResult> {
  try {
    return { ok: true, document: await softDelete(documentId) };
  } catch (error) {
    return result(error);
  }
}

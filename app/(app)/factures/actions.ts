"use server";

import {
  assignNumber,
  assignNumberManually,
  createDocumentSnapshot,
  createDraftDocument,
  DocumentError,
  lockDocument,
  setPaid,
  softDelete,
  restore,
  restoreDocumentSnapshot,
  listDocumentSnapshots,
  updateLineItems,
  unlockDocument,
  type DocumentRow,
  type DocumentSnapshot,
  type LineItem,
} from "@/lib/db/documents";

type ActionResult = { ok: true; document: DocumentRow } | { ok: false; error: string };
export type InvoiceSnapshotsResult =
  | { ok: true; snapshots: DocumentSnapshot[] }
  | { ok: false; error: string };

function result(error: unknown): { ok: false; error: string } {
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

export async function unlockInvoiceAction(documentId: string): Promise<ActionResult> {
  try {
    return { ok: true, document: await unlockDocument(documentId) };
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
  city?: string,
  hasCachet?: boolean
): Promise<ActionResult> {
  try {
    let document = await updateLineItems(documentId, lineItems, tvaRate, date, city, hasCachet);
    await createDocumentSnapshot(documentId);
    if (shouldLock) document = await lockDocument(documentId);
    return { ok: true, document };
  } catch (error) {
    return result(error);
  }
}

export async function listInvoiceSnapshotsAction(documentId: string): Promise<InvoiceSnapshotsResult> {
  try {
    return { ok: true, snapshots: await listDocumentSnapshots(documentId) };
  } catch (error) {
    return result(error);
  }
}

export async function restoreInvoiceSnapshotAction(
  documentId: string,
  snapshotId: string,
): Promise<ActionResult> {
  try {
    return { ok: true, document: await restoreDocumentSnapshot(documentId, snapshotId) };
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

export async function restoreInvoiceAction(documentId: string): Promise<ActionResult> {
  try {
    return { ok: true, document: await restore(documentId) };
  } catch (error) {
    return result(error);
  }
}

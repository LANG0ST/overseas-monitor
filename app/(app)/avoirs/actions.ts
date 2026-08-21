"use server";

import {
  assignNumber,
  assignNumberManually,
  createDraftDocument,
  DocumentError,
  lockDocument,
  softDelete,
  updateLineItems,
  type DocumentRow,
  type LineItem,
} from "@/lib/db/documents";
import { createClient } from "@/lib/supabase/server";

export type AvoirDocument = DocumentRow & {
  partenaire_id: string | null;
  motif: string | null;
  reference_facture_number: string | null;
  avoir_payment_method: string | null;
  avoir_payment_reference: string | null;
};

type ActionResult = { ok: true; document: AvoirDocument } | { ok: false; error: string };

const select = "id, type, number, date, city, has_cachet, partenaire_id, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked, motif, reference_facture_number, avoir_payment_method, avoir_payment_reference";

async function getAvoir(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").select(select).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || data.type !== "avoir") throw new DocumentError("NOT_FOUND", "Avoir introuvable.");
  return data as AvoirDocument;
}

function result(error: unknown): ActionResult {
  if (error instanceof DocumentError) return { ok: false, error: error.message };
  return { ok: false, error: "Une erreur inattendue est survenue. Réessayez." };
}

export async function createAvoirDraftAction(input: {
  factureId: string;
}): Promise<ActionResult> {
  try {
    if (!input.factureId?.trim()) {
      throw new DocumentError("INVALID_INPUT", "Sélectionnez une facture à créditer.");
    }
    const supabase = await createClient();
    const { data: facture, error: factureError } = await supabase
      .from("documents")
      .select("id, type, number, client_name, client_ice, client_address")
      .eq("id", input.factureId)
      .eq("type", "facture")
      .eq("is_active", true)
      .eq("is_locked", true)
      .maybeSingle();
    if (factureError) throw factureError;
    if (!facture || !facture.number) {
      throw new DocumentError("INVALID_INPUT", "La facture sélectionnée est introuvable ou non verrouillée.");
    }

    const document = await createDraftDocument("avoir", {
      name: facture.client_name,
      ice: facture.client_ice,
      address: facture.client_address,
    });
    const { error: referenceError } = await supabase
      .from("documents")
      .update({ reference_facture_number: facture.number })
      .eq("id", document.id)
      .eq("type", "avoir");
    if (referenceError) throw referenceError;
    return { ok: true, document: await getAvoir(document.id) };
  } catch (error) {
    return result(error);
  }
}

export async function assignAvoirNumberAction(documentId: string): Promise<ActionResult> {
  try { await assignNumber(documentId); return { ok: true, document: await getAvoir(documentId) }; }
  catch (error) { return result(error); }
}

export async function assignAvoirNumberManuallyAction(documentId: string, number: string): Promise<ActionResult> {
  try { await assignNumberManually(documentId, number); return { ok: true, document: await getAvoir(documentId) }; }
  catch (error) { return result(error); }
}

export async function saveAvoirAction(
  documentId: string,
  lineItems: LineItem[],
  tvaRate: number,
  shouldLock: boolean,
  date: string,
  city: string,
  hasCachet: boolean,
  details: { motif: string; referenceFactureNumber: string; paymentMethod: string; paymentReference: string },
): Promise<ActionResult> {
  try {
    if (!details.motif.trim()) throw new DocumentError("INVALID_INPUT", "Le motif de l’avoir est obligatoire.");
    const current = await getAvoir(documentId);
    if (current.is_locked) throw new DocumentError("LOCKED", "Cet avoir est verrouillé.");
    await updateLineItems(documentId, lineItems, tvaRate, date, city, hasCachet);
    const supabase = await createClient();
    const { error } = await supabase.from("documents").update({
      motif: details.motif.trim(),
      reference_facture_number: details.referenceFactureNumber.trim() || null,
      avoir_payment_method: details.paymentMethod || null,
      avoir_payment_reference: details.paymentReference.trim() || null,
    }).eq("id", documentId).eq("is_locked", false);
    if (error) throw error;
    if (shouldLock) await lockDocument(documentId);
    return { ok: true, document: await getAvoir(documentId) };
  } catch (error) { return result(error); }
}

export async function deleteAvoirAction(documentId: string): Promise<ActionResult> {
  try { await softDelete(documentId); return { ok: true, document: await getAvoir(documentId) }; }
  catch (error) { return result(error); }
}

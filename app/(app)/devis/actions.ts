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

type ActionResult =
  | { ok: true; document: DevisDocument }
  | { ok: false; error: string };

export type DevisDocument = DocumentRow & {
  partenaire_id: string | null;
  validity_days: number | null;
  period_start: string | null;
  period_end: string | null;
  chantier: string | null;
  devis_fuel_driver: string;
  devis_payment_conditions: string;
  devis_bank_name: string;
  devis_iban: string;
};

const select = "id, type, number, date, city, has_cachet, partenaire_id, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked, validity_days, chantier, period_start, period_end, devis_fuel_driver, devis_payment_conditions, devis_bank_name, devis_iban";

async function getDevis(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").select(select).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || data.type !== "devis") throw new DocumentError("NOT_FOUND", "Devis introuvable.");
  return data as DevisDocument;
}

function result(error: unknown): ActionResult {
  if (error instanceof DocumentError) return { ok: false, error: error.message };
  return { ok: false, error: "Une erreur inattendue est survenue. Réessayez." };
}

export async function createDevisDraftAction(input: {
  partnerId?: string;
  clientName?: string;
  clientIce?: string;
  clientAddress?: string;
}): Promise<ActionResult> {
  try {
    const document = await createDraftDocument(
      "devis",
      input.partnerId || {
        name: input.clientName ?? "",
        ice: input.clientIce,
        address: input.clientAddress,
      },
    );
    const supabase = await createClient();
    const { error: cachetError } = await supabase
      .from("documents")
      .update({ has_cachet: true })
      .eq("id", document.id);
    if (cachetError) throw cachetError;
    return { ok: true, document: await getDevis(document.id) };
  } catch (error) {
    return result(error);
  }
}

export async function assignDevisNumberAction(documentId: string): Promise<ActionResult> {
  try { return { ok: true, document: { ...(await assignNumber(documentId)), ...(await getDevis(documentId)) } }; }
  catch (error) { return result(error); }
}

export async function assignDevisNumberManuallyAction(documentId: string, number: string): Promise<ActionResult> {
  try { return { ok: true, document: { ...(await assignNumberManually(documentId, number)), ...(await getDevis(documentId)) } }; }
  catch (error) { return result(error); }
}

export async function saveDevisAction(
  documentId: string,
  lineItems: LineItem[],
  tvaRate: number,
  shouldLock: boolean,
  date: string,
  city: string,
  hasCachet: boolean,
  details: {
    validity_days: number;
    period_start: string | null;
    period_end: string | null;
    fuel_driver: string;
    payment_conditions: string;
    bank_name: string;
    iban: string;
    client_name: string;
    client_ice: string;
    client_address: string;
  },
): Promise<ActionResult> {
  try {
    const current = await getDevis(documentId);
    if (current.is_locked) throw new DocumentError("LOCKED", "Ce devis est verrouillé.");
    if (!details.client_name.trim()) throw new DocumentError("INVALID_INPUT", "Le nom du client est obligatoire.");
    await updateLineItems(documentId, lineItems, tvaRate, date, city, hasCachet);
    const supabase = await createClient();
    const update: Record<string, unknown> = {
      validity_days: details.validity_days,
      period_start: details.period_start,
      period_end: details.period_end,
      devis_fuel_driver: details.fuel_driver,
      devis_payment_conditions: details.payment_conditions,
      devis_bank_name: details.bank_name,
      devis_iban: details.iban,
    };
    if (!current.partenaire_id) {
      update.client_name = details.client_name.trim();
      update.client_ice = details.client_ice.trim() || null;
      update.client_address = details.client_address.trim() || null;
    }
    const { error } = await supabase.from("documents").update(update).eq("id", documentId).eq("is_locked", false);
    if (error) throw error;
    if (shouldLock) await lockDocument(documentId);
    return { ok: true, document: await getDevis(documentId) };
  } catch (error) { return result(error); }
}

export async function deleteDevisAction(documentId: string): Promise<ActionResult> {
  try { return { ok: true, document: { ...(await softDelete(documentId)), ...(await getDevis(documentId)) } }; }
  catch (error) { return result(error); }
}

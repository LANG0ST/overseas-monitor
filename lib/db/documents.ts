import { createClient } from "@/lib/supabase/server";
import { calculateTotals, type DocumentTotals, type LineItem } from "./document-calculations";

export { calculateTotals, type DocumentTotals, type LineItem } from "./document-calculations";

export const documentTypes = ["devis", "bon_commande", "facture", "avoir"] as const;
export type DocumentType = (typeof documentTypes)[number];

export type ManualClientInfo = {
  name: string;
  ice?: string | null;
  address?: string | null;
};

export type DocumentRow = {
  id: string;
  type: DocumentType;
  number: string | null;
  date: string;
  city: string;
  has_cachet: boolean;
  client_name: string;
  client_ice: string | null;
  client_address: string | null;
  line_items: LineItem[];
  tva_rate: number;
  ht: number;
  tva: number;
  ttc: number;
  is_active: boolean;
  is_locked: boolean;
};

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseError = { code?: string; message: string };

export class DocumentError extends Error {
  constructor(
    public readonly code:
      | "AUTH_REQUIRED"
      | "PROFILE_NOT_FOUND"
      | "PERMISSION_DENIED"
      | "NOT_FOUND"
      | "INVALID_INPUT"
      | "ALREADY_NUMBERED"
      | "NUMBER_REQUIRED"
      | "LOCKED"
      | "NUMBER_COLLISION"
      | "CONCURRENT_UPDATE"
      | "DATABASE_ERROR",
    message: string
  ) {
    super(message);
    this.name = "DocumentError";
  }
}

function failDatabase(error: SupabaseError): never {
  if (error.code === "23505") {
    throw new DocumentError("NUMBER_COLLISION", "Ce numéro existe déjà pour ce type de document.");
  }
  if (error.code === "42501") {
    throw new DocumentError("PERMISSION_DENIED", "Vous n’avez pas la permission de modifier ce document.");
  }
  throw new DocumentError("DATABASE_ERROR", error.message);
}

function resourceFor(type: DocumentType) {
  return type === "facture"
    ? "factures"
    : type === "bon_commande"
      ? "bons_commande"
      : type;
}

async function requireUser(supabase: ServerClient) {
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) throw new DocumentError("AUTH_REQUIRED", "Vous devez être connecté.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) failDatabase(profileError);
  if (!profile) throw new DocumentError("PROFILE_NOT_FOUND", "Votre profil n’est pas configuré.");
  if (!profile.is_active) throw new DocumentError("PERMISSION_DENIED", "Votre compte est désactivé.");
  return { userId, isAdmin: profile.role === "admin" };
}

async function requireDocumentEdit(supabase: ServerClient, type: DocumentType) {
  const { data, error } = await supabase.rpc("can_edit_resource", {
    p_resource: resourceFor(type),
  });
  if (error) failDatabase(error);
  if (data !== true) throw new DocumentError("PERMISSION_DENIED", "Vous n’avez pas la permission de modifier ce document.");
}

async function getDocument(supabase: ServerClient, documentId: string): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, type, number, date, city, has_cachet, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked")
    .eq("id", documentId)
    .maybeSingle();
  if (error) failDatabase(error);
  if (!data) throw new DocumentError("NOT_FOUND", "Document introuvable.");
  return data as DocumentRow;
}

function requireId(id: string) {
  if (!id || typeof id !== "string") throw new DocumentError("INVALID_INPUT", "Identifiant de document invalide.");
}

function requireType(type: DocumentType) {
  if (!documentTypes.includes(type)) throw new DocumentError("INVALID_INPUT", "Type de document invalide.");
}

function normalizeNumber(value: string) {
  const number = value.trim();
  if (!number || number.length > 100 || /[\r\n]/.test(number)) {
    throw new DocumentError("INVALID_INPUT", "Numéro de document invalide.");
  }
  return number;
}

export async function createDraftDocument(
  type: DocumentType,
  client: string | ManualClientInfo,
  initial?: { lineItems?: LineItem[]; tvaRate?: number },
) {
  requireType(type);
  const supabase = await createClient();
  const { userId } = await requireUser(supabase);
  await requireDocumentEdit(supabase, type);

  let snapshot: ManualClientInfo;
  if (typeof client === "string") {
    if (!client.trim()) throw new DocumentError("INVALID_INPUT", "Partenaire invalide.");
    const { data: partenaire, error } = await supabase
      .from("partenaires")
      .select("name, ice, address")
      .eq("id", client)
      .maybeSingle();
    if (error) failDatabase(error);
    if (!partenaire) throw new DocumentError("INVALID_INPUT", "Partenaire introuvable.");
    snapshot = partenaire;
  } else {
    snapshot = {
      name: client?.name?.trim() ?? "",
      ice: client?.ice?.trim() || null,
      address: client?.address?.trim() || null,
    };
    if (!snapshot.name) throw new DocumentError("INVALID_INPUT", "Le nom du client est obligatoire.");
  }

  const lineItems = initial?.lineItems ?? [];
  const tvaRate = initial?.tvaRate ?? 20;
  let totals: DocumentTotals;
  try {
    totals = calculateTotals(lineItems, tvaRate);
  } catch (error) {
    throw new DocumentError(
      "INVALID_INPUT",
      error instanceof Error ? error.message : "Lignes invalides.",
    );
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      type,
      number: null,
      city: "Casablanca",
      has_cachet: false,
      partenaire_id: typeof client === "string" ? client : null,
      client_name: snapshot.name,
      client_ice: snapshot.ice ?? null,
      client_address: snapshot.address ?? null,
      line_items: lineItems,
      tva_rate: tvaRate,
      ...totals,
      created_by: userId,
    })
    .select("id, type, number, date, city, has_cachet, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked")
    .single();
  if (error) failDatabase(error);
  return data as DocumentRow;
}

export async function assignNumber(documentId: string) {
  requireId(documentId);
  const supabase = await createClient();
  await requireUser(supabase);
  const document = await getDocument(supabase, documentId);
  await requireDocumentEdit(supabase, document.type);
  if (document.number) return document;
  if (document.is_locked) throw new DocumentError("LOCKED", "Un numéro ne peut pas être attribué à un document verrouillé.");

  const year = Number(document.date.slice(0, 4));
  const { data: nextNumber, error: numberError } = await supabase.rpc("next_document_number", {
    p_type: document.type,
    p_year: year,
  });
  if (numberError) failDatabase(numberError);
  if (typeof nextNumber !== "string" || !nextNumber) throw new DocumentError("DATABASE_ERROR", "Le numéro n’a pas pu être généré.");

  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .update({ number: nextNumber })
    .eq("id", documentId)
    .is("number", null)
    .eq("is_locked", false)
    .select("id, type, number, date, city, has_cachet, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked")
    .maybeSingle();
  if (updateError) failDatabase(updateError);
  if (updated) return updated as DocumentRow;

  const concurrent = await getDocument(supabase, documentId);
  if (concurrent.number) return concurrent;
  throw new DocumentError("CONCURRENT_UPDATE", "Le document a été modifié dans un autre onglet. Rechargez-le et réessayez.");
}

export async function assignNumberManually(documentId: string, value: string) {
  requireId(documentId);
  const number = normalizeNumber(value);
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user.isAdmin) throw new DocumentError("PERMISSION_DENIED", "Seul un administrateur peut définir un numéro manuellement.");
  const document = await getDocument(supabase, documentId);
  if (document.number) throw new DocumentError("ALREADY_NUMBERED", "Ce document possède déjà un numéro.");
  if (document.is_locked) throw new DocumentError("LOCKED", "Un document verrouillé ne peut pas être renuméroté.");

  const { data: updated, error } = await supabase
    .from("documents")
    .update({ number })
    .eq("id", documentId)
    .is("number", null)
    .eq("is_locked", false)
    .select("id, type, number, date, city, has_cachet, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked")
    .maybeSingle();
  if (error) failDatabase(error);
  if (updated) return updated as DocumentRow;
  const concurrent = await getDocument(supabase, documentId);
  if (concurrent.number) throw new DocumentError("ALREADY_NUMBERED", "Ce document possède déjà un numéro.");
  throw new DocumentError("CONCURRENT_UPDATE", "Le document a été modifié dans un autre onglet. Rechargez-le et réessayez.");
}

export async function lockDocument(documentId: string) {
  requireId(documentId);
  const supabase = await createClient();
  await requireUser(supabase);
  const document = await getDocument(supabase, documentId);
  await requireDocumentEdit(supabase, document.type);
  if (!document.number) throw new DocumentError("NUMBER_REQUIRED", "Attribuez un numéro avant de verrouiller le document.");
  if (document.is_locked) return document;

  const { data: updated, error } = await supabase
    .from("documents")
    .update({ is_locked: true })
    .eq("id", documentId)
    .eq("is_locked", false)
    .not("number", "is", null)
    .select("id, type, number, date, city, has_cachet, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked")
    .maybeSingle();
  if (error) failDatabase(error);
  if (updated) return updated as DocumentRow;
  const concurrent = await getDocument(supabase, documentId);
  if (concurrent.is_locked) return concurrent;
  throw new DocumentError("CONCURRENT_UPDATE", "Le document a été modifié dans un autre onglet. Rechargez-le et réessayez.");
}

export async function updateLineItems(documentId: string, lineItems: readonly LineItem[], tvaRate?: number, date?: string, city?: string, hasCachet?: boolean) {
  requireId(documentId);
  const supabase = await createClient();
  await requireUser(supabase);
  const document = await getDocument(supabase, documentId);
  await requireDocumentEdit(supabase, document.type);
  if (document.is_locked) throw new DocumentError("LOCKED", "Les lignes d’un document verrouillé ne sont pas modifiables.");
  const rate = tvaRate ?? Number(document.tva_rate);
  let totals: DocumentTotals;
  try {
    totals = calculateTotals(lineItems, rate);
  } catch (error) {
    throw new DocumentError("INVALID_INPUT", error instanceof Error ? error.message : "Lignes invalides.");
  }

  const { data: updated, error } = await supabase
    .from("documents")
    .update({ line_items: lineItems, tva_rate: rate, ...(date ? { date } : {}), ...(city?.trim() ? { city: city.trim() } : {}), ...(typeof hasCachet === "boolean" ? { has_cachet: hasCachet } : {}), ...totals })
    .eq("id", documentId)
    .eq("is_locked", false)
    .select("id, type, number, date, city, has_cachet, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked")
    .maybeSingle();
  if (error) failDatabase(error);
  if (updated) return updated as DocumentRow;
  const concurrent = await getDocument(supabase, documentId);
  if (concurrent.is_locked) throw new DocumentError("LOCKED", "Les lignes d’un document verrouillé ne sont pas modifiables.");
  throw new DocumentError("CONCURRENT_UPDATE", "Le document a été modifié dans un autre onglet. Rechargez-le et réessayez.");
}

async function setDocumentActive(documentId: string, isActive: boolean) {
  requireId(documentId);
  const supabase = await createClient();
  await requireUser(supabase);
  const document = await getDocument(supabase, documentId);
  await requireDocumentEdit(supabase, document.type);
  const { data: updated, error } = await supabase
    .from("documents")
    .update({ is_active: isActive })
    .eq("id", documentId)
    .select("id, type, number, date, city, has_cachet, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked")
    .maybeSingle();
  if (error) failDatabase(error);
  if (!updated) throw new DocumentError("CONCURRENT_UPDATE", "Le document a été modifié dans un autre onglet. Rechargez-le et réessayez.");
  return updated as DocumentRow;
}

export async function setPaid(documentId: string, paid: boolean) {
  requireId(documentId);
  const supabase = await createClient();
  await requireUser(supabase);
  const document = await getDocument(supabase, documentId);
  await requireDocumentEdit(supabase, document.type);
  const { data: updated, error } = await supabase
    .from("documents")
    .update({ paid, paid_date: paid ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", documentId)
    .select("id, type, number, date, city, has_cachet, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked, paid, paid_date")
    .maybeSingle();
  if (error) failDatabase(error);
  if (!updated) throw new DocumentError("CONCURRENT_UPDATE", "Le document a été modifié dans un autre onglet. Rechargez-le et réessayez.");
  return updated as DocumentRow;
}

export function softDelete(documentId: string) {
  return setDocumentActive(documentId, false);
}

export function restore(documentId: string) {
  return setDocumentActive(documentId, true);
}

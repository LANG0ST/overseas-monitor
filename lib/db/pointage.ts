import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  cleanDayValues,
  isHalfHourIncrement,
  isValidMonth,
  normalizeText,
  type PointageEntry,
  type PointageEntryDraft,
  type PointageSheet,
} from "@/lib/pointage";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export class PointageError extends Error {
  constructor(
    public readonly code:
      | "AUTH_REQUIRED"
      | "PERMISSION_DENIED"
      | "NOT_FOUND"
      | "INVALID_INPUT"
      | "CONCURRENT_UPDATE"
      | "DATABASE_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "PointageError";
  }
}

function failDatabase(error: { code?: string; message: string }): never {
  if (error.code === "42501") {
    throw new PointageError("PERMISSION_DENIED", "Vous n’avez pas la permission de modifier le pointage.");
  }
  if (error.code === "40001") {
    throw new PointageError("CONCURRENT_UPDATE", error.message);
  }
  if (error.code === "P0002") {
    throw new PointageError("NOT_FOUND", error.message);
  }
  if (error.code === "22023" || error.code === "23514" || error.code === "23505") {
    throw new PointageError("INVALID_INPUT", error.message);
  }
  throw new PointageError("DATABASE_ERROR", error.message);
}

function mapEntry(row: Record<string, unknown>): PointageEntry {
  return {
    id: String(row.id),
    sheet_id: String(row.sheet_id),
    engin_id: typeof row.engin_id === "string" ? row.engin_id : null,
    engin_name: String(row.engin_name ?? ""),
    unit_price: Number(row.unit_price),
    days: (row.days ?? {}) as PointageEntry["days"],
    overtime_hours: (row.overtime_hours ?? {}) as PointageEntry["overtime_hours"],
    is_active: Boolean(row.is_active),
    updated_at: String(row.updated_at),
  };
}

function mapSheet(
  row: Record<string, unknown>,
  entries: PointageEntry[],
): PointageSheet {
  return {
    id: String(row.id),
    partenaire_id: typeof row.partenaire_id === "string" ? row.partenaire_id : null,
    client_name: String(row.client_name ?? ""),
    client_ice: typeof row.client_ice === "string" ? row.client_ice : null,
    client_address:
      typeof row.client_address === "string" ? row.client_address : null,
    ym: String(row.ym),
    project: typeof row.project === "string" ? row.project : null,
    has_cachet: Boolean(row.has_cachet),
    is_active: Boolean(row.is_active),
    updated_at: String(row.updated_at),
    entries,
  };
}

async function requirePointageEdit(supabase: ServerClient) {
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) {
    throw new PointageError("AUTH_REQUIRED", "Vous devez être connecté.");
  }
  const { data, error } = await supabase.rpc("can_edit_resource", {
    p_resource: "pointage",
  });
  if (error) failDatabase(error);
  if (data !== true) {
    throw new PointageError("PERMISSION_DENIED", "Vous n’avez pas la permission de modifier le pointage.");
  }
}

export async function getPointageSheet(id: string) {
  const supabase = await createClient();
  const { data: sheet, error: sheetError } = await supabase
    .from("pointage_sheets")
    .select(
      "id, partenaire_id, client_name, client_ice, client_address, ym, project, has_cachet, is_active, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (sheetError) failDatabase(sheetError);
  if (!sheet) return null;

  const { data: entries, error: entriesError } = await supabase
    .from("pointage_entries")
    .select(
      "id, sheet_id, engin_id, engin_name, unit_price, days, overtime_hours, is_active, updated_at",
    )
    .eq("sheet_id", id)
    .order("created_at");
  if (entriesError) failDatabase(entriesError);
  return mapSheet(
    sheet as Record<string, unknown>,
    (entries ?? []).map((entry) => mapEntry(entry as Record<string, unknown>)),
  );
}

export async function findPointageSheet(input: {
  partenaireId?: string;
  clientName?: string;
  ym: string;
}) {
  if (!isValidMonth(input.ym)) return null;
  const supabase = await createClient();
  let query = supabase
    .from("pointage_sheets")
    .select("id")
    .eq("ym", input.ym)
    .eq("is_active", true)
    .limit(1);
  if (input.partenaireId) {
    query = query.eq("partenaire_id", input.partenaireId);
  } else {
    const clientName = normalizeText(input.clientName ?? "");
    if (!clientName) return null;
    query = query.is("partenaire_id", null).ilike("client_name", clientName);
  }
  const { data, error } = await query.maybeSingle();
  if (error) failDatabase(error);
  return data ? getPointageSheet(data.id) : null;
}

export type SavePointageInput = {
  sheetId?: string;
  expectedUpdatedAt?: string;
  partenaireId?: string;
  clientName: string;
  clientIce?: string;
  clientAddress?: string;
  ym: string;
  project?: string;
  hasCachet?: boolean;
  entries: PointageEntryDraft[];
};

function saveEntry(entry: PointageEntryDraft, ym: string) {
  const unitPrice = Number(entry.unit_price);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new PointageError("INVALID_INPUT", "Le P.U. journalier est invalide.");
  }
  const enginName = normalizeText(entry.engin_name ?? "");
  if (!entry.id && !entry.engin_id && !enginName) {
    throw new PointageError("INVALID_INPUT", "La désignation de l’engin est obligatoire.");
  }
  return {
    id: entry.id ?? null,
    expected_updated_at: entry.expected_updated_at ?? null,
    engin_id: entry.engin_id ?? null,
    engin_name: enginName,
    unit_price: unitPrice,
    days: cleanDayValues(entry.days, ym, [0, 0.5, 1]),
    overtime_hours: (() => {
      const values = cleanDayValues(entry.overtime_hours, ym);
      if (!Object.values(values).every(isHalfHourIncrement)) {
        throw new PointageError("INVALID_INPUT", "Les heures supplémentaires doivent être saisies par demi-heure.");
      }
      return values;
    })(),
    is_active: Boolean(entry.is_active),
  };
}

export async function savePointageSheet(input: SavePointageInput) {
  if (!isValidMonth(input.ym)) {
    throw new PointageError("INVALID_INPUT", "Mois de pointage invalide.");
  }
  const clientName = normalizeText(input.clientName);
  if (!input.partenaireId && !clientName) {
    throw new PointageError("INVALID_INPUT", "Le nom du client est obligatoire.");
  }
  const supabase = await createClient();
  await requirePointageEdit(supabase);
  const { data: sheetId, error } = await supabase.rpc("save_pointage_sheet", {
    p_sheet_id: input.sheetId ?? null,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_partenaire_id: input.partenaireId ?? null,
    p_client_name: clientName,
    p_client_ice: normalizeText(input.clientIce ?? "") || null,
    p_client_address: normalizeText(input.clientAddress ?? "") || null,
    p_ym: input.ym,
    p_project: normalizeText(input.project ?? "") || null,
    p_entries: input.entries.map((entry) => saveEntry(entry, input.ym)),
  });
  if (error) failDatabase(error);
  if (typeof sheetId !== "string") {
    throw new PointageError("DATABASE_ERROR", "La feuille de pointage n’a pas pu être enregistrée.");
  }
  if (typeof input.hasCachet === "boolean") {
    const { error: cachetError } = await supabase
      .from("pointage_sheets")
      .update({ has_cachet: input.hasCachet })
      .eq("id", sheetId);
    if (cachetError) failDatabase(cachetError);
  }
  const sheet = await getPointageSheet(sheetId);
  if (!sheet) throw new PointageError("NOT_FOUND", "Feuille de pointage introuvable.");
  return sheet;
}

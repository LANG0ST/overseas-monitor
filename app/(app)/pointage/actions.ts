"use server";

import { revalidatePath } from "next/cache";
import { canEdit } from "@/lib/auth/can-edit";
import { createDraftDocument, DocumentError } from "@/lib/db/documents";
import {
  getPointageSheet,
  PointageError,
  savePointageSheet,
  type SavePointageInput,
} from "@/lib/db/pointage";
import { pointageInvoiceLines, type PointageSheet } from "@/lib/pointage";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function result(error: unknown): ActionResult<never> {
  if (error instanceof PointageError || error instanceof DocumentError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Une erreur inattendue est survenue. Réessayez." };
}

export async function savePointageAction(
  input: SavePointageInput,
): Promise<ActionResult<PointageSheet>> {
  try {
    const sheet = await savePointageSheet(input);
    revalidatePath("/pointage");
    return { ok: true, data: sheet };
  } catch (error) {
    return result(error);
  }
}

export async function createPointageFactureDraftAction(
  sheetId: string,
): Promise<ActionResult<{ documentId: string }>> {
  try {
    if (!sheetId || typeof sheetId !== "string") {
      throw new PointageError("INVALID_INPUT", "Feuille de pointage invalide.");
    }
    if (!(await canEdit("pointage"))) {
      throw new PointageError("PERMISSION_DENIED", "Vous n’avez pas la permission de modifier le pointage.");
    }
    if (!(await canEdit("factures"))) {
      throw new PointageError("PERMISSION_DENIED", "Vous n’avez pas la permission de créer une facture.");
    }

    const sheet = await getPointageSheet(sheetId);
    if (!sheet || !sheet.is_active) {
      throw new PointageError("NOT_FOUND", "Feuille de pointage introuvable.");
    }

    const supabase = await createClient();
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("ot_reference_hours")
      .eq("id", 1)
      .maybeSingle();
    if (settingsError) throw settingsError;
    const otReferenceHours = Number(settings?.ot_reference_hours);
    if (!Number.isFinite(otReferenceHours) || otReferenceHours <= 0) {
      throw new PointageError("DATABASE_ERROR", "La journée de référence des heures supplémentaires est invalide.");
    }

    const lineItems = pointageInvoiceLines(sheet, otReferenceHours);
    if (lineItems.length === 0) {
      throw new PointageError("INVALID_INPUT", "Aucune donnée facturable dans cette feuille.");
    }

    const document = await createDraftDocument(
      "facture",
      sheet.partenaire_id || {
        name: sheet.client_name,
        ice: sheet.client_ice,
        address: sheet.client_address,
      },
      { lineItems },
    );
    revalidatePath("/pointage");
    revalidatePath("/factures");
    return { ok: true, data: { documentId: document.id } };
  } catch (error) {
    return result(error);
  }
}

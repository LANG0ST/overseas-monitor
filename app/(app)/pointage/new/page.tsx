import { redirect } from "next/navigation";
import { PointageEditor } from "@/components/shared/pointage-editor";
import { canEdit } from "@/lib/auth/can-edit";
import { findPointageSheet } from "@/lib/db/pointage";
import { isValidMonth, normalizeText } from "@/lib/pointage";
import { createClient } from "@/lib/supabase/server";

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export default async function NewPointagePage({
  searchParams,
}: {
  searchParams: Promise<{ partenaire?: string; client?: string; ym?: string }>;
}) {
  const params = await searchParams;
  const ym = isValidMonth(params.ym ?? "") ? String(params.ym) : currentMonth();
  const partenaireId = params.partenaire?.trim() || undefined;
  const manualClientName = partenaireId
    ? ""
    : normalizeText(params.client ?? "");
  const initialSheet =
    partenaireId || manualClientName
      ? await findPointageSheet({
          partenaireId,
          clientName: manualClientName,
          ym,
        })
      : null;

  if (initialSheet) redirect(`/pointage/${initialSheet.id}`);

  const supabase = await createClient();
  const [
    { data: partners, error: partnersError },
    { data: engins, error: enginsError },
    { data: settings, error: settingsError },
    editable,
    canCreateFacture,
  ] = await Promise.all([
    supabase
      .from("partenaires")
      .select("id, name, ice, address")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("engins")
      .select("id, name, default_price")
      .eq("is_active", true)
      .eq("unit", "Jour")
      .order("name"),
    supabase
      .from("settings")
      .select("ot_reference_hours")
      .eq("id", 1)
      .maybeSingle(),
    canEdit("pointage"),
    canEdit("factures"),
  ]);
  if (partnersError) throw new Error(partnersError.message);
  if (enginsError) throw new Error(enginsError.message);
  if (settingsError) throw new Error(settingsError.message);

  return (
    <PointageEditor
      canCreateFacture={canCreateFacture}
      editable={editable}
      editorMode="new"
      engins={(engins ?? []).map((engin) => ({
        ...engin,
        default_price: Number(engin.default_price),
      }))}
      initialClient={{ partenaireId, manualClientName }}
      initialSheet={null}
      key={`${partenaireId ?? manualClientName}-${ym}`}
      otReferenceHours={Number(settings?.ot_reference_hours ?? 9)}
      partners={partners ?? []}
      ym={ym}
    />
  );
}

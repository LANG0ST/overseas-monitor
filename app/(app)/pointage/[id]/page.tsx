import { redirect } from "next/navigation";
import { PointageEditor } from "@/components/shared/pointage-editor";
import { canEdit } from "@/lib/auth/can-edit";
import { getPointageSheet } from "@/lib/db/pointage";
import { createClient } from "@/lib/supabase/server";

export default async function PointageEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    redirect("/pointage");
  }

  const sheet = await getPointageSheet(id);
  if (!sheet || !sheet.is_active) redirect("/pointage");

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
      editorMode="existing"
      engins={(engins ?? []).map((engin) => ({
        ...engin,
        default_price: Number(engin.default_price),
      }))}
      initialClient={{
        partenaireId: sheet.partenaire_id ?? undefined,
        manualClientName: sheet.partenaire_id ? "" : sheet.client_name,
      }}
      initialSheet={sheet}
      key={`${sheet.id}-${sheet.updated_at}`}
      otReferenceHours={Number(settings?.ot_reference_hours ?? 9)}
      partners={partners ?? []}
      ym={sheet.ym}
    />
  );
}

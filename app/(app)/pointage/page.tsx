import { PointageDashboard, type PointageDashboardRow } from "@/components/shared/pointage-dashboard";
import { canEdit } from "@/lib/auth/can-edit";
import { roundMoney } from "@/lib/db/document-calculations";
import { entryTotals, isValidMonth, type DayValues } from "@/lib/pointage";
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

type SheetRow = {
  id: string;
  client_name: string;
  project: string | null;
  updated_at: string;
};

type EntryRow = {
  sheet_id: string;
  unit_price: number | string;
  days: DayValues;
  overtime_hours: DayValues;
};

export default async function PointagePage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const params = await searchParams;
  const ym = isValidMonth(params.ym ?? "") ? String(params.ym) : currentMonth();
  const supabase = await createClient();
  const [
    { data: sheets, error: sheetsError },
    { data: settings, error: settingsError },
    editable,
    canCreateFacture,
  ] = await Promise.all([
    supabase
      .from("pointage_sheets")
      .select("id, client_name, project, updated_at")
      .eq("ym", ym)
      .eq("is_active", true)
      .order("client_name"),
    supabase.from("settings").select("ot_reference_hours").eq("id", 1).maybeSingle(),
    canEdit("pointage"),
    canEdit("factures"),
  ]);
  if (sheetsError) throw new Error(sheetsError.message);
  if (settingsError) throw new Error(settingsError.message);

  const sheetRows = (sheets ?? []) as SheetRow[];
  const sheetIds = sheetRows.map((sheet) => sheet.id);
  let entries: EntryRow[] = [];
  if (sheetIds.length > 0) {
    const { data, error } = await supabase
      .from("pointage_entries")
      .select("sheet_id, unit_price, days, overtime_hours")
      .in("sheet_id", sheetIds)
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    entries = (data ?? []) as EntryRow[];
  }

  const otReferenceHours = Number(settings?.ot_reference_hours ?? 9);
  const rows: PointageDashboardRow[] = sheetRows.map((sheet) => {
    const totals = entries
      .filter((entry) => entry.sheet_id === sheet.id)
      .map((entry) => entryTotals({
        days: entry.days ?? {},
        overtime_hours: entry.overtime_hours ?? {},
        unit_price: Number(entry.unit_price),
      }, otReferenceHours));
    return {
      id: sheet.id,
      clientName: sheet.client_name,
      project: sheet.project,
      totalDays: totals.reduce((total, entry) => total + entry.days, 0),
      overtimeHours: totals.reduce((total, entry) => total + entry.overtimeHours, 0),
      estimatedHt: roundMoney(totals.reduce((total, entry) => total + entry.totalHt, 0)),
      updatedAt: sheet.updated_at,
    };
  });

  return <PointageDashboard canCreateFacture={editable && canCreateFacture} rows={rows} ym={ym} />;
}

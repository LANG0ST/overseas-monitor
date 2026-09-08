import { PointageDashboard, type PointageDashboardRow } from "@/components/shared/pointage-dashboard";
import { getAccessContext } from "@/lib/auth/can-edit";
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
  facture_id: string | null;
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
  const accessPromise = getAccessContext();
  const [
    { data: sheets, error: sheetsError },
    { data: settings, error: settingsError },
    access,
  ] = await Promise.all([
    supabase
      .from("pointage_sheets")
      .select("id, client_name, project, updated_at, facture_id")
      .eq("ym", ym)
      .eq("is_active", true)
      .order("client_name"),
    supabase.from("settings").select("ot_reference_hours").eq("id", 1).maybeSingle(),
    accessPromise,
  ]);
  if (sheetsError) throw new Error(sheetsError.message);
  if (settingsError) throw new Error(settingsError.message);

  const sheetRows = (sheets ?? []) as SheetRow[];
  const sheetIds = sheetRows.map((sheet) => sheet.id);
  const factureIds = sheetRows.map((sheet) => sheet.facture_id).filter(Boolean) as string[];
  const [
    { data: factures, error: facturesError },
    { data: entryData, error: entriesError },
  ] = await Promise.all([
    factureIds.length
      ? supabase.from("documents").select("id, number, is_locked, is_active").in("id", factureIds)
      : Promise.resolve({ data: [], error: null }),
    sheetIds.length
      ? supabase.from("pointage_entries").select("sheet_id, unit_price, days, overtime_hours").in("sheet_id", sheetIds).eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (facturesError) throw new Error(facturesError.message);
  if (entriesError) throw new Error(entriesError.message);
  const facturesById = new Map((factures ?? []).map((facture) => [facture.id, facture]));

  const otReferenceHours = Number(settings?.ot_reference_hours ?? 9);
  const totalsBySheet = new Map<string, { days: number; overtimeHours: number; totalHt: number }>();
  for (const entry of (entryData ?? []) as EntryRow[]) {
    const total = entryTotals({
      days: entry.days ?? {},
      overtime_hours: entry.overtime_hours ?? {},
      unit_price: Number(entry.unit_price),
    }, otReferenceHours);
    const accumulated = totalsBySheet.get(entry.sheet_id) ?? { days: 0, overtimeHours: 0, totalHt: 0 };
    accumulated.days += total.days;
    accumulated.overtimeHours += total.overtimeHours;
    accumulated.totalHt += total.totalHt;
    totalsBySheet.set(entry.sheet_id, accumulated);
  }
  const rows: PointageDashboardRow[] = sheetRows.map((sheet) => {
    const totals = totalsBySheet.get(sheet.id) ?? { days: 0, overtimeHours: 0, totalHt: 0 };
    return {
      id: sheet.id,
      clientName: sheet.client_name,
      project: sheet.project,
      totalDays: totals.days,
      overtimeHours: totals.overtimeHours,
      estimatedHt: roundMoney(totals.totalHt),
      updatedAt: sheet.updated_at,
      facture: sheet.facture_id ? (facturesById.get(sheet.facture_id) ?? { id: sheet.facture_id, number: null, is_locked: false, is_active: true }) : null,
    };
  });

  return <PointageDashboard canCreateFacture={access.allowedResources.includes("pointage") && access.allowedResources.includes("factures")} rows={rows} ym={ym} />;
}

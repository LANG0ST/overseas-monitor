import { roundMoney, type LineItem } from "@/lib/db/document-calculations";

export type DayValues = Record<string, number>;

export type PointageEntry = {
  id: string;
  sheet_id: string;
  engin_id: string | null;
  engin_name: string;
  unit_price: number;
  days: DayValues;
  overtime_hours: DayValues;
  is_active: boolean;
  updated_at: string;
};

export type PointageSheet = {
  id: string;
  partenaire_id: string | null;
  client_name: string;
  client_ice: string | null;
  client_address: string | null;
  ym: string;
  project: string | null;
  has_cachet: boolean;
  is_active: boolean;
  updated_at: string;
  entries: PointageEntry[];
};

export type PointageEntryDraft = Omit<
  PointageEntry,
  "id" | "sheet_id" | "updated_at"
> & {
  id?: string;
  expected_updated_at?: string;
};

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function daysInMonth(ym: string) {
  if (!isValidMonth(ym)) return 0;
  const [year, month] = ym.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isSunday(ym: string, day: number) {
  if (!isValidMonth(ym) || day < 1 || day > daysInMonth(ym)) return false;
  const [year, month] = ym.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

export function isValidDayValues(
  values: DayValues,
  ym: string,
  allowedValues?: readonly number[],
) {
  const limit = daysInMonth(ym);
  if (!limit || !values || typeof values !== "object" || Array.isArray(values))
    return false;
  return Object.entries(values).every(([key, value]) => {
    const day = Number(key);
    return (
      Number.isInteger(day) &&
      day >= 1 &&
      day <= limit &&
      Number.isFinite(value) &&
      value >= 0 &&
      (!allowedValues || allowedValues.includes(value))
    );
  });
}

export function cleanDayValues(
  values: DayValues,
  ym: string,
  allowedValues?: readonly number[],
) {
  if (!isValidDayValues(values, ym, allowedValues)) {
    throw new Error("Données journalières invalides.");
  }
  return Object.fromEntries(
    Object.entries(values).map(([day, value]) => [day, Number(value)]),
  );
}

export function isHalfHourIncrement(value: number) {
  return Number.isFinite(value) && value >= 0 && Number.isInteger(value * 2);
}

export function totalValues(values: DayValues) {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

export function entryTotals(entry: Pick<PointageEntry, "days" | "overtime_hours" | "unit_price">, otReferenceHours: number) {
  const days = totalValues(entry.days);
  const overtimeHours = totalValues(entry.overtime_hours);
  const overtimeRate = otReferenceHours > 0 ? entry.unit_price / otReferenceHours : 0;
  return {
    days,
    overtimeHours,
    overtimeRate,
    totalHt: roundMoney(days * entry.unit_price + overtimeHours * overtimeRate),
  };
}

export function pointageInvoiceLines(
  sheet: Pick<PointageSheet, "ym" | "entries">,
  otReferenceHours: number,
): LineItem[] {
  const [year, month] = sheet.ym.split("-");
  const period = `Pointage du 01/${month}/${year} au ${String(daysInMonth(sheet.ym)).padStart(2, "0")}/${month}/${year}`;

  return sheet.entries.flatMap((entry) => {
    if (!entry.is_active) return [];
    const totals = entryTotals(entry, otReferenceHours);
    const lines: LineItem[] = [];
    if (totals.days > 0) {
      lines.push({
        desc: `LOCATION ${entry.engin_name}\n(${period})`,
        unit: "Jour",
        qty: totals.days,
        unit_price: entry.unit_price,
      });
    }
    if (totals.overtimeHours > 0) {
      lines.push({
        desc: `HEURES SUPPLÉMENTAIRES ${entry.engin_name}`,
        unit: "Heure",
        qty: totals.overtimeHours,
        unit_price: totals.overtimeRate,
      });
    }
    return lines;
  });
}

export function cyclePresence(current: number | undefined) {
  if (current === undefined) return 1;
  if (current === 1) return 0.5;
  if (current === 0.5) return 0;
  return undefined;
}

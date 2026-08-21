import { daysInMonth, entryTotals, isSunday, type PointageSheet } from "@/lib/pointage";

type CellStyle = Record<string, unknown>;

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "") || "client";
}

export async function exportPointageXlsx(
  sheet: PointageSheet,
  otReferenceHours: number,
) {
  const XLSX = await import("xlsx-js-style");
  const dayCount = daysInMonth(sheet.ym);
  const [year, month] = sheet.ym.split("-");
  const monthNumber = Number(month);
  const lastColumn = dayCount + 4;
  const navy = "1C3F6E";
  const gold = "B8925A";
  const sundayHeader = "7A2F2F";
  const sundayBackground = "FBF1F1";
  const overtimeBackground = "FFFDF5";
  const overtimeText = "8A5A00";
  const line = "9AA7B4";
  const border = {
    top: { style: "thin", color: { rgb: line } },
    bottom: { style: "thin", color: { rgb: line } },
    left: { style: "thin", color: { rgb: line } },
    right: { style: "thin", color: { rgb: line } },
  };
  const center = { horizontal: "center", vertical: "center" };
  const titleStyle: CellStyle = {
    font: { bold: true, sz: 14, color: { rgb: navy } },
    alignment: center,
  };
  const subtitleStyle: CellStyle = {
    font: { sz: 10, color: { rgb: "556677" } },
    alignment: center,
  };
  const headerStyle: CellStyle = {
    font: { bold: true, sz: 9, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: navy } },
    alignment: { ...center, wrapText: true },
    border,
  };
  const sundayHeaderStyle: CellStyle = {
    ...headerStyle,
    fill: { fgColor: { rgb: sundayHeader } },
  };
  const regularCell: CellStyle = { font: { sz: 10 }, alignment: center, border };
  const sundayCell: CellStyle = {
    ...regularCell,
    fill: { fgColor: { rgb: sundayBackground } },
  };
  const overtimeCell: CellStyle = {
    font: { sz: 9, color: { rgb: overtimeText } },
    alignment: center,
    border,
    fill: { fgColor: { rgb: overtimeBackground } },
  };
  const overtimeSundayCell: CellStyle = {
    ...overtimeCell,
    fill: { fgColor: { rgb: sundayBackground } },
  };
  const numberStyle: CellStyle = { font: { sz: 10 }, alignment: center, border };
  const nameStyle: CellStyle = {
    font: { bold: true, sz: 10, color: { rgb: navy } },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    border,
  };
  const typeStyle: CellStyle = {
    font: { sz: 9, color: { rgb: "556677" } },
    alignment: center,
    border,
  };
  const totalStyle: CellStyle = {
    font: { bold: true, sz: 10, color: { rgb: navy } },
    alignment: center,
    border,
  };
  const overtimeTotalStyle: CellStyle = {
    font: { bold: true, sz: 9, color: { rgb: overtimeText } },
    alignment: center,
    border,
    fill: { fgColor: { rgb: overtimeBackground } },
  };
  const priceStyle: CellStyle = {
    font: { bold: true, sz: 9, color: { rgb: gold } },
    alignment: center,
    border,
  };
  const overtimeNoteStyle: CellStyle = {
    font: { sz: 8, color: { rgb: overtimeText } },
    alignment: center,
    border,
    fill: { fgColor: { rgb: overtimeBackground } },
  };
  const legendStyle: CellStyle = {
    font: { sz: 9, color: { rgb: "556677" } },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
  };
  const signatureStyle: CellStyle = {
    font: { sz: 10 },
    alignment: { horizontal: "left", vertical: "bottom" },
  };
  const cell = (value: string | number, style: CellStyle) => ({
    v: value,
    t: typeof value === "number" ? "n" : "s",
    s: style,
  });
  const rows: unknown[][] = [];
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
  const rowHeights: Array<{ hpt: number }> = [];
  const title = [cell("Pointage des engins · POINTAGE DES ENGINS", titleStyle)];
  while (title.length <= lastColumn) title.push(cell("", titleStyle));
  rows.push(title);
  const subtitleText = `${sheet.project ? `Chantier : ${sheet.project}　　` : ""}Client : ${sheet.client_name}　　Mois : ${year}an${monthNumber}mois　　OVERSEAS SERVICES`;
  const subtitle = [cell(subtitleText, subtitleStyle)];
  while (subtitle.length <= lastColumn) subtitle.push(cell("", subtitleStyle));
  rows.push(subtitle);
  merges.push(
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumn } },
  );
  rowHeights.push({ hpt: 26 }, { hpt: 16 });

  const header = [
    cell("NO", headerStyle),
    cell("Désignation\nNom de l'engin", headerStyle),
    cell("Type\nType", headerStyle),
  ];
  for (let day = 1; day <= dayCount; day += 1) {
    header.push(cell(day, isSunday(sheet.ym, day) ? sundayHeaderStyle : headerStyle));
  }
  header.push(cell("Total\nTotal", headerStyle), cell("Remarque\nMarque", headerStyle));
  rows.push(header);
  rowHeights.push({ hpt: 26 });

  sheet.entries
    .filter((entry) => entry.is_active)
    .forEach((entry, index) => {
      const startRow = rows.length;
      const totals = entryTotals(entry, otReferenceHours);
      const presence = [
        cell(index + 1, numberStyle),
        cell(entry.engin_name, nameStyle),
        cell("P.U. jour", typeStyle),
      ];
      const overtime = [cell("", numberStyle), cell("", nameStyle), cell("", typeStyle)];
      for (let day = 1; day <= dayCount; day += 1) {
        const isSundayCell = isSunday(sheet.ym, day);
        const presenceValue = entry.days[String(day)];
        const overtimeValue = entry.overtime_hours[String(day)];
        presence.push(
          cell(
            presenceValue === undefined ? "" : presenceValue,
            isSundayCell ? sundayCell : regularCell,
          ),
        );
        overtime.push(
          cell(
            overtimeValue === undefined ? "" : overtimeValue,
            isSundayCell ? overtimeSundayCell : overtimeCell,
          ),
        );
      }
      presence.push(
        cell(totals.days, totalStyle),
        cell(`${entry.unit_price.toFixed(2)} /j`, priceStyle),
      );
      overtime.push(
        cell(totals.overtimeHours, overtimeTotalStyle),
        cell("heures supplémentaires comptées à l’heure", overtimeNoteStyle),
      );
      rows.push(presence, overtime);
      rowHeights.push({ hpt: 18 }, { hpt: 16 });
      merges.push(
        { s: { r: startRow, c: 0 }, e: { r: startRow + 1, c: 0 } },
        { s: { r: startRow, c: 1 }, e: { r: startRow + 1, c: 1 } },
        { s: { r: startRow, c: 2 }, e: { r: startRow + 1, c: 2 } },
      );
    });

  const legendRow = rows.length;
  const legend = [
    cell(
      "Présence : 1 = journée complète, 0,5 = demi-journée, 0 = présent sans activité. La ligne « heures supp. » compte les heures du jour ; elles sont facturées au P.U. journalier divisé par la journée de référence (9 h par défaut, réglable sur le portail).",
      legendStyle,
    ),
  ];
  while (legend.length <= lastColumn) legend.push(cell("", legendStyle));
  rows.push(legend);
  rowHeights.push({ hpt: 36 });
  merges.push({ s: { r: legendRow, c: 0 }, e: { r: legendRow, c: lastColumn } });

  const signatureRow = rows.length;
  const signatures = [cell("Signature du client Signature Client : ", signatureStyle)];
  while (signatures.length <= lastColumn) signatures.push(cell("", signatureStyle));
  const middle = Math.floor(lastColumn / 2);
  signatures[middle] = cell("OVERSEAS SERVICES : ", signatureStyle);
  rows.push(signatures);
  rowHeights.push({ hpt: 28 });
  merges.push(
    { s: { r: signatureRow, c: 0 }, e: { r: signatureRow, c: middle - 1 } },
    { s: { r: signatureRow, c: middle }, e: { r: signatureRow, c: lastColumn } },
  );

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 4 },
    { wch: 26 },
    { wch: 10 },
    ...Array.from({ length: dayCount }, () => ({ wch: 4.2 })),
    { wch: 9 },
    { wch: 26 },
  ];
  worksheet["!merges"] = merges;
  worksheet["!rows"] = rowHeights;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${monthNumber}mois`);
  XLSX.writeFile(workbook, `Pointage_${safeFilename(sheet.client_name)}_${sheet.ym}.xlsx`);
}

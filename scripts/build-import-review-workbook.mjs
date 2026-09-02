import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = process.cwd();
const sourceDir = path.join(root, "data", "import-review");
const outputDir = path.join(root, "outputs", "import-review-2026");
const previewDir = path.join("/tmp", "overseas-import-review-previews");

const inputs = [
  ["Clients", "clients_review.csv"],
  ["Machines", "machines_review.csv"],
  ["Exceptions", "invoice_exceptions.csv"],
];

const firstText = (await fs.readFile(path.join(sourceDir, inputs[0][1]), "utf8")).replace(/^\uFEFF/, "");
const workbook = await Workbook.fromCSV(firstText, { sheetName: inputs[0][0] });
for (const [sheetName, filename] of inputs.slice(1)) {
  const csvText = (await fs.readFile(path.join(sourceDir, filename), "utf8")).replace(/^\uFEFF/, "");
  await workbook.fromCSV(csvText, { sheetName });
}

const widths = {
  Clients: [13, 38, 20, 44, 48, 14, 78, 13, 58],
  Machines: [13, 38, 18, 16, 28, 45, 14, 78, 13, 58],
  Exceptions: [65, 34, 36, 13, 28, 75],
};

for (const [sheetName] of inputs) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const used = sheet.getUsedRange(true);
  const rowCount = used.rowCount;
  const colCount = used.columnCount;
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  used.format = {
    font: { name: "Aptos", size: 10, color: "#172033" },
    verticalAlignment: "top",
  };
  used.format.wrapText = true;
  used.format.borders = {
    insideHorizontal: { style: "thin", color: "#E2E8F0" },
    bottom: { style: "thin", color: "#CBD5E1" },
  };
  const header = sheet.getRangeByIndexes(0, 0, 1, colCount);
  header.format = {
    fill: "#123B5D",
    font: { name: "Aptos Display", size: 10, bold: true, color: "#FFFFFF" },
    verticalAlignment: "center",
    horizontalAlignment: "left",
    wrapText: true,
    rowHeight: 32,
    borders: { bottom: { style: "medium", color: "#0B253B" } },
  };
  for (let column = 0; column < colCount; column += 1) {
    sheet.getRangeByIndexes(0, column, rowCount, 1).format.columnWidth = widths[sheetName][column] ?? 24;
  }
  if (rowCount > 1) {
    sheet.getRangeByIndexes(1, 0, rowCount - 1, colCount).format.rowHeight = 42;
  }
  const table = sheet.tables.add(used, true, `${sheetName}ReviewTable`);
  table.style = "TableStyleMedium2";
  table.showBandedRows = true;
  table.showFilterButton = true;

  const headerValues = header.values[0].map((value) => String(value));
  for (const textHeader of ["ice", "detected_value"]) {
    const textColumn = headerValues.indexOf(textHeader);
    if (textColumn >= 0) {
      if (rowCount > 1) {
        const textRange = sheet.getRangeByIndexes(1, textColumn, rowCount - 1, 1);
        textRange.values.forEach(([value], rowIndex) => {
          const stringValue = value == null ? "" : String(value);
          if (/^\d{10,}$/.test(stringValue)) {
            sheet.getCell(rowIndex + 1, textColumn).format.numberFormat = "0".repeat(stringValue.length);
          }
        });
      }
    }
  }
  const statusColumn = headerValues.indexOf("status");
  if (statusColumn >= 0 && rowCount > 1) {
    const statuses = sheet.getRangeByIndexes(1, statusColumn, rowCount - 1, 1);
    statuses.dataValidation = { rule: { type: "list", values: ["approve", "review", "exclude"] } };
    statuses.conditionalFormats.add("containsText", { text: "approve", format: { fill: "#DCFCE7", font: { color: "#166534", bold: true } } });
    statuses.conditionalFormats.add("containsText", { text: "review", format: { fill: "#FEF3C7", font: { color: "#92400E", bold: true } } });
    statuses.conditionalFormats.add("containsText", { text: "exclude", format: { fill: "#FEE2E2", font: { color: "#991B1B", bold: true } } });
  }
  const confidenceColumn = headerValues.indexOf("confidence");
  if (confidenceColumn >= 0 && rowCount > 1) {
    const confidence = sheet.getRangeByIndexes(1, confidenceColumn, rowCount - 1, 1);
    confidence.conditionalFormats.add("containsText", { text: "medium", format: { fill: "#FEF3C7", font: { color: "#92400E" } } });
  }
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
for (const [sheetName] of inputs) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(previewDir, `${sheetName.toLowerCase()}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const inspection = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 5000,
  tableMaxRows: 5,
  tableMaxCols: 10,
  tableMaxCellChars: 100,
});
console.log(inspection.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, "import_review.xlsx"));
console.log(path.join(outputDir, "import_review.xlsx"));

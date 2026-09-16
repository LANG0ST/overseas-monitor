import { roundMoney, type LineItem } from "@/lib/db/document-calculations";

export type InvoiceReportRow = {
  number: string;
  date: string;
  client_name: string;
  client_ice: string | null;
  line_items: LineItem[];
  tva_rate: number;
  ht: number;
  tva: number;
  ttc: number;
  paid: boolean;
  paid_date: string | null;
};

type VatBucket = { base: number; tax: number };

function vatBreakdown(invoice: InvoiceReportRow) {
  const buckets = new Map<number, VatBucket>();
  for (const line of invoice.line_items ?? []) {
    const rate = Number(line.tva_rate ?? invoice.tva_rate);
    const base = roundMoney(Number(line.qty) * Number(line.unit_price));
    const bucket = buckets.get(rate) ?? { base: 0, tax: 0 };
    bucket.base = roundMoney(bucket.base + base);
    bucket.tax = roundMoney(bucket.tax + roundMoney((base * rate) / 100));
    buckets.set(rate, bucket);
  }

  const rates = [...buckets.keys()];
  const adjustmentRate = rates.length === 1 ? rates[0] : Number(invoice.tva_rate);
  const adjustment = buckets.get(adjustmentRate) ?? { base: 0, tax: 0 };
  const calculatedBase = [...buckets.values()].reduce((sum, bucket) => sum + bucket.base, 0);
  const calculatedTax = [...buckets.values()].reduce((sum, bucket) => sum + bucket.tax, 0);
  adjustment.base = roundMoney(adjustment.base + Number(invoice.ht) - calculatedBase);
  adjustment.tax = roundMoney(adjustment.tax + Number(invoice.tva) - calculatedTax);
  buckets.set(adjustmentRate, adjustment);
  return buckets;
}

export async function buildInvoiceReportXlsx(invoices: InvoiceReportRow[]) {
  const XLSX = await import("xlsx-js-style");
  const navy = "082F57";
  const lightBlue = "EAF2F8";
  const border = {
    top: { style: "thin", color: { rgb: "CBD5E1" } },
    bottom: { style: "thin", color: { rgb: "CBD5E1" } },
    left: { style: "thin", color: { rgb: "CBD5E1" } },
    right: { style: "thin", color: { rgb: "CBD5E1" } },
  };
  const headers = [
    "N° facture",
    "Date",
    "Client",
    "ICE",
    "Statut paiement",
    "Date de paiement",
    "HT TVA 0%",
    "TVA 0%",
    "HT TVA 10%",
    "TVA 10%",
    "HT TVA 20%",
    "TVA 20%",
    "Total HT",
    "Total TVA",
    "Total TTC",
  ];
  const data = invoices.map((invoice) => {
    const vat = vatBreakdown(invoice);
    return [
      invoice.number,
      invoice.date,
      invoice.client_name,
      invoice.client_ice ?? "",
      invoice.paid ? "Payée" : "Impayée",
      invoice.paid_date ?? "",
      vat.get(0)?.base ?? 0,
      vat.get(0)?.tax ?? 0,
      vat.get(10)?.base ?? 0,
      vat.get(10)?.tax ?? 0,
      vat.get(20)?.base ?? 0,
      vat.get(20)?.tax ?? 0,
      Number(invoice.ht),
      Number(invoice.tva),
      Number(invoice.ttc),
    ];
  });
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:O1");
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: navy } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border,
      };
    }
  }
  for (let row = 1; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (!cell) continue;
      cell.s = {
        fill: row % 2 === 0 ? { fgColor: { rgb: lightBlue } } : undefined,
        alignment: { vertical: "center", horizontal: column >= 6 ? "right" : "left" },
        border,
      };
      if (column >= 6) cell.z = '#,##0.00 "MAD"';
    }
  }
  worksheet["!cols"] = [
    { wch: 20 }, { wch: 12 }, { wch: 38 }, { wch: 19 }, { wch: 17 }, { wch: 17 },
    ...Array.from({ length: 9 }, () => ({ wch: 16 })),
  ];
  worksheet["!rows"] = [{ hpt: 32 }];
  worksheet["!autofilter"] = { ref: `A1:O${Math.max(1, invoices.length + 1)}` };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rapport factures");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

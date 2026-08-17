export type LineItem = {
  desc: string;
  unit: string;
  qty: number;
  unit_price: number;
  tva_rate?: number;
};

export type DocumentTotals = {
  ht: number;
  tva: number;
  ttc: number;
};

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validAmount(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`);
  }
  return value;
}

export function calculateTotals(lineItems: readonly LineItem[], tvaRate: number): DocumentTotals {
  if (!Array.isArray(lineItems)) throw new Error("Line items must be an array.");
  validAmount(tvaRate, "TVA rate");
  if (tvaRate > 100) throw new Error("TVA rate cannot exceed 100%.");

  const { ht, tva } = lineItems.reduce(
    (totals, lineItem, index) => {
      if (!lineItem || typeof lineItem !== "object") {
        throw new Error(`Line item ${index + 1} is invalid.`);
      }
      const qty = validAmount(lineItem.qty, `Line item ${index + 1} quantity`);
      const unitPrice = validAmount(lineItem.unit_price, `Line item ${index + 1} unit price`);
      const lineRate = validAmount(lineItem.tva_rate ?? tvaRate, `Line item ${index + 1} TVA rate`);
      if (lineRate > 100) throw new Error(`Line item ${index + 1} TVA rate cannot exceed 100%.`);
      const lineHt = roundMoney(qty * unitPrice);
      return { ht: totals.ht + lineHt, tva: totals.tva + roundMoney((lineHt * lineRate) / 100) };
    },
    { ht: 0, tva: 0 }
  );
  const roundedHt = roundMoney(ht);
  const roundedTva = roundMoney(tva);
  return { ht: roundedHt, tva: roundedTva, ttc: roundMoney(roundedHt + roundedTva) };
}

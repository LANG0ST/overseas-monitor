const units = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
];

function underHundred(value: number): string {
  if (value < 17) return units[value];
  if (value < 20) return `dix-${units[value - 10]}`;
  if (value < 70) {
    const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"][Math.floor(value / 10)];
    const remainder = value % 10;
    return remainder === 0 ? tens : remainder === 1 ? `${tens} et un` : `${tens}-${units[remainder]}`;
  }
  if (value < 80) {
    const remainder = value - 60;
    return remainder === 0 ? "soixante" : remainder === 11 ? "soixante et onze" : `soixante-${underHundred(remainder)}`;
  }
  const remainder = value - 80;
  return remainder === 0 ? "quatre-vingts" : `quatre-vingt-${underHundred(remainder)}`;
}

function underThousand(value: number): string {
  if (value < 100) return underHundred(value);
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const prefix = hundreds === 1 ? "cent" : `${units[hundreds]} cent${remainder === 0 ? "s" : ""}`;
  return remainder === 0 ? prefix : `${prefix} ${underHundred(remainder)}`;
}

export function numberToFrenchWords(value: number): string {
  const integer = Math.max(0, Math.floor(value));
  if (integer < 1000) return underThousand(integer);

  if (integer >= 1_000_000_000) {
    const billions = Math.floor(integer / 1_000_000_000);
    const remainder = integer % 1_000_000_000;
    const billionPart = billions === 1 ? "un milliard" : `${numberToFrenchWords(billions)} milliards`;
    return remainder === 0 ? billionPart : `${billionPart} ${numberToFrenchWords(remainder)}`;
  }

  if (integer >= 1_000_000) {
    const millions = Math.floor(integer / 1_000_000);
    const remainder = integer % 1_000_000;
    const millionPart = millions === 1 ? "un million" : `${numberToFrenchWords(millions)} millions`;
    return remainder === 0 ? millionPart : `${millionPart} ${numberToFrenchWords(remainder)}`;
  }

  const thousands = Math.floor(integer / 1000);
  const remainder = integer % 1000;
  const thousandPart = thousands === 1 ? "mille" : `${numberToFrenchWords(thousands)} mille`;
  return remainder === 0 ? thousandPart : `${thousandPart} ${underThousand(remainder)}`;
}

export function amountInFrenchWords(value: number): string {
  const rounded = Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);
  const integer = Math.floor(rounded);
  const centimes = Math.round((rounded - integer) * 100);
  const dirham = integer === 1 ? "dirham" : "dirhams";
  const centime = centimes === 1 ? "centime" : "centimes";
  const phrase = `Arrêté le présent facture à la somme de ${numberToFrenchWords(integer)} ${dirham} virgule ${numberToFrenchWords(centimes)} ${centime}`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export const resources = [
  "factures",
  "devis",
  "bons_commande",
  "avoirs",
  "pointage",
  "partenaires",
  "engins",
] as const;

export type Resource = (typeof resources)[number];

export const ENGIN_CATEGORIES = [
  "Manutention & Levage",
  "Grues",
  "Terrassement & Excavation",
  "Camions & Transport",
  "Misc",
] as const;

export type EnginCategory = (typeof ENGIN_CATEGORIES)[number];

export type CategorizedEngin = {
  id: string;
  name: string;
  category: string;
};

export function isEnginCategory(value: string): value is EnginCategory {
  return ENGIN_CATEGORIES.includes(value as EnginCategory);
}

export function enginsByCategory<T extends CategorizedEngin>(engins: readonly T[]) {
  return ENGIN_CATEGORIES.map((category) => ({
    category,
    engins: engins.filter((engin) => engin.category === category),
  })).filter((group) => group.engins.length > 0);
}

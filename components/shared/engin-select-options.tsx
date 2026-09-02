import { enginsByCategory, type CategorizedEngin } from "@/lib/engin-categories";

export function EnginSelectOptions<T extends CategorizedEngin>({
  engins,
  label,
}: {
  engins: readonly T[];
  label: (engin: T) => string;
}) {
  return enginsByCategory(engins).map((group) => (
    <optgroup key={group.category} label={group.category}>
      {group.engins.map((engin) => (
        <option key={engin.id} value={engin.id}>
          {label(engin)}
        </option>
      ))}
    </optgroup>
  ));
}

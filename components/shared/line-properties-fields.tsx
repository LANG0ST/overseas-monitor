import type { LineItem } from "@/lib/db/document-calculations";

export function LinePropertiesFields({
  line,
  locked,
  defaultTvaRate,
  unitOptions,
  onChange,
  onDelete,
}: {
  line: LineItem;
  locked: boolean;
  defaultTvaRate: number;
  unitOptions: readonly string[];
  onChange: (field: keyof LineItem, value: string) => void;
  onDelete: () => void;
}) {
  const selectedTvaRate = line.tva_rate ?? defaultTvaRate;
  const normalizedTvaRate =
    selectedTvaRate === 0 || selectedTvaRate === 10 || selectedTvaRate === 20
      ? selectedTvaRate
      : 20;

  return (
    <>
      <label className="block text-sm font-semibold text-neutral-900">
        Désignation
        <input
          className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
          disabled={locked}
          onChange={(event) => onChange("desc", event.target.value)}
          value={line.desc}
        />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="min-w-0 text-sm font-semibold text-neutral-900">
          Unité
          <select
            className="mt-1 min-w-0 w-full rounded-xl border border-neutral-300 bg-white px-2 py-2 text-sm"
            disabled={locked}
            onChange={(event) => onChange("unit", event.target.value)}
            value={line.unit}
          >
            {unitOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm font-semibold text-neutral-900">
          Nombre
          <input
            className="mt-1 min-w-0 w-full rounded-xl border border-neutral-300 bg-white px-2 py-2 text-sm"
            disabled={locked}
            min="0"
            onChange={(event) => onChange("qty", event.target.value)}
            type="number"
            value={line.qty}
          />
        </label>
        <label className="min-w-0 text-sm font-semibold text-neutral-900">
          P.U. HT
          <input
            className="mt-1 min-w-0 w-full rounded-xl border border-neutral-300 bg-white px-2 py-2 text-sm"
            disabled={locked}
            min="0"
            onChange={(event) => onChange("unit_price", event.target.value)}
            step="0.01"
            type="number"
            value={line.unit_price}
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-neutral-900">Période</legend>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-neutral-700">
            Du
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              disabled={locked}
              max={line.period_end || undefined}
              onChange={(event) => onChange("period_start", event.target.value)}
              type="date"
              value={line.period_start || ""}
            />
          </label>
          <label className="text-xs font-medium text-neutral-700">
            Au
            <input
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
              disabled={locked}
              min={line.period_start || undefined}
              onChange={(event) => onChange("period_end", event.target.value)}
              type="date"
              value={line.period_end || ""}
            />
          </label>
        </div>
      </fieldset>

      <label className="block text-sm font-semibold text-neutral-900">
        TVA (%)
        <select
          className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
          disabled={locked}
          onChange={(event) => onChange("tva_rate", event.target.value)}
          value={String(normalizedTvaRate)}
        >
          <option value="20">20%</option>
          <option value="10">10%</option>
          <option value="0">0%</option>
        </select>
      </label>

      <button
        className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900"
        disabled={locked}
        onClick={onDelete}
        type="button"
      >
        Supprimer cette ligne
      </button>
    </>
  );
}

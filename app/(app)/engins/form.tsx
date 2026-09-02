import { ConfirmedForm } from "@/components/shared/confirmed-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { ENGIN_CATEGORIES } from "@/lib/engin-categories";

type EnginFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  engin?: {
    name: string;
    category: string;
    unit: string;
    default_price: number;
    note: string | null;
  };
  error?: string;
};

export function EnginForm({
  action,
  submitLabel,
  engin,
  error,
}: EnginFormProps) {
  return (
    <ConfirmedForm
      action={action}
      className="glass-card max-w-2xl space-y-5 rounded-3xl p-6 md:p-8"
      confirmationTitle={`${submitLabel} ?`}
      confirmationDescription="Les informations de cet engin seront enregistrées."
      confirmationLabel={submitLabel}
    >
      {error === "name" ? (
        <p className="text-sm text-destructive">Le nom est obligatoire.</p>
      ) : null}
      {error === "duplicate" ? (
        <p className="text-sm text-destructive">
          Un engin actif porte déjà ce nom.
        </p>
      ) : null}
      {error === "category" ? (
        <p className="text-sm text-destructive">Choisissez une catégorie valide.</p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Nom
          <input
            className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2.5"
            name="name"
            defaultValue={engin?.name}
            required
          />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Catégorie
          <select
            className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2.5"
            name="category"
            defaultValue={engin?.category ?? "Misc"}
            required
          >
            {ENGIN_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Unité
          <select
            className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2.5"
            name="unit"
            defaultValue={engin?.unit ?? "Jour"}
          >
            <option>Jour</option>
            <option>Mois</option>
            <option>Heure</option>
            <option>Fois</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Prix par défaut
          <input
            className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2.5"
            min="0"
            name="default_price"
            step="0.01"
            type="number"
            defaultValue={engin?.default_price ?? 0}
          />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Note
          <textarea
            className="mt-1 min-h-24 w-full rounded-xl border bg-white/70 px-3 py-2.5"
            name="note"
            defaultValue={engin?.note ?? ""}
          />
        </label>
      </div>
      <SubmitButton className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white">
        {submitLabel}
      </SubmitButton>
    </ConfirmedForm>
  );
}

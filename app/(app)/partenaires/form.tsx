import { SubmitButton } from "@/components/shared/submit-button";

type PartenaireFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  partenaire?: {
    name: string;
    ice: string | null;
    address: string | null;
    representative: string | null;
    phone: string | null;
  };
  error?: string;
};

export function PartenaireForm({
  action,
  submitLabel,
  partenaire,
  error,
}: PartenaireFormProps) {
  return (
    <form
      action={action}
      encType="multipart/form-data"
      className="glass-card max-w-2xl space-y-5 rounded-3xl p-6 md:p-8"
    >
      {error === "name" ? (
        <p className="text-sm text-destructive">Le nom est obligatoire.</p>
      ) : null}
      {error === "duplicate" ? (
        <p className="text-sm text-destructive">
          Un partenaire actif porte déjà ce nom.
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Raison sociale
          <input
            className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2.5"
            name="name"
            defaultValue={partenaire?.name}
            required
          />
        </label>
        <label className="text-sm font-medium">
          ICE
          <input
            className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2.5"
            name="ice"
            defaultValue={partenaire?.ice ?? ""}
          />
        </label>
        <label className="text-sm font-medium">
          Téléphone
          <input
            className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2.5"
            name="phone"
            defaultValue={partenaire?.phone ?? ""}
          />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Adresse
          <textarea
            className="mt-1 min-h-24 w-full rounded-xl border bg-white/70 px-3 py-2.5"
            name="address"
            defaultValue={partenaire?.address ?? ""}
          />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Représentant
          <input
            className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2.5"
            name="representative"
            defaultValue={partenaire?.representative ?? ""}
          />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Logo
          <input
            className="mt-1 block w-full rounded-xl border bg-white/70 px-3 py-2.5 text-sm"
            name="logo"
            type="file"
            accept="image/*"
          />
        </label>
      </div>
      <SubmitButton className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

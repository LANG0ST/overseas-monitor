import Link from "next/link";
import { DevisCreateForm } from "@/components/shared/devis-create-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewDevisPage() {
  const supabase = await createClient();
  const { data: partners, error } = await supabase
    .from("partenaires")
    .select("id, name, ice, address")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm font-medium text-primary-700" href="/devis">← Devis</Link>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-900">Nouveau devis</h1>
        <p className="mt-2 text-neutral-700">Commencez par choisir le client ou saisir ses coordonnées.</p>
      </div>
      <DevisCreateForm partners={partners ?? []} />
    </div>
  );
}

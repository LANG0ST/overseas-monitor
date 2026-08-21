import Link from "next/link";
import { BonCommandeCreateForm } from "@/components/shared/bon-commande-create-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewBonCommandePage() {
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
        <Link className="text-sm font-medium text-primary-700" href="/bons-commande">
          ← Bons de commande
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-900">
          Nouveau bon de commande
        </h1>
        <p className="mt-2 text-neutral-700">
          Choisissez le fournisseur ou saisissez ses coordonnées.
        </p>
      </div>
      <BonCommandeCreateForm partners={partners ?? []} />
    </div>
  );
}

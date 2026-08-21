import Link from "next/link";
import { InvoiceCreateForm } from "@/components/shared/invoice-create-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewFacturePage() {
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
        <Link className="text-sm font-medium text-primary-700" href="/factures">
          ← Factures
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-900">
          Nouvelle facture
        </h1>
        <p className="mt-2 text-neutral-700">
          Commencez par choisir le client ou saisir ses coordonnées.
        </p>
      </div>
      <InvoiceCreateForm partners={partners ?? []} />
    </div>
  );
}

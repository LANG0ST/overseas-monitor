import { notFound } from "next/navigation";
import { InvoiceEditor } from "@/components/shared/invoice-editor";
import { getAccessContext } from "@/lib/auth/can-edit";
import { createClient } from "@/lib/supabase/server";

export default async function FacturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { userId, isAdmin } = await getAccessContext();
  if (!userId) notFound();
  const [
    { data: document, error: documentError },
    { data: engins, error: enginsError },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, type, number, date, city, has_cachet, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, paid, is_active, is_locked, source_pointage_sheet_id",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("engins")
      .select("id, name, category, unit, default_price")
      .eq("is_active", true)
      .order("category")
      .order("name"),
  ]);
  if (documentError) throw new Error(documentError.message);
  if (enginsError) throw new Error(enginsError.message);
  if (!document || document.type !== "facture") notFound();

  return (
    <InvoiceEditor
      initialDocument={document}
      isAdmin={isAdmin}
      engins={engins ?? []}
    />
  );
}

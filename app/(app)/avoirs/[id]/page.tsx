import { notFound } from "next/navigation";
import { AvoirEditor } from "@/components/shared/avoir-editor";
import { createClient } from "@/lib/supabase/server";

export default async function AvoirDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) notFound();

  const [
    { data: document, error: documentError },
    { data: profile, error: profileError },
    { data: engins, error: enginsError },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, type, number, date, city, has_cachet, partenaire_id, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked, motif, reference_facture_number, avoir_payment_method, avoir_payment_reference",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("engins")
      .select("id, name, unit, default_price")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (documentError) throw new Error(documentError.message);
  if (profileError) throw new Error(profileError.message);
  if (enginsError) throw new Error(enginsError.message);
  if (!document || document.type !== "avoir") notFound();

  return (
    <AvoirEditor
      engins={engins ?? []}
      initialDocument={document}
      isAdmin={profile?.role === "admin"}
    />
  );
}

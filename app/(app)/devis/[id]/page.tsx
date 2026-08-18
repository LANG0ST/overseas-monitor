import { notFound } from "next/navigation";
import { DevisEditor } from "@/components/shared/devis-editor";
import { createClient } from "@/lib/supabase/server";

export default async function DevisDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) notFound();
  const [{ data: document, error: documentError }, { data: profile, error: profileError }, { data: engins, error: enginsError }] = await Promise.all([
    supabase.from("documents").select("id, type, number, date, city, has_cachet, partenaire_id, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, is_active, is_locked, validity_days, chantier, period_start, period_end, devis_fuel_driver, devis_payment_conditions, devis_bank_name, devis_iban").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase.from("engins").select("id, name, unit, default_price").eq("is_active", true).order("name"),
  ]);
  if (documentError) throw new Error(documentError.message);
  if (profileError) throw new Error(profileError.message);
  if (enginsError) throw new Error(enginsError.message);
  if (!document || document.type !== "devis") notFound();
  return <DevisEditor initialDocument={document} isAdmin={profile?.role === "admin"} engins={engins ?? []} />;
}

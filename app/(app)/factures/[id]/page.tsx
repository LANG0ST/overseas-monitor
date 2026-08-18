import { notFound } from "next/navigation";
import { InvoiceEditor } from "@/components/shared/invoice-editor";
import { createClient } from "@/lib/supabase/server";

export default async function FacturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) notFound();
  const [{ data: document, error: documentError }, { data: profile, error: profileError }, { data: engins, error: enginsError }] = await Promise.all([
    supabase.from("documents").select("id, type, number, date, city, has_cachet, client_name, client_ice, client_address, line_items, tva_rate, ht, tva, ttc, paid, is_locked").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase.from("engins").select("id, name, unit, default_price").eq("is_active", true).order("name"),
  ]);
  if (documentError) throw new Error(documentError.message);
  if (profileError) throw new Error(profileError.message);
  if (enginsError) throw new Error(enginsError.message);
  if (!document || document.type !== "facture") notFound();

  return <InvoiceEditor initialDocument={document} isAdmin={profile?.role === "admin"} engins={engins ?? []} />;
}

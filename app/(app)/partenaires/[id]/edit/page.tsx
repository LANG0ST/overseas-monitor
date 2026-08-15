import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PartenaireForm } from "../../form";
import { updatePartenaire } from "../../actions";
import { canEdit } from "@/lib/auth/can-edit";
import { createClient } from "@/lib/supabase/server";

export default async function EditPartenairePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  if (!(await canEdit("partenaires"))) redirect("/partenaires");
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: partenaire } = await supabase.from("partenaires").select("name, ice, address, representative, phone").eq("id", id).maybeSingle();
  if (!partenaire) notFound();
  return <div className="space-y-6"><div><Link className="text-sm text-primary-600" href="/partenaires">← Partenaires</Link><h1 className="mt-3 text-3xl font-semibold">Modifier le partenaire</h1></div><PartenaireForm action={updatePartenaire.bind(null, id)} error={error} partenaire={partenaire} submitLabel="Enregistrer" /></div>;
}

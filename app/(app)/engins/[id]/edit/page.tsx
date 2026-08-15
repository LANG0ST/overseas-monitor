import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EnginForm } from "../../form";
import { updateEngin } from "../../actions";
import { canEdit } from "@/lib/auth/can-edit";
import { createClient } from "@/lib/supabase/server";

export default async function EditEnginPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  if (!(await canEdit("engins"))) redirect("/engins");
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: engin } = await supabase.from("engins").select("name, unit, default_price, note").eq("id", id).maybeSingle();
  if (!engin) notFound();
  return <div className="space-y-6"><div><Link className="text-sm text-primary-600" href="/engins">← Parc d’engins</Link><h1 className="mt-3 text-3xl font-semibold">Modifier l’engin</h1></div><EnginForm action={updateEngin.bind(null, id)} error={error} engin={engin} submitLabel="Enregistrer" /></div>;
}

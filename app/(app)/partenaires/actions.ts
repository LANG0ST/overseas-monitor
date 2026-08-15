"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit } from "@/lib/auth/can-edit";
import { createClient } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/supabase/storage";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireEdit() {
  if (!(await canEdit("partenaires"))) redirect("/partenaires?error=forbidden");
}

async function nameExists(supabase: Awaited<ReturnType<typeof createClient>>, name: string, id?: string) {
  let query = supabase.from("partenaires").select("id").eq("name", name).eq("is_active", true).limit(1);
  if (id) query = query.neq("id", id);
  const { data } = await query;
  return Boolean(data?.length);
}

export async function createPartenaire(formData: FormData) {
  await requireEdit();
  const name = text(formData, "name");
  if (!name) redirect("/partenaires/new?error=name");

  const supabase = await createClient();
  if (await nameExists(supabase, name)) redirect("/partenaires/new?error=duplicate");
  const logoPath = await uploadImage(supabase, "partenaire-logos", formData.get("logo"));
  const { error } = await supabase.from("partenaires").insert({
    name,
    ice: text(formData, "ice") || null,
    address: text(formData, "address") || null,
    representative: text(formData, "representative") || null,
    phone: text(formData, "phone") || null,
    logo_url: logoPath,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/partenaires");
  redirect("/partenaires");
}

export async function updatePartenaire(id: string, formData: FormData) {
  await requireEdit();
  const name = text(formData, "name");
  if (!name) redirect(`/partenaires/${id}/edit?error=name`);

  const supabase = await createClient();
  if (await nameExists(supabase, name, id)) redirect(`/partenaires/${id}/edit?error=duplicate`);
  const logoPath = await uploadImage(supabase, "partenaire-logos", formData.get("logo"));
  const updates: Record<string, string | null> = {
    name,
    ice: text(formData, "ice") || null,
    address: text(formData, "address") || null,
    representative: text(formData, "representative") || null,
    phone: text(formData, "phone") || null,
  };
  if (logoPath) updates.logo_url = logoPath;

  const { error } = await supabase.from("partenaires").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/partenaires");
  redirect("/partenaires");
}

export async function setPartenaireActive(id: string, isActive: boolean, destination = "/partenaires") {
  await requireEdit();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partenaires")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) redirect(`${destination}${destination.includes("?") ? "&" : "?"}error=soft-delete`);
  revalidatePath("/partenaires");
  redirect(destination);
}

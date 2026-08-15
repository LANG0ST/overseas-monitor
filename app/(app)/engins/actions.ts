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
  if (!(await canEdit("engins"))) redirect("/engins?error=forbidden");
}

async function nameExists(supabase: Awaited<ReturnType<typeof createClient>>, name: string, id?: string) {
  let query = supabase.from("engins").select("id").eq("name", name).eq("is_active", true).limit(1);
  if (id) query = query.neq("id", id);
  const { data } = await query;
  return Boolean(data?.length);
}

function price(formData: FormData) {
  const value = Number(text(formData, "default_price"));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export async function createEngin(formData: FormData) {
  await requireEdit();
  const name = text(formData, "name");
  if (!name) redirect("/engins/new?error=name");

  const supabase = await createClient();
  if (await nameExists(supabase, name)) redirect("/engins/new?error=duplicate");
  const photoPath = await uploadImage(supabase, "engin-photos", formData.get("photo"));
  const { error } = await supabase.from("engins").insert({
    name,
    unit: text(formData, "unit") || "Jour",
    default_price: price(formData),
    note: text(formData, "note") || null,
    photo_url: photoPath,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/engins");
  redirect("/engins");
}

export async function updateEngin(id: string, formData: FormData) {
  await requireEdit();
  const name = text(formData, "name");
  if (!name) redirect(`/engins/${id}/edit?error=name`);

  const supabase = await createClient();
  if (await nameExists(supabase, name, id)) redirect(`/engins/${id}/edit?error=duplicate`);
  const photoPath = await uploadImage(supabase, "engin-photos", formData.get("photo"));
  const updates: Record<string, string | number | null> = {
    name,
    unit: text(formData, "unit") || "Jour",
    default_price: price(formData),
    note: text(formData, "note") || null,
  };
  if (photoPath) updates.photo_url = photoPath;

  const { error } = await supabase.from("engins").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/engins");
  redirect("/engins");
}

export async function setEnginActive(id: string, isActive: boolean, destination = "/engins") {
  await requireEdit();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engins")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) redirect(`${destination}${destination.includes("?") ? "&" : "?"}error=soft-delete`);
  revalidatePath("/engins");
  redirect(destination);
}

"use server";

import { revalidatePath } from "next/cache";
import { resources, type Resource } from "@/lib/auth/resources";
import { createClient } from "@/lib/supabase/server";

export type PermissionUpdateResult =
  | { ok: true; canEdit: boolean }
  | { ok: false; error: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updatePermissionAction(input: {
  userId: string;
  resource: Resource;
  canEdit: boolean;
}): Promise<PermissionUpdateResult> {
  if (
    !input ||
    !uuidPattern.test(input.userId) ||
    !resources.includes(input.resource) ||
    typeof input.canEdit !== "boolean"
  ) {
    return { ok: false, error: "Permission invalide." };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const adminId = claimsData?.claims?.sub;
  if (claimsError || !adminId) {
    return { ok: false, error: "Vous devez être connecté." };
  }

  const { data: admin, error: adminError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", adminId)
    .maybeSingle();
  if (adminError || !admin || admin.role !== "admin" || !admin.is_active) {
    return { ok: false, error: "Cette action est réservée aux administrateurs." };
  }

  const { data: staff, error: staffError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", input.userId)
    .eq("role", "staff")
    .maybeSingle();
  if (staffError || !staff) {
    return { ok: false, error: "Utilisateur introuvable." };
  }

  const { error } = await supabase.from("permissions").upsert(
    {
      user_id: input.userId,
      resource: input.resource,
      can_edit: input.canEdit,
    },
    { onConflict: "user_id,resource" },
  );
  if (error) {
    return { ok: false, error: "La permission n’a pas pu être enregistrée." };
  }

  revalidatePath("/permissions");
  return { ok: true, canEdit: input.canEdit };
}

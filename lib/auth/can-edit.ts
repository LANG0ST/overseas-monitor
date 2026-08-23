import "server-only";

import { forbidden } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resources, type Resource } from "@/lib/auth/resources";

export { resources, type Resource } from "@/lib/auth/resources";

export async function canEdit(resource: Resource) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_edit_resource", {
    p_resource: resource,
  });

  return !error && data === true;
}

export async function getAccessibleResources(): Promise<Resource[]> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return [];

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile?.is_active) return [];
  if (profile.role === "admin") return [...resources];

  const { data: permissions, error } = await supabase
    .from("permissions")
    .select("resource")
    .eq("user_id", userId)
    .eq("can_edit", true);
  if (error) return [];

  const allowed = new Set(
    (permissions ?? [])
      .map((permission) => permission.resource)
      .filter((resource): resource is Resource => resources.includes(resource as Resource)),
  );
  return resources.filter((resource) => allowed.has(resource));
}

export async function requireModuleAccess(resource: Resource) {
  if (!(await canEdit(resource))) forbidden();
}

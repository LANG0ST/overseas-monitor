import "server-only";

import { cache } from "react";
import { forbidden } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resources, type Resource } from "@/lib/auth/resources";

export { resources, type Resource } from "@/lib/auth/resources";

export const getAccessContext = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub;
  if (!userId) {
    return {
      userId: null,
      name: "Utilisateur",
      isAdmin: false,
      isActive: false,
      allowedResources: [] as Resource[],
      userMetadata: undefined as Record<string, unknown> | undefined,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("name, role, is_active")
    .eq("id", userId)
    .maybeSingle();
  const isActive = !profileError && Boolean(profile?.is_active);
  const isAdmin = isActive && profile?.role === "admin";
  let allowedResources: Resource[] = [];

  if (isAdmin) {
    allowedResources = [...resources];
  } else if (isActive) {
    const { data: permissions, error } = await supabase
      .from("permissions")
      .select("resource")
      .eq("user_id", userId)
      .eq("can_edit", true);
    if (!error) {
      const allowed = new Set(
        (permissions ?? [])
          .map((permission) => permission.resource)
          .filter((resource): resource is Resource => resources.includes(resource as Resource)),
      );
      allowedResources = resources.filter((resource) => allowed.has(resource));
    }
  }

  return {
    userId,
    name: profile?.name || "Utilisateur",
    isAdmin,
    isActive,
    allowedResources,
    userMetadata: claims.user_metadata as Record<string, unknown> | undefined,
  };
});

export async function canEdit(resource: Resource) {
  const context = await getAccessContext();
  return context.allowedResources.includes(resource);
}

export async function getAccessibleResources(): Promise<Resource[]> {
  return (await getAccessContext()).allowedResources;
}

export async function requireModuleAccess(resource: Resource) {
  if (!(await canEdit(resource))) forbidden();
}

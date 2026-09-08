import { forbidden, notFound } from "next/navigation";
import { PermissionsMatrix, type PermissionStaffRow } from "@/components/shared/permissions-matrix";
import { getAccessContext } from "@/lib/auth/can-edit";
import { resources, type Resource } from "@/lib/auth/resources";
import { createClient } from "@/lib/supabase/server";

export default async function PermissionsPage() {
  const supabase = await createClient();
  const { userId, isActive, isAdmin } = await getAccessContext();
  if (!userId) notFound();
  if (!isActive) notFound();
  if (!isAdmin) forbidden();

  const { data: staff, error: staffError } = await supabase
    .from("profiles")
    .select("id, name, is_active")
    .eq("role", "staff")
    .order("name");
  if (staffError) throw new Error(staffError.message);

  const staffIds = (staff ?? []).map((profile) => profile.id);
  let permissionRows: { user_id: string; resource: string; can_edit: boolean }[] = [];
  if (staffIds.length > 0) {
    const { data, error } = await supabase
      .from("permissions")
      .select("user_id, resource, can_edit")
      .in("user_id", staffIds);
    if (error) throw new Error(error.message);
    permissionRows = data ?? [];
  }

  const rows: PermissionStaffRow[] = (staff ?? []).map((profile) => {
    const permissions = Object.fromEntries(resources.map((resource) => [resource, false])) as Record<Resource, boolean>;
    for (const permission of permissionRows) {
      if (permission.user_id === profile.id && resources.includes(permission.resource as Resource)) {
        permissions[permission.resource as Resource] = permission.can_edit;
      }
    }
    return {
      id: profile.id,
      name: profile.name.trim() || "Utilisateur sans nom",
      isActive: profile.is_active,
      permissions,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-neutral-600">Administration des accès</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">Permissions</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
          Choisissez librement les modules que chaque utilisateur staff peut modifier. Les administrateurs conservent toujours tous les accès.
        </p>
      </div>
      <PermissionsMatrix initialRows={rows} />
    </div>
  );
}

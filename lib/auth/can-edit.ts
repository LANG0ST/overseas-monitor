import { createClient } from "@/lib/supabase/server";

export const resources = [
  "factures",
  "devis",
  "bons_commande",
  "avoirs",
  "pointage",
  "partenaires",
  "engins",
] as const;

export type Resource = (typeof resources)[number];

export async function canEdit(resource: Resource) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_edit_resource", {
    p_resource: resource,
  });

  return !error && data === true;
}

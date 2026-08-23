import { requireModuleAccess } from "@/lib/auth/can-edit";

export default async function BonsCommandeLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("bons_commande");
  return children;
}

import { requireModuleAccess } from "@/lib/auth/can-edit";

export default async function DevisLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("devis");
  return children;
}

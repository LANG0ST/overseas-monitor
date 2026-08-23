import { requireModuleAccess } from "@/lib/auth/can-edit";

export default async function PartenairesLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("partenaires");
  return children;
}
